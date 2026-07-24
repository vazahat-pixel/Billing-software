const mongoose = require('mongoose');

/**
 * Isolated yearly Hindu festival windows for invoice festive theming.
 * Update documents per year without redeploying fixed Gregorian dates.
 */
const FestivalEntrySchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  greeting: { type: String, default: '' },
  start: { type: String, required: true }, // YYYY-MM-DD
  end: { type: String, required: true },   // YYYY-MM-DD
  motif: { type: String, default: 'marigold' },
  accents: {
    primary: { type: String, default: '#7f1d1d' },
    secondary: { type: String, default: '#d97706' },
  },
}, { _id: false });

const FestivalCalendarSchema = new mongoose.Schema({
  year: { type: Number, required: true, unique: true, index: true },
  festivals: { type: [FestivalEntrySchema], default: [] },
  source: { type: String, default: 'seed' },
  notes: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('FestivalCalendar', FestivalCalendarSchema);
