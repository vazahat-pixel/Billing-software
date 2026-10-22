const mongoose = require('mongoose');

const emailOtpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  otpHash: {
    type: String,
    required: true,
  },
  purpose: {
    type: String,
    default: 'registration',
    enum: ['registration', 'login', 'password_reset'],
  },
  attempts: {
    type: Number,
    default: 0,
    max: 5,
  },
  resendAfter: {
    type: Date,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }, // MongoDB TTL auto-expire
  },
  verified: {
    type: Boolean,
    default: false,
  },
  verificationToken: {
    type: String,
    sparse: true,
    index: true,
  },
}, { timestamps: true });

emailOtpSchema.index({ email: 1, purpose: 1 });

module.exports = mongoose.model('EmailOtp', emailOtpSchema);
