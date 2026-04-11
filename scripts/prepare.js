const fs = require('fs');
const { execSync } = require('child_process');

if (fs.existsSync('./node_modules/ts-patch')) {
  execSync('ts-patch install', { stdio: 'inherit' });
}
