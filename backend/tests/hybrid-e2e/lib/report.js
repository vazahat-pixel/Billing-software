'use strict';

const fs = require('fs');
const path = require('path');

function createReport({ stamp, fixtures }) {
  const rows = [];
  const stats = {
    invoicesCreated: 0,
    invoicesSynced: 0,
    duplicateInvoices: 0,
    dataLossEvents: 0,
    stockMismatches: 0,
    financialMismatches: 0,
    conflicts: 0,
    recovered: 0,
  };

  return {
    pass(name, detail = '') {
      rows.push({ name, ok: true, detail });
    },
    fail(name, detail = '') {
      rows.push({ name, ok: false, detail });
    },
    stats,
    allPassed() {
      return rows.every((r) => r.ok);
    },
    render() {
      const lines = [];
      lines.push('==================================================');
      lines.push('HYBRID ERP SALES CERTIFICATION');
      lines.push('==================================================');
      lines.push('');
      lines.push('Environment: LOCAL TEST (isolated memory Mongo + dual API)');
      lines.push(`Company: ${fixtures?.tag || 'HYBRID-E2E'}-COMPANY`);
      lines.push(`Device: ${fixtures?.deviceId || 'HYBRID-E2E-DEVICE'}`);
      lines.push(`Run: HYBRID-E2E-${stamp}`);
      lines.push('');
      for (const r of rows) {
        lines.push(`[${r.ok ? 'PASS' : 'FAIL'}] ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
      }
      lines.push('');
      lines.push('==================================================');
      lines.push(`RESULT: ${this.allPassed() ? 'PASS' : 'FAIL'}`);
      lines.push('==================================================');
      lines.push('');
      lines.push(`Invoices created: ${stats.invoicesCreated}`);
      lines.push(`Invoices synchronized: ${stats.invoicesSynced}`);
      lines.push(`Duplicate invoices: ${stats.duplicateInvoices}`);
      lines.push(`Data-loss events: ${stats.dataLossEvents}`);
      lines.push(`Stock mismatches: ${stats.stockMismatches}`);
      lines.push(`Financial mismatches: ${stats.financialMismatches}`);
      lines.push(`Conflicts: ${stats.conflicts}`);
      lines.push(`Failed operations recovered: ${stats.recovered}`);
      lines.push('==================================================');
      return lines.join('\n');
    },
    write(artifactsDir) {
      fs.mkdirSync(artifactsDir, { recursive: true });
      const file = path.join(artifactsDir, `HYBRID-E2E-${stamp}-report.txt`);
      fs.writeFileSync(file, this.render(), 'utf8');
      return file;
    },
    dumpFailure(artifactsDir, payload) {
      fs.mkdirSync(artifactsDir, { recursive: true });
      const file = path.join(artifactsDir, `HYBRID-E2E-${stamp}-failure.json`);
      const safe = JSON.parse(
        JSON.stringify(payload, (k, v) =>
          /password|token|secret|authorization/i.test(String(k)) ? '[redacted]' : v
        )
      );
      fs.writeFileSync(file, JSON.stringify(safe, null, 2), 'utf8');
      return file;
    },
  };
}

module.exports = { createReport };
