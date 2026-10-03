# Elbert plugin SDK

Types, build tooling, documentation and a sample for writing [Elbert](../elbert) plugins.
Published as `@evolvedmesh/elbert-plugin-sdk`. Releases are cut by semantic-release, so commit
messages must be Conventional Commits. Don't commit or push unless asked.

- `types/elbert.d.ts` is **the** API contract: the global `elbert` object a plugin calls. It must
  match what Elbert's host implements in `../elbert/lib/plugins/` (`runtime/plugin_prelude.dart`
  for the JS surface, `api/*.dart` for the handlers, `runtime/plugin_manifest.dart` for the
  manifest).
  - Change both sides together.
  - Prefer adding to changing. Installed plugins depend on every name.
  - A breaking change bumps `kPluginApiVersion` in the host and `apiVersion` here.
- **Bun is the whole toolchain**: package manager (`bun install`, `bun.lock`), runtime and bundler.
  Don't introduce npm/pnpm/yarn, Node-only tooling or esbuild. Biome lints and formats
  (`biome.json`); `types/` is exempt from `noExplicitAny`/`noConfusingVoidType` on purpose.
- `bin/elbert-plugin.ts` is the CLI, a Bun script (`#!/usr/bin/env bun`) with `fflate` (zip) as its
  only dependency, and has these commands:
  - `build`: `Bun.build` → one IIFE (`format: 'iife'`, `target: 'browser'`) at `dist/plugin.js`.
  - `dev` lives in `bin/dev.ts` (see "The dev loop" below).
  - `check`: manifest validation plus a bracket lint of templates. It does **not** fully parse
    RFW.
  - `pack`: zips the plugin into `<id>-<version>.elbx`. It skips dot entries and `*.map`, so a
    `dist/` left behind by `dev` never ships its source map or `.elbert/`.
  - `build` empties `dist/` but keeps the folder and `.elbert/`, because a running Elbert may be
    watching it.
  - `Bun.build` is always called with `throw: false`. Bun ≥ 1.2 throws on a failed build
    otherwise, which once killed the `dev` loop on the first typo.
  - `init`: scaffolds a plugin (or a theme with `--theme`) from the templates in `bin/init.ts`, which
    must always produce a project that passes `check` and loads in Elbert. It never overwrites a file.
    Change a template and re-run the smoke test: `init` into a temp dir with `--sdk file:<this repo>`,
    `bun install`, `bun run check`, `bun run pack`.
  - `version`.
- `examples/radio-browser` is the sample plugin. It deliberately does not use Apple Music; the
  real Apple Music plugin is `../elbert-apple-music`. It shows a section with its own phone dock,
  pages and templates, streams, a settings page, a track action and plugin storage. Elbert's
  `test/plugin_host_test.dart` runs it, so keep it building.
- **Themes** are packages with `"type": "theme"`: no `entry`, no permissions, a `theme.json` instead.
  `types/theme.d.ts` and `bin/theme.ts` (used by `check`, `build` and `dev`) mirror the host's
  `lib/theme/theme_pack.dart` - change them together. That includes the string keys
  (`theme_strings.dart`), the component fields (`theme_components.dart`), the slots and the widget
  names a template may not reuse. `examples/dusk-theme` is the sample, built by
  `bun run theme:build` as part of `check`; Elbert's `test/theme_background_test.dart` loads it when
  `ELBERT_SAMPLE_THEME` points at its `dist/`. A theme is data only, so don't add anything to
  `theme.json` that needs logic or access; the decoration widgets (`GradientFill`, `Orb`,
  `Particles`, `Waves`, `Spin`, `Drift`, `Pulse`) are in `docs/widgets.md` under "Decoration".
- `docs/` is the developer documentation: getting started, the manifest, the API, templates, the
  widget reference, themes, permissions, packaging and runtime packs. `docs/widgets.md` is derived from
  `../elbert/lib/plugins/ui/widgets/lib_*.dart`; when a widget or argument changes there, change
  it here.

```shell
bun install
bun run check            # tsc (CLI + sample), biome check, sample build — what CI runs
bun run fix              # biome check --write
bun run example:pack     # → dist/
```

