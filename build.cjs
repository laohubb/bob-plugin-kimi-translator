const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const info = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/info.json'), 'utf8'));
if (!/^[0-9a-z.]+$/.test(info.version)) throw new Error('Invalid version');
const output = path.resolve(__dirname, '..', `kimi-translate-${info.version}.bobplugin`);
// Supply exact files so tests, keys, and development files cannot enter the package.
if (fs.existsSync(output)) fs.unlinkSync(output);
execFileSync('/usr/bin/zip', ['-X', '-q', output, 'info.json', 'main.js'], { cwd: path.join(__dirname, 'src') });
console.log(output);
