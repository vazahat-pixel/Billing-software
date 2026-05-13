const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    itemName: { type: String, required: true },
    lotNo: { type: String, required: true },
    currentStock: { type: Number, default: 0 },
    unit: { type: String, default: 'Mtrs' },
    purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' },
    lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

// Ensure unique lot numbers within a company
inventorySchema.index({ companyId: 1, lotNo: 1 }, { unique: true });

module.exports = mongoose.model('Inventory', inventorySchema);
