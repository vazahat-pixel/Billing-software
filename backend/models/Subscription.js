const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    companyId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Company',
        required: true
    },
    planId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Plan',
        required: true
    },
    status: { 
        type: String, 
        enum: ['trial', 'active', 'expired'], 
        default: 'trial' 
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    billingCycle: { 
        type: String, 
        enum: ['monthly', 'yearly'], 
        required: true 
    },
    autoRenew: { type: Boolean, default: true },
    lastPaymentAt: { type: Date },
    offlineModeEnabled: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
