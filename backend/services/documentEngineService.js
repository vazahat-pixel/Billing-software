const DocumentTemplate = require('../models/DocumentTemplate');
const Sales = require('../models/Sales');
const Purchase = require('../models/Purchase');
const DeliveryChallan = require('../models/DeliveryChallan');
const Order = require('../models/Order');
const InventoryLot = require('../models/InventoryLot');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const notificationDispatch = require('./notificationDispatchService');

const DEFAULT_TEMPLATES = [
  { docType: 'sales_invoice', name: 'Tax Invoice A4', format: 'A4', isDefault: true },
  { docType: 'purchase_bill', name: 'Purchase Bill A4', format: 'A4', isDefault: true },
  { docType: 'delivery_challan', name: 'Delivery Challan A4', format: 'A4', isDefault: true },
  { docType: 'purchase_order', name: 'Purchase Order A4', format: 'A4', isDefault: true },
  { docType: 'grn', name: 'GRN A4', format: 'A4', isDefault: true },
  { docType: 'label', name: 'Lot Label Thermal', format: 'Thermal', isDefault: true, channels: { print: true, pdf: true, email: false, whatsapp: false, excel: false } },
];

class DocumentEngineService {
  async pipeline(companyId) {
    const templates = await this.listTemplates(companyId);
    return {
      templateCount: templates.length,
      formats: [...new Set(templates.map((t) => t.format))],
      channels: { print: true, pdf: true, email: 'stub', whatsapp: 'client', excel: 'stub', barcode: true, signature: 'hook' },
    };
  }

  async seedTemplates(companyId) {
    for (const t of DEFAULT_TEMPLATES) {
      await DocumentTemplate.findOneAndUpdate(
        { companyId, docType: t.docType, name: t.name },
        { companyId, ...t, status: 'Active', branding: { showLogo: true, showBank: true, footerNote: '', signatureLabel: 'Authorised Signatory' } },
        { upsert: true }
      );
    }
    return this.listTemplates(companyId);
  }

  async listTemplates(companyId) {
    let rows = await DocumentTemplate.find({ companyId, status: 'Active' }).sort({ docType: 1 });
    if (!rows.length) {
      await this.seedTemplates(companyId);
      rows = await DocumentTemplate.find({ companyId, status: 'Active' }).sort({ docType: 1 });
    }
    return rows;
  }

  async getTemplate(companyId, docType) {
    let t = await DocumentTemplate.findOne({ companyId, docType, isDefault: true, status: 'Active' });
    if (!t) t = await DocumentTemplate.findOne({ companyId, docType, status: 'Active' });
    return t;
  }

  /** Build printable payload for FE InvoicePDFViewer / print pages */
  async buildPayload(companyId, { docType, referenceId }) {
    const template = await this.getTemplate(companyId, docType);
    let document = null;
    let party = null;

    if (docType === 'sales_invoice') {
      document = await Sales.findOne({ _id: referenceId, companyId })
        .populate('customerId')
        .populate('items.itemId', 'name hsnCode');
      party = document?.customerId;
    } else if (docType === 'purchase_bill') {
      document = await Purchase.findOne({ _id: referenceId, companyId })
        .populate('supplierId')
        .populate('items.itemId', 'name hsnCode');
      party = document?.supplierId;
    } else if (docType === 'delivery_challan') {
      document = await DeliveryChallan.findOne({ _id: referenceId, companyId })
        .populate('customerId')
        .populate('items.itemId', 'name')
        .populate('items.lotId', 'lotId barcode');
      party = document?.customerId;
    } else if (docType === 'purchase_order') {
      document = await Order.findOne({ _id: referenceId, companyId, orderType: 'Purchase' })
        .populate('partyId')
        .populate('items.itemId', 'name');
      party = document?.partyId;
    }

    if (!document) throw AppError.notFound('Document not found');

    return {
      docType,
      format: template?.format || 'A4',
      template: template || null,
      document,
      party,
      branding: template?.branding || {},
      signatureHook: {
        enabled: false,
        label: template?.branding?.signatureLabel || 'Authorised Signatory',
        note: 'Digital signature provider hook — Sprint 2.7 readiness',
      },
    };
  }

  async buildLotLabel(companyId, lotId) {
    const lot = await InventoryLot.findOne({ _id: lotId, companyId })
      .populate('itemId', 'name barcode hsnCode')
      .populate('warehouseId', 'name code');
    if (!lot) throw AppError.notFound('Lot not found');
    const code = lot.barcode || lot.itemId?.barcode || lot.lotId;
    return {
      docType: 'label',
      format: 'Thermal',
      lotCode: lot.lotId,
      itemName: lot.itemId?.name,
      barcode: code,
      qrPayload: JSON.stringify({ lotId: lot._id, lotCode: lot.lotId, mts: lot.remainingMtrs }),
      remainingMtrs: lot.remainingMtrs,
      warehouse: lot.warehouseId?.name || '',
    };
  }

  /** Channel dispatch stubs — real providers in later SaaS stage */
  async sendDocument(companyId, { channel, docType, referenceId, to, message }) {
    const payload = await this.buildPayload(companyId, { docType, referenceId });
    if (channel === 'email' || channel === 'whatsapp') {
      await notificationDispatch.dispatch(companyId, 'sales.created', {
        title: `Document ${channel}: ${docType}`,
        body: message || `Queued ${docType} to ${to || 'default'} (${channel} stub)`,
        severity: 'info',
        referenceType: docType,
        referenceId,
        meta: { channel, to, stub: true },
      });
      logger.info('document.channel.stub', { companyId, channel, docType, referenceId, to });
      return { queued: true, channel, stub: true, docType, referenceNo: payload.document?.invoiceNo || payload.document?.challanNo || payload.document?.orderNo };
    }
    if (channel === 'excel') {
      return {
        stub: true,
        channel: 'excel',
        rows: (payload.document?.items || []).map((i) => ({
          item: i.itemId?.name || i.itemId,
          mts: i.mts,
          rate: i.rate,
          amount: i.amount,
        })),
      };
    }
    throw AppError.badRequest('Unsupported channel');
  }
}

module.exports = new DocumentEngineService();
