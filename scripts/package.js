/* Build a Vortex-installable archive from dist/.
 *
 * Vortex's "Drop File(s)" extension installer accepts both .zip and .7z.
 * We default to .zip (most portable). Pass `--7z` to produce a .7z instead.
 *
 * .zip is created with 7-Zip when available (clean, deterministic), otherwise
 * via PowerShell's Compress-Archive so packaging works without 7z on PATH.
 */
'use strict';

const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const pkg = require(path.join(root, 'package.json'));
const baseName = `${pkg.name}-${pkg.version}`;
const want7z = process.argv.includes('--7z');

if (!fs.existsSync(distDir) || fs.readdirSync(distDir).length === 0) {
  console.error('dist/ is empty - run the build first (make build).');
  process.exit(1);
}

function find7z() {
  const candidates = [
    process.env.SEVENZIP,
    'C:/Program Files/7-Zip/7z.exe',
    'C:/Program Files (x86)/7-Zip/7z.exe',
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  const probe = cp.spawnSync(process.platform === 'win32' ? 'where' : 'which', ['7z']);
  return probe.status === 0 ? '7z' : null;
}

function rm(file) {
  try {
    fs.rmSync(file, { force: true });
  } catch (err) {
    /* ignore */
  }
}

function run(cmd, args, opts) {
  const res = cp.spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.status !== 0) {
    process.exit(res.status || 1);
  }
}

const sevenZip = find7z();
const ext = want7z ? '7z' : 'zip';
const out = path.join(root, `${baseName}.${ext}`);
rm(out);

if (sevenZip !== null) {
  // Archive the *contents* of dist/ so the extension files sit at the archive
  // root, which is what Vortex expects.
  run(sevenZip, ['a', `-t${ext}`, out, '*'], { cwd: distDir });
} else if (!want7z && process.platform === 'win32') {
  // Fallback: zip via PowerShell.
  const ps = `Compress-Archive -Path '${distDir.replace(/\\/g, '/')}/*' `
    + `-DestinationPath '${out.replace(/\\/g, '/')}' -Force`;
  run('powershell', ['-NoProfile', '-Command', ps]);
} else {
  console.error('7-Zip not found. Install it, or omit --7z to use the .zip fallback.');
  process.exit(1);
}

console.log(`\nCreated ${path.relative(root, out)}`);
console.log('Drop this file onto Vortex → Extensions → "Drop File(s)" to install.');
