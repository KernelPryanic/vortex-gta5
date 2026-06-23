import * as path from 'path';
import { types } from 'vortex-api';

export const GAME_ID = 'gta5';
export const STEAM_APP_ID = '271590';
export const EPIC_APP_ID = '9d2d0eb64d5c44529cece33fe2a46482';

// Add-on DLC packs live here, each in its own named folder containing a dlc.rpf.
export const DLCPACKS_PATH = path.join('update', 'x64', 'dlcpacks');

// External resources users commonly need.
export const OPENIV_URL = 'https://openiv.com/';

// GTA5 game-asset file extensions that live INSIDE packed .rpf archives. A mod
// shipping these loose (with no .rpf of its own) is meant to be injected into an
// existing .rpf with OpenIV/CodeWalker - Vortex cannot edit .rpf contents, so we
// detect this and guide the user rather than deploying loose files to no effect.
export const RPF_ASSET_EXTS = new Set<string>([
  '.ymt',   // metadata (e.g. landing_page_deck.ymt)
  '.ymf',   // manifest
  '.ymap',  // map placement
  '.ytyp',  // archetype definitions
  '.ytd',   // texture dictionary
  '.ydr',   // drawable
  '.ydd',   // drawable dictionary
  '.yft',   // fragment
  '.ybn',   // collision bounds
  '.ynd',   // path nodes
  '.ynv',   // nav mesh
  '.ycd',   // clip dictionary
  '.gxt2',  // localized text table
]);

// Top-level folder names that are meaningful relative to the GTA5 root. When an
// archive's single wrapping folder is one of these we must NOT strip it as a
// wrapper, because doing so would destroy the path the mod author intended
// (e.g. `scripts/some.dll` must stay under `scripts/`).
export const KNOWN_ROOT_DIRS = new Set<string>([
  'scripts',
  'update',
  'mods',
  'x64',
  'plugins',
  'common',
  'data',
  'menu',
  'menyoostuff',  // Menyoo trainer's data dir; mods drop outfits/vehicles here
  'lml',          // RDR-style loaders sometimes reused; harmless to keep
  'asiloader',
]);

// Files that, when present, mark loose script-plugin ("ASI") mods.
export const ASI_LOADER_FILES = new Set<string>([
  'dinput8.dll',
  'scripthookv.dll',
  'scripthookvdotnet.asi',
  'scripthookvdotnet2.asi',
  'scripthookvdotnet3.asi',
  'openiv.asi',
]);


export function toUnix(p: string): string {
  return p.split(path.sep).join('/');
}

/**
 * Detect a single wrapping top-level folder that should be stripped.
 *
 * Many mod archives wrap their content in one folder named after the mod
 * (e.g. `Cool Mod v2/scripts/x.dll`). We strip that so the result lands at
 * `<GTA5>/scripts/x.dll`. But if the single top-level folder is itself a
 * meaningful GTA root folder (`scripts`, `menyooStuff`, ...) we keep it, so the
 * mod's files merge into that existing game folder instead of being flattened.
 *
 * Returns the prefix (with trailing slash) to strip, or '' for none.
 */
export function detectWrapperPrefix(files: string[]): string {
  const tops = new Set<string>();
  for (const file of files) {
    const norm = toUnix(file);
    const slash = norm.indexOf('/');
    if (slash === -1) {
      // A file sits directly at the archive root -> there is no single wrapper.
      return '';
    }
    tops.add(norm.slice(0, slash));
  }
  if (tops.size !== 1) {
    return '';
  }
  const only = Array.from(tops)[0];
  if (KNOWN_ROOT_DIRS.has(only.toLowerCase())) {
    return '';
  }
  return only + '/';
}

// ---------------------------------------------------------------------------
// Install-time noise filter
// ---------------------------------------------------------------------------
// Mod archives routinely bundle files that have no business in the game folder:
// compiler/debugger leftovers, documentation, licenses. We drop these so a clean
// install doesn't litter the GTA5 root with author build junk. Kept conservative
// on purpose — only unambiguous non-runtime files, so a mod's real `config.txt`
// or `settings.ini` always survives.

// Build/debug artifacts emitted next to a .dll/.asi; never loaded at runtime.
const IGNORED_EXTS = new Set<string>([
  '.pdb',   // debug symbol database
  '.lib',   // import library
  '.exp',   // export file
  '.ilk',   // incremental-link state
  '.map',   // linker map
]);

