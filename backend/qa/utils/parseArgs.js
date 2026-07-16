function parseArgs(argv = process.argv) {
  const args = { _: [] };
  for (const raw of argv.slice(2)) {
    if (raw.startsWith('--')) {
      const body = raw.slice(2);
      const eq = body.indexOf('=');
      if (eq === -1) {
        args[body] = true;
      } else {
        args[body.slice(0, eq)] = body.slice(eq + 1);
      }
    } else {
      args._.push(raw);
    }
  }
  return args;
}

module.exports = { parseArgs };
