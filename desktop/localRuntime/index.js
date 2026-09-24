'use strict';

/**
 * Boot / shutdown the full local stack: mongod + Express API.
 * Modes: local | hybrid | remote
 * - local: standalone offline (local SoR)
 * - hybrid: local Express+Mongo execution + sync to centralApiBaseUrl
 * - remote: UI points at external API only (no embedded stack)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { findFreePort } = require('./ports');
const { startMongo, stopMongo } = require('./mongoLauncher');
const { startApi, stopApi } = require('./apiLauncher');

function readJson(file) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    /* ignore */
  }
  return null;
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
}

function ensureJwtSecret(userData) {
  const secretFile = path.join(userData, 'jwt.secret');
  if (fs.existsSync(secretFile)) {
    return fs.readFileSync(secretFile, 'utf8').trim();
  }
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretFile, secret, 'utf8');
  return secret;
}

/**
 * @param {{
 *   userData: string,
 *   desktopRoot: string,
 *   resourcesPath?: string,
 *   isPackaged?: boolean,
 * }} ctx
 */
async function bootLocalStack(ctx) {
  const userData = ctx.userData;
  const cfgPath = path.join(userData, 'config.json');
  const desktopCfg = ctx.desktopRoot ? readJson(path.join(ctx.desktopRoot, 'config.json')) : null;
  const exampleCfg = ctx.desktopRoot ? readJson(path.join(ctx.desktopRoot, 'config.example.json')) : null;
  const cfg = { ...(exampleCfg || {}), ...(desktopCfg || {}), ...(readJson(cfgPath) || {}) };

  const mode = String(cfg.mode || process.env.ERP_DESKTOP_MODE || 'hybrid').toLowerCase();

  if (mode === 'remote' && cfg.apiBaseUrl && !process.env.ERP_FORCE_LOCAL) {
    writeJson(cfgPath, {
      ...cfg,
      mode: 'remote',
      apiBaseUrl: String(cfg.apiBaseUrl).replace(/\/$/, ''),
    });
    return {
      mode: 'remote',
      apiBaseUrl: String(cfg.apiBaseUrl).replace(/\/$/, ''),
      centralApiBaseUrl: cfg.centralApiBaseUrl || null,
      configPath: cfgPath,
    };
  }

  const isHybrid = mode === 'hybrid';
  const dataRoot = path.join(userData, 'data');
  const mongoData = path.join(dataRoot, 'mongo');
  const mongoLog = path.join(userData, 'logs', 'mongod.log');
  fs.mkdirSync(mongoData, { recursive: true });
  fs.mkdirSync(path.join(userData, 'logs'), { recursive: true });

  const preferredApi = Number(cfg.apiPort || 5050);
  const apiPort = await findFreePort(
    process.env.DESKTOP_API_PORT ? Number(process.env.DESKTOP_API_PORT) : preferredApi
  );
  const mongoPort = await findFreePort(Number(cfg.mongoPort || 27028));
  const jwtSecret = ensureJwtSecret(userData);

  // Hybrid + local: single-node replica set for ACID withTransaction
  const mongo = await startMongo({
    dataDir: mongoData,
    port: mongoPort,
    logPath: mongoLog,
    resourcesPath: ctx.resourcesPath,
    desktopRoot: ctx.desktopRoot,
    replicaSet: 'rs0',
  });

  const centralApiBaseUrl = cfg.centralApiBaseUrl
    ? String(cfg.centralApiBaseUrl).replace(/\/$/, '')
    : process.env.CENTRAL_API_BASE_URL || '';

  const api = await startApi({
    port: apiPort,
    mongoUri: mongo.uri,
    userData,
    desktopRoot: ctx.desktopRoot,
    resourcesPath: ctx.resourcesPath,
    jwtSecret,
    hybrid: isHybrid,
    centralApiBaseUrl,
  });

  const apiBaseUrl = `http://127.0.0.1:${apiPort}/api`;
  const nextCfg = {
    ...cfg,
    mode: isHybrid ? 'hybrid' : 'local',
    apiBaseUrl,
    apiPort,
    mongoPort: mongo.port,
    mongoUri: mongo.uri,
    centralApiBaseUrl: centralApiBaseUrl || cfg.centralApiBaseUrl || '',
    note: isHybrid
      ? 'Hybrid: local Express+Mongo executes ERP; syncs to centralApiBaseUrl when online.'
      : 'Standalone offline desktop — local Mongo + API.',
  };
  writeJson(cfgPath, nextCfg);

  return {
    mode: nextCfg.mode,
    apiBaseUrl,
    apiPort,
    mongoPort: mongo.port,
    mongoUri: mongo.uri,
    centralApiBaseUrl: nextCfg.centralApiBaseUrl || null,
    configPath: cfgPath,
    api,
    mongo,
  };
}

async function shutdownLocalStack() {
  await stopApi();
  await stopMongo();
}

module.exports = { bootLocalStack, shutdownLocalStack, ensureJwtSecret };
