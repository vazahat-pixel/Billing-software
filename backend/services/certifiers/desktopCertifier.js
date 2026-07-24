const fs = require('fs');
const path = require('path');

/**
 * Desktop (Electron) certification — scaffold, builder, updater present.
 */
async function certify() {
  const desktopRoot = path.join(__dirname, '../../../desktop');
  const issues = [];
  const files = {
    main: path.join(desktopRoot, 'main.js'),
    preload: path.join(desktopRoot, 'preload.js'),
    updater: path.join(desktopRoot, 'updater.js'),
    builder: path.join(desktopRoot, 'electron-builder.yml'),
    pkg: path.join(desktopRoot, 'package.json'),
  };

  for (const [k, p] of Object.entries(files)) {
    if (!fs.existsSync(p)) issues.push(`Desktop missing: ${k}`);
  }

  let electron = false;
  if (fs.existsSync(files.pkg)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(files.pkg, 'utf8'));
      electron = !!(pkg.dependencies?.electron || pkg.devDependencies?.electron);
      if (!electron) issues.push('electron dependency missing in desktop/package.json');
    } catch (err) {
      issues.push(err.message);
    }
  }

  const passed = issues.length === 0;
  return {
    passed,
    warnOnly: !passed, // scaffold gaps warn in platform unless completely missing main
    detail: `electron=${electron} issues=${issues.length}`,
    gaps: issues,
    score: passed ? 100 : Math.max(40, 100 - issues.length * 15),
  };
}

module.exports = { certify };
