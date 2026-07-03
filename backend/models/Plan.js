const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        enum: ['Basic', 'Standard', 'Pro', 'Custom'],
        unique: true
    },
    priceMonthly: { type: Number, required: true },
    priceYearly: { type: Number, required: true },
    features: {
        offlineMode: { type: Boolean, default: false },
        modules: {
            purchase: { type: Boolean, default: false },
            inventory: { type: Boolean, default: false },
            jobWork: { type: Boolean, default: false },
            sales: { type: Boolean, default: false },
            accounting: { type: Boolean, default: false },
            gst: { type: Boolean, default: false },
            reports: { type: Boolean, default: false },
            offline: { type: Boolean, default: false }
        },
        fields: {
            purchase: {
                broker: { type: Boolean, default: false },
                lrNo: { type: Boolean, default: false },
                discount2: { type: Boolean, default: false }
            },
            sales: {
                bale: { type: Boolean, default: false },
                weight: { type: Boolean, default: false },
                challan: { type: Boolean, default: false }
            }
        }
    },
    limits: {
        users: { type: Number, default: 1 },
        invoicesPerMonth: { type: Number, default: 100 },
        storageMb: { type: Number, default: 500 }
    },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);
