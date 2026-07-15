/**

 * Immutable domain event store — complements in-process eventBus.

 * Future Event Architecture / outbox can drain this collection.

 */

const mongoose = require('mongoose');



const DomainEventSchema = new mongoose.Schema(

  {

    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true },

    eventType: { type: String, required: true, index: true },

    aggregateType: { type: String, default: '' },

    aggregateId: { type: mongoose.Schema.Types.ObjectId, default: null },

    payload: { type: mongoose.Schema.Types.Mixed, default: {} },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    requestId: { type: String, default: '' },

    processedAt: { type: Date, default: null },

  },

  { timestamps: true, collection: 'domain_events' }

);



DomainEventSchema.index({ companyId: 1, createdAt: -1 });

DomainEventSchema.index({ eventType: 1, createdAt: -1 });



// Append-only for business fields; allow outbox drain (processedAt only)
DomainEventSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], function allowProcessedAt(next) {
  const update = this.getUpdate() || {};
  const set = update.$set || update;
  const keys = Object.keys(set).filter((k) => k !== '$set');
  const allowed = keys.every((k) => ['processedAt', '$set'].includes(k) || k.startsWith('$'));
  if (keys.length && !keys.every((k) => k === 'processedAt')) {
    // Only processedAt may be set (also allow $set: { processedAt })
    const setKeys = Object.keys(update.$set || {});
    if (!(setKeys.length === 1 && setKeys[0] === 'processedAt') && !(keys.length === 1 && keys[0] === 'processedAt')) {
      return next(new Error('DomainEvent store is append-only (except processedAt)'));
    }
  }
  next();
});

DomainEventSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function blockDelete(next) {
  next(new Error('DomainEvent store is append-only'));
});

module.exports = mongoose.model('DomainEvent', DomainEventSchema);


