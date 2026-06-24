import Bluebird from 'bluebird';
import * as path from 'path';
import { fs, log, types, util } from 'vortex-api';

import {
  ASI_LOADER_FILES,
  DLCPACKS_PATH,
  EPIC_APP_ID,
  GAME_ID,
  OPENIV_URL,
  RPF_ASSET_EXTS,
  STEAM_APP_ID,
  basenameLower,
  copyInstructions,
  dataFiles,
  detectWrapperPrefix,
  hasExt,
  findModMetaPath,
  isIgnoredFile,
  isOIVInstalled,
  isRPFReplacement,
  metaInstructions,
  openIVPath,
  parseModMeta,
  toUnix,
} from './util';
import { resolveInstaller } from './installers';

type InstallResult = types.IInstallResult;
type Instruction = types.IInstruction;

// Read a mod's optional gta5mod.json (already extracted under destinationPath)
// and turn it into version/name `attribute` instructions. Best-effort: any read
// or parse failure yields no instructions, so a missing/garbled file never
// breaks an install (the mod just keeps its blank version).
function metaInstructionsFor(files: string[], destinationPath: string): Bluebird<Instruction[]> {
  const metaPath = findModMetaPath(files);
  if (metaPath === undefined) {
    return Bluebird.resolve([]);
  }
  return Bluebird.resolve(fs.readFileAsync(path.join(destinationPath, metaPath), 'utf8'))
    .then(content => metaInstructions(parseModMeta(content)))
    .catch(err => {
      log('warn', 'failed to read gta5 mod metadata', { metaPath, error: err.message });
      return [];
    });
}

// ---------------------------------------------------------------------------
// Game detection & setup
// ---------------------------------------------------------------------------

function findGame(): Bluebird<string> {
  return util.GameStoreHelper.findByName(['Grand Theft Auto V'])
    .then(game => game.gamePath)
    .catch(() =>
      util.GameStoreHelper.findByAppId([STEAM_APP_ID, EPIC_APP_ID])
        .then(game => game.gamePath));
}

function prepareForModding(discovery: types.IDiscoveryResult): Bluebird<void> {
  if (discovery.path === undefined) {
    return Bluebird.resolve();
  }
  const gamePath = discovery.path;
  // Ensure the game root and the DLC packs folder exist and are writable so
  // deployment never fails on a missing target directory.
  return fs.ensureDirWritableAsync(gamePath)
    .then(() => fs.ensureDirWritableAsync(path.join(gamePath, DLCPACKS_PATH)))
    .then(() => undefined);
}

// ---------------------------------------------------------------------------
// Helpers (shared pure helpers live in ./util)
// ---------------------------------------------------------------------------
// Headline installer: preserve archive folder structure verbatim
// ---------------------------------------------------------------------------

function testPreserve(_files: string[], gameId: string): Bluebird<types.ISupportedResult> {
  // Lowest-priority catch-all for GTA5. The special-case installers/mod types
  // (OpenIV, DLC, ASI) run at higher priority and claim their archives first.
  return Bluebird.resolve({
    supported: gameId === GAME_ID,
    requiredFiles: [],
  });
}

function installPreserve(files: string[], destinationPath: string): Bluebird<InstallResult> {
  return metaInstructionsFor(files, destinationPath).then(meta => {
    // A custom installer for a specific quirky mod takes precedence over the
    // generic structure-preserving logic.
    const custom = resolveInstaller(files);
    if (custom !== undefined) {
      log('debug', 'using custom installer', { id: custom.id });
      return { instructions: [...custom.install(files), ...meta] };
    }

    const data = dataFiles(files);
    const skipped = files.filter(f => !f.endsWith('/') && !f.endsWith('\\'))
      .filter(isIgnoredFile);
    if (skipped.length > 0) {
      log('debug', 'skipped install-time noise files', { files: skipped });
    }
    const prefix = detectWrapperPrefix(data);

    const instructions = copyInstructions(data.map(source => {
      const norm = toUnix(source);
      const rel = (prefix !== '' && norm.startsWith(prefix))
        ? norm.slice(prefix.length)
        : norm;
      return { source, dest: rel };
    }));

    return { instructions: [...instructions, ...meta] };
  });
}

// ---------------------------------------------------------------------------
// OpenIV (.oiv) package installer
// ---------------------------------------------------------------------------

let gApi: types.IExtensionApi | undefined;

function isOIVArchive(files: string[]): boolean {
  return hasExt(files, '.oiv')
    || files.some(file => basenameLower(file) === 'assembly.xml');
}

function testOIV(files: string[], gameId: string): Bluebird<types.ISupportedResult> {
  return Bluebird.resolve({
    supported: (gameId === GAME_ID) && isOIVArchive(files),
    requiredFiles: [],
  });
}

