/**
 * Pilot rollout flag helpers for hybrid cloud-authoritative sync.
 *
 * Production checklist (Phase 9):
 * - HYBRID_SYNC_ENABLED=true on central
 * - DEVICE_BINDING_ENFORCE=true
 * - MODULE_GATE_ENFORCE=true
 * - Desktop config mode=hybrid + centralApiBaseUrl
 * - Pilot one company, Sales-only, maxDevices=1
 * - Certify: no duplicate invoices/stock, no cross-company leakage, online Sales unchanged
 */
function isHybridSyncEnabled() {
  return String(process.env.HYBRID_SYNC_ENABLED || '').toLowerCase() === 'true';
}

function isDesktopHybrid() {
  return (
    String(process.env.DESKTOP_HYBRID || '').toLowerCase() === 'true' &&
    String(process.env.DESKTOP_LOCAL || '').toLowerCase() === 'true'
  );
}

function pilotGatesOk() {
  return {
    hybridSyncEnabled: isHybridSyncEnabled(),
    deviceBindingEnforce:
      String(process.env.DEVICE_BINDING_ENFORCE || '').toLowerCase() === 'true',
    moduleGateEnforce:
      String(process.env.MODULE_GATE_ENFORCE || '').toLowerCase() === 'true',
    desktopHybrid: isDesktopHybrid(),
  };
}

module.exports = {
  isHybridSyncEnabled,
  isDesktopHybrid,
  pilotGatesOk,
};
