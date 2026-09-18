const CommunicationLog = require('../models/CommunicationLog');
const documentEngine = require('./documentEngineService');
const Party = require('../models/Party');
const AppError = require('../utils/AppError');
const auditService = require('./auditService');
const logger = require('../utils/logger');
const enterpriseConfigService = require('./enterpriseConfigService');
const whatsappService = require('./whatsappService');

const TEMPLATES = {
  send_invoice: { docType: 'sales_invoice', subject: 'Invoice {{invoiceNo}}' },
  send_purchase_order: { docType: 'purchase_order', subject: 'Purchase Order {{orderNo}}' },
  send_statement: { docType: 'sales_invoice', subject: 'Account Statement' },
  send_outstanding: { docType: 'sales_invoice', subject: 'Outstanding Reminder' },
  send_gst_report: { docType: 'sales_invoice', subject: 'GST Report' },
  send_payment_reminder: { docType: 'sales_invoice', subject: 'Payment Reminder' },
  custom: { docType: null, subject: 'Message' },
};

function buildPlainText(action, payload, party, explicitMessage) {
  if (explicitMessage && String(explicitMessage).trim()) return String(explicitMessage).trim();

  const doc = payload?.document || {};
  const invNo = doc.invoiceNo || doc.billNo || doc.docNo || '—';
  const amt = doc.netAmount ?? doc.totalAmount ?? doc.amount;
  const partyName = party?.name || doc.partyName || 'Customer';
  const firm = doc.companyName || doc.firmName || 'Company';
  const subject = TEMPLATES[action]?.subject || 'Document';

  const lines = [
    `*${firm}*`,
    subject.replace('{{invoiceNo}}', invNo).replace('{{orderNo}}', invNo),
    `Party: ${partyName}`,
  ];
  if (amt != null && amt !== '') {
    const n = Number(amt);
    lines.push(`Amount: ₹ ${Number.isFinite(n) ? n.toLocaleString('en-IN') : amt}`);
  }
  if (doc.gstin) lines.push(`GSTIN: ${doc.gstin}`);
  return lines.join('\n');
}

/**
 * Stage 6.6 — Communication Hub (template-based multi-channel send).
 * WhatsApp uses Meta Cloud API when WHATSAPP_API_KEY + WHATSAPP_PHONE_ID are set.
 */
class CommunicationHubService {
  templates() {
    return Object.entries(TEMPLATES).map(([action, t]) => ({
      action,
      ...t,
      channels: ['whatsapp', 'email', 'sms', 'api'],
    }));
  }

  providerStatus() {
    return {
      whatsapp: whatsappService.status(),
    };
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
      message = '',
      bodyParams = [],
      fallbackPhone = '',
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
      party?.whatsapp ||
      party?.mobile ||
      party?.phone ||
      fallbackPhone ||
      '';

    const text = buildPlainText(action, payload, party, message);
    payload.messagePreview = text.slice(0, 500);

    const log = await CommunicationLog.create({
      companyId,
      channel,
      action: TEMPLATES[action] ? action : 'custom',
      templateCode: templateCode || action,
      recipient: to,
      partyId: partyId || null,
      referenceType,
      referenceId: referenceId || null,
      status: 'queued',
      payload,
      sentBy: userId || null,
      error: '',
    });

    let delivery = null;
    let status = 'stub';
    let error = '';

    try {
      if (channel === 'whatsapp') {
        if (!whatsappService.configured()) {
          status = 'stub';
          error = 'WhatsApp API credentials not configured';
        } else if (!to) {
          status = 'failed';
          error = 'No recipient phone on party / request';
        } else {
          delivery = await whatsappService.sendInvoiceMessage({
            to,
            text,
            bodyParams: Array.isArray(bodyParams) && bodyParams.length
              ? bodyParams
              : [payload.document?.invoiceNo || '—', String(payload.document?.netAmount ?? ''), party?.name || ''],
          });
          status = 'sent';
          payload.provider = delivery;
        }
      } else {
        status = 'stub';
        error = `${channel} provider not wired yet`;
      }
    } catch (err) {
      status = 'failed';
      error = err.message || 'Send failed';
      logger.warn('communication.hub.send.failed', {
        companyId: String(companyId),
        channel,
        err: error,
        code: err.code,
      });
    }

    log.status = status;
    log.error = error;
    log.payload = payload;
    await log.save();

    logger.info('communication.hub.send', {
      companyId: String(companyId),
      channel,
      action,
      recipient: to,
      status,
      logId: log._id,
    });

    await auditService.logSystem({
      companyId,
      userId,
      action: 'communication.send',
      module: 'enterprise',
      referenceId: log._id,
      after: { channel, action, recipient: to, status },
    });

    const clientFallback = channel === 'whatsapp' && status !== 'sent';

    return {
      log,
      status,
      message:
        status === 'sent'
          ? 'WhatsApp message sent'
          : status === 'failed'
            ? error || 'WhatsApp send failed'
            : 'WhatsApp API not configured — use client share fallback',
      delivery,
      clientFallback,
      waMeSuggested: clientFallback,
      text,
      to: whatsappService.normalizePhone(to) || to,
    };
  }

  async list(companyId, { limit = 50, channel } = {}) {
    const filter = { companyId };
    if (channel) filter.channel = channel;
    return CommunicationLog.find(filter).sort({ createdAt: -1 }).limit(Math.min(limit, 200));
  }

  async pipeline(companyId) {
    const [total, stub, failed, sent] = await Promise.all([
      CommunicationLog.countDocuments({ companyId }),
      CommunicationLog.countDocuments({ companyId, status: 'stub' }),
      CommunicationLog.countDocuments({ companyId, status: 'failed' }),
      CommunicationLog.countDocuments({ companyId, status: 'sent' }),
    ]);
    return {
      total,
      stub,
      failed,
      sent,
      templates: this.templates().length,
      providers: this.providerStatus(),
    };
  }
}

module.exports = new CommunicationHubService();
