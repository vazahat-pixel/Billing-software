const mongoose = require('mongoose');
const { enterpriseIntegrityPlugin } = require('./mixins/enterpriseMetaSchema');

/**
 * Point-in-time profit snapshot — Sprint 2.6 (documented / stub computation).
 * Full cost accounting expansion deferred; stores summary KPIs for dashboards.
 */
const ProfitSnapshotSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  snapshotDate: { type: Date, required: true, index: true },
  periodFrom: { type: Date, default: null },
  periodTo: { type: Date, default: null },
  salesTaxable: { type: Number, default: 0 },
  purchaseTaxable: { type: Number, default: 0 },
  jobCharges: { type: Number, default: 0 },
  estimatedCogs: { type: Number, default: 0 },
  estimatedGrossProfit: { type: Number, default: 0 },
  notes: { type: String, default: 'Estimated from invoice taxables + lot rates — not statutory P&L' },
  source: { type: String, default: 'automation' },
}, { timestamps: true });

ProfitSnapshotSchema.index({ companyId: 1, snapshotDate: -1 });
ProfitSnapshotSchema.plugin(enterpriseIntegrityPlugin);

module.exports = mongoose.model('ProfitSnapshot', ProfitSnapshotSchema);
