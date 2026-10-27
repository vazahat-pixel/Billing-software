/**
 * Offline entries arrive with the number the device guessed while it had no connection
 * (e.g. purchase 6). If the cloud already used that number (someone made purchase 6 online),
 * the synced entry takes the next number of the same series instead of failing on every retry.
 * Only applies to requests from the offline sync queue (header X-Offline-Sync: 1).
 */
const isOfflineSync = (req) => String(req.headers['x-offline-sync'] || '') === '1';

/** True when any of `fields` already holds `value` for this company. */
async function numberTaken(Model, companyId, fields, value) {
  const v = String(value ?? '').trim();
  if (!v || v.toUpperCase() === 'AUTO') return false;
  const or = fields.map((f) => ({ [f]: v }));
  return !!(await Model.exists({ companyId, $or: or }));
}

/**
 * Sets `body[field] = 'AUTO'` (next number in the series) when the requested number is taken.
 * Returns the original number when it was replaced, else null. The reply carries
 * X-Renumbered-From so the device can tell the user "offline 6 is now 7".
 */
// Placeholders the device writes when it could not get a number offline (OFF-INV-…, OFF-PUR-…, JC-OFF-…).
const OFFLINE_PLACEHOLDER = /^(OFF-[A-Z]+-|JC-OFF-)/i;

async function renumberIfTaken(req, res, { Model, field, alsoCheck = [], clear = [] }) {
  if (!isOfflineSync(req)) return null;
  const requested = req.body?.[field];
  const placeholder = OFFLINE_PLACEHOLDER.test(String(requested ?? '').trim());
  if (!placeholder && !(await numberTaken(Model, req.companyId, [field, ...alsoCheck], requested))) return null;
  req.body[field] = 'AUTO';
  for (const f of clear) delete req.body[f];
  res.set('X-Renumbered-From', String(requested));
  return String(requested);
}

module.exports = { isOfflineSync, numberTaken, renumberIfTaken };
