const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    partyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Party',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    visitDate: {
        type: Date,
        default: Date.now
    },
    purpose: {
        type: String,
        required: true,
        enum: ['Sales', 'Payment Collection', 'Service', 'Complaint', 'Other']
    },
    discussion: {
        type: String,
        required: true
    },
    outcome: {
        type: String
    },
    nextFollowUp: {
        type: Date
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Follow-up Required'],
        default: 'Completed'
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            default: [0, 0]
        }
    }
}, { timestamps: true });

visitSchema.index({ location: '2dsphere' });
visitSchema.index({ companyId: 1, visitDate: -1 });

module.exports = mongoose.model('Visit', visitSchema);
