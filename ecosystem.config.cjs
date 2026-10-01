/**
 * PM2 Process Configuration for Billing Software Backend
 * Production deployment file
 *
 * Usage from repo root:
 *   pm2 startOrReload ecosystem.config.cjs
 * or:
 *   pm2 reload billing-api --update-env
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
      kill_timeout: 5000,
      listen_timeout: 10000,
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,
    },
  ],
};
