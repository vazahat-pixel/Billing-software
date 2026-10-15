/**
 * Standalone Rollback Script: Safely revert Sanchal Creation master import from Surat Demo Textile Company.
 * 
 * Rules:
 * 1. Removes ONLY documents registered in 'jsm_master_mappings' for batch 'SANCHAL-MIGRATION-20261014'.
 * 2. Restores pre-import snapshots for updated records (PADMAVATI PRINT and VRAJ TEXTILES).
 * 3. Never touches or removes any pre-existing Surat Demo master records.
 * 4. Wrapped in a multi-document ACID transaction.
 */

const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const TARGET_COMPANY_ID = new mongoose.Types.ObjectId('6aaa80eab327c5ec12031bcc');
const BATCH_ID = 'SANCHAL-MIGRATION-20261014';

async function runRollback() {
  console.log(`\n======================================================================`);
  console.log(` SANCHAL MASTER IMPORT ROLLBACK RUNNER`);
  console.log(` Target Company: Surat Demo Textile Mills Pvt Ltd (${TARGET_COMPANY_ID})`);
  console.log(`======================================================================\n`);

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing from environment.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const mappingsColl = db.collection('jsm_master_mappings');
    const partiesColl = db.collection('parties');
    const itemsColl = db.collection('items');
    const submastersColl = db.collection('submasters');
    const ledgersColl = db.collection('ledgermasters');

    const mappings = await mappingsColl.find({ companyId: TARGET_COMPANY_ID, importBatch: BATCH_ID }).toArray();
    console.log(`[ROLLBACK] Found ${mappings.length} registered mappings for batch: ${BATCH_ID}`);

    let stats = {
      partiesDeleted: 0,
      partiesReverted: 0,
      itemsDeleted: 0,
      submastersDeleted: 0,
      ledgersDeleted: 0,
      mappingsRemoved: 0
    };

    for (const m of mappings) {
      if (m.action === 'INSERT') {
        if (m.targetModel === 'Party') {
          await partiesColl.deleteOne({ _id: m.targetId, companyId: TARGET_COMPANY_ID }, { session });
          await ledgersColl.deleteMany({ linkedPartyId: m.targetId, companyId: TARGET_COMPANY_ID }, { session });
          stats.partiesDeleted++;
        } else if (m.targetModel === 'Item') {
          await itemsColl.deleteOne({ _id: m.targetId, companyId: TARGET_COMPANY_ID }, { session });
          stats.itemsDeleted++;
        } else if (m.targetModel === 'SubMaster') {
          await submastersColl.deleteOne({ _id: m.targetId, companyId: TARGET_COMPANY_ID }, { session });
          stats.submastersDeleted++;
        } else if (m.targetModel === 'LedgerMaster') {
          await ledgersColl.deleteOne({ _id: m.targetId, companyId: TARGET_COMPANY_ID }, { session });
          stats.ledgersDeleted++;
        }
      } else if (m.action === 'UPDATE') {
        // Revert party snapshot
        if (m.preImportPartySnapshot) {
          await partiesColl.replaceOne(
            { _id: m.targetId, companyId: TARGET_COMPANY_ID },
            m.preImportPartySnapshot,
            { session }
          );
          stats.partiesReverted++;
        }
        // Revert ledger snapshot
        if (m.preImportLedgerSnapshot) {
          await ledgersColl.replaceOne(
            { _id: m.preImportLedgerSnapshot._id, companyId: TARGET_COMPANY_ID },
            m.preImportLedgerSnapshot,
            { session }
          );
        }
      }
    }

    await mappingsColl.deleteMany({ companyId: TARGET_COMPANY_ID, importBatch: BATCH_ID }, { session });
    stats.mappingsRemoved = mappings.length;

    await session.commitTransaction();
    console.log('\n[ROLLBACK COMMITTED] Successfully reverted all Sanchal migration additions!');
    console.log('[ROLLBACK SUMMARY]', JSON.stringify(stats, null, 2));

    await mongoose.disconnect();
    return { success: true, stats };
  } catch (err) {
    await session.abortTransaction();
    console.error('\n[ROLLBACK ABORTED] Error during rollback:', err.message);
    await mongoose.disconnect();
    throw err;
  } finally {
    session.endSession();
  }
}

if (require.main === module) {
  runRollback()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runRollback };
