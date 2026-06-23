# Vortex GTA 5 Support (structure-preserving)

A [Vortex](https://www.nexusmods.com/about/vortex/) game extension that adds
**Grand Theft Auto V** modding support — like the official
[GTA V extension](https://www.nexusmods.com/site/mods/62), but it **preserves the
mod archive's folder structure** when installing.

If a mod archive contains `scripts/some.dll`, it is installed exactly as
`<GTA5 root>/scripts/some.dll` — no flattening, no name-map guesswork.

## Features

- **Structure-preserving installer** — copies every file at its archive-relative
  path into the GTA5 root. A single wrapping folder named after the mod
  (e.g. `Cool Mod v2/scripts/x.dll`) is stripped automatically, while meaningful
  GTA folders (`scripts`, `update`, ...) are kept.
- **Custom installers** — mods that don't fit the preserve rule get a
  self-contained handler under [`src/installers/`](src/installers/). ScriptHookV
  (its `bin/` is flattened to the game root) and LemonUI (only the correct
  variant folder — `SHVDN3`/`SHVDNC` — is installed into `scripts/`, the rest
  discarded) ship by default. Handlers are auto-discovered, so adding support
  for another mod is one new file — see
  [`src/installers/README.md`](src/installers/README.md).
- **Game detection** for Steam / Epic / Rockstar via Vortex's GameStoreHelper.
- **ASI / Script Hook** loose-plugin mods (`.asi`, `dinput8.dll`,
  `ScriptHookV.dll`, ...) recognised as the `gta5asi` mod type and placed in the
  game root.
- **DLC add-on packs** (archives containing `dlc.rpf`) routed into
  `update/x64/dlcpacks/<name>/`.
- **OpenIV `.oiv` packages** detected, saved to staging, and the user is guided
  to apply them through OpenIV (they can't be deployed as loose files).
- **RPF-replacement mods** — loose game assets (`.ymt`, `.ytd`, ...) meant to be
  injected into a packed `.rpf` (e.g. replacing `landing_page_deck.ymt` inside
  `update.rpf`). Vortex can't edit `.rpf` archives, so these are staged and the
  user is guided to apply them with OpenIV / CodeWalker.

## Build & package

Uses `make` (mirrors the conventions in `/d/workspace/mass`):

```bash
make install      # npm install --legacy-peer-deps
make lint         # TypeScript type-check (tsc --noEmit)
make build        # compile to dist/ (index.js + assets)
make package      # build + produce vortex-gta5-<version>.zip
make package-7z   # same, but a .7z instead
make clean        # remove dist/ and archives
make help         # list all targets
```

`make package` writes a `.zip` whose files sit at the archive root — the format
Vortex's extension installer expects.

## Install into Vortex

**Easiest:** run `make package`, then in Vortex go to
**Extensions → "Drop File(s)"** and drop the generated `.zip`. Restart Vortex.

**Manual / dev:** copy the contents of `dist/` into
`%APPDATA%\Vortex\plugins\vortex-gta5\` and restart Vortex.

## How the structure-preserving install works

1. Directory entries are dropped.
2. If every file shares one top-level folder, and that folder is **not** a known
   GTA root folder, it's treated as a mod-name wrapper and stripped.
3. Every remaining file becomes a `copy` instruction whose destination is its
   path relative to the detected root — subfolders preserved exactly.

See [`src/index.ts`](src/index.ts) (`installPreserve`, `detectWrapperPrefix`).

## License

GPL-3.0 — see [LICENSE](LICENSE).
