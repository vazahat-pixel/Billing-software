const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const PermissionMatrix = require('../../models/PermissionMatrix');
const { DEFAULT_PERMISSION_MATRIX } = require('../../config/defaultConfigs');
const { resolveCompanyId } = require('../utils/tenant');
const logger = require('../utils/logger');

const QA_USERS = [
  { name: 'QA Admin', emailSuffix: 'admin', companyRole: 'admin' },
  { name: 'QA Manager', emailSuffix: 'manager', companyRole: 'manager' },
  { name: 'QA Accountant', emailSuffix: 'accountant', companyRole: 'accountant' },
  { name: 'QA Salesman', emailSuffix: 'salesman', companyRole: 'salesman' },
];

async function seedUsers(ctx) {
  const companyId = await resolveCompanyId(ctx);
  const profile = ctx.profile.name;
  const password = process.env.QA_DEFAULT_PASSWORD || 'QaTenant@123';
  const hash = await bcrypt.hash(password, 10);
  const users = [];

  for (const spec of QA_USERS) {
    const email = `qa.${profile}.${spec.emailSuffix}@textileerp.dev`;
    const user = await User.findOneAndUpdate(
      { email },
      {
        name: spec.name,
        password: hash,
        role: 'user',
        companyRole: spec.companyRole,
        companyId,
        isActive: true,
      },
      { upsert: true, new: true }
    );
    users.push({ id: user._id, email, role: spec.companyRole });
  }

  await PermissionMatrix.findOneAndUpdate(
    { companyId },
    { $set: { roles: DEFAULT_PERMISSION_MATRIX } },
    { upsert: true }
  );

  logger.info('Seeded QA users', { count: users.length, companyId: String(companyId) });
  ctx.masters.users = users;
  return users;
}

module.exports = { seedUsers };
