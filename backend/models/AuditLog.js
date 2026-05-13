const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User'
    },
    companyId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Company'
    },
    action: { type: String, required: true },
    module: { type: String, required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    ip: String,
    userAgent: String
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
