const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const UserSession = require('../models/UserSession');
const LoginHistory = require('../models/LoginHistory');
const User = require('../models/User');
const securityConfigService = require('./securityConfigService');
const auditService = require('./auditService');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/** Life of the office desktop's sync login, restarted on every sync. */
const DEVICE_SYNC_DAYS = 365;

function clientMeta(req = {}) {
  return {
    ip: req.ip || req.headers?.['x-forwarded-for'] || '',
    userAgent: req.headers?.['user-agent'] || '',
    deviceId: req.body?.deviceId || req.headers?.['x-device-id'] || '',
    deviceFingerprint: req.body?.deviceFingerprint || req.headers?.['x-device-fingerprint'] || '',
    deviceName: req.body?.deviceName || 'Unknown device',
    rememberDevice: !!req.body?.rememberDevice,
  };
}

/**
 * Stage 7.2 — Session + refresh token management.
 * Extends existing JWT auth; does not replace generateToken consumers.
 */
class SessionService {
  accessTtl(cfg) {
    return process.env.JWT_ACCESS_EXPIRES || cfg?.session?.accessTokenTtl || '8h';
  }

  refreshDays(cfg) {
    return Number(process.env.JWT_REFRESH_DAYS || cfg?.session?.refreshTokenTtlDays || 30);
  }

  signAccess(user, sessionId, { syncOnly = false } = {}) {
    return jwt.sign(
      {
        id: user._id,
        role: user.role,
        companyId: user.companyId,
        sid: sessionId,
        typ: 'access',
        ...(syncOnly ? { scp: 'sync' } : {}),
      },
      process.env.JWT_SECRET,
      { expiresIn: this.accessTtl() }
    );
  }

  /**
   * @param {object} opts  kind: 'device-sync' for the office desktop's sync login (see UserSession.kind)
   */
  async createSession(user, req = {}, opts = {}) {
    const cfg = await securityConfigService.getOrCreate(user.companyId);
    const meta = clientMeta(req);
    const sessionId = crypto.randomBytes(24).toString('hex');
    const refreshRaw = crypto.randomBytes(48).toString('hex');
    const deviceSync = opts.kind === 'device-sync';
    const days = deviceSync ? DEVICE_SYNC_DAYS : this.refreshDays(cfg);
    const expiresAt = new Date(Date.now() + days * 24 * 3600 * 1000);

    if (deviceSync) {
      // Re-connecting the same PC replaces its earlier sync login; nothing else is touched.
      await UserSession.updateMany(
        { userId: user._id, kind: 'device-sync', deviceId: meta.deviceId || '', status: 'active' },
        { status: 'revoked', revokedAt: new Date(), revokeReason: 'device_reconnected' }
      );
      const session = await UserSession.create({
        companyId: user.companyId || null,
        userId: user._id,
        sessionId,
        refreshTokenHash: hashToken(refreshRaw),
        deviceId: meta.deviceId,
        deviceName: meta.deviceName,
        deviceFingerprint: meta.deviceFingerprint,
        trusted: true,
        rememberDevice: true,
        ip: meta.ip,
        userAgent: meta.userAgent,
        kind: 'device-sync',
        expiresAt,
        lastActiveAt: new Date(),
        status: 'active',
      });
      const accessToken = this.signAccess(user, sessionId, { syncOnly: true });
      return { session, accessToken, refreshToken: refreshRaw, expiresAt };
    }

    // Single active session policy.
    // A single-device licence implies a single session: allowing two live
    // sessions on a one-computer licence would defeat the binding, so the
    // licence cap forces the policy on regardless of the stored security
    // config (which defaults to false for historical companies).
    let singleSession = !!cfg.session?.singleActiveSession;
    if (!singleSession && user.companyId) {
      try {
        const License = require('../models/License');
        const licence = await License.findOne({ companyId: user.companyId, isActive: true })
          .select('maxDevices')
          .sort({ createdAt: -1 })
          .lean();
        if (licence && (licence.maxDevices ?? 1) === 1) singleSession = true;
      } catch {
        /* fall back to the configured policy */
      }
    }

    // The office desktop's sync login is not a person at a screen: it is neither ended by nor
    // counted against these limits.
    if (singleSession) {
      await UserSession.updateMany(
        { userId: user._id, status: 'active', kind: { $ne: 'device-sync' } },
        { status: 'forced', revokedAt: new Date(), revokeReason: 'single_session_policy' }
      );
    } else {
      const max = cfg.session?.maxSessions || 5;
      const active = await UserSession.find({ userId: user._id, status: 'active', kind: { $ne: 'device-sync' } })
        .sort({ lastActiveAt: 1 });
      if (active.length >= max) {
        const overflow = active.slice(0, active.length - max + 1);
        for (const s of overflow) {
          s.status = 'forced';
          s.revokedAt = new Date();
          s.revokeReason = 'max_sessions';
          await s.save();
        }
      }
    }

    const session = await UserSession.create({
      companyId: user.companyId || null,
      userId: user._id,
      sessionId,
      refreshTokenHash: hashToken(refreshRaw),
      deviceId: meta.deviceId,
      deviceName: meta.deviceName,
      deviceFingerprint: meta.deviceFingerprint,
      trusted: !!meta.rememberDevice,
      rememberDevice: !!meta.rememberDevice,
      ip: meta.ip,
      userAgent: meta.userAgent,
      expiresAt,
      lastActiveAt: new Date(),
      status: 'active',
    });

    const accessToken = this.signAccess(user, sessionId);
    return { session, accessToken, refreshToken: refreshRaw, expiresAt };
  }

