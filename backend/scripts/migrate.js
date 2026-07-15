/**
 * Migration runner — applies pending migrations in order.
 *
 * Usage:
 *   node scripts/migrate.js
 *   node scripts/migrate.js --status
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Migration = require('../models/Migration');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function connect() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/billing-software';
  await mongoose.connect(uri);
  console.log('[migrate] connected');
}

function loadMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.*\.js$/.test(f))
    .sort()
    .map((file) => {
      const mod = require(path.join(MIGRATIONS_DIR, file));
      return {
        id: file.replace(/\.js$/, ''),
        name: mod.name || file,
        up: mod.up,
        down: mod.down,
      };
    });
}

async function status() {
  const all = loadMigrations();
  const applied = await Migration.find().lean();
  const appliedIds = new Set(applied.map((m) => m._id));
  console.log('Migration status:');
  for (const m of all) {
    console.log(`  ${appliedIds.has(m.id) ? '✓' : '○'} ${m.id} — ${m.name}`);
  }
}

async function up() {
  const all = loadMigrations();
  for (const m of all) {
    const exists = await Migration.findById(m.id);
    if (exists) {
      console.log(`[skip] ${m.id}`);
      continue;
    }
    console.log(`[up]   ${m.id} — ${m.name}`);
    if (typeof m.up !== 'function') throw new Error(`Migration ${m.id} missing up()`);
    await m.up(mongoose);
    await Migration.create({ _id: m.id, name: m.name, notes: 'Sprint 1.4' });
    console.log(`[done] ${m.id}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  await connect();
  try {
    if (args.includes('--status')) await status();
    else await up();
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
