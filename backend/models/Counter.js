const mongoose = require('mongoose');

/**
 * Counter model for atomic sequence generation.
 * Prevents race conditions in voucher/entry number generation.
 * Uses MongoDB's atomic $inc operator via findOneAndUpdate.
 * Sprint 1.4: optional session binds seq to the calling transaction.
 */
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

/**
 * @param {string} counterId
 * @param {import('mongoose').ClientSession|null} session
 */
CounterSchema.statics.nextSeq = async function(counterId, session = null) {
  const opts = { new: true, upsert: true };
  if (session) opts.session = session;
  const counter = await this.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    opts
  );
  return counter.seq;
};

module.exports = mongoose.model('Counter', CounterSchema);
