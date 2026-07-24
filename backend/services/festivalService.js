const path = require('path');
const fs = require('fs');
const FestivalCalendar = require('../models/FestivalCalendar');

const SEED_PATH = path.join(__dirname, '../data/festivalCalendar.json');

function loadSeedFile() {
  const raw = fs.readFileSync(SEED_PATH, 'utf8');
  return JSON.parse(raw);
}

async function ensureSeeded() {
  const seed = loadSeedFile();
  const years = Object.keys(seed.years || {});
  for (const yearStr of years) {
    const year = Number(yearStr);
    const existing = await FestivalCalendar.findOne({ year }).lean();
    if (!existing) {
      await FestivalCalendar.create({
        year,
        festivals: seed.years[yearStr],
        source: 'seed',
      });
    }
  }
}

function toDateOnly(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function inRange(iso, start, end) {
  return iso >= start && iso <= end;
}

async function listYears() {
  await ensureSeeded();
  return FestivalCalendar.find({}).sort({ year: 1 }).lean();
}

async function getYear(year) {
  await ensureSeeded();
  let doc = await FestivalCalendar.findOne({ year: Number(year) }).lean();
  if (!doc) {
    const seed = loadSeedFile();
    const festivals = seed.years?.[String(year)];
    if (festivals) {
      doc = (await FestivalCalendar.create({ year: Number(year), festivals, source: 'seed' })).toObject();
    }
  }
  return doc;
}

async function upsertYear(year, festivals, notes = '') {
  return FestivalCalendar.findOneAndUpdate(
    { year: Number(year) },
    { $set: { festivals, notes, source: 'manual' } },
    { upsert: true, new: true }
  ).lean();
}

async function getActiveFestival(date = new Date()) {
  await ensureSeeded();
  const iso = toDateOnly(date);
  if (!iso) return null;
  const year = Number(iso.slice(0, 4));
  const doc = await getYear(year);
  if (!doc?.festivals?.length) return null;
  const hit = doc.festivals.find((f) => inRange(iso, f.start, f.end));
  return hit || null;
}

module.exports = {
  ensureSeeded,
  listYears,
  getYear,
  upsertYear,
  getActiveFestival,
  toDateOnly,
};
