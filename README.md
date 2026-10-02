# Elbert plugin SDK

Types, build tooling and documentation for writing plugins for [Elbert](https://github.com/evolvedmesh/elbert), a
cross-platform music player. Everything here runs on [Bun](https://bun.sh) — package manager,
runtime and bundler. A plugin adds pages, navigation, settings, track and playlist actions,
lyrics and playback sources to Elbert at runtime. It is one JavaScript file plus declarative UI
templates, so it needs no app update and no native build.

```shell
bun add -d @evolvedmesh/elbert-plugin-sdk typescript
bunx elbert-plugin dev
```

| Command                          | Does                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `elbert-plugin build`            | Validates the manifest and bundles `src/index.ts` into `dist/plugin.js`, copying templates and assets.            |
| `elbert-plugin dev`              | The same, live: templates reload in place, code reloads keep your place, errors show in the page and here. Prints how to load it on this computer or connect a phone. |
| `elbert-plugin check`            | Manifest rules and a structural check of every template.                                                          |
| `elbert-plugin pack`             | Zips `dist/` into `<id>-<version>.elbx`.                                                                          |
| `elbert-plugin version <semver>` | Sets the manifest's version, for release tooling.                                                                 |

## Documentation

- [Getting started](docs/getting-started.md)
- [The manifest](docs/manifest.md)
- [The `elbert` API](docs/api.md)
- [Writing templates](docs/templates.md)
- [Widget reference](docs/widgets.md)
- [Permissions](docs/permissions.md)
- [Packaging and releasing](docs/packaging.md)
- [Runtime packs for native programs on Android](docs/runtime-packs.md)

`types/elbert.d.ts` is the API contract. `examples/radio-browser` is a small complete plugin.

## Developing the SDK

```shell
bun install
bun run check            # tsc (CLI + sample), Biome lint/format, sample build
bun run fix              # apply Biome's fixes and formatting
bun run example:pack     # writes dist/
```

Commit messages are [Conventional Commits](https://www.conventionalcommits.org); releases are cut by
semantic-release.

## License

MIT
