const mongoose = require('mongoose');

const licenseSchema = new mongoose.Schema({
    companyId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Company',
        required: true
    },
    licenseKey: { 
        type: String, 
        required: true, 
        unique: true 
    },
    issuedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    checksum: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('License', licenseSchema);
