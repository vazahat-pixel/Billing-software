const mongoose = require('mongoose');

const usageSchema = new mongoose.Schema({
    companyId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Company',
        required: true
    },
    period: { 
        type: String, 
        required: true 
    }, // Format: YYYY-MM
    invoicesCount: { type: Number, default: 0 },
    usersCount: { type: Number, default: 0 },
    storageUsedMb: { type: Number, default: 0 }
}, { timestamps: true });

usageSchema.index({ companyId: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('Usage', usageSchema);