  async recordLogin(user, event, req = {}, extra = {}) {
    const meta = clientMeta(req);
    await LoginHistory.create({
      companyId: user?.companyId || null,
      userId: user?._id || null,
      email: user?.email || req.body?.email || '',
      event,
      ip: meta.ip,
      userAgent: meta.userAgent,
      deviceId: meta.deviceId,
      deviceFingerprint: meta.deviceFingerprint,
      sessionId: extra.sessionId || '',
      success: extra.success !== false,
      reason: extra.reason || '',
      meta: extra.meta || {},
    });
  }

  async refresh(refreshToken, req = {}) {
    if (!refreshToken) throw AppError.unauthorized('Refresh token required');
    const hash = hashToken(refreshToken);
    const session = await UserSession.findOne({ refreshTokenHash: hash, status: 'active' }).select('+refreshTokenHash');
    if (!session) throw AppError.unauthorized('Invalid or revoked refresh token');
    if (session.expiresAt < new Date()) {
      session.status = 'expired';
      await session.save();
      throw AppError.unauthorized('Session expired');
    }

    const user = await User.findById(session.userId);
    if (!user || !user.isActive) throw AppError.unauthorized('User inactive');

    const cfg = await securityConfigService.getOrCreate(user.companyId);
    const deviceSync = session.kind === 'device-sync';
    // Idle timeout — not for the desktop's sync login, which is idle whenever the PC is offline.
    const idleMin = cfg.session?.idleTimeoutMinutes || 60;
    if (!deviceSync && session.lastActiveAt && Date.now() - new Date(session.lastActiveAt).getTime() > idleMin * 60 * 1000) {
      session.status = 'expired';
      session.revokeReason = 'idle_timeout';
      await session.save();
      throw AppError.unauthorized('Session idle timeout');
    }

    // Rotate refresh token
    const newRefresh = crypto.randomBytes(48).toString('hex');
    if (cfg.security?.requireRefreshRotation !== false) {
      session.refreshTokenHash = hashToken(newRefresh);
    }
    session.lastActiveAt = new Date();
    // A desktop that keeps syncing keeps its login: the year starts again from today.
    if (deviceSync) session.expiresAt = new Date(Date.now() + DEVICE_SYNC_DAYS * 24 * 3600 * 1000);
    const meta = clientMeta(req);
    if (meta.ip) session.ip = meta.ip;
    await session.save();

    const companyGroupService = require('./companyGroupService');
    const scope = await companyGroupService.resolveAccess(user, session.activeCompanyId || user.companyId);
    const accessToken = jwt.sign(
      {
        id: user._id,
        role: user.role,
        companyId: scope.companyId,
        masterCompanyId: scope.masterCompanyId,
        sid: session.sessionId,
        typ: 'access',
        ...(deviceSync ? { scp: 'sync' } : {}),
      },
      process.env.JWT_SECRET,
      { expiresIn: this.accessTtl() }
    );
    await this.recordLogin(user, 'refresh', req, { sessionId: session.sessionId, success: true });

    return {
      token: accessToken,
      refreshToken: cfg.security?.requireRefreshRotation !== false ? newRefresh : refreshToken,
      sessionId: session.sessionId,
    };
  }

