const { seedMasters } = require('./seedMasters');
const { seedInventory } = require('./seedInventory');
const { seedUsers } = require('./seedUsers');
const logger = require('../utils/logger');

async function seedAutomationDefaults(companyId) {
  const documentEngineService = require('../../services/documentEngineService');
  const workflowEngineService = require('../../services/workflowEngineService');
  const businessAutomationService = require('../../services/businessAutomationService');
  await Promise.all([
    documentEngineService.seedTemplates(companyId).catch(() => {}),
    workflowEngineService.seedDefinitions(companyId).catch(() => {}),
    businessAutomationService.seedDefaults(companyId).catch(() => {}),
  ]);
}

async function seedAll(ctx) {
  logger.info('Running seed:all', { profile: ctx.profile.name });
  await seedMasters(ctx);
  await seedUsers(ctx);
  await seedInventory(ctx);
  if (ctx.companyId) {
    await seedAutomationDefaults(ctx.companyId);
  }
  return ctx.masters;
}

module.exports = { seedAll };
