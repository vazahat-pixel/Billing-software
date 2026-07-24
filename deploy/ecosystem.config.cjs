/**
 * PM2 process file — run from repo root:
 *   npx pm2 start deploy/ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'billing-api',
      cwd: './backend',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
      time: true,
    },
  ],
};
