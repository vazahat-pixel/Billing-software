const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
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
    licenseKey: { type: String, unique: true, sparse: true },
    status: {
        type: String,
        enum: ['active', 'suspended', 'expired'],
        default: 'active'
    },
    isActive: { type: Boolean, default: true },
    meta: {
        industry: String,
        state: String,
        gstin: { type: String, uppercase: true, trim: true },
        pan: { type: String, uppercase: true, trim: true },
        phone: String,
        address: String,
        city: String,
        district: String,
        pincode: String
    },
    // Accounting settings
    settings: {
        lockedUntilDate: { type: Date, default: null },   // Period lock — no entries before this date
        financialYearStart: { type: String, default: 'April' }, // April or January
        defaultGstType: { type: String, enum: ['CGST+SGST', 'IGST'], default: 'CGST+SGST' }
    },
    /** Developer QA engine tenant markers — never set on production customer companies */
    isQaTenant: { type: Boolean, default: false, index: true },
    qaProfile: { type: String, default: null, trim: true },
    /**
     * SaaS commercial policy (does not change ERP transaction math):
     *  legacy_open   — grandfathered tenants; hard gates never block
     *  saas_enforced — new SaaS tenants; MODULE_GATE / PLAN_LIMIT may hard-block
     */
    commercialPolicy: {
        type: String,
        enum: ['legacy_open', 'saas_enforced'],
        default: 'legacy_open',
        index: true,
    },
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);
