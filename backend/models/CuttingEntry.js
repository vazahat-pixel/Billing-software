const mongoose = require('mongoose');

/** Cutting Entry — recording a grey/finished fabric lot being cut into pieces. */
const CuttingEntrySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  entryNo: { type: String, required: true },
  date: { type: Date, default: Date.now, index: true },
  lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryLot', required: true },
  lotCode: { type: String, default: '' },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
  originalQty: { type: Number, default: 0, min: 0 },
  cutPieces: { type: Number, required: true, min: 0 },
  cutQty: { type: Number, required: true, min: 0 },
  wastageQty: { type: Number, default: 0, min: 0 },
  remark: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

CuttingEntrySchema.index({ companyId: 1, entryNo: 1 }, { unique: true });

module.exports = mongoose.model('CuttingEntry', CuttingEntrySchema);
