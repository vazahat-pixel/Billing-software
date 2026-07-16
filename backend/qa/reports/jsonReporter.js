const fs = require('fs');
const path = require('path');

function writeJsonReport(outputDir, report) {
  fs.mkdirSync(outputDir, { recursive: true });
  const file = path.join(outputDir, 'report.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  return file;
}

module.exports = { writeJsonReport };
