/* Run the compiled node:test suite.
 *
 * `node --test "<glob>"` does not expand globs on Node 18 (native glob support
 * landed in Node 21), and shell glob expansion is inconsistent across the dev
 * shell and CI runners. So we discover the compiled *.test.js files ourselves
 * and hand explicit paths to `node --test`.
 */
'use strict';

const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const testDir = path.join(root, '.test-build');

function findTests(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findTests(full));
    } else if (entry.name.endsWith('.test.js')) {
      out.push(full);
    }
  }
  return out;
}

if (!fs.existsSync(testDir)) {
  console.error('.test-build/ not found - compile the tests first (tsc -p tsconfig.test.json).');
  process.exit(1);
}

const tests = findTests(testDir);
if (tests.length === 0) {
  console.error('No *.test.js files found under .test-build/.');
  process.exit(1);
}

const res = cp.spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' });
process.exit(res.status === null ? 1 : res.status);
