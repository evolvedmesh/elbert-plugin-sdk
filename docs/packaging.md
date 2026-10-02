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

A plugin is one file, and every way of adding it ends at the same review screen. That screen
shows who made it, where it runs, what it may do and, for an update, what changes ("Updates 1.0.0 →
1.1.0", new permissions marked **New**). Nothing runs until it is allowed.

- **Open it with Elbert**: double-click an `.elbx` on the desktop (Windows installs the file
  association; Linux packages register `application/x-elbert-plugin` from
  `linux/elbert-plugin.xml`; macOS declares the type), or *Open with* / *Share* to Elbert on
  Android. If Elbert is already running, the file goes to that window.
- **Drop it** anywhere on Elbert's window (desktop).
- **From GitHub**: Settings → Plugins → Add a plugin → *From GitHub or a link*, then paste the
  repository (`owner/repo`, or any github.com link to it). Elbert installs the `.elbx` attached to
  its latest release. If that release has none, it uses the newest prerelease that does, and a
  `…/releases/tag/<tag>` link pins one release. A direct link to an `.elbx` file works too.
- **Settings → Plugins → Add a plugin → *Choose file***.

Installing a newer version of an installed id replaces the package and keeps the plugin's data.

For development, see [getting-started.md](getting-started.md#build-and-load-it): *Load development
folder* (this computer) and *Connect to a dev server* (any device on the network).

### `dev` options

| Flag             | Default   | Does                                                                     |
| ---------------- | --------- | ------------------------------------------------------------------------ |
| `--open [route]` |           | Navigates a connected Elbert to `route`, or to the plugin's first page.  |
| `--port <n>`     | `7357`    | The dev server's port.                                                   |
| `--host <addr>`  | `0.0.0.0` | The interface it listens on.                                             |
| `--no-lan`       |           | No server at all: only *Load development folder* on this computer.       |

The dev server only answers a device that paired with the code it printed. That code buys a random
session token, five wrong codes replace the code, and Elbert always connects out to the server,
never the other way. It serves `dist/` and nothing else. A connected plugin still runs with only
the permissions granted on that device.

`dev` also writes `plugin.js.map` beside the bundle so stack traces map to your sources. Elbert
and `dev` exchange files in `dist/.elbert/` (Elbert's log, `--open` requests, the last build error,
paired sessions). `pack` never includes either, and the dev server never serves `.elbert/`.

Installed packages live in `<appSupport>/plugins/packages/<id>` (replaced wholesale on update) and
plugin data in `plugins/data/<id>` (kept across updates). The registry in
`plugins/registry.json` records which plugins are enabled and what each was granted.

## Versioning and releases

**Attach the `.elbx` to every GitHub release.** That is all "install from GitHub" needs: users
paste your repository and Elbert takes the package from the latest release (public repositories
only, since Elbert asks GitHub anonymously). The semantic-release setup below does it with
`@semantic-release/github`'s `assets`. Attach one `.elbx` per release; if there are several,
Elbert takes the first.

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
