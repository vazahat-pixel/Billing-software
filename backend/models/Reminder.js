const mongoose = require('mongoose');

const ReminderSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  date: { type: Date, required: true },
  description: { type: String, required: true, trim: true },
  amount: { type: Number, default: 0 },
  beforeRemindDays: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
  reminderFor: {
    type: String,
    enum: ['Daily', 'Monthly', 'Quarterly', 'Yearly', 'Half Yearly'],
    default: 'Monthly',
  },
}, { timestamps: true });

ReminderSchema.index({ companyId: 1, date: 1 });

module.exports = mongoose.model('Reminder', ReminderSchema);
