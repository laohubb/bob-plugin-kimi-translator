const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
for (const [directory, name] of [['src', 'kimi-translate'], ['magpie/src', 'magpie']]) {
  const source = path.join(__dirname, directory);
  const info = JSON.parse(fs.readFileSync(path.join(source, 'info.json'), 'utf8'));
  if (!/^[0-9a-z.]+$/.test(info.version)) throw new Error('Invalid version');
  const output = path.resolve(__dirname, '..', `${name}-${info.version}.bobplugin`);
  // Supply exact files so tests, keys, and development files cannot enter either package.
  if (fs.existsSync(output)) fs.unlinkSync(output);
  execFileSync('/usr/bin/zip', ['-X', '-q', output, 'info.json', 'main.js'], { cwd: source });
  console.log(output);
}
