import assert from 'node:assert/strict';
import test from 'node:test';

import lemonUI from './lemonui';
import scriptHookV from './scripthookv';

// Map an installer's copy instructions to "source -> destination" (unix) pairs
// for compact assertions.
function destMap(files: string[], inst: { install(f: string[]): Array<{ type: string; source?: string; destination?: string }> }) {
  const out: Record<string, string> = {};
  for (const i of inst.install(files)) {
    if (i.type === 'copy' && i.source !== undefined && i.destination !== undefined) {
      out[i.source] = i.destination.split('\\').join('/');
    }
  }
  return out;
}

test('ScriptHookV: flattens bin/ to game root', () => {
  const files = ['bin/ScriptHookV.dll', 'bin/dinput8.dll', 'bin/NativeTrainer.asi', 'readme.txt', 'bin/'];
  assert.equal(scriptHookV.detect(files), true);
  // readme.txt is dropped by the shared install-time noise filter (dataFiles).
  assert.deepEqual(destMap(files, scriptHookV), {
    'bin/ScriptHookV.dll': 'ScriptHookV.dll',
    'bin/dinput8.dll': 'dinput8.dll',
    'bin/NativeTrainer.asi': 'NativeTrainer.asi',
  });
});

test('ScriptHookV: does not claim unrelated archives', () => {
  assert.equal(scriptHookV.detect(['scripts/foo.dll']), false);
});

test('LemonUI: installs only SHVDN3 variant into scripts/', () => {
  const files = [
    'SHVDN3/LemonUI.SHVDN3.dll',
    'SHVDNC/LemonUI.SHVDNC.dll',
    'FiveM/LemonUI.FiveM.dll',
    'RageMP/LemonUI.RageMP.dll',
    'AltV/LemonUI.AltV.dll',
    'RPH/LemonUI.RPH.dll',
  ];
  assert.equal(lemonUI.detect(files), true);
  assert.deepEqual(destMap(files, lemonUI), {
    'SHVDN3/LemonUI.SHVDN3.dll': 'scripts/LemonUI.SHVDN3.dll',
  });
});

test('LemonUI: falls back to SHVDNC when SHVDN3 absent', () => {
  const files = ['SHVDNC/LemonUI.SHVDNC.dll', 'FiveM/LemonUI.FiveM.dll'];
  assert.equal(lemonUI.detect(files), true);
  assert.deepEqual(destMap(files, lemonUI), {
    'SHVDNC/LemonUI.SHVDNC.dll': 'scripts/LemonUI.SHVDNC.dll',
  });
});

test('LemonUI: does not claim a non-LemonUI archive', () => {
  assert.equal(lemonUI.detect(['scripts/SomethingElse.dll']), false);
});
