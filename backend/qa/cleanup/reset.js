const { QaContext } = require('../context');
const { cleanByProfile } = require('./clean');
const { seedAll } = require('../seed/seedAll');

async function resetQa(profile = 'smoke') {
  const ctx = new QaContext({ profile });
  await ctx.connect();
  await cleanByProfile(ctx.profile.name);
  await seedAll(ctx);
  await ctx.disconnect();
  return { companyId: String(ctx.companyId), profile: ctx.profile.name };
}

module.exports = { resetQa };
