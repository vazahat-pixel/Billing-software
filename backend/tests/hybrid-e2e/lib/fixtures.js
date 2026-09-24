'use strict';

/**
 * Seed disposable hybrid E2E fixtures into a Mongo URI (before or via mongoose).
 */
const mongoose = require('mongoose');
const { assertNotProduction } = require('../../helpers/memoryDb');

async function withMongoose(uri, fn) {
  assertNotProduction(uri);
  const prev = process.env.MONGO_URI;
  process.env.MONGO_URI = uri;
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  // Clear model cache conflicts when reconnecting
  await mongoose.connect(uri);
  try {
    return await fn(mongoose);
  } finally {
    await mongoose.disconnect();
    if (prev) process.env.MONGO_URI = prev;
    else delete process.env.MONGO_URI;
  }
}

async function seedCentralFixtures(uri, stamp) {
  return withMongoose(uri, async () => {
    const Plan = require('../../../models/Plan');
    const Company = require('../../../models/Company');
    const User = require('../../../models/User');
    const Party = require('../../../models/Party');
    const Item = require('../../../models/Item');
    const InventoryLot = require('../../../models/InventoryLot');
    const License = require('../../../models/License');
    const CompanyModuleConfig = require('../../../models/CompanyModuleConfig');
    const configService = require('../../../services/configService');
    const { generateLicenseKey } = require('../../../utils/license');

    const tag = `HYBRID-E2E-${stamp}`;
    const ownerId = new mongoose.Types.ObjectId();
    const plan = await Plan.create({
      name: `${tag}-PLAN`,
      slug: `hybrid-e2e-${stamp}`,
      priceMonthly: 0,
      priceYearly: 0,
      features: {
        modules: {
          sales: true,
          purchase: true,
          inventory: true,
          accounting: true,
          gst: true,
          masters: true,
          reports: true,
        },
        offlineMode: true,
      },
    });

    const company = await Company.create({
      name: `${tag}-COMPANY`,
      status: 'active',
      isActive: true,
      ownerId,
      planId: plan._id,
      commercialPolicy: 'saas_enforced',
    });

    const password = 'HybridE2ePass123!';
    const email = `hybrid.e2e.user.${stamp}@test.local`;
    const user = await User.create({
      name: 'HYBRID-E2E-USER',
      email,
      password,
      role: 'user',
      companyRole: 'owner',
      companyId: company._id,
      isActive: true,
    });
    await Company.updateOne({ _id: company._id }, { $set: { ownerId: user._id } });

    await configService.seedCompanyDefaults(company._id);
    await CompanyModuleConfig.updateOne(
      { companyId: company._id },
      {
        $set: {
          'modules.sales': true,
          'modules.inventory': true,
          'modules.accounting': true,
          'modules.gst': true,
          'modules.masters': true,
        },
      },
      { upsert: true }
    );

    const crypto = require('crypto');
    const licenseKey = generateLicenseKey(String(company._id));
    const checksum = crypto
      .createHash('sha256')
      .update(`${company._id}:${licenseKey}:${process.env.JWT_SECRET || 'hybrid-e2e'}`)
      .digest('hex')
      .substring(0, 16)
      .toUpperCase();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    await License.create({
      companyId: company._id,
      licenseKey,
      expiresAt,
      checksum,
      isActive: true,
      planTier: 'pro',
      maxDevices: 1,
      devices: [],
    });
    await Company.updateOne({ _id: company._id }, { $set: { licenseKey } });

    const Subscription = require('../../../models/Subscription');
    await Subscription.create({
      companyId: company._id,
      planId: plan._id,
      status: 'active',
      startDate: new Date(),
      endDate: expiresAt,
      billingCycle: 'yearly',
    });

    const party = await Party.create({
      companyId: company._id,
      name: `${tag}-CUSTOMER`,
      type: 'Customer',
      state: 'Gujarat',
      stateCode: '24',
    });

    const item = await Item.create({
      companyId: company._id,
      name: `${tag}-PRODUCT`,
      unit: 'MTRS',
      category: 'Grey',
      gstRate: 5,
      salesRate: 100,
    });

    const lot = await InventoryLot.create({
      companyId: company._id,
      itemId: item._id,
      lotId: `${tag}-LOT`,
      totalMtrs: 500,
      remainingMtrs: 500,
      totalPcs: 50,
      remainingPcs: 50,
      source: 'opening',
      status: 'Available',
    });

    // Company B for isolation tests
    const ownerB = new mongoose.Types.ObjectId();
    const companyB = await Company.create({
      name: `${tag}-COMPANY-B`,
      status: 'active',
      isActive: true,
      ownerId: ownerB,
      planId: plan._id,
    });
    const userB = await User.create({
      name: 'HYBRID-E2E-USER-B',
      email: `hybrid.e2e.b.${stamp}@test.local`,
      password,
      role: 'user',
      companyRole: 'owner',
      companyId: companyB._id,
      isActive: true,
    });
    await Company.updateOne({ _id: companyB._id }, { $set: { ownerId: userB._id } });
    await configService.seedCompanyDefaults(companyB._id);
    await Subscription.create({
      companyId: companyB._id,
      planId: plan._id,
      status: 'active',
      startDate: new Date(),
      endDate: expiresAt,
      billingCycle: 'yearly',
    });

    return {
      tag,
      password,
      email,
      companyId: String(company._id),
      userId: String(user._id),
      partyId: String(party._id),
      itemId: String(item._id),
      lotId: String(lot._id),
      companyBId: String(companyB._id),
      userBEmail: userB.email,
      deviceId: `${tag}-DEVICE`,
      deviceBId: `${tag}-DEVICE-B`,
      licenseKey,
      openingMtrs: 500,
      saleQty: 2,
      saleRate: 100,
    };
  });
}

