const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
    name: { type: String, required: true },
    ownerId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true
    },
    planId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Plan',
        required: true
    },
    licenseKey: { type: String, unique: true },
    status: { 
        type: String, 
        enum: ['active', 'suspended', 'expired'], 
        default: 'active' 
    },
    isActive: { type: Boolean, default: true },
    meta: {
        industry: String,
        state: String,
        gstin: String
    }
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);
