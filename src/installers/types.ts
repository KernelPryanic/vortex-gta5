import { types } from 'vortex-api';

/**
 * A custom per-mod installer: handling for a mod whose archive does not follow
 * the default "preserve the layout under the game root" rule.
 *
 * Each handler is fully self-contained - it decides whether it applies
 * (`detect`) and, if so, produces the install instructions (`install`). The
 * registry (./index.ts) auto-discovers every handler in ./handlers and the
 * lowest-`priority` one whose `detect` returns true owns the install.
 *
 * To add support for a new mod, drop ONE new file in ./handlers that
 * `export default`s an object of this shape. You should not need to edit any
 * other file - the registry picks it up automatically.
 */
export interface CustomInstallerInterface {
  // Stable identifier, also used in logs (e.g. 'ScriptHookV', 'LemonUI').
  readonly id: string;

  /**
   * Resolution order when several handlers could match. LOWER runs first.
   * Default 100. Use a smaller number only when your detect overlaps a broader
   * handler and must win. Most handlers can omit it.
   */
  readonly priority?: number;

  /**
   * Return true if this handler recognises the archive and should handle it.
   * `files` are archive-relative paths (directories included, with a trailing
   * separator). Keep this cheap and specific - usually a marker-file check.
   * Prefer the helpers in ../util (basenameLower, hasExt) so detection is
   * separator-agnostic.
   */
  detect(files: string[]): boolean;

  /**
   * Produce the copy/mkdir/... instructions for this archive. Only called when
   * `detect` returned true. Use ../util `copyInstructions` for the common case.
   * Return the instruction array (no need to wrap in a Promise).
   */
  install(files: string[]): types.IInstruction[];
}