async function snapshotStock(uri, companyId, itemId) {
  return withMongoose(uri, async () => {
    const InventoryLot = require('../../../models/InventoryLot');
    const StockMovement = require('../../../models/StockMovement');
    const Sales = require('../../../models/Sales');
    const AccountingEntry = require('../../../models/AccountingEntry');
    const SyncOutbox = require('../../../models/SyncOutbox');
    const ProcessedOperation = require('../../../models/ProcessedOperation');

    const lots = await InventoryLot.find({ companyId, itemId }).lean();
    const remainingMtrs = lots.reduce((s, l) => s + Number(l.remainingMtrs || 0), 0);
    return {
      remainingMtrs,
      lotCount: lots.length,
      salesCount: await Sales.countDocuments({ companyId }),
      stockMovements: await StockMovement.countDocuments({ companyId, type: 'SALE' }),
      accountingEntries: await AccountingEntry.countDocuments({ companyId }),
      outboxPending: await SyncOutbox.countDocuments({
        companyId,
        status: { $in: ['PENDING', 'SYNCING', 'RETRY', 'FAILED', 'CONFLICT'] },
      }),
      outboxSynced: await SyncOutbox.countDocuments({ companyId, status: 'SYNCED' }),
      processedOps: await ProcessedOperation.countDocuments({ companyId }),
    };
  });
}

async function findSalesByOperation(uri, companyId, operationId) {
  return withMongoose(uri, async () => {
    const Sales = require('../../../models/Sales');
    const StockMovement = require('../../../models/StockMovement');
    const AccountingEntry = require('../../../models/AccountingEntry');
    const SyncOutbox = require('../../../models/SyncOutbox');
    const ProcessedOperation = require('../../../models/ProcessedOperation');

    const sale = await Sales.findOne({ companyId, operationId }).lean();
    if (!sale) {
      return { sale: null, movements: [], accounting: [], outbox: null, processed: null };
    }
    const movements = await StockMovement.find({
      companyId,
      $or: [{ referenceId: sale._id }, { idempotencyKey: new RegExp(`^SALE:${operationId}:`) }],
    }).lean();
    const accounting = sale.accountingEntryId
      ? await AccountingEntry.find({ _id: sale.accountingEntryId, companyId }).lean()
      : await AccountingEntry.find({ companyId, refType: 'SalesInvoice', refId: sale._id }).lean();
    const outbox = await SyncOutbox.findOne({ companyId, operationId }).lean();
    const processed = await ProcessedOperation.findOne({ companyId, operationId }).lean();
    return { sale, movements, accounting, outbox, processed };
  });
}

module.exports = {
  seedCentralFixtures,
  snapshotStock,
  findSalesByOperation,
  withMongoose,
};
