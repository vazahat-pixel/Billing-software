const GstConfig = require('../models/GstConfig');
const GstPeriod = require('../models/GstPeriod');
const CompanySettings = require('../models/CompanySettings');
const Company = require('../models/Company');
const LedgerMaster = require('../models/LedgerMaster');
const {
  validateGstin, stateCodeFromGstin, stateNameFromCode, periodBounds, periodKey,
} = require('../utils/gstDetermination');
const auditService = require('./auditService');

const DEFAULT_TEMPLATES = [
  { code: 'GST5', name: 'GST 5%', rate: 5, category: 'Taxable' },
  { code: 'GST12', name: 'GST 12%', rate: 12, category: 'Taxable' },
  { code: 'GST18', name: 'GST 18%', rate: 18, category: 'Taxable' },
  { code: 'EXEMPT', name: 'Exempt', rate: 0, category: 'Exempt' },
  { code: 'NIL', name: 'Nil Rated', rate: 0, category: 'NilRated' },
  { code: 'ZERO', name: 'Zero Rated / Export', rate: 0, category: 'ZeroRated' },
];

/**
 * GST Configuration Engine — Sprint 4.1
 */
class GstConfigService {
  async getOrCreate(companyId) {
    let cfg = await GstConfig.findOne({ companyId });
    if (cfg) return cfg;

    const settings = await CompanySettings.findOne({ companyId });
    const company = await Company.findById(companyId);
    const gstin = (settings?.gstin || company?.meta?.gstin || '').toUpperCase();
    const stateCode = stateCodeFromGstin(gstin) || '';

    cfg = await GstConfig.create({
      companyId,
      gstin,
      legalName: settings?.legalName || company?.name || '',
      tradeName: settings?.shortName || company?.name || '',
      stateCode,
      stateName: stateNameFromCode(stateCode) || settings?.state || '',
      registrationType: /composition/i.test(settings?.gstScheme || '') ? 'Composition' : 'Regular',
      filingFrequency: /quarter/i.test(settings?.gstScheme || '') ? 'Quarterly' : 'Monthly',
      eInvoiceEnabled: !!settings?.eInvoice,
      eWayEnabled: !!settings?.eway,
      taxTemplates: DEFAULT_TEMPLATES,
    });

    await this.mapSystemLedgers(companyId);
    return GstConfig.findOne({ companyId });
  }

  async mapSystemLedgers(companyId) {
    const cfg = await this.getOrCreate(companyId);
    const names = {
      cgstInput: 'CGST Input',
      sgstInput: 'SGST Input',
      igstInput: 'IGST Input',
      cgstOutput: 'CGST Output',
      sgstOutput: 'SGST Output',
      igstOutput: 'IGST Output',
      tdsPayable: 'TDS Payable',
    };
    const map = { ...(cfg.ledgerMap?.toObject?.() || cfg.ledgerMap || {}) };
    for (const [key, name] of Object.entries(names)) {
      if (map[key]) continue;
      const led = await LedgerMaster.findOne({ companyId, name });
      if (led) map[key] = led._id;
    }
    cfg.ledgerMap = map;
    await cfg.save();
    return cfg;
  }

  async update(companyId, payload, userId) {
    const cfg = await this.getOrCreate(companyId);
    const before = cfg.toObject();

    if (payload.gstin) {
      const v = validateGstin(payload.gstin);
      if (!v.ok) throw new Error(v.reason);
      cfg.gstin = v.gstin;
      cfg.stateCode = v.stateCode;
      cfg.stateName = stateNameFromCode(v.stateCode);
    }

    const fields = [
      'legalName', 'tradeName', 'stateCode', 'stateName', 'registrationType',
      'filingFrequency', 'isExporter', 'lutNumber', 'lutValidFrom', 'lutValidTo',
      'reverseChargeEnabled', 'eInvoiceEnabled', 'eWayEnabled',
      'eInvoiceThreshold', 'eWayThreshold', 'taxTemplates', 'lockedUntilPeriod',
    ];
    for (const f of fields) {
      if (payload[f] !== undefined) cfg[f] = payload[f];
    }
    if (payload.ledgerMap) {
      cfg.ledgerMap = { ...(cfg.ledgerMap?.toObject?.() || {}), ...payload.ledgerMap };
    }
    cfg.updatedBy = userId;
    await cfg.save();

    // Mirror to CompanySettings
    await CompanySettings.findOneAndUpdate(
      { companyId },
      {
        $set: {
          gstin: cfg.gstin,
          state: cfg.stateName,
          eInvoice: cfg.eInvoiceEnabled,
          eway: cfg.eWayEnabled,
        },
      },
      { upsert: true }
    );

    await auditService.logSystem({
      companyId, userId, action: 'GST_CONFIG_UPDATE', module: 'GstConfig',
      referenceId: cfg._id, before, after: cfg.toObject(),
    });
    return cfg;
  }

  async ensurePeriod(companyId, period) {
    const key = period || periodKey();
    let doc = await GstPeriod.findOne({ companyId, period: key });
    if (doc) return doc;
    const bounds = periodBounds(key);
    doc = await GstPeriod.create({
      companyId,
      period: key,
      ...bounds,
    });
    return doc;
  }

  async listPeriods(companyId) {
    return GstPeriod.find({ companyId }).sort({ period: -1 }).lean();
  }

  async lockPeriod(companyId, period, userId) {
    const doc = await this.ensurePeriod(companyId, period);
    if (doc.status === 'Filed') throw new Error('Cannot lock a filed period');
    doc.status = 'Locked';
    doc.lockedAt = new Date();
    doc.lockedBy = userId;
    await doc.save();
    await auditService.logSystem({
      companyId, userId, action: 'GST_PERIOD_LOCK', module: 'GstPeriod',
      referenceId: doc._id, after: { period, status: 'Locked' },
    });
    return doc;
  }

  async unlockPeriod(companyId, period, userId, reason = '') {
    const doc = await GstPeriod.findOne({ companyId, period });
    if (!doc) throw new Error('Period not found');
    if (doc.status === 'Filed') throw new Error('Filed period requires amendment flow');
    doc.status = 'Open';
    doc.notes = reason || doc.notes;
    await doc.save();
    await auditService.logSystem({
      companyId, userId, action: 'GST_PERIOD_UNLOCK', module: 'GstPeriod',
      referenceId: doc._id, after: { period, reason },
    });
    return doc;
  }

  async assertPeriodOpen(companyId, date) {
    const key = periodKey(date);
    const cfg = await this.getOrCreate(companyId);
    if (cfg.lockedUntilPeriod && key <= cfg.lockedUntilPeriod) {
      throw new Error(`GST period locked until ${cfg.lockedUntilPeriod}`);
    }
    const period = await GstPeriod.findOne({ companyId, period: key });
    if (period && ['Locked', 'Filed'].includes(period.status)) {
      throw new Error(`GST period ${key} is ${period.status}`);
    }
    return true;
  }
}

module.exports = new GstConfigService();
