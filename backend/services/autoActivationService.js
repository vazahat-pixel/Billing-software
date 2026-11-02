'use strict';

/**
 * Desktop hybrid: auto-provision this local database from cloud credentials.
 * Called once per machine (first run). Subsequent logins use the local DB directly.
 *
 * Flow:
 *  1. Verify email+password against the CENTRAL cloud API.
 *  2. Pull Company + CompanySettings + user record from cloud.
 *  3. Create them in the local MongoDB.
 *  4. Return a local JWT session.
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const mongoose = require('mongoose');

const User = require('../models/User');
const Company = require('../models/Company');
const CompanySettings = require('../models/CompanySettings');
const AppError = require('../utils/AppError');

const centralUrl = () =>
  (process.env.CENTRAL_API_BASE_URL || 'https://app.dealingindia.com/api').replace(/\/$/, '');

/** Minimal promise-based fetch using built-in http/https (no axios dep needed at boot). */
function cloudFetch(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const base = centralUrl();
    const fullUrl = `${base}${path}`;
    const u = new URL(fullUrl);
    const lib = u.protocol === 'https:' ? https : http;
    const body = opts.body ? JSON.stringify(opts.body) : null;
    const reqOpts = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
      timeout: 15000,
    };
    const req = lib.request(reqOpts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: {} });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Cloud request timed out')); });
    if (body) req.write(body);
    req.end();
  });
}

/**
 * @param {{ email: string, password: string, deviceId?: string, deviceName?: string }} opts
 * @returns {{ localUser: object, token: string, refreshToken: string }}
 */
exports.autoActivate = async function autoActivate({ email, password, deviceId, deviceName }) {
  if (String(process.env.DESKTOP_LOCAL || '').toLowerCase() !== 'true') {
    throw AppError.forbidden('Auto-activation only available in DESKTOP_LOCAL mode');
  }

  // Block if already activated (users already exist in this local DB).
  const existing = await User.findOne({}).lean();
  if (existing) {
    throw AppError.conflict(
      'This device is already activated. Use normal login or reset the local data to re-activate.'
    );
  }

  // 1. Verify credentials against the cloud.
  const loginRes = await cloudFetch('/auth/login', {
    method: 'POST',
    // A mirrored desktop asks for its own sync login, which other logins cannot end.
    body: {
      email, password, deviceId, deviceName, isDesktop: true,
      syncAgent: String(process.env.DESKTOP_REPLICATION || '').toLowerCase() === 'true',
    },
  }).catch((err) => {
    throw new Error(`Cannot reach cloud for activation: ${err.message}`);
  });

  if (loginRes.status !== 200) {
    const msg = loginRes.data?.message || loginRes.data?.error || 'Cloud login failed';
    throw AppError.unauthorized(msg);
  }

  const cloudToken = loginRes.data?.data?.token || loginRes.data?.token;
  const cloudRefresh = loginRes.data?.data?.refreshToken || loginRes.data?.refreshToken || '';
  const cloudUser = loginRes.data?.data?.user || loginRes.data?.user;
  if (!cloudToken || !cloudUser) {
    throw AppError.badRequest('Unexpected cloud login response — token or user missing');
  }

  // Connecting a desktop copies the whole company to it, so the first sign-in must be by
  // someone allowed to see all of it.
  const isMirror = String(process.env.DESKTOP_REPLICATION || '').toLowerCase() === 'true';
  const elevated = cloudUser.role === 'super_admin' || ['owner', 'admin'].includes(String(cloudUser.companyRole || ''));
  if (isMirror && !elevated) {
    throw AppError.forbidden('The first sign-in on this computer must be by the Owner or an Admin of the company.');
  }

  // 2. Pull company settings from cloud. (A mirrored desktop's sync login cannot read them, and
  //    does not need to: the download brings the cloud's own settings document.)
  const settingsRes = isMirror ? null : await cloudFetch('/company/settings', { token: cloudToken }).catch(() => null);
  const cloudSettings = settingsRes?.data?.data || settingsRes?.data || null;

  const companyId = cloudUser.companyId
    ? new mongoose.Types.ObjectId(String(cloudUser.companyId))
    : new mongoose.Types.ObjectId();
  const userId = cloudUser.id || cloudUser._id
    ? new mongoose.Types.ObjectId(String(cloudUser.id || cloudUser._id))
    : new mongoose.Types.ObjectId();

  // 3. A placeholder Company so the local login works straight away. It is written without the
  //    model's validation because the plan and owner fields are only known to the cloud; on a
  //    mirrored desktop the download replaces it with the cloud's real Company document.
  if (!(await Company.exists({ _id: companyId }))) {
    await Company.collection.insertOne({
      _id: companyId,
      name: cloudUser.companyName || cloudSettings?.legalName || 'Company',
      ownerId: userId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // 4. Create CompanySettings if we got them. A mirrored desktop gets the cloud's own settings
  //    document in the download that follows, so it must not make a second one here.
  if (!isMirror && cloudSettings && Object.keys(cloudSettings).length > 0) {
    await CompanySettings.findOneAndUpdate(
      { companyId },
      { $setOnInsert: { companyId, ...cloudSettings } },
      { upsert: true, new: true }
    );
  }

  // 5. Create the local User for offline login. The User model hashes the password on save, so
  //    it is given in plain here — hashing it first would store a hash of the hash and the
  //    password would never match.

  const localUser = await User.create({
    _id: userId,
    name: cloudUser.name || email,
    email: email.trim().toLowerCase(),
    password,
    role: cloudUser.role || 'user',
    companyRole: cloudUser.companyRole || 'owner',
    companyId,
    isActive: true,
    createdAt: new Date(),
  });

  // 6. Issue a local JWT session.
  const sessionService = require('./sessionService');
  const fakeReq = {
    headers: { 'user-agent': deviceName || 'Textile ERP Desktop', 'x-device-id': deviceId || '' },
    ip: '127.0.0.1',
  };
  const sessionBundle = await sessionService.createSession(localUser, fakeReq);

  if (isMirror) {
    const syncAgentWorker = require('./syncAgentWorker');
    await syncAgentWorker.seedAgentSession({
      companyId: String(companyId),
      token: cloudToken,
      refreshToken: cloudRefresh,
      deviceId: deviceId || '',
      elevated: true,
    });
    // Download the company now; the screen shows progress and entries wait until it is done.
    require('./replication/desktopSync').tick().catch(() => {});
  }

  return {
    localUser,
    token: sessionBundle.accessToken,
    refreshToken: sessionBundle.refreshToken,
  };
};

/** Check whether this local DB has been activated (any user exists). */
exports.isActivated = async function isActivated() {
  return !!(await User.findOne({}).lean());
};
