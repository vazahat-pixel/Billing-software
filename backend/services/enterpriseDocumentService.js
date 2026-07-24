const documentEngine = require('./documentEngineService');
const DocumentTemplate = require('../models/DocumentTemplate');
const AppError = require('../utils/AppError');
const auditService = require('./auditService');

/**
 * Stage 6.7 — Document & Template Engine enterprise layer.
 * Extends Sprint 2.7 documentEngine with branding / format / multi-doc types.
 */
const EXTRA_TEMPLATES = [
  { docType: 'sales_invoice', name: 'Thermal Invoice', format: 'Thermal', isDefault: false },
  { docType: 'sales_invoice', name: 'Dot Matrix Invoice', format: 'DotMatrix', isDefault: false },
  { docType: 'credit_note', name: 'Credit Note A4', format: 'A4', isDefault: true },
  { docType: 'job_card', name: 'Job Card A4', format: 'A4', isDefault: true },
];

class EnterpriseDocumentService {
  async seed(companyId) {
    await documentEngine.seedTemplates(companyId);
    for (const t of EXTRA_TEMPLATES) {
      await DocumentTemplate.findOneAndUpdate(
        { companyId, docType: t.docType, name: t.name },
        {
          companyId,
          ...t,
          status: 'Active',
          branding: {
            showLogo: true,
            showBank: true,
            footerNote: '',
            signatureLabel: 'Authorised Signatory',
          },
          channels: {
            print: true,
            pdf: true,
            email: true,
            whatsapp: true,
            excel: t.format === 'A4',
          },
          locale: 'en-IN',
        },
        { upsert: true }
      );
    }
    return this.list(companyId);
  }

  async list(companyId) {
    let rows = await DocumentTemplate.find({ companyId }).sort({ docType: 1, name: 1 });
    if (!rows.length) {
      await this.seed(companyId);
      rows = await DocumentTemplate.find({ companyId }).sort({ docType: 1, name: 1 });
    }
    return rows;
  }

  async update(companyId, id, patch, userId) {
    const allowed = ['name', 'format', 'locale', 'branding', 'channels', 'isDefault', 'status'];
    const $set = {};
    for (const k of allowed) {
      if (patch[k] !== undefined) $set[k] = patch[k];
    }
    const row = await DocumentTemplate.findOneAndUpdate({ _id: id, companyId }, { $set }, { new: true });
    if (!row) throw AppError.notFound('Template not found');
    if (patch.isDefault) {
      await DocumentTemplate.updateMany(
        { companyId, docType: row.docType, _id: { $ne: row._id } },
        { isDefault: false }
      );
    }
    await auditService.logSystem({
      companyId,
      userId,
      action: 'document.template.updated',
      module: 'enterprise',
      referenceId: row._id,
      after: { name: row.name, format: row.format },
    });
    return row;
  }

  async preview(companyId, { docType, referenceId, format }) {
    const payload = await documentEngine.buildPayload(companyId, { docType, referenceId });
    if (format) payload.format = format;
    payload.preview = {
      watermark: payload.branding?.footerNote || '',
      qrHint: referenceId ? `DOC:${docType}:${referenceId}` : '',
      barcodeHint: payload.document?.invoiceNo || payload.document?.billNo || '',
      languages: [payload.template?.locale || 'en-IN', 'hi-IN'],
      outputs: ['print', 'pdf', 'excel', 'word'],
    };
    return payload;
  }

  async pipeline(companyId) {
    const base = await documentEngine.pipeline(companyId);
    const templates = await DocumentTemplate.find({ companyId }).select('format').lean();
    const byFormat = {};
    for (const t of templates) {
      byFormat[t.format || 'A4'] = (byFormat[t.format || 'A4'] || 0) + 1;
    }
    return {
      ...base,
      byFormat: Object.entries(byFormat).map(([format, count]) => ({ _id: format, count })),
      enterprise: {
        watermark: true,
        digitalSignatureHook: true,
        multiLanguage: true,
        thermal: true,
        a4: true,
        dotMatrix: true,
        pdf: true,
        excel: true,
        word: 'export-hook',
        printPreview: true,
        barcode: true,
        qr: true,
      },
    };
  }
}

module.exports = new EnterpriseDocumentService();
