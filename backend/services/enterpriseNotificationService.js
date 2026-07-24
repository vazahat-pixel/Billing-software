const Notification = require('../models/Notification');
const NotificationConfig = require('../models/NotificationConfig');
const notificationDispatch = require('./notificationDispatchService');
const enterpriseConfigService = require('./enterpriseConfigService');
const logger = require('../utils/logger');

/**
 * Stage 6.2 — Enterprise Notification Center.
 * Extends Sprint 2.6 in-app dispatch with multi-channel stubs + inbox APIs.
 */
const ENTERPRISE_EVENTS = [
  { ruleKey: 'low_stock', name: 'Low Stock', event: 'low_stock', severity: 'warning' },
  { ruleKey: 'subscription_expiry', name: 'Subscription Expiry', event: 'subscription_expiry', severity: 'critical' },
  { ruleKey: 'license_expiry', name: 'License Expiry', event: 'license_expiry', severity: 'critical' },
  { ruleKey: 'gst_due', name: 'GST Due', event: 'gst_due', severity: 'warning' },
  { ruleKey: 'payment_due', name: 'Payment Due', event: 'payment_due', severity: 'warning' },
  { ruleKey: 'outstanding_reminder', name: 'Outstanding Reminder', event: 'outstanding_reminder', severity: 'info' },
  { ruleKey: 'failed_backup', name: 'Failed Backup', event: 'failed_backup', severity: 'critical' },
  { ruleKey: 'approval_pending', name: 'Approval Pending', event: 'approval_pending', severity: 'warning' },
  { ruleKey: 'job_completed', name: 'Job Work Completed', event: 'job_completed', severity: 'info' },
  { ruleKey: 'server_error', name: 'Server Error', event: 'server_error', severity: 'critical' },
];

// Relax enum mismatch: store unknown events as meta while using closest known enum
const EVENT_FALLBACK = {
  license_expiry: 'subscription_expiry',
  gst_due: 'overdue_invoice',
  payment_due: 'overdue_invoice',
  outstanding_reminder: 'overdue_invoice',
  failed_backup: 'company_locked',
  approval_pending: 'invoice_created',
  server_error: 'company_locked',
};

class EnterpriseNotificationService {
  async seedConfigs(companyId) {
    const cfg = await enterpriseConfigService.getOrCreate(companyId);
    for (const e of ENTERPRISE_EVENTS) {
      const event = NotificationConfig.schema.path('event').enumValues.includes(e.event)
        ? e.event
        : EVENT_FALLBACK[e.event] || 'invoice_created';
      await NotificationConfig.findOneAndUpdate(
        { companyId, ruleKey: e.ruleKey },
        {
          companyId,
          ruleKey: e.ruleKey,
          name: e.name,
          enabled: true,
          event,
          channels: {
            inApp: cfg.channels?.inApp !== false,
            email: !!cfg.channels?.email,
            sms: !!cfg.channels?.sms,
            whatsapp: !!cfg.channels?.whatsapp,
          },
          template: e.name,
        },
        { upsert: true }
      );
    }
    return this.listConfigs(companyId);
  }

  async listConfigs(companyId) {
    let rows = await NotificationConfig.find({ companyId }).sort({ name: 1 });
    if (!rows.length) {
      await this.seedConfigs(companyId);
      rows = await NotificationConfig.find({ companyId }).sort({ name: 1 });
    }
    return rows;
  }

  async updateConfig(companyId, ruleKey, patch) {
    return NotificationConfig.findOneAndUpdate(
      { companyId, ruleKey },
      { $set: patch },
      { new: true }
    );
  }

  async inbox(companyId, { status, limit = 50, channel } = {}) {
    const filter = { companyId };
    if (status) filter.status = status;
    if (channel) filter.channel = channel;
    const [items, unread] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).limit(Math.min(limit, 200)),
      notificationDispatch.unreadCount(companyId),
    ]);
    return { items, unread };
  }

  async markRead(companyId, id) {
    return notificationDispatch.markRead(companyId, id);
  }

  async markAllRead(companyId) {
    await Notification.updateMany(
      { companyId, status: 'Unread' },
      { status: 'Read', readAt: new Date() }
    );
    return { ok: true, unread: 0 };
  }

  async archive(companyId, id) {
    return Notification.findOneAndUpdate(
      { _id: id, companyId },
      { status: 'Archived' },
      { new: true }
    );
  }

  /**
   * Multi-channel notify — always creates in-app via existing dispatch;
   * email/sms/whatsapp/push/desktop are logged stubs until providers connect.
   */
  async notify(companyId, eventType, payload = {}) {
    const note = await notificationDispatch.dispatch(companyId, eventType, payload);
    const cfg = await enterpriseConfigService.getOrCreate(companyId);
    const channels = [];
    if (cfg.channels?.email) channels.push('email');
    if (cfg.channels?.sms) channels.push('sms');
    if (cfg.channels?.whatsapp) channels.push('whatsapp');
    if (cfg.channels?.push) channels.push('push');
    if (cfg.channels?.desktop) channels.push('desktop');
    if (channels.length) {
      logger.info('enterprise.notification.channels', {
        companyId: String(companyId),
        eventType,
        channels,
        title: payload.title,
      });
    }
    return { notification: note, channelsQueued: channels };
  }

  async unreadCount(companyId) {
    return notificationDispatch.unreadCount(companyId);
  }
}

module.exports = new EnterpriseNotificationService();
