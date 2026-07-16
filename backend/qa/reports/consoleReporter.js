function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

function printReadinessSummary(report) {
  printSection('ERP Production Readiness Report');
  const areas = report.areas || {};
  for (const [key, area] of Object.entries(areas)) {
    const status = area.passed ? 'PASS' : 'FAIL';
    const score = area.score != null ? ` (${area.score}%)` : '';
    console.log(`${area.label || key}: ${status}${score}`);
    if (!area.passed && area.issues?.length) {
      area.issues.slice(0, 5).forEach((i) => console.log(`  - ${i}`));
      if (area.issues.length > 5) console.log(`  ... +${area.issues.length - 5} more`);
    }
  }
  console.log(`\nOverall Readiness: ${report.overallScore}%`);
  console.log(`Recommendation: ${report.recommendation}`);
  if (report.outputDir) console.log(`Reports: ${report.outputDir}`);
}

function printSimulationSummary(result) {
  printSection('Simulation Summary');
  for (const step of result.steps || []) {
    console.log(`${step.name}: ${step.success} ok, ${step.failed} failed (${step.ms}ms)`);
  }
}

module.exports = { printSection, printReadinessSummary, printSimulationSummary };
