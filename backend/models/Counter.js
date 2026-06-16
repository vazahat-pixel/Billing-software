const mongoose = require('mongoose');

/**
 * Counter model for atomic sequence generation.
 * Prevents race conditions in voucher/entry number generation.
 * Uses MongoDB's atomic $inc operator via findOneAndUpdate.
 */
const CounterSchema = new mongoose.Schema({
  // e.g. "JNL-{companyId}", "PV-{companyId}", "RV-{companyId}"
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

CounterSchema.statics.nextSeq = async function(counterId) {
  const counter = await this.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

module.exports = mongoose.model('Counter', CounterSchema);
