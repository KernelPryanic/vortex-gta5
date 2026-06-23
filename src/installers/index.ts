import { log } from 'vortex-api';

import { CustomInstallerInterface } from './types';

/**
 * Auto-discover every handler in ./handlers. Adding a custom installer is just
 * dropping one file there that `export default`s a CustomInstallerInterface -
 * no edit to this file, so contributors never collide here.
 *
 * `require.context` is a webpack feature resolved at build time. The cast keeps
 * TypeScript happy without pulling in @types/webpack-env.
 */
declare const require: {
  context(dir: string, recursive: boolean, regexp: RegExp): {
    keys(): string[];
    (id: string): { default?: CustomInstallerInterface };
  };
};

function discover(): CustomInstallerInterface[] {
  // Match handler modules but not their *.test.ts siblings (which would pull
  // node:test into the production bundle and have no default export).
  const ctx = require.context('./handlers', false, /^(?!.*\.test\.ts$).*\.ts$/);
  const found: CustomInstallerInterface[] = [];
  for (const key of ctx.keys()) {
    const handler = ctx(key).default;
    if (handler === undefined) {
      log('warn', 'custom installer file has no default export', { file: key });
      continue;
    }
    found.push(handler);
  }
  // Lowest priority first; default 100. Stable by id for deterministic order.
  return found.sort((a, b) =>
    (a.priority ?? 100) - (b.priority ?? 100) || a.id.localeCompare(b.id));
}

export const CUSTOM_INSTALLERS: ReadonlyArray<CustomInstallerInterface> = discover();

/** Return the custom installer that claims this archive, or undefined for none. */
export function resolveInstaller(files: string[]): CustomInstallerInterface | undefined {
  return CUSTOM_INSTALLERS.find(inst => inst.detect(files));
}

export { CustomInstallerInterface } from './types';