function notifyOIV(files: string[]): void {
  const api = gApi;
  if (api === undefined
      || api.sendNotification === undefined
      || api.showDialog === undefined) {
    return;
  }
  const sendNotification = api.sendNotification;
  const showDialog = api.showDialog;
  const oivFile = files.find(f => path.extname(f).toLowerCase() === '.oiv');
  const storeActions = isOIVInstalled()
    ? [{
        title: 'Open OpenIV',
        action: () => {
          const p = openIVPath();
          if (p !== undefined) {
            util.opn(p).catch(() => undefined);
          }
        },
      }]
    : [{
        title: 'Get OpenIV',
        action: () => { util.opn(OPENIV_URL).catch(() => undefined); },
      }];

  sendNotification({
    type: 'info',
    id: 'gta5-oiv-package',
    title: 'OpenIV package detected',
    message: oivFile !== undefined ? path.basename(oivFile) : 'This mod is an .oiv package',
    noDismiss: true,
    actions: [
      ...storeActions,
      {
        title: 'More',
        action: (dismiss: () => void) => {
          showDialog('info', 'OpenIV package', {
            text: 'This mod is packaged as an OpenIV (.oiv) installer and cannot be deployed as '
              + 'loose files. Vortex has saved the package in this mod\'s staging folder. '
              + 'Open it with OpenIV (Tools → Package Installer) to apply it to the game, '
              + 'then disable the Vortex mod to avoid confusion.',
          }, [{ label: 'Close', action: () => dismiss() }]);
        },
      },
    ],
  });
}

function installOIV(files: string[]): Bluebird<InstallResult> {
  // .oiv packages can only be applied by OpenIV itself - they are not loose
  // files we can deploy. We copy the package into the staging folder so the
  // user has it on hand, tag it as a passive type, and tell them what to do.
  const data = dataFiles(files);
  const instructions: Instruction[] = data.map(source => ({
    type: 'copy',
    source,
    destination: toUnix(source).split('/').join(path.sep),
  } as Instruction));
  instructions.push({ type: 'setmodtype', value: 'gta5oiv' } as Instruction);

  notifyOIV(files);

  return Bluebird.resolve({ instructions });
}

// ---------------------------------------------------------------------------
// RPF-replacement installer (loose game assets injected into a packed .rpf)
// ---------------------------------------------------------------------------

function testRPF(files: string[], gameId: string): Bluebird<types.ISupportedResult> {
  return Bluebird.resolve({
    supported: (gameId === GAME_ID) && isRPFReplacement(files),
    requiredFiles: [],
  });
}

function notifyRPF(files: string[]): void {
  const api = gApi;
  if (api === undefined
      || api.sendNotification === undefined
      || api.showDialog === undefined) {
    return;
  }
  const sendNotification = api.sendNotification;
  const showDialog = api.showDialog;
  const asset = dataFiles(files)
    .find(file => RPF_ASSET_EXTS.has(path.extname(file).toLowerCase()));

  sendNotification({
    type: 'info',
    id: 'gta5-rpf-replacement',
    title: 'RPF replacement mod detected',
    message: asset !== undefined ? path.basename(asset) : 'This mod replaces a file inside a .rpf',
    noDismiss: true,
    actions: [
      {
        title: 'Get OpenIV',
        action: () => { util.opn(OPENIV_URL).catch(() => undefined); },
      },
      {
        title: 'More',
        action: (dismiss: () => void) => {
          showDialog('info', 'RPF replacement mod', {
            text: 'This mod replaces game assets that live INSIDE a packed .rpf archive '
              + '(such as update.rpf). Vortex cannot edit .rpf contents, so the file(s) have '
              + 'been saved in this mod\'s staging folder instead of being deployed. To apply '
              + 'the mod, open the target .rpf with OpenIV or CodeWalker and replace the file '
              + 'there - the mod\'s own page lists the exact path (e.g. '
              + 'mods\\update\\update.rpf\\x64\\data\\ui). Modding a Mods-folder copy of the '
              + '.rpf (via OpenRPF/OpenIV) keeps the base game files intact.',
          }, [{ label: 'Close', action: () => dismiss() }]);
        },
      },
    ],
  });
}

function installRPF(files: string[]): Bluebird<InstallResult> {
  // Loose RPF assets cannot be deployed - they must be injected into a .rpf by
  // OpenIV/CodeWalker. We stage the files (so the user has them on hand), tag a
  // passive mod type so Vortex does not deploy them to the game root, and guide
  // the user on how to apply them.
  const data = dataFiles(files);
  const instructions: Instruction[] = data.map(source => ({
    type: 'copy',
    source,
    destination: toUnix(source).split('/').join(path.sep),
  } as Instruction));
  instructions.push({ type: 'setmodtype', value: 'gta5rpf' } as Instruction);

  notifyRPF(files);

  return Bluebird.resolve({ instructions });
}

// ---------------------------------------------------------------------------
// Mod type: DLC add-on packs
// ---------------------------------------------------------------------------

function isDLCMod(files: string[]): boolean {
  return files.some(file => basenameLower(file) === 'dlc.rpf');
}

