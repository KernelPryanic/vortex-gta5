# AGENTS.md — vortex-gta5

A Vortex (Nexus Mods) game extension for GTA V, written in TypeScript and
bundled with webpack. These conventions adapt the Go AGENTS.md from the MASS
repo (and its C++ translation) to this TS/JS codebase. Apply them throughout.

## Core principles
- Best modern TypeScript practices. Simple, reusable, maintainable code;
  maintainability and simplicity come first, optimize only where it pays off.
- Use proper abstraction only where truly required. Abstractions belong at the
  seams (the Vortex `IExtensionContext` boundary, installers, mod types) — not
  mid-code. Three similar lines beat a premature helper.
- Write the minimal thing first. Don't generalize for hypothetical future mods;
  add the table/strategy when a second concrete case actually shows up
  (e.g. `KNOWN_MODS` grew from the real ScriptHookV `bin/` case).
- Design for reversibility: keep features self-contained, don't leak concerns
  across boundaries. Ask "what would it take to delete this?" before committing.
- Breaking changes are fine when they make the code better.
- After changing code, revisit it: simpler? something now unused? remove it.

## Project shape
- `src/` — TypeScript source. `index.ts` is the entry point (`main(context)`);
  `util.ts` holds constants and store/OpenIV helpers. One concern per file.
- `assets/` — `info.json` (extension metadata Vortex reads), `icon.png` (logo).
- `dist/` — webpack output + copied assets; the deployable payload. Disposable.
- Root `*.zip` / `*.7z` — the installable artifact from `make package`.
- `scripts/` — Node build/packaging helpers (plain JS, no build step).

## Style
- TypeScript with `strictNullChecks` / `noImplicitAny` on (see `tsconfig.json`).
  Keep the type-check (`make lint`) green — it is the static check that matters.
- Prefer pure functions for logic (path mapping, detection) — they're trivial to
  reason about and test. Keep side effects (notifications, fs) at the edges.
- `const` by default; `camelCase` functions/vars, `PascalCase` types/interfaces,
  `UPPER_SNAKE_CASE` module constants.
- Interfaces: suffix with `Interface` only when it disambiguates; match Vortex's
  own `IFoo` naming when extending its API surface (`IInstallResult`, etc.).
- Normalize archive paths to `/` for comparison (`toUnix`); emit destinations
  with `path.sep`. Vortex hands paths with OS separators — don't assume `/`.
- 2-space indent, semicolons, single quotes (consistent with existing files).

## Errors
- Never silently swallow errors. Each path either propagates (return/throw to a
  caller that can act), logs at the call site with context, or fails fast on an
  invariant that should never happen.
- Don't bury a rejected Promise. The only acceptable `.catch(() => undefined)` is
  genuinely fire-and-forget UI (e.g. `util.opn(url)` opening a link) where the
  caller can do nothing with the failure — same narrow exemption as the parent
  repo's "never `_ =` an error".
- Vortex's API uses **Bluebird** promises (`Promise_2` in its types). `queryPath`,
  `setup`, and `registerModType` test callbacks must return Bluebird; installers
  accept `PromiseLike`. Import `Bluebird from 'bluebird'` and return it directly
  rather than fighting the types.
- Guard Vortex's optional API methods (`api.sendNotification?`, `api.showDialog?`)
  before calling — bind to a local after the undefined check.
- Prefer fail-fast on programmer errors over defensive fallbacks that hide bugs.

## Logging & user feedback
- Use vortex-api's `log(level, message, meta?)` for diagnostics (`debug`, `info`,
  `warn`, `error`) — never `console.*`, which bypasses Vortex's log routing.
- Surface user-actionable situations through `api.sendNotification` /
  `api.showDialog` (see the OpenIV `.oiv` flow), not log lines they won't see.

## Installers & mod types
- Installer priority is lowest-number-wins. Special cases (OpenIV `.oiv`,
  RPF-replacement assets, DLC) register at higher priority; the
  structure-preserving catch-all is last.
- Some mods can't be deployed as loose files (`.oiv` packages, loose RPF assets
  that must be injected into a `.rpf` via OpenIV/CodeWalker). These live in
  `index.ts` (not the pure handlers) because they need the API to notify/guide
  the user — they stage the files, tag a passive mod type via `setmodtype`, and
  surface a `sendNotification`/`showDialog`. Pure handlers can't notify, so this
  guided flow stays in `index.ts`.
- The headline contract: **preserve the archive's folder layout** under the game
  root. `scripts/some.dll` → `<GTA5>/scripts/some.dll`. Only strip a single
  mod-name wrapper folder; never flatten by default.
- **Custom installers** (`src/installers/`) handle mods that don't fit that rule
  (a folder to flatten, mutually-exclusive variant folders, etc.). Each is a
  self-contained `CustomInstallerInterface` (`detect` + `install`) in its own
  file under `handlers/`, auto-discovered by the registry via webpack
  `require.context`. Adding one = drop a file + a test; touch nothing shared.
  `installPreserve` consults `resolveInstaller(files)` before the generic logic.
- Keep handler `detect`/`install` **pure** (no fs/API) so they stay table-test-able.
  See [`src/installers/README.md`](src/installers/README.md) for the contributor flow.

## Tests
- Logic worth testing is the pure path-mapping/detection (`detectWrapperPrefix`,
  `installPreserve`, `isASIMod`, `isDLCMod`). Prefer table-driven cases: an array
  of `{ name, files, expected }` run through one assertion loop.
- Use Node's built-in `node:test` + `assert` (no extra runner needed) when a
  suite is added; wire it into `make test`.

## Build / lint / test / package
- `make build` — webpack compile + copy assets to `dist/`.
- `make lint` — `tsc --noEmit` type-check.
- `make test` — test suite (placeholder until tests exist).
- `make package` — build + a `.zip` for Vortex's "Drop File(s)" (`make package-7z`
  for `.7z`). The archive's files sit at its root, which Vortex expects.
- `make install` uses `--legacy-peer-deps` (vortex-api pins an older
  `@types/bluebird`); keep that flag.

## Don't do
- No comments that restate the code. Comment only WHY: an invariant, a Vortex
  API quirk, a path-edge-case breadcrumb. If a careful reader wouldn't be
  confused by its removal, delete it.
- Don't bundle `vortex-api`, `bluebird`, or native modules — they're provided by
  the Vortex host at runtime and are marked `externals` in webpack.
- Don't use `eval`/`new Function` or anything Vortex's CSP forbids (the webpack
  config avoids eval source maps for this reason).
- Don't hand-edit `dist/` — it's generated. Don't commit `dist/` or archives.
