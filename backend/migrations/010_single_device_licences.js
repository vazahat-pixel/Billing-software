/**
 * 010 — Move existing licences onto the one-computer model.
 *
 * The product is sold as "one company, one user, one computer", but licences
 * issued before device binding existed carry the old multi-device defaults
 * (maxDevices 3 or 5). Left alone, device binding would enforce nothing for
 * them — the whole point of Phase 3 would be inert for current customers.
 *
 * What this does:
 *   - sets maxDevices = 1 on every active licence that allows more
 *   - leaves alone any licence deliberately raised above 1 by an admin AFTER
 *     device binding shipped (detected by an active device already holding a
 *     second slot — narrowing those would lock a working machine out)
 *
 * Safe to re-run: a licence already at 1 is skipped.
 */
const TARGET_MAX_DEVICES = 1;

module.exports = {
  async up() {
    const License = require('../models/License');

    const licences = await License.find({ isActive: true });
    let updated = 0;
    let skippedAlready = 0;
    let skippedInUse = 0;

    for (const licence of licences) {
      const current = licence.maxDevices ?? 1;

      if (current <= TARGET_MAX_DEVICES) {
        skippedAlready += 1;
        continue;
      }

      // Never shrink a licence below the machines actually bound to it — that
      // would strand a customer who is legitimately using two computers today.
      const activeDevices = (licence.devices || []).filter((d) => d.active).length;
      if (activeDevices > TARGET_MAX_DEVICES) {
        skippedInUse += 1;
        console.log(
          `    skip ${licence.licenseKey}: ${activeDevices} devices already active (max stays ${current})`
        );
        continue;
      }

      licence.maxDevices = TARGET_MAX_DEVICES;
      await licence.save();
      updated += 1;
      console.log(`    ${licence.licenseKey}: maxDevices ${current} -> ${TARGET_MAX_DEVICES}`);
    }

    console.log(
      `    single-device migration done: updated=${updated}, already=${skippedAlready}, in-use=${skippedInUse}`
    );
  },

  async down() {
    // Deliberately not automatic: the pre-migration value differed per licence
    // (3 for trials, 5 for admin-generated) and is not recorded anywhere, so a
    // blanket restore would invent a number. Raise individual licences from the
    // admin panel instead (PUT /admin/company/:id/devices/max).
    console.log('    down: manual — raise maxDevices per licence from the admin panel');
  },
};
