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
    checksum: { type: String, required: true },
    // Stage 8.7 — commercial activation
    planTier: { type: String, enum: ['trial', 'basic', 'standard', 'pro', 'enterprise'], default: 'trial' },
    activationMode: { type: String, enum: ['online', 'offline'], default: 'online' },
    maxDevices: { type: Number, default: 3 },
    graceDays: { type: Number, default: 7 },
    devices: [{
        deviceId: { type: String, required: true },
        deviceName: { type: String, default: '' },
        fingerprint: { type: String, default: '' },
        activatedAt: { type: Date, default: Date.now },
        lastSeenAt: { type: Date, default: Date.now },
        active: { type: Boolean, default: true },
    }],
    lastValidatedAt: { type: Date, default: null },
    offlineCode: { type: String, default: '' },
    transferCount: { type: Number, default: 0 },
    antiTamperHash: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('License', licenseSchema);
