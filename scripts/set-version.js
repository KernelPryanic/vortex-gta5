/* Write a release version into the manifests.
 *
 * The release workflow passes the git tag (e.g. "0.1.1") as the single source
 * of truth for the version, so the packaged artifact always matches the tag
 * without a pre-release bump commit. Updates both package.json (npm) and
 * assets/info.json (what Vortex reads and shows the user).
 *
 * Usage: node scripts/set-version.js <version>
 */
'use strict';

const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!version || !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version)) {
  console.error(`Invalid version "${version || ''}" - expected MAJOR.MINOR.PATCH.`);
  process.exit(1);
}

const root = path.resolve(__dirname, '..');

for (const rel of ['package.json', 'assets/info.json']) {
  const file = path.join(root, rel);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  json.version = version;
  // Trailing newline keeps the file diff-clean (matches editors / npm).
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
  console.log(`${rel} -> ${version}`);
}
