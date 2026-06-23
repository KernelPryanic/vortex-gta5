import * as path from 'path';

import { basenameLower, copyInstructions, dataFiles, toUnix } from '../../util';
import { CustomInstallerInterface } from '../types';

const MARKER = 'scripthookv.dll';

/**
 * ScriptHookV ships everything inside a `bin/` folder
 * (bin/ScriptHookV.dll, bin/dinput8.dll, bin/NativeTrainer.asi). That `bin/`
 * wrapper must be flattened so the DLLs land in the game root. The folder
 * holding the marker becomes the strip prefix; files outside it (e.g. a
 * top-level readme) keep their relative path.
 */
const scriptHookV: CustomInstallerInterface = {
  id: 'ScriptHookV',

  detect(files) {
    return files.some(file => basenameLower(file) === MARKER);
  },

  install(files) {
    const data = dataFiles(files);
    const marker = data.find(file => basenameLower(file) === MARKER)!;
    const dir = toUnix(path.dirname(marker));
    const prefix = dir === '.' ? '' : dir + '/';

    return copyInstructions(data.map(source => {
      const norm = toUnix(source);
      const dest = (prefix !== '' && norm.startsWith(prefix))
        ? norm.slice(prefix.length)
        : norm;
      return { source, dest };
    }));
  },
};

export default scriptHookV;
