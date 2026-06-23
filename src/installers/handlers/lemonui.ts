import { basenameLower, copyInstructions, dataFiles, toUnix } from '../../util';
import { CustomInstallerInterface } from '../types';

// LemonUI's archive carries one top-level folder per platform: SHVDN3, SHVDNC,
// FiveM, RageMP, AltV, RPH. For a standalone, Vortex-managed GTA V only the
// ScriptHookVDotNet builds apply. We install exactly one and discard the rest.
// Priority: SHVDN3 (the common SHVDN.3 build) then SHVDNC (newer "core" build).
// FiveM/RageMP self-provide at runtime; AltV/RPH target other hosts.
const VARIANTS = ['SHVDN3', 'SHVDNC'];
const DEST = 'scripts';
const MARKERS = ['lemonui.shvdn3.dll', 'lemonui.shvdnc.dll'];

function topDir(file: string): string {
  const norm = toUnix(file);
  const slash = norm.indexOf('/');
  return slash === -1 ? '' : norm.slice(0, slash);
}

/** Pick the first available variant folder (case-insensitive) from the archive. */
function chooseVariant(files: string[]): string | undefined {
  const present = new Set(files.map(f => topDir(f).toLowerCase()).filter(Boolean));
  return VARIANTS.find(v => present.has(v.toLowerCase()));
}

const lemonUI: CustomInstallerInterface = {
  id: 'LemonUI',

  detect(files) {
    return files.some(file => MARKERS.includes(basenameLower(file)))
      && chooseVariant(files) !== undefined;
  },

  install(files) {
    const data = dataFiles(files);
    const variant = chooseVariant(data);
    if (variant === undefined) {
      return [];
    }
    const prefix = variant.toLowerCase() + '/';

    // Take only the chosen variant's files; map them under scripts/, dropping
    // the variant folder name so e.g. SHVDN3/LemonUI.SHVDN3.dll ->
    // scripts/LemonUI.SHVDN3.dll. All other variant folders are ignored.
    const picked = data.filter(file => toUnix(file).toLowerCase().startsWith(prefix));
    return copyInstructions(picked.map(source => {
      const rel = toUnix(source).slice(prefix.length);
      return { source, dest: `${DEST}/${rel}` };
    }));
  },
};

export default lemonUI;