  async touch(sessionId) {
    if (!sessionId) return;
    await UserSession.updateOne(
      { sessionId, status: 'active' },
      { lastActiveAt: new Date() }
    );
  }

  async isSessionValid(sessionId) {
    if (!sessionId) return true; // legacy tokens without sid
    const s = await UserSession.findOne({ sessionId }).lean();
    if (!s) return false;
    return s.status === 'active' && s.expiresAt > new Date();
  }

  async listSessions(userId) {
    return UserSession.find({ userId, status: 'active' })
      .select('-refreshTokenHash')
      .sort({ lastActiveAt: -1 });
  }

  async revokeSession(userId, sessionId, reason = 'logout') {
    const s = await UserSession.findOne({ userId, sessionId, status: 'active' });
    if (!s) return null;
    s.status = 'revoked';
    s.revokedAt = new Date();
    s.revokeReason = reason;
    await s.save();
    return s;
  }

  async revokeAll(userId, exceptSessionId = null, reason = 'logout_all') {
    const filter = { userId, status: 'active' };
    if (exceptSessionId) filter.sessionId = { $ne: exceptSessionId };
    const result = await UserSession.updateMany(filter, {
      status: 'forced',
      revokedAt: new Date(),
      revokeReason: reason,
    });
    return { revoked: result.modifiedCount || 0 };
  }

  async forceLogout(userId, actorId, companyId) {
    const result = await this.revokeAll(userId, null, 'force_logout');
    await auditService.logSystem({
      companyId,
      userId: actorId,
      action: 'session.force_logout',
      module: 'infrastructure',
      after: { targetUserId: userId, ...result },
    });
    return result;
  }

  async loginHistory(userId, { limit = 50 } = {}) {
    return LoginHistory.find({ userId }).sort({ createdAt: -1 }).limit(Math.min(limit, 200));
  }

  async trustDevice(userId, sessionId) {
    return UserSession.findOneAndUpdate(
      { userId, sessionId },
      { trusted: true, rememberDevice: true },
      { new: true }
    );
  }

  async detectSuspicious(user, req = {}) {
    const meta = clientMeta(req);
    if (!meta.ip && !meta.deviceFingerprint) return { suspicious: false };
    const recent = await LoginHistory.find({
      userId: user._id,
      event: 'login_success',
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    if (!recent.length) return { suspicious: false };
    const knownIps = new Set(recent.map((r) => r.ip).filter(Boolean));
    const knownFp = new Set(recent.map((r) => r.deviceFingerprint).filter(Boolean));
    const newIp = meta.ip && knownIps.size && !knownIps.has(meta.ip);
    const newDevice = meta.deviceFingerprint && knownFp.size && !knownFp.has(meta.deviceFingerprint);
    if (newIp || newDevice) {
      logger.warn('suspicious.login', { userId: String(user._id), ip: meta.ip, newIp, newDevice });
      await this.recordLogin(user, 'suspicious', req, {
        success: true,
        reason: newIp ? 'new_ip' : 'new_device',
      });
      return { suspicious: true, reasons: [newIp && 'new_ip', newDevice && 'new_device'].filter(Boolean) };
    }
    return { suspicious: false };
  }
}

module.exports = new SessionService();
