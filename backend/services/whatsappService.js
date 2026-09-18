/**
 * Meta Cloud WhatsApp Business API client.
 * Env:
 *   WHATSAPP_API_KEY     — permanent / system user access token
 *   WHATSAPP_PHONE_ID    — phone_number_id from Meta
 *   WHATSAPP_DEFAULT_PHONE — fallback "from" display / test recipient (E.164 digits)
 *   WHATSAPP_API_VERSION — optional, default v21.0
 *   WHATSAPP_INVOICE_TEMPLATE — optional approved template name for business-initiated sends
 *   WHATSAPP_TEMPLATE_LANG — optional, default en
 */

const logger = require('../utils/logger');

function configured() {
  const token = String(process.env.WHATSAPP_API_KEY || '').trim();
  const phoneId = String(process.env.WHATSAPP_PHONE_ID || '').trim();
  return Boolean(token && phoneId);
}

function status() {
  return {
    configured: configured(),
    phoneIdSet: Boolean(String(process.env.WHATSAPP_PHONE_ID || '').trim()),
    defaultPhone: String(process.env.WHATSAPP_DEFAULT_PHONE || '').trim() || null,
    template: String(process.env.WHATSAPP_INVOICE_TEMPLATE || '').trim() || null,
    apiVersion: String(process.env.WHATSAPP_API_VERSION || 'v21.0').trim(),
  };
}

/** Normalize to WhatsApp international digits (India default 91). */
function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.startsWith('0') && digits.length === 11) digits = `91${digits.slice(1)}`;
  return digits;
}

async function graphSend(body) {
  const token = String(process.env.WHATSAPP_API_KEY || '').trim();
  const phoneId = String(process.env.WHATSAPP_PHONE_ID || '').trim();
  const version = String(process.env.WHATSAPP_API_VERSION || 'v21.0').trim();
  if (!token || !phoneId) {
    const err = new Error('WhatsApp API not configured (WHATSAPP_API_KEY / WHATSAPP_PHONE_ID)');
    err.code = 'WHATSAPP_NOT_CONFIGURED';
    throw err;
  }

  const url = `https://graph.facebook.com/${version}/${phoneId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.error?.error_user_msg ||
      `WhatsApp API HTTP ${res.status}`;
    const err = new Error(msg);
    err.code = data?.error?.code || 'WHATSAPP_API_ERROR';
    err.details = data?.error || data;
    throw err;
  }
  return data;
}

/**
 * Send a free-form text message (works inside the 24h customer-care window).
 */
async function sendText({ to, body }) {
  const phone = normalizePhone(to);
  if (!phone) {
    const err = new Error('Recipient phone required');
    err.code = 'WHATSAPP_NO_RECIPIENT';
    throw err;
  }
  if (!body || !String(body).trim()) {
    const err = new Error('Message body required');
    err.code = 'WHATSAPP_EMPTY_BODY';
    throw err;
  }

  const result = await graphSend({
    to: phone,
    type: 'text',
    text: { preview_url: true, body: String(body).slice(0, 4096) },
  });

  logger.info('whatsapp.text.sent', {
    to: phone,
    messageId: result?.messages?.[0]?.id,
  });

  return {
    provider: 'meta_cloud',
    to: phone,
    messageId: result?.messages?.[0]?.id || null,
    result,
  };
}

/**
 * Send an approved template (required for business-initiated outside 24h window).
 * components: Meta template components array (optional).
 */
async function sendTemplate({ to, templateName, languageCode, components }) {
  const phone = normalizePhone(to);
  if (!phone) {
    const err = new Error('Recipient phone required');
    err.code = 'WHATSAPP_NO_RECIPIENT';
    throw err;
  }
  const name = String(templateName || process.env.WHATSAPP_INVOICE_TEMPLATE || '').trim();
  if (!name) {
    const err = new Error('WhatsApp template name not configured');
    err.code = 'WHATSAPP_NO_TEMPLATE';
    throw err;
  }

  const payload = {
    to: phone,
    type: 'template',
    template: {
      name,
      language: { code: String(languageCode || process.env.WHATSAPP_TEMPLATE_LANG || 'en').trim() },
    },
  };
  if (Array.isArray(components) && components.length) {
    payload.template.components = components;
  }

  const result = await graphSend(payload);
  logger.info('whatsapp.template.sent', {
    to: phone,
    template: name,
    messageId: result?.messages?.[0]?.id,
  });

  return {
    provider: 'meta_cloud',
    to: phone,
    template: name,
    messageId: result?.messages?.[0]?.id || null,
    result,
  };
}

/**
 * Smart send for invoices:
 * - If WHATSAPP_INVOICE_TEMPLATE set → template with body params
 * - Else → free-form text
 */
async function sendInvoiceMessage({ to, text, bodyParams = [] }) {
  const template = String(process.env.WHATSAPP_INVOICE_TEMPLATE || '').trim();
  if (template) {
    const params = (bodyParams.length ? bodyParams : [String(text || '').slice(0, 200)]).map((t) => ({
      type: 'text',
      text: String(t || '—').slice(0, 1024),
    }));
    return sendTemplate({
      to,
      templateName: template,
      components: [
        {
          type: 'body',
          parameters: params,
        },
      ],
    });
  }
  return sendText({ to, body: text });
}

module.exports = {
  configured,
  status,
  normalizePhone,
  sendText,
  sendTemplate,
  sendInvoiceMessage,
};
