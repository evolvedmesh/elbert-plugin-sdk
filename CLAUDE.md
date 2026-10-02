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
  - `dev`: build, then rebuild on changes (`fs.watch` over the entry's folder, templates, assets).
  - `check`: manifest validation plus a bracket lint of templates. It does **not** fully parse
    RFW.
  - `pack`: zips the plugin into `<id>-<version>.elbx`.
  - `version`.
- `examples/radio-browser` is the sample plugin. It deliberately does not use Apple Music; the
  real Apple Music plugin is `../elbert-apple-music`. It shows a section with its own phone dock,
  pages and templates, streams, a settings page, a track action and plugin storage. Elbert's
  `test/plugin_host_test.dart` runs it, so keep it building.
- `docs/` is the developer documentation: getting started, the manifest, the API, templates, the
  widget reference, permissions, packaging and runtime packs. `docs/widgets.md` is derived from
  `../elbert/lib/plugins/ui/widgets/lib_*.dart`; when a widget or argument changes there, change
  it here.

```shell
bun install
bun run check            # tsc (CLI + sample), biome check, sample build — what CI runs
bun run fix              # biome check --write
bun run example:pack     # → dist/
```

Releases: semantic-release under `bunx --bun`; the version bump is `scripts/set-version.ts`
(no `@semantic-release/npm`).

## Facts worth knowing when documenting or changing the API

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
