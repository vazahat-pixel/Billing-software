const mongoose = require('mongoose');
const configMetaSchema = require('./mixins/configMetaSchema');

// Stores per-company settings: legal info, financial year, GST scheme, branding, etc.
const CompanySettingsSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
    // Identity
    legalName: { type: String, default: '' },
    shortName: { type: String, default: '' },
    gstin: { type: String, default: '' },
    pan: { type: String, default: '' },
    tan: { type: String, default: '' },
    // Contact
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    website: { type: String, default: '' },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    // Financial
    financialYear: { type: String, default: '2024-25' },
    gstScheme: { type: String, default: 'Regular (Monthly)' },
    currency: { type: String, default: 'INR (₹)' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    tdsEnabled: { type: Boolean, default: false },
    tcsEnabled: { type: Boolean, default: false },
    eway: { type: Boolean, default: false },
    eInvoice: { type: Boolean, default: false },
    // Vouchers
    businessType: { type: String, default: 'Textile' },
    invoicePrefix: { type: String, default: 'INV' },
    purchasePrefix: { type: String, default: 'PUR' },
    challanPrefix: { type: String, default: 'CHL' },
    receiptPrefix: { type: String, default: 'RCP' },
    paymentPrefix: { type: String, default: 'PAY' },
    autoVoucherNo: { type: Boolean, default: true },
    // Notifications
    notifyExpiry: { type: Boolean, default: true },
    notifyLowStock: { type: Boolean, default: false },
    notifyOverdue: { type: Boolean, default: true },
    // Branding
    primaryColor: { type: String, default: '#7c3aed' },
    logoUrl: { type: String, default: '' },
    showLogo: { type: Boolean, default: true },
    printWatermark: { type: Boolean, default: false },
    // Custom Fields
    customField1Label: { type: String, default: '' },
    customField2Label: { type: String, default: '' },
    customField3Label: { type: String, default: '' },
  // Limit Overrides (null = use plan defaults)
    offlineModeEnabled: { type: Boolean, default: false },
    maxUsers: { type: Number, default: null },
    maxInvoices: { type: Number, default: null },
    maxStorage: { type: Number, default: null },
    // Company lock override (mirrors Company.status for config bundle)
    isLocked: { type: Boolean, default: false },
    lockReason: { type: String, default: '' },
    ...configMetaSchema
}, { timestamps: true });

module.exports = mongoose.model('CompanySettings', CompanySettingsSchema);
