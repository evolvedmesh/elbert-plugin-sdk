# Packaging and releasing

## Build

```shell
bunx elbert-plugin build          # validate, bundle plugin.js, copy templates/assets into dist/
bunx elbert-plugin build --minify
bunx elbert-plugin dev            # build, then rebuild on every change
bunx elbert-plugin check          # manifest rules and a structural check of every template
```

`build` bundles your TypeScript or JavaScript with Bun's bundler (`Bun.build`) into a single
self-contained script (IIFE), because the plugin runs in QuickJS-ng (ES2023): there are no modules,
no Node or Bun built-ins and no browser globals. Anything you `import` from `node_modules` is bundled in, so it must not need
`fs`, `fetch`, `URL` or other host objects. Network and files go through `elbert.http` and
`elbert.fs`.

The entry defaults to `src/index.ts`, then `src/index.js`; pass `--entry` to choose another.
`--out` changes the output folder (default `dist`).

## Pack

```shell
bunx elbert-plugin pack --to release
```

Zips `dist/` into `<id>-<version>.elbx` (building first when `dist/` is missing), in the folder
`--to` names. Already-compressed assets such as a bundled `.tar.gz` are stored without recompressing.
A `.elbx` is an ordinary zip; open it to see exactly what ships.

`pack` reuses an existing `dist/`. Run `build` first when you have changed anything, or release
tooling can pack stale files.

## Install and try

- **Install from file**: Settings → Plugins → *Install from file*, pick the `.elbx`. Elbert
  validates it, shows the permissions and starts it once allowed. Installing a newer version of an
  installed id replaces the package and keeps the plugin's data.
- **Load development folder**: Settings → Plugins → *Load development folder*, pick `dist/`. The
  folder is watched; rebuilding restarts the plugin.

Installed packages live in `<appSupport>/plugins/packages/<id>` (replaced wholesale on update) and
plugin data in `plugins/data/<id>` (kept across updates). The registry in
`plugins/registry.json` records which plugins are enabled and what each was granted.

## Versioning and releases

`elbert-plugin version <semver>` rewrites `version` in `elbert-plugin.json`, which is what release
tooling calls. A typical semantic-release setup:

```json
{
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/exec", {
      "prepareCmd": "bunx elbert-plugin version ${nextRelease.version} && bun run build && bunx elbert-plugin pack --to release"
    }],
    ["@semantic-release/git", { "assets": ["elbert-plugin.json"], "message": "ci(release): ${nextRelease.version} [skip ci]" }],
    ["@semantic-release/github", { "assets": [{ "path": "release/*.elbx" }] }]
  ]
}
```

Run it with `bunx --bun semantic-release`.

Keep `"version": "0.0.0-development"` in the checked-in manifest if release tooling owns the
number.

## Compatibility

- The plugin API only grows within an `apiVersion`; you do not need to republish for a newer
  Elbert.
- A plugin never changes its `id`, because the id names its data and secrets.
- A track id you hand to the library (`library.add`) or the queue is stored in users' libraries
  and listening history. Changing your id scheme later orphans their data.
