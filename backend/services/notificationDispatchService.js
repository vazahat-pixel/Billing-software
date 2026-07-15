const Notification = require('../models/Notification');
const NotificationConfig = require('../models/NotificationConfig');
const logger = require('../utils/logger');

const EVENT_MAP = {
  'sales.created': 'invoice_created',
  'purchase.created': 'invoice_created',
  'job.received': 'job_completed',
  'automation.low_stock': 'low_stock',
  'automation.overdue': 'overdue_invoice',
  'automation.approval_pending': 'invoice_created',
};

/**
 * Dispatch in-app (and stub channel) notifications from domain events.
 */
async function dispatch(companyId, eventType, { title, body, severity = 'info', referenceType = '', referenceId = null, meta = {} } = {}) {
  if (!companyId) return null;

  const configEvent = EVENT_MAP[eventType] || eventType;
  let configs = await NotificationConfig.find({
    companyId,
    enabled: true,
    $or: [{ event: configEvent }, { event: eventType }],
  }).lean();

  // Always create at least one in-app notification even without config
  const wantInApp = !configs.length || configs.some((c) => c.channels?.inApp !== false);

  if (wantInApp) {
    const note = await Notification.create({
      companyId,
      event: configEvent,
      title: title || eventType,
      body: body || '',
      severity,
      channel: 'inApp',
      status: 'Unread',
      referenceType,
      referenceId,
      meta: { ...meta, domainEvent: eventType },
    });
    logger.debug('notification.dispatched', { companyId, eventType, id: note._id });
    return note;
  }

  // Email/SMS/WhatsApp hooks — log only until Sprint 2.7 document/channel engine
  for (const cfg of configs) {
    if (cfg.channels?.email || cfg.channels?.sms || cfg.channels?.whatsapp) {
      logger.info('notification.channel.stub', {
        companyId,
        event: cfg.event,
        channels: cfg.channels,
      });
    }
  }
  return null;
}

async function listInbox(companyId, { status = 'Unread', limit = 50 } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  return Notification.find(filter).sort({ createdAt: -1 }).limit(Math.min(limit, 200));
}

async function markRead(companyId, id) {
  return Notification.findOneAndUpdate(
    { _id: id, companyId },
    { status: 'Read', readAt: new Date() },
    { new: true }
  );
}

async function unreadCount(companyId) {
  return Notification.countDocuments({ companyId, status: 'Unread' });
}

module.exports = {
  dispatch,
  listInbox,
  markRead,
  unreadCount,
  EVENT_MAP,
};
