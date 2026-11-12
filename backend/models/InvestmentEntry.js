const mongoose = require('mongoose');

const InvestmentEntrySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  srNo: { type: Number, default: 1 },
  folioNo: { type: String, default: '', trim: true },
  scheme: { type: String, required: true, trim: true },
  investor: { type: String, default: '', trim: true },
  tranType: { type: String, default: 'BUY', trim: true },
  tranMode: { type: String, default: 'SIP', trim: true },
  date: { type: Date, required: true },
  unit: { type: Number, default: 0 },
  nav: { type: Number, default: 0 },
  stt: { type: Number, default: 0 },
  brokereg: { type: Number, default: 0 },
  tds: { type: Number, default: 0 },
  exitLoad: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  curNav: { type: Number, default: 0 },
  curAmount: { type: Number, default: 0 },
  divAmount: { type: Number, default: 0 },
}, { timestamps: true });

InvestmentEntrySchema.index({ companyId: 1, date: 1 });

module.exports = mongoose.model('InvestmentEntry', InvestmentEntrySchema);
