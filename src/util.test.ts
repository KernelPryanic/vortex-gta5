import assert from 'node:assert/strict';
import test from 'node:test';

import {
  dataFiles,
  detectWrapperPrefix,
  findModMetaPath,
  isIgnoredFile,
  isRPFReplacement,
  metaInstructions,
  parseModMeta,
} from './util';

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

  // Mod-metadata file is read by the installer, not deployed.
  { name: 'gta5mod.json dropped', file: 'gta5mod.json', ignored: true },
  { name: 'gta5mod.json in wrapper dropped', file: 'Cool Mod/gta5mod.json', ignored: true },

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

const wrapperCases: Array<{ name: string; files: string[]; expected: string }> = [
  {
    name: 'mod-name wrapper folder is stripped',
    files: ['Cool Mod v2/scripts/x.dll', 'Cool Mod v2/readme.txt'],
    expected: 'Cool Mod v2/',
  },
  {
    name: 'known GTA root folder (scripts) is kept',
    files: ['scripts/Trainer.dll', 'scripts/Trainer.ini'],
    expected: '',
  },
  {
    // Regression: menyooStuff is the Menyoo data dir at the game root; stripping
    // it loses the folder and the outfits land in the wrong place.
    name: 'menyooStuff is kept so its tree merges at the game root',
    files: [
      'menyooStuff/Outfit/!Female/Deadline/Blue.xml',
      'menyooStuff/Outfit/!Male/Sumo/Black.xml',
    ],
    expected: '',
  },
  {
    name: 'deep path under a known root is kept whole (only top level matters)',
    files: ['scripts/addons/a/b/c/x.dll'],
    expected: '',
  },
  {
    name: 'a mod-name wrapper around a deep tree strips only the outer level',
    files: ['Cool Mod v2/menyooStuff/Outfit/Deadline/Blue.xml'],
    expected: 'Cool Mod v2/',
  },
  {
    name: 'multiple top-level entries -> no wrapper to strip',
    files: ['scripts/x.dll', 'menyooStuff/y.xml'],
    expected: '',
  },
  {
    name: 'a file at the archive root -> no wrapper to strip',
    files: ['ScriptHookV.dll', 'bin/x.asi'],
    expected: '',
  },
];

for (const c of wrapperCases) {
  test(`detectWrapperPrefix: ${c.name}`, () => {
    assert.equal(detectWrapperPrefix(c.files), c.expected);
  });
}

// ---------------------------------------------------------------------------
// Mod metadata (gta5mod.json)
// ---------------------------------------------------------------------------

test('findModMetaPath: finds the meta file at the archive root', () => {
  assert.equal(findModMetaPath(['scripts/Mod.dll', 'gta5mod.json']), 'gta5mod.json');
});

test('findModMetaPath: finds it inside a wrapper folder, case-insensitively', () => {
  assert.equal(
    findModMetaPath(['Cool Mod/scripts/Mod.dll', 'Cool Mod/GTA5Mod.json']),
    'Cool Mod/GTA5Mod.json');
});

test('findModMetaPath: undefined when absent (and ignores directory entries)', () => {
  assert.equal(findModMetaPath(['scripts/Mod.dll', 'scripts/']), undefined);
});

test('parseModMeta: reads name and version', () => {
  assert.deepEqual(
    parseModMeta('{"name":"Vehicle Keeper","version":"4.0.0"}'),
    { name: 'Vehicle Keeper', version: '4.0.0' });
});

test('parseModMeta: trims and drops empty fields', () => {
  assert.deepEqual(parseModMeta('{"name":"  ","version":" 1.2.3 "}'), { version: '1.2.3' });
});

test('parseModMeta: ignores wrong-typed fields', () => {
  assert.deepEqual(parseModMeta('{"name":42,"version":["x"]}'), {});
});

test('parseModMeta: invalid JSON yields empty meta, never throws', () => {
  assert.deepEqual(parseModMeta('not json'), {});
  assert.deepEqual(parseModMeta('null'), {});
  assert.deepEqual(parseModMeta('"a string"'), {});
});

test('metaInstructions: emits version and name attributes', () => {
  assert.deepEqual(
    metaInstructions({ name: 'Vehicle Keeper', version: '4.0.0' }),
    [
      { type: 'attribute', key: 'version', value: '4.0.0' },
      { type: 'attribute', key: 'customFileName', value: 'Vehicle Keeper' },
    ]);
});

test('metaInstructions: emits only what is present', () => {
  assert.deepEqual(
    metaInstructions({ version: '4.0.0' }),
    [{ type: 'attribute', key: 'version', value: '4.0.0' }]);
  assert.deepEqual(metaInstructions({}), []);
});
