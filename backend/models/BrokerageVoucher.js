const mongoose = require('mongoose');

const BrokerageVoucherSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  voucherNo: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  kind: { type: String, enum: ['BrokerageEntry', 'BrokerTaxInvoice'], default: 'BrokerageEntry' },
  brokerName: { type: String, default: '', trim: true },
  partyName: { type: String, default: '', trim: true },
  billAmt: { type: Number, default: 0 },
  commiPer: { type: Number, default: 0 },
  commiAmt: { type: Number, default: 0 },
  sgstPer: { type: Number, default: 0 },
  sgstAmt: { type: Number, default: 0 },
  cgstPer: { type: Number, default: 0 },
  cgstAmt: { type: Number, default: 0 },
  igstPer: { type: Number, default: 0 },
  igstAmt: { type: Number, default: 0 },
  roundOff: { type: Number, default: 0 },
  netTot: { type: Number, default: 0 },
  remark1: { type: String, default: '' },
  remark2: { type: String, default: '' },
  lines: [{
    _id: false,
    billType: { type: String, default: '' },
    billNo: { type: String, default: '' },
    billDate: { type: Date, default: null },
    paidDate: { type: Date, default: null },
    party: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    commiPer: { type: Number, default: 0 },
    commiAmt: { type: Number, default: 0 },
    remark: { type: String, default: '' },
  }],
}, { timestamps: true });

BrokerageVoucherSchema.index({ companyId: 1, kind: 1, voucherNo: 1 }, { unique: true });

module.exports = mongoose.model('BrokerageVoucher', BrokerageVoucherSchema);
