'use strict';
// node --test desktop/tests/modePolicy.test.cjs
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const p = require('../localRuntime/modePolicy');

const shipped = { mode: 'hybrid' };
const CLOUD = 'https://cloud.example/api';

test('failed start: remote now, hybrid again once the queue is empty', () => {
  const c = p.afterFailedStart({ mode: 'hybrid', apiPort: 5050 }, shipped, CLOUD, 'boom');
  assert.equal(c.mode, 'remote');
  assert.equal(c.hybridRetry, true);
  assert.equal(c.apiPort, 5050);
  assert.equal(c.apiBaseUrl, CLOUD);
  assert.equal(p.onQueueReport(c, 0).mode, 'hybrid');
});

test('entries waiting keep the PC remote, including when they appear after re-arming', () => {
  const c = p.afterFailedStart({ mode: 'hybrid' }, shipped, CLOUD, 'boom');
  assert.equal(p.onQueueReport(c, 2), null);
  const armed = p.onQueueReport(c, 0);
  assert.equal(p.onQueueReport(armed, 1).mode, 'remote');
  assert.equal(p.onQueueReport(armed, 0), null);
});

test('fresh PC with no saved config whose first start fails also retries', () => {
  assert.equal(p.afterFailedStart({}, shipped, CLOUD, 'x').hybridRetry, true);
});

test('a PC in plain local mode is not turned into hybrid', () => {
  const c = p.afterFailedStart({ mode: 'local' }, shipped, CLOUD, 'x');
  assert.equal(c.hybridRetry, undefined);
  assert.equal(p.onQueueReport(c, 0), null);
});

test('repeated failures count up; a good start clears them', () => {
  let c = p.afterFailedStart({ mode: 'hybrid' }, shipped, CLOUD, 'a');
  c = p.afterFailedStart(p.onQueueReport(c, 0), shipped, CLOUD, 'b');
  assert.equal(c.hybridFailCount, 2);
  assert.deepEqual(Object.keys(p.afterGoodStart(c)).filter((k) => k.startsWith('hybrid')), []);
  assert.equal(p.afterGoodStart({ mode: 'hybrid' }), null);
});

test('offer: old remote PC and stuck PC yes; same version, retrying, or cloud-only installer no', () => {
  assert.equal(p.shouldOfferMirror({ mode: 'remote' }, shipped, '1.0.16'), true);
  assert.equal(p.shouldOfferMirror({ mode: 'remote', mirrorSwitchedAt: 'x' }, shipped, '1.0.16'), true);
  assert.equal(p.shouldOfferMirror({ mode: 'remote', mirrorSwitchVersion: '1.0.16' }, shipped, '1.0.16'), false);
  assert.equal(p.shouldOfferMirror({ mode: 'remote', hybridRetry: true }, shipped, '1.0.16'), false);
  assert.equal(p.shouldOfferMirror({ mode: 'remote' }, { mode: 'remote' }, '1.0.16'), false);
});

test('every local module the desktop requires is in the installer file list', () => {
  const root = path.join(__dirname, '..');
  const files = require('../package.json').build.files;
  const yml = fs.readFileSync(path.join(root, 'electron-builder.yml'), 'utf8');
  for (const f of ['main.js', 'preload.js', 'updater.js', 'machineId.js']) {
    for (const m of fs.readFileSync(path.join(root, f), 'utf8').matchAll(/require\(["']\.\/([^"']+)["']\)/g)) {
      const top = m[1].split('/')[0];
      const entry = [`${top}.js`, `${top}/**/*`].find((x) => files.includes(x));
      assert.ok(entry, `${f} requires ./${m[1]} but package.json does not ship it`);
      assert.ok(yml.includes(`- ${entry}`), `${entry} missing from electron-builder.yml`);
    }
  }
});