// DLC installer: route each dlc.rpf (and its siblings) into its own named pack
// folder under update/x64/dlcpacks, preserving any structure beneath dlc.rpf.
function installDLC(files: string[], destinationPath: string): Bluebird<InstallResult> {
  const data = dataFiles(files);
  const dlcFile = data.find(file => basenameLower(file) === 'dlc.rpf');
  if (dlcFile === undefined) {
    // Shouldn't happen (test gated); fall back to preserving structure.
    return installPreserve(files, destinationPath);
  }
  const dlcDir = toUnix(path.dirname(dlcFile));            // folder containing dlc.rpf
  const packName = path.basename(dlcDir) || 'vortex';
  const prefix = dlcDir === '.' ? '' : dlcDir + '/';

  const instructions: Instruction[] = data
    .filter(file => prefix === '' || toUnix(file).startsWith(prefix))
    .map(source => {
      const norm = toUnix(source);
      const rel = prefix === '' ? norm : norm.slice(prefix.length);
      const dest = path.join(DLCPACKS_PATH, packName, rel.split('/').join(path.sep));
      return { type: 'copy', source, destination: dest } as Instruction;
    });

  return Bluebird.resolve({ instructions });
}

// ---------------------------------------------------------------------------
// Mod type: ASI / Script Hook loose plugins
// ---------------------------------------------------------------------------

function isASIMod(files: string[]): boolean {
  // Has an .asi (or a known loader dll) and is not a packed/DLC archive.
  if (hasExt(files, '.rpf')) {
    return false;
  }
  if (hasExt(files, '.asi')) {
    return true;
  }
  return files.some(file => ASI_LOADER_FILES.has(basenameLower(file)));
}

// registerModType's `test` receives the resolved install instructions; pull the
// destination paths back out so we can reuse the file-based predicates above.
function instructionFiles(instructions: Instruction[]): string[] {
  return instructions
    .filter(instr => instr.type === 'copy' && instr.destination !== undefined)
    .map(instr => instr.destination as string);
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

function getGamePath(game: types.IGame): string {
  if (gApi === undefined) {
    return '.';
  }
  const state = gApi.getState();
  const discovery: types.IDiscoveryResult =
    util.getSafe(state, ['settings', 'gameMode', 'discovered', game.id], {} as any);
  return discovery.path !== undefined ? discovery.path : '.';
}

function main(context: types.IExtensionContext): boolean {
  context.registerGame({
    id: GAME_ID,
    name: 'Grand Theft Auto V',
    mergeMods: true,
    queryPath: findGame,
    // Deploy relative to the game root so the structure produced by the
    // installer is reproduced verbatim under the GTA5 install folder.
    queryModPath: () => '.',
    logo: 'icon.png',
    executable: () => 'PlayGTAV.exe',
    parameters: ['-scOfflineOnly'],
    requiredFiles: ['GTA5.exe'],
    setup: prepareForModding,
    environment: {
      SteamAPPId: STEAM_APP_ID,
    },
    details: {
      steamAppId: parseInt(STEAM_APP_ID, 10),
      // Treat each .rpf / .asi as the boundary of a mod so Vortex does not try
      // to merge their internals across mods.
      stopPatterns: ['[^/]*\\.rpf', '[^/]*\\.asi'],
      supportsSymlinks: false,
    },
    compatible: {
      symlinks: false,
      usvfs: false,
    },
  });

  // Mod type: ASI / Script Hook loose plugins -> game root.
  context.registerModType(
    'gta5asi', 25,
    gameId => gameId === GAME_ID,
    getGamePath,
    (instructions: Instruction[]) => Bluebird.resolve(isASIMod(instructionFiles(instructions))),
    { mergeMods: true });

  // Mod type: DLC add-on packs. The installDLC already targets dlcpacks, so the
  // type just labels these mods; path is the game root.
  context.registerModType(
    'gta5dlc', 25,
    gameId => gameId === GAME_ID,
    getGamePath,
    (instructions: Instruction[]) => Bluebird.resolve(isDLCMod(instructionFiles(instructions))),
    { mergeMods: true });

  // Passive type used for OpenIV packages (assigned explicitly via setmodtype).
  context.registerModType(
    'gta5oiv', 90,
    gameId => gameId === GAME_ID,
    getGamePath,
    () => Bluebird.resolve(false),
    { mergeMods: true });

  // Passive type for RPF-replacement mods (assigned explicitly via setmodtype).
  context.registerModType(
    'gta5rpf', 91,
    gameId => gameId === GAME_ID,
    getGamePath,
    () => Bluebird.resolve(false),
    { mergeMods: true });

  // Installers, highest priority first (lower number = higher priority).
  context.registerInstaller('gta5-oiv', 20, testOIV, installOIV);

  context.registerInstaller('gta5-rpf', 25, testRPF, installRPF);

  context.registerInstaller('gta5-dlc', 30,
    (files, gameId) => Bluebird.resolve({
      supported: (gameId === GAME_ID) && isDLCMod(files),
      requiredFiles: [],
    }),
    installDLC);

  // The headline catch-all: preserve folder structure for everything else.
  context.registerInstaller('gta5-preserve-structure', 50, testPreserve, installPreserve);

  context.once(() => {
    gApi = context.api;
  });

  return true;
}

module.exports = {
  default: main,
};
