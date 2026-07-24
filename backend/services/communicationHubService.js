const CommunicationLog = require('../models/CommunicationLog');
const documentEngine = require('./documentEngineService');
const Party = require('../models/Party');
const AppError = require('../utils/AppError');
const auditService = require('./auditService');
const logger = require('../utils/logger');
const enterpriseConfigService = require('./enterpriseConfigService');

const TEMPLATES = {
  send_invoice: { docType: 'sales_invoice', subject: 'Invoice {{invoiceNo}}' },
  send_purchase_order: { docType: 'purchase_order', subject: 'Purchase Order {{orderNo}}' },
  send_statement: { docType: 'sales_invoice', subject: 'Account Statement' },
  send_outstanding: { docType: 'sales_invoice', subject: 'Outstanding Reminder' },
  send_gst_report: { docType: 'sales_invoice', subject: 'GST Report' },
  send_payment_reminder: { docType: 'sales_invoice', subject: 'Payment Reminder' },
};

/**
 * Stage 6.6 — Communication Hub (template-based multi-channel send).
 * Provider hooks are stubbed; delivery is logged for audit.
 */
class CommunicationHubService {
  templates() {
    return Object.entries(TEMPLATES).map(([action, t]) => ({
      action,
      ...t,
      channels: ['whatsapp', 'email', 'sms', 'api'],
    }));
  }

  async send(companyId, data, userId) {
    const {
      channel = 'whatsapp',
      action = 'send_invoice',
      recipient = '',
      partyId = null,
      referenceType = '',
      referenceId = null,
      templateCode = '',
    } = data;

    if (!['whatsapp', 'email', 'sms', 'api'].includes(channel)) {
      throw AppError.badRequest('Invalid channel');
    }

    const cfg = await enterpriseConfigService.getOrCreate(companyId);
    if (!cfg.features?.communicationHub) {
      throw AppError.forbidden('Communication Hub disabled for this company');
    }

    let party = null;
    if (partyId) {
      party = await Party.findOne({ _id: partyId, companyId }).lean();
    }

    let payload = { action, template: TEMPLATES[action] || TEMPLATES.send_invoice };
    if (referenceId && TEMPLATES[action]?.docType) {
      try {
        payload.document = await documentEngine.buildPayload(companyId, {
          docType: TEMPLATES[action].docType,
          referenceId,
        });
      } catch (err) {
        logger.warn('communication.payload.partial', { err: err.message });
      }
    }

    const to =
      recipient ||
      party?.mobile ||
      party?.email ||
      party?.whatsapp ||
      '';

    const log = await CommunicationLog.create({
      companyId,
      channel,
      action,
      templateCode: templateCode || action,
      recipient: to,
      partyId: partyId || null,
      referenceType,
      referenceId: referenceId || null,
      status: 'stub',
      payload,
      sentBy: userId || null,
      error: '',
    });

    logger.info('communication.hub.send', {
      companyId: String(companyId),
      channel,
      action,
      recipient: to,
      logId: log._id,
    });

    await auditService.logSystem({
      companyId,
      userId,
      action: 'communication.send',
      module: 'enterprise',
      referenceId: log._id,
      after: { channel, action, recipient: to, status: 'stub' },
    });

    return {
      log,
      status: 'stub',
      message: `${channel} provider hook ready — message queued as stub until credentials configured`,
    };
  }

  async list(companyId, { limit = 50, channel } = {}) {
    const filter = { companyId };
    if (channel) filter.channel = channel;
    return CommunicationLog.find(filter).sort({ createdAt: -1 }).limit(Math.min(limit, 200));
  }

  async pipeline(companyId) {
    const [total, stub, failed] = await Promise.all([
      CommunicationLog.countDocuments({ companyId }),
      CommunicationLog.countDocuments({ companyId, status: 'stub' }),
      CommunicationLog.countDocuments({ companyId, status: 'failed' }),
    ]);
    return { total, stub, failed, templates: this.templates().length };
  }
}

module.exports = new CommunicationHubService();
