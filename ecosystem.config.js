module.exports = {
  apps: [
    {
      name: 'scan-to-obsidian',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: 'logs/error.log',
      out_file: 'logs/output.log',
      time: true
    }
  ]
};
