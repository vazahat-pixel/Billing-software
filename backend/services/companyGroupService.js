const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Company = require('../models/Company');
const Subscription = require('../models/Subscription');
const License = require('../models/License');
const CompanySettings = require('../models/CompanySettings');
const UserSession = require('../models/UserSession');
const { generateLicenseKey } = require('../utils/license');

const fyStart = () => {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-04-01`;
};
const fyEnd = () => {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear();
  return `${y}-03-31`;
};

function isOwner(user) {
  return user && (user.companyRole === 'owner' || user.role === 'super_admin');
}

async function ensureHome(company) {
  if (!company) return null;
  let dirty = false;
  if (!company.groupCode) {
    company.groupCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    dirty = true;
  }
  if (!company.coCode) {
    company.coCode = '100';
    dirty = true;
  }
  if (!company.fyFrom) {
    company.fyFrom = fyStart();
    company.fyTo = fyEnd();
    dirty = true;
  }
  if (dirty) await company.save();
  return company;
}

async function masterId(companyId) {
  if (!companyId) return companyId;
  const company = await Company.findById(companyId).select('masterCompanyId').lean();
  return company?.masterCompanyId || companyId;
}

async function homeOf(user) {
  const home = await Company.findById(user.companyId);
  if (!home) return null;
  return ensureHome(home);
}

async function groupRootId(company) {
  return company?.masterCompanyId || company?._id;
}

function extractCompanyMeta(body = {}) {
  const bank = body.bankDetail || {};
  const others = body.others || {};
  return {
    shortName: String(body.shortName || '').trim(),
    codeRef: String(body.codeRef || body.coCode || '').trim(),
    address: String(body.address || '').trim(),
    address2: String(body.address2 || '').trim(),
    city: String(body.city || '').trim(),
    state: String(body.state || '').trim(),
    stateCode: String(body.stateCode || '').trim(),
    pincode: String(body.pincode || '').trim(),
    phone: String(body.phone || '').trim(),
    phone2: String(body.phone2 || '').trim(),
    mobile: String(body.mobile || '').trim(),
    fax: String(body.fax || '').trim(),
    email: String(body.email || '').trim(),
    portalPassword: String(body.portalPassword || '').trim(),
    website: String(body.website || '').trim(),
    designation: String(body.designation || '').trim(),
    signature: String(body.signature || '').trim(),
    pan: String(body.pan || '').toUpperCase().trim(),
    gstin: String(body.gstin || '').toUpperCase().trim(),
    msmeNumber: String(body.msmeNumber || '').trim(),
    tinCstNo: String(body.tinCstNo || '').trim(),
    serviceTaxNo: String(body.serviceTaxNo || '').trim(),
    tanNo: String(body.tanNo || '').toUpperCase().trim(),
    tcsApplicable: String(body.tcsApplicable || 'No'),
    tdsApplicable: String(body.tdsApplicable || 'Yes'),
    coDataPath: String(body.coDataPath || '').trim(),
    coType: String(body.coType || 'TEXT').trim(),
    bankDetail: {
      bankName: String(bank.bankName || '').trim(),
      accountNo: String(bank.accountNo || '').trim(),
      accountName: String(bank.accountName || '').trim(),
      ifsc: String(bank.ifsc || '').toUpperCase().trim(),
      branch: String(bank.branch || '').trim(),
      accountType: String(bank.accountType || 'Current').trim(),
      upiId: String(bank.upiId || '').trim(),
    },
    others: {
      cinNo: String(others.cinNo || '').trim(),
      iecNo: String(others.iecNo || '').trim(),
      udyamNo: String(others.udyamNo || '').trim(),
      ewayUsername: String(others.ewayUsername || '').trim(),
      ewayPassword: String(others.ewayPassword || '').trim(),
      einvoiceUsername: String(others.einvoiceUsername || '').trim(),
      einvoicePassword: String(others.einvoicePassword || '').trim(),
      jurisdiction: String(others.jurisdiction || '').trim(),
      notes: String(others.notes || '').trim(),
    },
  };
}

async function syncCompanySettings(companyId, name, meta, workType, fyFrom) {
  const bank = meta.bankDetail || {};
  await CompanySettings.findOneAndUpdate(
    { companyId },
    {
      legalName: name,
      shortName: meta.shortName || '',
      codeRef: meta.codeRef || '',
      businessType: workType || 'Textile',
      gstin: meta.gstin || '',
      pan: meta.pan || '',
      tan: meta.tanNo || '',
      msmeNumber: meta.msmeNumber || '',
      tinCstNo: meta.tinCstNo || '',
      serviceTaxNo: meta.serviceTaxNo || '',
      address: meta.address || '',
      address2: meta.address2 || '',
      city: meta.city || '',
      state: meta.state || '',
      stateCode: meta.stateCode || '',
      pincode: meta.pincode || '',
      phone: meta.phone || '',
      mobile: meta.mobile || '',
      fax: meta.fax || '',
      email: meta.email || '',
      website: meta.website || '',
      portalPassword: meta.portalPassword || '',
      designation: meta.designation || '',
      signature: meta.signature || '',
      bankName: bank.bankName || '',
      accountNo: bank.accountNo || '',
      accountName: bank.accountName || name,
      ifsc: bank.ifsc || '',
      bankBranch: bank.branch || '',
      upiId: bank.upiId || '',
      tdsEnabled: meta.tdsApplicable === 'Yes',
      tcsEnabled: meta.tcsApplicable === 'Yes',
      financialYear: String(fyFrom || '').slice(0, 4),
      coDataPath: meta.coDataPath || '',
      coType: meta.coType || 'TEXT',
      offlineModeEnabled: true,
    },
    { upsert: true }
  );
}

async function listForUser(user) {
  const home = await homeOf(user);
  if (!home) return { groupCode: '', companies: [] };
  const root = await groupRootId(home);
  const rows = await Company.find({
    isActive: { $ne: false },
    $or: [{ _id: root }, { masterCompanyId: root }],
  }).sort({ createdAt: 1 }).lean();

  const visible = rows;

  const companyIds = visible.map((r) => r._id);
  const settingsDocs = await CompanySettings.find({ companyId: { $in: companyIds } }).lean();
  const settingsMap = new Map(settingsDocs.map((s) => [String(s.companyId), s]));

  return {
    groupCode: home.groupCode,
    masterCompanyId: root,
    companies: visible.map((c) => present(c, settingsMap.get(String(c._id)))),
  };
}

function present(company, settings = null) {
  const from = company.fyFrom || fyStart();
  const to = company.fyTo || fyEnd();
  const meta = company.meta || {};
  const bank = meta.bankDetail || {};
  const sBank = {
    bankName: settings?.bankName || '',
    accountNo: settings?.accountNo || '',
    accountName: settings?.accountName || '',
    ifsc: settings?.ifsc || '',
    branch: settings?.bankBranch || '',
    upiId: settings?.upiId || '',
  };
  return {
    id: company._id,
    name: company.name,
    shortName: meta.shortName || settings?.shortName || '',
    coCode: company.coCode || '',
    codeRef: meta.codeRef || settings?.codeRef || String(company.coCode || ''),
    groupCode: company.groupCode || '',
    year: `${from} TO ${to}`,
    fyFrom: from,
    fyTo: to,
    workType: company.workType || settings?.businessType || '',
    address: meta.address || settings?.address || '',
    address2: meta.address2 || settings?.address2 || '',
    city: meta.city || settings?.city || '',
    state: meta.state || settings?.state || '',
    stateCode: meta.stateCode || settings?.stateCode || '',
    pincode: meta.pincode || settings?.pincode || '',
    phone: meta.phone || settings?.phone || '',
    phone2: meta.phone2 || '',
    mobile: meta.mobile || settings?.mobile || '',
    fax: meta.fax || settings?.fax || '',
    email: meta.email || settings?.email || '',
    portalPassword: meta.portalPassword || settings?.portalPassword || '',
    website: meta.website || settings?.website || '',
    designation: meta.designation || settings?.designation || '',
    signature: meta.signature || settings?.signature || '',
    pan: meta.pan || settings?.pan || '',
    gstin: meta.gstin || settings?.gstin || '',
    msmeNumber: meta.msmeNumber || settings?.msmeNumber || '',
    tinCstNo: meta.tinCstNo || settings?.tinCstNo || '',
    serviceTaxNo: meta.serviceTaxNo || settings?.serviceTaxNo || '',
    tanNo: meta.tanNo || settings?.tan || '',
    tcsApplicable: meta.tcsApplicable || (settings?.tcsEnabled ? 'Yes' : 'No'),
    tdsApplicable: meta.tdsApplicable || (settings?.tdsEnabled ? 'Yes' : 'No'),
    coDataPath: meta.coDataPath || settings?.coDataPath || '',
    coType: meta.coType || settings?.coType || 'TEXT',
    bankDetail: {
      bankName: bank.bankName || sBank.bankName || '',
      accountNo: bank.accountNo || sBank.accountNo || '',
      accountName: bank.accountName || sBank.accountName || '',
      ifsc: bank.ifsc || sBank.ifsc || '',
      branch: bank.branch || sBank.branch || '',
      accountType: bank.accountType || 'Current',
      upiId: bank.upiId || sBank.upiId || '',
    },
    others: meta.others || {},
    licenseKey: company.licenseKey || '',
    isMaster: !company.masterCompanyId,
    updatedAt: company.updatedAt,
    createdAt: company.createdAt,
  };
}

async function assertInGroup(user, companyId) {
  const home = await homeOf(user);
  if (!home) {
    const err = new Error('No company on this login');
    err.statusCode = 403;
    throw err;
  }
  const root = await groupRootId(home);
  const target = await Company.findById(companyId);
  if (!target || target.isActive === false) {
    const err = new Error('Company not found');
    err.statusCode = 404;
    throw err;
  }
  const targetRoot = target.masterCompanyId || target._id;
  if (String(targetRoot) !== String(root)) {
    const err = new Error('That company is not in your group');
    err.statusCode = 403;
    throw err;
  }
  return { home, target, root };
}

async function createSibling(user, body = {}) {
  const home = await homeOf(user);
  if (!home) {
    const err = new Error('No company on this login');
    err.statusCode = 403;
    throw err;
  }
  const code = String(body.groupCode || '').trim().toUpperCase();
  if (!code || code !== String(home.groupCode || '').toUpperCase()) {
    const err = new Error('Group code does not match this login');
    err.statusCode = 400;
    throw err;
  }
  const name = String(body.name || '').trim();
  if (!name) {
    const err = new Error('Company name is required');
    err.statusCode = 400;
    throw err;
  }
  const root = await groupRootId(home);
  const rootDoc = String(root) === String(home._id) ? home : await Company.findById(root);
  const siblings = await Company.find({ $or: [{ _id: root }, { masterCompanyId: root }] }).select('coCode').lean();
  let coCode = String(body.coCode || '').trim();
  if (!coCode) {
    const nums = siblings.map((row) => Number(row.coCode)).filter((n) => Number.isFinite(n));
    coCode = String((nums.length ? Math.max(...nums) : 100) + 1);
  }
  if (siblings.some((row) => String(row.coCode) === coCode)) {
    const err = new Error(`Company code ${coCode} is already used`);
    err.statusCode = 400;
    throw err;
  }

  const meta = extractCompanyMeta(body);
  const company = await Company.create({
    name,
    ownerId: rootDoc.ownerId || user._id,
    planId: rootDoc.planId,
    commercialPolicy: rootDoc.commercialPolicy || 'saas_enforced',
    status: 'active',
    isActive: true,
    groupCode: home.groupCode,
    coCode,
    masterCompanyId: root,
    workType: String(body.workType || '').trim(),
    fyFrom: body.fyFrom || fyStart(),
    fyTo: body.fyTo || fyEnd(),
    meta,
  });

  const accountingService = require('./accountingService');
  const configService = require('./configService');
  try {
    await accountingService.seedSystemLedgers(company._id);
    await configService.seedCompanyDefaults(company._id, user._id, null, { planId: rootDoc.planId });
    await syncCompanySettings(company._id, name, meta, company.workType, company.fyFrom);
  } catch (seedErr) {
    console.error('Sibling company seed failed:', seedErr.message);
  }

  const parentSub = await Subscription.findOne({ companyId: root }).lean();
  await Subscription.create({
    companyId: company._id,
    planId: rootDoc.planId,
    status: parentSub?.status || 'active',
    startDate: parentSub?.startDate || new Date(),
    endDate: parentSub?.endDate || new Date(fyEnd()),
    billingCycle: parentSub?.billingCycle || 'monthly',
    autoRenew: false,
    offlineModeEnabled: true,
  });

  const key = generateLicenseKey(company._id);
  const checksum = crypto.createHash('sha256')
    .update(`${company._id}:${key}:${process.env.JWT_SECRET || ''}`)
    .digest('hex')
    .substring(0, 16)
    .toUpperCase();
  await License.create({
    companyId: company._id,
    licenseKey: key,
    expiresAt: parentSub?.endDate || new Date(fyEnd()),
    isActive: true,
    checksum,
  });
  company.licenseKey = key;
  await company.save();
  const settings = await CompanySettings.findOne({ companyId: company._id }).lean();
  return present(company, settings);
}

function signForCompany(user, sessionId, companyId, masterCompanyId) {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      companyId,
      masterCompanyId,
      sid: sessionId,
      typ: 'access',
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '8h' }
  );
}

async function switchCompany(user, companyId, sessionId) {
  const { target, root } = await assertInGroup(user, companyId);
  if (sessionId) {
    await UserSession.updateOne(
      { sessionId, userId: user._id, status: 'active' },
      { activeCompanyId: target._id }
    );
  }
  const token = signForCompany(user, sessionId, target._id, root);
  const settings = await CompanySettings.findOne({ companyId: target._id }).lean();
  return { token, company: present(target, settings), masterCompanyId: root };
}

async function updateCompany(user, targetCompanyId, patch = {}) {
  const { target } = await assertInGroup(user, targetCompanyId || user.companyId);
  if (patch.name) target.name = String(patch.name).trim();
  if (patch.coCode) target.coCode = String(patch.coCode).trim();
  if (patch.workType != null) target.workType = String(patch.workType).trim();
  if (patch.fyFrom) target.fyFrom = patch.fyFrom;
  if (patch.fyTo) target.fyTo = patch.fyTo;

  const currentMeta = (target.meta && typeof target.meta === 'object') ? target.meta : {};
  const newMeta = extractCompanyMeta({ ...currentMeta, ...patch });
  target.meta = newMeta;
  target.markModified('meta');
  await target.save();

  await syncCompanySettings(target._id, target.name, newMeta, target.workType, target.fyFrom);
  const settings = await CompanySettings.findOne({ companyId: target._id }).lean();
  return present(target, settings);
}

async function updateActive(user, activeCompanyId, patch = {}) {
  return updateCompany(user, activeCompanyId, patch);
}

async function deleteCompany(user, companyId) {
  const { target, root } = await assertInGroup(user, companyId);
  if (String(target._id) === String(root)) {
    const err = new Error('Cannot delete primary master company');
    err.statusCode = 400;
    throw err;
  }
  if (String(target._id) === String(user.companyId)) {
    const err = new Error('Cannot delete currently open company. Switch to another company first.');
    err.statusCode = 400;
    throw err;
  }
  target.isActive = false;
  target.status = 'suspended';
  await target.save();
  return { success: true, message: 'Company removed successfully' };
}

async function resolveAccess(user, requestedCompanyId) {
  const home = await Company.findById(user.companyId).select('masterCompanyId groupCode').lean();
  const root = home?.masterCompanyId || user.companyId;
  const requested = requestedCompanyId || user.companyId;
  if (String(requested) === String(user.companyId) || String(requested) === String(root)) {
    return { companyId: requested, masterCompanyId: root };
  }
  const target = await Company.findById(requested).select('masterCompanyId isActive').lean();
  const targetRoot = target?.masterCompanyId || target?._id;
  if (target && target.isActive !== false && String(targetRoot) === String(root)) {
    return { companyId: requested, masterCompanyId: root };
  }
  return { companyId: user.companyId, masterCompanyId: root };
}

module.exports = {
  masterId,
  listForUser,
  createSibling,
  switchCompany,
  updateActive,
  updateCompany,
  deleteCompany,
  resolveAccess,
  present,
};
