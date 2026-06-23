import assert from 'node:assert/strict';
import test from 'node:test';

import { dataFiles, isIgnoredFile, isRPFReplacement } from './util';

// Each case: a path and whether it should be skipped at install time.
const cases: Array<{ name: string; file: string; ignored: boolean }> = [
  // Build/debug artifacts.
  { name: 'pdb dropped', file: 'scripts/Mod.pdb', ignored: true },
  { name: 'lib dropped', file: 'MinHook.lib', ignored: true },
  { name: 'exp dropped', file: 'foo.exp', ignored: true },
  { name: 'ilk dropped', file: 'foo.ilk', ignored: true },
  { name: 'linker map dropped', file: 'foo.map', ignored: true },

  // Documentation by basename stem, any extension.
  { name: 'README.txt dropped', file: 'README.txt', ignored: true },
  { name: 'README.md dropped', file: 'README.md', ignored: true },
  { name: 'CHANGELOG dropped', file: 'CHANGELOG', ignored: true },
  { name: 'license dropped', file: 'LICENSE.txt', ignored: true },
  { name: 'licence (UK) dropped', file: 'Licence.md', ignored: true },

  // Clutter folders (any depth).
  { name: 'Docs/ subtree dropped', file: 'Docs/manual.pdf', ignored: true },
  { name: 'Licenses/ subtree dropped', file: 'Licenses/MIT.txt', ignored: true },
  { name: 'Debug/ build dropped', file: 'Debug/ScriptHookVDotNet2.dll', ignored: true },
  { name: '__MACOSX cruft dropped', file: '__MACOSX/._foo', ignored: true },

  // Real mod content survives.
  { name: 'asi kept', file: 'ScriptHookVDotNet.asi', ignored: false },
  { name: 'dll kept', file: 'ScriptHookVDotNet3.dll', ignored: false },
  { name: 'config ini kept', file: 'ScriptHookVDotNet.ini', ignored: false },
  { name: 'config txt kept', file: 'settings.txt', ignored: false },
  { name: 'a dll inside scripts kept', file: 'scripts/Trainer.dll', ignored: false },
  // "license" must match the whole stem, not a substring.
  { name: 'licensed-content not dropped', file: 'licensed-content.dll', ignored: false },
];

for (const c of cases) {
  test(`isIgnoredFile: ${c.name}`, () => {
    assert.equal(isIgnoredFile(c.file), c.ignored);
  });
}

// isRPFReplacement: loose RPF assets meant for OpenIV/CodeWalker injection.
const rpfCases: Array<{ name: string; files: string[]; expected: boolean }> = [
  {
    name: 'bare .ymt -> RPF replacement',
    files: ['landing_page_deck.ymt', 'readme.txt'],
    expected: true,
  },
  {
    name: 'loose .ytd in a folder -> RPF replacement',
    files: ['textures/vehicle_generic_smallspecmap.ytd'],
    expected: true,
  },
  {
    name: 'asset shipped with its own .rpf -> deployable, not RPF replacement',
    files: ['dlc.rpf', 'something.ymt'],
    expected: false,
  },
  {
    name: 'asset shipped with an .asi -> deployable, not RPF replacement',
    files: ['OpenIV.asi', 'config.ymt'],
    expected: false,
  },
  {
    name: 'asset under a mods/ overlay tree -> preserve installer deploys it',
    files: ['mods/update/update.rpf/x64/data/ui/landing_page_deck.ymt'],
    expected: false,
  },
  {
    name: 'no RPF asset at all -> not RPF replacement',
    files: ['scripts/Trainer.dll', 'scripts/Trainer.ini'],
    expected: false,
  },
];

for (const c of rpfCases) {
  test(`isRPFReplacement: ${c.name}`, () => {
    assert.equal(isRPFReplacement(c.files), c.expected);
  });
}

test('dataFiles drops directory entries and noise, keeps real files', () => {
  const input = [
    'Debug/',
    'Debug/ScriptHookVDotNet2.dll',
    'Docs/',
    'Docs/manual.pdf',
    'Licenses/',
    'Licenses/MIT.txt',
    'MinHook.x64.dll',
    'README.txt',
    'ScriptHookVDotNet.asi',
    'ScriptHookVDotNet.ini',
    'ScriptHookVDotNet2.dll',
    'ScriptHookVDotNet3.dll',
  ];
  assert.deepEqual(dataFiles(input), [
    'MinHook.x64.dll',
    'ScriptHookVDotNet.asi',
    'ScriptHookVDotNet.ini',
    'ScriptHookVDotNet2.dll',
    'ScriptHookVDotNet3.dll',
  ]);
});
