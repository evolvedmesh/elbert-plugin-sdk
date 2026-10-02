# The manifest

Every plugin has an `elbert-plugin.json` at its root. Elbert parses it strictly: a missing field or
an unknown permission refuses the install with a message naming the problem, rather than
half-loading a plugin. `bunx elbert-plugin check` applies the same rules.

```json
{
  "id": "com.example.radio-browser",
  "name": "Radio Browser",
  "version": "1.0.0",
  "apiVersion": 1,
  "description": "Internet radio from a community directory.",
  "author": "Example",
  "icon": "radio",
  "entry": "plugin.js",
  "ui": { "radio": "ui/radio.rfwtxt" },
  "permissions": ["network", "player"],
  "platforms": ["linux", "windows", "macos", "android"],
  "android": { "runtimePackages": ["com.example.radio.runtime"] },
  "migrate": {
    "settingsKeys": ["oldSettingName"],
    "secureKeys": ["old_secret"],
    "playlistLinks": true,
    "legacySources": ["oldServiceName"]
  }
}
```

| Field                     | Required | Meaning                                                                                                                                                                                                           |
| ------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                      | yes      | Lower-case reverse-DNS (`com.example.my-plugin`). It names the install folder and the namespace of the plugin's storage and secrets, so it can **never change** once published.                                   |
| `name`                    | yes      | Shown in Settings.                                                                                                                                                                                                |
| `version`                 | yes      | Semver, `1.2.0` or `1.2.0-beta.1`. Release tooling sets it with `elbert-plugin version`.                                                                                                                          |
| `apiVersion`              | yes      | The plugin API version you wrote against (currently `1`). A plugin that needs a newer API than the running Elbert implements is refused; an older one keeps running, because the API only grows within a version. |
| `entry`                   | yes      | The bundled JavaScript file, relative to the plugin root (`plugin.js`).                                                                                                                                           |
| `description`, `author`   | no       | Shown in Settings.                                                                                                                                                                                                |
| `icon`                    | no       | A Lucide icon name for the Plugins list. Defaults to `puzzle`.                                                                                                                                                    |
| `ui`                      | no       | Maps a **library name** to a `.rfwtxt` path. Routes and settings refer to a widget as `library:Widget`, and one template can `import library;` another.                                                           |
| `permissions`             | no       | What the plugin asks to do; see [permissions.md](permissions.md). Unknown names are refused.                                                                                                                      |
| `platforms`               | no       | Any of `linux`, `windows`, `macos`, `android`, `ios`. Empty or absent means all. Elsewhere the plugin cannot be installed, and an existing install is kept but never started.                                     |
| `android.runtimePackages` | no       | Packages of companion APKs that carry native programs; see [runtime-packs.md](runtime-packs.md).                                                                                                                  |
| `migrate`                 | no       | One-time adoption of state the app kept before the feature became a plugin; see below.                                                                                                                            |

All paths (`entry`, every `ui` value) must stay inside the plugin: no leading `/`, no `..`, no
drive letters.

## `migrate`

For a plugin that replaces something Elbert once did itself and wants existing users to carry on
untouched. Everything but `legacySources` runs once, on the plugin's first start.

- `settingsKeys`: top-level keys of Elbert's old `settings.json` that Elbert no longer knows about.
  Their values are copied into the plugin's `storage` under the same names.
- `secureKeys`: secure-storage keys that move into the plugin's secrets namespace.
- `playlistLinks`: when `true`, library playlists that were synced before plugins existed (they
  carry a remote playlist id but name no plugin) become this plugin's linked playlists.
- `legacySources`: source names the feature's listens were logged under in Elbert's listening
  history before it was a plugin. Those lines are refiled under the plugin's name, so statistics
  count them as one provider. Runs on every start; it is a no-op once nothing matches.

Normal plugins never need it.

## Files in a plugin

```
elbert-plugin.json
plugin.js            the bundle `entry` names
ui/*.rfwtxt          the templates `ui` names
assets/              anything else; read with elbert.fs.asset()
```

`elbert-plugin build` produces this layout in `dist/`.