- `schemas/*.schema.json` are **generated** by `scripts/gen-schemas.ts` from the tables in `bin/theme.ts`
  (colour roles, components, string keys, slots); `bun run schemas` rewrites them and `check` fails if
  they are stale. Biome ignores the folder. `init` points new projects' `$schema` at them.
- `scripts/check-docs.ts` (in `check`) compiles every ```ts block in `docs/cookbook.md` against
  `types/elbert.d.ts` and runs every JSON block in the "Recipes" section of `docs/themes.md` through the
  theme rules. A recipe that stops compiling or validating is a docs bug.

Releases: semantic-release under `bunx --bun`; the version bump is `scripts/set-version.ts`
(no `@semantic-release/npm`).

## The dev loop (`bin/dev.ts`)

`elbert-plugin dev` builds into `dist/` and rebuilds on any change under the project (one
recursive `fs.watch`; `dist/`, `node_modules/`, `.git` and dot-paths ignored). It writes a file
**only when its bytes changed**, and atomically by rename. Elbert relies on this to tell a
template edit from a code edit:

- If only `ui/*.rfwtxt` changed, Elbert re-parses those libraries in place and open pages keep
  their data.
- Anything else restarts the engine (`PluginHost.reloadPlugin`). Pages reopen on the same route
  with their `page.state`.

A comment-only edit prints "no output change" and reloads nothing; that is correct, not a bug.

Two transports, both active at once:

- **This machine, through `dist/.elbert/`:**
  - Elbert writes `log.jsonl` (log lines, dev issues, reload results, plugin state), which the
    CLI tails, following the file by inode. Elbert recreates it on each load rather than
    truncating it.
  - The CLI writes `open` (`--open`) and `build-error` (present while the last build failed). The
    host watcher handles both.
- **LAN, through `Bun.serve` on port 7357:**
  - `POST /pair {code}` → session token. Five wrong codes rotate the code. Tokens persist in
    `.elbert/sessions.json` for 24 h, so restarting `dev` doesn't force re-pairing.
  - `GET /files` returns manifest plus `{path, sha1, size}`; `GET /file?path=` serves one file,
    refusing dot-paths and anything outside `dist/`.
  - `/ws` carries `{t:'changed'|'build'|'open'}` out, and the same messages as `log.jsonl` come
    back in.
  - Elbert always connects out, and nothing on the Elbert side listens.

Bridge interfaces (docker, veth, virbr…) are left out of the printed addresses. `--no-lan`
serves nothing. `dev` builds with `sourcemap: 'external'`, and the host maps stacks with it.

## Facts worth knowing when documenting or changing the API

- **Development state:** `elbert.dev.isDev`, `elbert.dev.persist(key, save)`,
  `elbert.dev.restore(key)` and `page.restored` (API v1 additions). On a development reload the
  host invokes `dev.snapshot`, gets each open page's `page.state` and every persisted value, and
  hands them to the new engine: the values through the config, the page states through
  `page.open`'s `restored` argument. All of it must be JSON.
- **Runtime:** plugins run in QuickJS-ng, one engine per plugin in a background isolate.
  - No Node, browser or `URL` globals. Timers and `console` are provided by the host.
  - Limits: 256 MB heap, 512 KB stack, 10 s per call.
- **Permissions:** `network`, `storage`, `process`, `player`, `library`, `playlists`, `lyrics`,
  `history`.
  They are checked by the host, not in JS.
- **Templates (RFW):** the libraries are `core`, `material` and `elbert`, and each `ui` manifest
  key is importable by name. These rules fail at runtime, not at `check`:
  - Only `...for` can be spread into a list. Use a `switch` element with `default: SizedBox()`
    instead of a spread switch.
  - `null` is not a switch key.
  - Core widgets need doubles written as `14.0`.
  - Nulls in page data are dropped.
- **Colours and text:** templates name colours and text styles by role, never by value.
- **Streams:** stream tracks live only in the queue and are never persisted, so their URLs may
  carry credentials.
- **Android:** executables must come from a **runtime pack**, a companion APK with the intent
  action `com.evolvedmesh.elbert.action.RUNTIME_PACK` listed under `android.runtimePackages`.
