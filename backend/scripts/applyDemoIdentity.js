/**
 * Patch demo company identity (GSTIN + legal name) without re-running transactions.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { gstinForState } = require('../qa/utils/faker');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const Company = require('../models/Company');
  const CompanySettings = require('../models/CompanySettings');
  const GstConfig = require('../models/GstConfig');

  const company = await Company.findOne({ isQaTenant: true, qaProfile: 'demo' });
  if (!company) {
    console.error('Demo company not found — run npm run seed:demo first');
    process.exit(1);
  }

  const gstin = gstinForState('Gujarat', 77);
  await Company.findByIdAndUpdate(company._id, {
    name: 'Surat Demo Textile Mills Pvt Ltd',
    meta: {
      ...(company.meta || {}),
      industry: 'Textile',
      state: 'Gujarat',
      gstin,
      city: 'Surat',
    },
  });
  await CompanySettings.findOneAndUpdate(
    { companyId: company._id },
    {
      $set: {
        legalName: 'Surat Demo Textile Mills Pvt Ltd',
        shortName: 'SDTM',
        gstin,
        pan: gstin.slice(2, 12),
        state: 'Gujarat',
        stateCode: '24',
        city: 'Surat',
        address: 'Ring Road, Textile Market, Surat',
        pincode: '395002',
        phone: '9825012345',
        email: 'accounts@suratdemo.textile',
        bankName: 'HDFC Bank',
        bankBranch: 'Ring Road Surat',
        accountNo: '50200012345678',
        ifsc: 'HDFC0001234',
        businessType: 'Textile',
        offlineModeEnabled: true,
        isActive: true,
        deletedAt: null,
      },
    },
    { upsert: true }
  );
  await GstConfig.findOneAndUpdate(
    { companyId: company._id },
    {
      $set: {
        gstin,
        stateCode: '24',
        stateName: 'Gujarat',
        registrationType: 'Regular',
        legalName: 'Surat Demo Textile Mills Pvt Ltd',
        tradeName: 'SDTM',
        isActive: true,
      },
    },
    { upsert: true }
  );

  const settings = await CompanySettings.findOne({ companyId: company._id }).lean();
  const parties = await require('../models/Party').countDocuments({
    companyId: company._id,
    gstin: { $exists: true, $nin: [null, ''] },
  });
  console.log(
    JSON.stringify({
      companyId: String(company._id),
      legalName: settings?.legalName,
      hasGstin: Boolean(settings?.gstin),
      gstinLen: settings?.gstin ? String(settings.gstin).length : 0,
      partiesWithGstin: parties,
    })
  );
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
