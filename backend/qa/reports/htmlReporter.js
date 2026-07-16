const fs = require('fs');
const path = require('path');

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderAreaRows(areas) {
  return Object.entries(areas || {})
    .map(([key, area]) => {
      const badge = area.passed
        ? '<span class="pass">PASS</span>'
        : '<span class="fail">FAIL</span>';
      const issues = (area.issues || [])
        .slice(0, 20)
        .map((i) => `<li>${escapeHtml(i)}</li>`)
        .join('');
      return `<tr><td>${escapeHtml(area.label || key)}</td><td>${badge}</td><td>${area.score ?? '-'}%</td><td><ul>${issues}</ul></td></tr>`;
    })
    .join('');
}

function writeHtmlReport(outputDir, report) {
  fs.mkdirSync(outputDir, { recursive: true });
  const file = path.join(outputDir, 'report.html');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ERP QA Readiness Report</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; background: #0f172a; color: #e2e8f0; }
    h1 { color: #38bdf8; }
    .score { font-size: 2rem; font-weight: bold; margin: 1rem 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { border: 1px solid #334155; padding: 0.5rem; vertical-align: top; }
    th { background: #1e293b; }
    .pass { color: #4ade80; font-weight: bold; }
    .fail { color: #f87171; font-weight: bold; }
    .meta { color: #94a3b8; font-size: 0.9rem; }
    ul { margin: 0; padding-left: 1.2rem; }
  </style>
</head>
<body>
  <h1>ERP Developer QA — Production Readiness</h1>
  <p class="meta">Profile: ${escapeHtml(report.profile)} | Company: ${escapeHtml(report.companyId)} | ${escapeHtml(report.generatedAt)}</p>
  <div class="score">Overall: ${report.overallScore}% — ${escapeHtml(report.recommendation)}</div>
  <table>
    <thead><tr><th>Area</th><th>Status</th><th>Score</th><th>Issues</th></tr></thead>
    <tbody>${renderAreaRows(report.areas)}</tbody>
  </table>
  ${report.simulation ? `<h2>Simulation</h2><pre>${escapeHtml(JSON.stringify(report.simulation, null, 2))}</pre>` : ''}
  ${report.benchmark ? `<h2>Benchmark</h2><pre>${escapeHtml(JSON.stringify(report.benchmark, null, 2))}</pre>` : ''}
</body>
</html>`;
  fs.writeFileSync(file, html);
  return file;
}

module.exports = { writeHtmlReport };
