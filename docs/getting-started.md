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
bunx elbert-plugin dev        # build, then rebuild on every change
```

In Elbert open **Settings → Plugins → Load development folder** and pick the `dist/` folder. Allow
the permissions the plugin asks for, and start it. Elbert watches the folder and restarts the
plugin whenever a rebuild finishes. The plugin's log is on the same settings page.

`bunx elbert-plugin check` validates the manifest and does a structural check of every template.
It does not fully parse RFW, so a template can pass `check` and still fail when its page opens.
The error appears in the plugin's log.

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
- [packaging.md](packaging.md) — building and shipping a `.elbx`.
- [runtime-packs.md](runtime-packs.md) — running native programs on Android.
- `examples/radio-browser` — a small complete plugin: navigation with its own phone dock, pages,
  streams, a settings page, a track action and storage.