// Documentation files, matched by basename stem (any extension) so `README.txt`,
// `README.md`, and `CHANGELOG` all go. These are never functional mod content.
const IGNORED_NAME_STEMS = new Set<string>([
  'readme',
  'changelog',
  'credits',
  'install',
  'installation',
  'license',
  'licence',
]);

// Folder names whose entire subtree is documentation/license/debug clutter.
const IGNORED_DIRS = new Set<string>([
  'docs',
  'doc',
  'licenses',
  'license',
  'debug',        // debug builds shipped alongside the release binaries
  '__macosx',     // macOS archive cruft
]);

// True when a file should be skipped at install time. Pure: matches on the
// normalized path only, so it is trivially table-testable.
export function isIgnoredFile(file: string): boolean {
  const norm = toUnix(file).toLowerCase();
  const segments = norm.split('/');
  // Any ancestor folder is an ignored-clutter directory.
  if (segments.slice(0, -1).some(seg => IGNORED_DIRS.has(seg))) {
    return true;
  }
  const base = segments[segments.length - 1];
  if (IGNORED_EXTS.has(path.extname(base))) {
    return true;
  }
  const stem = base.replace(/\.[^.]*$/, '');
  return IGNORED_NAME_STEMS.has(stem);
}

// ---------------------------------------------------------------------------
// Pure path/file helpers shared by the installer and the mod exceptions.
// ---------------------------------------------------------------------------

// Drop directory entries (Vortex lists folders with a trailing separator, which
// may be '/' or '\\' depending on the archive) and install-time noise files.
export function dataFiles(files: string[]): string[] {
  return files.filter(file =>
    !file.endsWith('/') && !file.endsWith('\\') && !isIgnoredFile(file));
}

export function hasExt(files: string[], ext: string): boolean {
  const lower = ext.toLowerCase();
  return files.some(file => path.extname(file).toLowerCase() === lower);
}

// True when the archive is a loose RPF-asset replacement meant to be injected
// into an existing .rpf via OpenIV/CodeWalker (e.g. a bare landing_page_deck.ymt).
// We exclude archives that are independently deployable - any .rpf/.asi/.dll, or
// a `mods/` overlay tree (which the preserve installer places verbatim) - so this
// only claims mods that have nowhere to go as loose files.
export function isRPFReplacement(files: string[]): boolean {
  const data = files.filter(file => !file.endsWith('/') && !file.endsWith('\\'));
  const hasAsset = data.some(file => RPF_ASSET_EXTS.has(path.extname(file).toLowerCase()));
  if (!hasAsset) {
    return false;
  }
  const deployable = data.some(file => {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.rpf' || ext === '.asi' || ext === '.dll') {
      return true;
    }
    return toUnix(file).toLowerCase().startsWith('mods/');
  });
  return !deployable;
}

export function basenameLower(file: string): string {
  return path.basename(file).toLowerCase();
}

// Convenience for exceptions: turn a list of (source, destination-unix) pairs
// into copy instructions with platform separators in the destination.
export function copyInstructions(
  pairs: Array<{ source: string; dest: string }>,
): types.IInstruction[] {
  return pairs.map(({ source, dest }) => ({
    type: 'copy',
    source,
    destination: dest.split('/').join(path.sep),
  }));
}

/**
 * Locate an installed OpenIV via the Windows registry / known install path.
 * Returns undefined if it cannot be found. Kept dependency-light so it works
 * even when winapi-bindings is unavailable (returns undefined rather than
 * throwing).
 */
export function openIVPath(): string | undefined {
  try {
    // Lazy require so a missing native module never breaks extension load.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const winapi = require('winapi-bindings');
    const lookups: Array<[string, string]> = [
      ['SOFTWARE\\WOW6432Node\\OpenIV', 'InstallPath'],
      ['SOFTWARE\\OpenIV', 'InstallPath'],
    ];
    for (const [key, value] of lookups) {
      try {
        const res = winapi.RegGetValue('HKEY_LOCAL_MACHINE', key, value);
        if (res && res.value) {
          return res.value as string;
        }
      } catch (err) {
        // try next key
      }
    }
  } catch (err) {
    // winapi-bindings not present; fall through.
  }

  const local = process.env['LOCALAPPDATA'];
  if (local !== undefined) {
    return path.join(local, 'New Technology Studio', 'Apps', 'OpenIV');
  }
  return undefined;
}

export function isOIVInstalled(): boolean {
  return openIVPath() !== undefined;
}
