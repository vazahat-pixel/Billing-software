const mongoose = require('mongoose');

/** Beam Entry — yarn wound onto a warping beam before weaving. */
const BeamEntrySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  beamNo: { type: String, required: true },
  date: { type: Date, default: Date.now, index: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
  yarnDetails: { type: String, default: '' },
  quantityKg: { type: Number, default: 0, min: 0 },
  totalEnds: { type: Number, default: 0, min: 0 },
  lengthMtrs: { type: Number, default: 0, min: 0 },
  partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party' },
  loomNo: { type: String, default: '' },
  status: { type: String, enum: ['Prepared', 'Loaded', 'Consumed'], default: 'Prepared' },
  remark: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

BeamEntrySchema.index({ companyId: 1, beamNo: 1 }, { unique: true });

module.exports = mongoose.model('BeamEntry', BeamEntrySchema);
