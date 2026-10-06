# Getting started

You can make two kinds of thing for Elbert, and they share the same tools, the same project shape and
the same live-reload loop:

|                | A **plugin**                                                       | A **theme**                                                                |
| -------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Adds           | Pages, navigation, settings, song-menu actions, streams, lyrics    | Colours, fonts, corners, text, how rows and cards look, an animated backdrop |
| Written in     | TypeScript (one bundled file) plus declarative UI templates        | JSON plus, optionally, UI templates. No code at all                        |
| Asks the user for | Permissions it lists (network, player, library...)              | Nothing. It cannot run code or reach anything                              |
| Go to          | [Make a plugin](#make-a-plugin)                                    | [Make a theme](#make-a-theme)                                              |

Both ship as one `.elbx` file the user installs by dropping it on Elbert, opening it, or pasting your
GitHub repository's address.
Add the topic `elbert-plugin` (or `elbert-theme`) to your repository and it is also listed in Elbert's
**Discover** page: see [Getting listed in the marketplace](packaging.md#getting-listed-in-the-marketplace).

You need [Bun](https://bun.sh) 1.3 or newer and an Elbert build with plugin support. Bun is the whole
toolchain: package manager, the CLI's runtime and the bundler.

## Make a plugin

```shell
bunx @evolvedmesh/elbert-plugin-sdk init hello       # creates ./hello
cd hello
bun install
bun run dev
```

`init` writes a project that already builds and loads:

```
hello/
  elbert-plugin.json   the manifest: id, name, version, permissions
  src/index.ts         your code: registers a page, a route and a nav entry
  ui/hello.rfwtxt      the page's look, as a template
  tsconfig.json        types for the `elbert` global
  package.json         scripts: dev, build, check, pack
```

Pass `--id com.you.hello` and `--name "Hello"` to choose them (the id is a lower-case reverse-DNS name
and **can never change** once published). The files, in full:

`src/index.ts`:

```ts
elbert.ui.page('hello', {
  open: async () => ({ greeting: 'Hello from a plugin' }),
  events: {
    again: () => elbert.ui.toast('Hello again'),
  },
});

elbert.onActivate(async () => {
  await elbert.ui.setNavigation({
    destinations: [{ label: 'Hello', icon: 'hand', route: '/hello' }],
  });
  await elbert.ui.setRoutes([{ path: '/hello', page: 'hello', widget: 'hello:HelloPage' }]);
});
```

`ui/hello.rfwtxt`:

```
import core;
import elbert;

widget HelloPage = ScrollPage(
  slivers: [
    PageInset(
      sliver: true,
      child: Column(
        crossAxisAlignment: "stretch",
        children: [
          ThemedText(text: data.greeting, style: "headlineMedium"),
          Button(variant: "filled", label: "Say it again", onPressed: event "again" {}),
        ],
      ),
    ),
  ],
);
```

The page controller (`elbert.ui.page`) is the code, the template is the look, and a route ties them
together: `hello:HelloPage` means the widget `HelloPage` in the library the manifest's `ui` map calls
`hello`. Widget names, argument names and role names are in [widgets.md](widgets.md); a wrong argument
fails when the page opens, not at build time, so check them against that file.

Next, pick what you want to build and use the [cookbook](cookbook.md): load a list from the web, play a
stream, remember settings, add a song-menu action, open detail pages.

## Make a theme

```shell
bunx @evolvedmesh/elbert-plugin-sdk init night-owl --theme
cd night-owl
bun install
bun run dev
```

```
night-owl/
  elbert-plugin.json   the manifest, with "type": "theme"
  theme.json           the look: colours, fonts, corners, components, text
  ui/background.rfwtxt an animated backdrop (optional; delete it and its theme.json entry to skip)
```

Open `theme.json`, change `"seed"` to another colour and save: Elbert repaints within a second. Your
editor completes and checks `theme.json` as you type, because the file points at the SDK's JSON Schema.
Everything a theme can change, with examples, is in [themes.md](themes.md).

## Load it in Elbert

`bun run dev` builds into `dist/`, rebuilds on every save, and prints how to load it. Two ways:

- **On this computer**: in Elbert open **Settings → Plugins → Developer → Load development
  folder** and pick the `dist/` folder it names. For a plugin, allow the permissions it asks for. A
  theme then appears under **Settings → Appearance → Look**. Elbert remembers the folder, so you only
  do this once.
- **On a phone or another computer** on the same network: **Settings → Plugins → Developer →
  Connect to a dev server**, then type the address and the six-digit pairing code `dev` printed.
  It runs there until you disconnect, and a "DEV" badge stays at the top of every page. Paired
  devices stay paired across restarts of `dev` for a day.

## The edit loop

From then on every save reloads your work in Elbert, and how depends on what you changed:

- **A template** (`.rfwtxt`) or **`theme.json`**: re-read in place in about a second. Open pages
  redraw with the data they already have, and the plugin keeps running.
- **Code**: the plugin restarts and Elbert reopens the pages that were open, with the same route
  and parameters and the same navigation stack underneath. Each page's `page.state` is carried
  over and `page.restored` is true, so `open` can show what it had instead of fetching it again
  ([api.md](api.md#development)).

When something breaks, the page you are looking at says so. Template parse errors (with
`file:line:column`), widgets that failed to build, uncaught JavaScript errors and failed builds
appear in an overlay inside the page. JavaScript stack traces point at your TypeScript
(`src/index.ts:42:7`), because `dev` writes a source map. The same lines, plus everything the
plugin logs, print in the `dev` terminal. A failed build keeps the last good one running.

`bunx elbert-plugin dev --open` also takes Elbert to your plugin's first page (or `--open /route`).
`bunx elbert-plugin check` validates the manifest and does a structural check of every template;
Elbert's real parser reports the rest in the overlay.

Don't use Flutter's hot restart (`R`) on Elbert while plugins run, because it can crash the app.
Plugin reloads don't need it.

## How a page works

1. A route names a **page controller** (`elbert.ui.page('hello', …)`) and a **template widget**
   (`hello:HelloPage`, the library named by the manifest's `ui` key, then the widget in it).
2. When the user opens the route, the controller's `open(page)` runs. What it returns (and every
   later `page.set(patch)`) becomes `data.*` in the template.
3. Events in the template (`event "again" {}`) call the controller's `events.again(page, args)`.
4. When the user leaves, `close(page)` runs and `page.closed` becomes true. Late `set` calls after
   that are ignored by you, so check `page.closed` before updating after an `await`.

Keep `open` fast. Return the initial data immediately and load the rest asynchronously with
`page.set`, so the page appears at once with a loading state.

## Troubleshooting

| You see                                                              | It means                                                                                                  |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `check` says `"x" is not a colour role` / `is not a component`        | A typo in `theme.json`. The message lists the valid names.                                                |
| `check` says a manifest field is missing                             | Elbert is strict by design; the message names the field. `$schema` in the manifest completes it.          |
| The plugin page is blank or shows a red box                          | A template problem. The overlay inside the page says `file:line:column`; the `dev` terminal prints it too. |
| A widget shows but ignores an argument                               | A wrong argument name or type is ignored, not an error. Compare with [widgets.md](widgets.md).             |
| `permission_denied` in the log                                       | The call needs a permission the manifest doesn't list, or the user hasn't allowed it ([permissions.md](permissions.md)). |
| Nothing happens after a code change                                  | The build failed; the last good one keeps running. The `dev` terminal and the page overlay show why.       |
| The theme doesn't appear in Appearance                               | It must be switched on in Settings → Plugins.                                                              |
| Appearance says the theme has a problem                              | `theme.json` or a template stopped passing Elbert's checks (the message names it). The last good version stays on screen until you fix it. |
| `Maximum call stack`, or a call "timed out"                          | One call into your plugin may run about ten seconds. Break long loops into awaited steps.                  |

The plugin's log (Settings → Plugins → the plugin → Log) has everything it printed with
`console.log`, plus uncaught errors.

## Where to go next

- [cookbook.md](cookbook.md) - short answers to "how do I...".
- [themes.md](themes.md) - everything a theme can change.
- [manifest.md](manifest.md) - every manifest field.
- [api.md](api.md) - the `elbert` global, grouped by what you want to do.
- [templates.md](templates.md) and [widgets.md](widgets.md) - writing the UI.
- [permissions.md](permissions.md) - what each permission allows.
- [packaging.md](packaging.md) - building and shipping a `.elbx`, and publishing it so users can
  install from your GitHub repository's URL.
- [runtime-packs.md](runtime-packs.md) - running native programs on Android.
- `examples/radio-browser` - a small complete plugin: navigation with its own phone dock, pages,
  streams, a settings page, a track action and storage.
- `examples/dusk-theme` - a complete theme: palette, corners, text, a custom song row and an
  animated background.
