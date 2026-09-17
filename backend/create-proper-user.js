/**
 * @deprecated Dangerous against shared Atlas DB.
 * Use: npm run restore:logins
 */
console.error(
  'create-proper-user.js is disabled — it deleted qa.dev.admin on the shared DB.\n' +
    'Run instead:\n  cd backend && npm run restore:logins\n'
);
process.exit(1);
