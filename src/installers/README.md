# Custom installers

Most mods install fine with the default rule: **the archive's folder layout is
preserved under the GTA V root** (`scripts/some.dll` → `<GTA5>/scripts/some.dll`).

Some mods don't fit that rule — they wrap their payload in a folder that must be
flattened, or ship several mutually-exclusive variant folders where only one is
correct. Those get a **custom installer**: a small, self-contained handler that
recognises the archive and produces the right install instructions.

The registry [`index.ts`](index.ts) **auto-discovers** every handler in
[`handlers/`](handlers). Adding support for a mod is therefore just **one new
file** — you don't edit the registry or anything else.

## Add a custom installer (the whole process)

1. Create `handlers/<modname>.ts`.
2. `export default` an object implementing
   [`CustomInstallerInterface`](types.ts):
   - `id` — a stable name (used in logs).
   - `detect(files)` — return `true` when this is your mod. Keep it cheap and
     specific, usually a marker-filename check.
   - `install(files)` — return the copy instructions. `copyInstructions` from
     [`../util`](../util.ts) handles the common "source → destination" mapping.
   - `priority?` — optional; lower wins when two handlers match. Default 100.
     Only set it if your `detect` overlaps a broader handler.
3. Add a test in `handlers/<modname>.test.ts` (see
   [`handlers/handlers.test.ts`](handlers/handlers.test.ts) for the table style)
   and run `make test`.

That's it — the build picks the file up automatically.

## Worked examples

- [`handlers/scripthookv.ts`](handlers/scripthookv.ts) — *wrapper* mod:
  ScriptHookV ships everything under `bin/`, which is flattened to the game root.
- [`handlers/lemonui.ts`](handlers/lemonui.ts) — *variant* mod: the archive has
  `SHVDN3`, `SHVDNC`, `FiveM`, `RageMP`, `AltV`, `RPH` folders; only the
  ScriptHookVDotNet build applies to a standalone GTA V, so we install one
  variant into `scripts/` and discard the rest.

## Guidelines

- Keep `detect`/`install` **pure** (no fs, no Vortex API calls) so they stay
  trivial to test.
- Match files by lower-cased basename; use `toUnix` before comparing paths so
  detection is separator-agnostic.
- Destinations are relative to the GTA V install root.
