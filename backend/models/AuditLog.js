const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        index: true
    },
    action: { type: String, required: true },
    module: { type: String, required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    reason: { type: String, default: '' },
    requestId: { type: String, default: '' },
    ip: String,
    userAgent: String,
    /** Audit rows must never be mutated after insert */
    immutable: { type: Boolean, default: true }
}, { timestamps: true });

auditLogSchema.index({ companyId: 1, createdAt: -1 });
auditLogSchema.index({ companyId: 1, module: 1, action: 1 });
auditLogSchema.index({ referenceId: 1 }, { sparse: true });

auditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany', 'deleteOne', 'deleteMany', 'findOneAndDelete'], function block(next) {
  next(new Error('AuditLog is immutable'));
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
