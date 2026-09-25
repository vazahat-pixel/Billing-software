const mongoose = require('mongoose');

function slugify(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'plan';
}

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    maxlength: 80,
  },
  slug: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
    maxlength: 80,
  },
  description: { type: String, default: '', maxlength: 500 },
  priceMonthly: { type: Number, required: true, min: 0 },
  priceYearly: { type: Number, required: true, min: 0 },
  trialDays: { type: Number, default: 14, min: 0, max: 365 },
  isPublic: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 100 },
  features: {
    offlineMode: { type: Boolean, default: false },
    /** Phone layout for the owner is view-only. Desktop billing stays editable. */
    mobileView: { type: Boolean, default: false },
    modules: {
      purchase: { type: Boolean, default: false },
      inventory: { type: Boolean, default: false },
      jobWork: { type: Boolean, default: false },
      sales: { type: Boolean, default: false },
      accounting: { type: Boolean, default: false },
      gst: { type: Boolean, default: false },
      reports: { type: Boolean, default: false },
      offline: { type: Boolean, default: false },
    },
    fields: {
      purchase: {
        broker: { type: Boolean, default: false },
        lrNo: { type: Boolean, default: false },
        discount2: { type: Boolean, default: false },
      },
      sales: {
        bale: { type: Boolean, default: false },
        weight: { type: Boolean, default: false },
        challan: { type: Boolean, default: false },
      },
    },
  },
  limits: {
    users: { type: Number, default: 1 },
    invoicesPerMonth: { type: Number, default: 100 },
    storageMb: { type: Number, default: 500 },
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

planSchema.pre('validate', function ensureSlug(next) {
  if (!this.slug && this.name) this.slug = slugify(this.name);
  next();
});

module.exports = mongoose.model('Plan', planSchema);
module.exports.slugify = slugify;
