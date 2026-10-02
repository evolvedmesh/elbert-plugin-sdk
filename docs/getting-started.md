# Getting started

An Elbert plugin is one JavaScript file plus declarative UI templates and a manifest. Elbert runs
the JavaScript in a sandboxed engine (QuickJS-ng, ES2023) and renders the templates with its own
widgets, so a plugin's pages follow the user's theme without any styling code.

You need [Bun](https://bun.sh) 1.3 or newer and an Elbert build with plugin support. Bun is the
whole toolchain: package manager, the CLI's runtime and the bundler.

## Create a project

```shell
mkdir my-plugin; cd my-plugin
bun init -y
bun add -d @evolvedmesh/elbert-plugin-sdk typescript @biomejs/biome
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "lib": ["ES2023"],
    "types": ["@evolvedmesh/elbert-plugin-sdk"]
  },
  "include": ["src"]
}
```

`elbert-plugin.json` (see [manifest.md](manifest.md)):

```json
{
  "id": "com.example.hello",
  "name": "Hello",
  "version": "1.0.0",
  "apiVersion": 1,
  "icon": "hand",
  "entry": "plugin.js",
  "ui": { "hello": "ui/hello.rfwtxt" },
  "permissions": []
}
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

Widget names, argument names and role names are in [widgets.md](widgets.md); check them against that
file, because a wrong argument fails when the page opens, not at build time.

## Build and load it

```shell
bunx elbert-plugin dev        # build, rebuild on every change, print how to connect
```

It prints two ways to load the plugin:

- **On this computer**: in Elbert open **Settings → Plugins → Developer → Load development
  folder** and pick the `dist/` folder it names. Allow the permissions the plugin asks for. Elbert
  remembers the folder, so you only do this once.
- **On a phone or another computer** on the same network: **Settings → Plugins → Developer →
  Connect to a dev server**, then type the address and the six-digit pairing code `dev` printed.
  The plugin runs there until you disconnect. A "DEV" badge stays at the top of every page while it
  is connected. Paired devices stay paired across restarts of `dev` for a day.

From then on, every save reloads the plugin, and how depends on what you changed:

- **A template** (`.rfwtxt`): re-parsed in place in about a second. Open pages redraw with the
  data they already have, and the plugin keeps running.
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

## Where to go next

- [manifest.md](manifest.md) — every manifest field.
- [api.md](api.md) — the `elbert` global.
- [templates.md](templates.md) and [widgets.md](widgets.md) — writing the UI.
- [permissions.md](permissions.md) — what each permission allows.
- [packaging.md](packaging.md) — building and shipping a `.elbx`, and publishing it so users can
  install from your GitHub repository's URL.
- [runtime-packs.md](runtime-packs.md) — running native programs on Android.
- `examples/radio-browser` — a small complete plugin: navigation with its own phone dock, pages,
  streams, a settings page, a track action and storage.
