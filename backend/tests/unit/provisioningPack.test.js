'use strict';

/**
 * Provisioning pack + desktop activation — security & apply flow.
 * Does NOT touch sales/purchase/GST calculation modules.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { bootIsolatedApp } = require('../helpers/isolatedApp');

describe('provisioningPack + desktop activate', () => {
  let ctx;
  let pack;
  let companyId;
  let ownerEmail;
  const JWT = 'ci-test-jwt-secret-minimum-32-characters-long';
  const PACK_SECRET = 'provisioning-pack-hmac-secret-32chars!!';

  before(async () => {
    ctx = await bootIsolatedApp({
      JWT_SECRET: JWT,
      PROVISIONING_PACK_SECRET: PACK_SECRET,
      ALLOW_PUBLIC_REGISTER: 'true',
      DESKTOP_LOCAL: 'false',
    });

    const Plan = require('../../models/Plan');
    const User = require('../../models/User');
    const Company = require('../../models/Company');
    const License = require('../../models/License');
    const Subscription = require('../../models/Subscription');
    const { generateLicenseKey } = require('../../utils/license');
    const crypto = require('crypto');
    const provisioning = require('../../services/provisioningPackService');

    const plan = await Plan.create({
      name: 'Desktop Pro',
      slug: 'desktop-pro-test',
      priceMonthly: 999,
      priceYearly: 9990,
      trialDays: 0,
      features: { sales: true, purchase: true, gst: true },
      limits: { users: 5 },
    });

    const owner = await User.create({
      name: 'Pack Owner',
      email: `owner.pack.${Date.now()}@test.local`,
      password: 'TempWebPass1!',
      role: 'user',
      companyRole: 'owner',
      isActive: true,
    });
    ownerEmail = owner.email;

    const company = await Company.create({
      name: 'Provisioned Textile Co',
      ownerId: owner._id,
      planId: plan._id,
      status: 'active',
      isActive: true,
      commercialPolicy: 'saas_enforced',
    });
    companyId = company._id;
    owner.companyId = company._id;
    await owner.save();

    const key = generateLicenseKey(String(company._id));
    const checksum = crypto
      .createHash('sha256')
      .update(`${company._id}:${key}:${JWT}`)
      .digest('hex')
      .substring(0, 16)
      .toUpperCase();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    await License.create({
      companyId: company._id,
      licenseKey: key,
      expiresAt,
      checksum,
      isActive: true,
      planTier: 'pro',
      maxDevices: 1,
    });

    await Subscription.create({
      companyId: company._id,
      planId: plan._id,
      status: 'active',
      startDate: new Date(),
      endDate: expiresAt,
      billingCycle: 'yearly',
      offlineModeEnabled: true,
    });

    await Company.findByIdAndUpdate(company._id, { licenseKey: key });

    pack = await provisioning.buildProvisioningPack(company._id, { issuedBy: null });
    assert.ok(pack.signature);
    assert.ok(pack.payload);
    assert.equal(pack.payload.company.name, 'Provisioned Textile Co');
    assert.ok(!JSON.stringify(pack).includes('TempWebPass1!'), 'pack must not contain plaintext password');
  });

  after(async () => {
    if (ctx) await ctx.shutdown();
  });

  it('validates a signed pack', () => {
    const provisioning = require('../../services/provisioningPackService');
    const summary = provisioning.validateProvisioningPack(pack);
    assert.equal(summary.ok, true);
    assert.equal(summary.companyName, 'Provisioned Textile Co');
  });

  it('rejects tampered pack', () => {
    const provisioning = require('../../services/provisioningPackService');
    const bad = JSON.parse(JSON.stringify(pack));
    bad.payload.company.name = 'Hacker Co';
    assert.throws(() => provisioning.validateProvisioningPack(bad), /signature|tampered|forbidden/i);
  });

  it('rejects expired license in pack', () => {
    const provisioning = require('../../services/provisioningPackService');
    const bad = JSON.parse(JSON.stringify(pack));
    bad.payload.license.expiresAt = new Date(Date.now() - 86400000).toISOString();
    // Re-sign with same secret so integrity passes but expiry fails
    bad.signature = provisioning.signPayload(bad.payload);
    assert.throws(() => provisioning.validateProvisioningPack(bad), /expired/i);
  });

  it('applies pack on desktop and sets owner password', async () => {
    process.env.DESKTOP_LOCAL = 'true';
    const provisioning = require('../../services/provisioningPackService');
    const User = require('../../models/User');

    const result = await provisioning.applyProvisioningPack(pack, {
      password: 'DesktopOwner@123',
      deviceId: 'test-device-1',
      deviceName: 'CI Desktop',
    });
    assert.equal(result.companyName, 'Provisioned Textile Co');

    const owner = await User.findOne({ email: ownerEmail }).select('+password');
    assert.ok(owner);
    const match = await owner.comparePassword('DesktopOwner@123');
    assert.equal(match, true);
  });

  it('blocks duplicate activation (replay)', async () => {
    process.env.DESKTOP_LOCAL = 'true';
    const provisioning = require('../../services/provisioningPackService');
    await assert.rejects(
      () =>
        provisioning.applyProvisioningPack(pack, {
          password: 'DesktopOwner@123',
          deviceId: 'test-device-1',
        }),
      /already activated/i
    );
  });

  it('blocks auth.register when DESKTOP_LOCAL', async () => {
    process.env.DESKTOP_LOCAL = 'true';
    const res = await ctx.request(ctx.app).post('/api/auth/register').send({
      name: 'X',
      email: `blocked.${Date.now()}@test.local`,
      password: 'BlockedPass1!',
      companyName: 'Should Not Exist',
    });
    assert.equal(res.status, 403);
    assert.match(String(res.body.message || res.body.code || ''), /activation|disabled|DESKTOP/i);
  });

  it('desktop activation-status reports activated', async () => {
    process.env.DESKTOP_LOCAL = 'true';
    const res = await ctx.request(ctx.app).get('/api/desktop/activation-status');
    assert.equal(res.status, 200);
    assert.equal(res.body.data?.activated || res.body.activated, true);
  });

  it('desktop validate-pack endpoint works', async () => {
    process.env.DESKTOP_LOCAL = 'true';
    const res = await ctx.request(ctx.app).post('/api/desktop/validate-pack').send({ pack });
    assert.equal(res.status, 200);
    assert.equal(res.body.data?.ok || res.body.ok, true);
  });
});
