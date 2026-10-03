# Cookbook

Short, complete answers to "how do I...". Every TypeScript block here is compiled against
`types/elbert.d.ts` by `bun run check`, so the calls and their shapes are real. Widget argument names
are in [widgets.md](widgets.md); theme recipes are in [themes.md](themes.md#recipes).

Each snippet goes in `src/index.ts`, with the permissions it names in your manifest. Page templates
assume `import core; import elbert;` at the top.

## Show a list from a web API

Needs `network`. Return the page's first state at once and fill it in with `page.set`, so the page
appears immediately with a spinner instead of waiting on the request.

```ts
interface Station {
  stationuuid: string;
  name: string;
  country: string;
  favicon: string;
}

elbert.ui.page('stations', {
  open(page) {
    void load(page);
    return { status: 'loading', items: [] };
  },
  events: {
    refresh: (page) => load(page),
  },
});

async function load(page: { set(patch: object): void; closed: boolean }) {
  try {
    const res = await elbert.http.request<Station[]>({
      url: 'https://de1.api.radio-browser.info/json/stations/topvote/30',
      responseType: 'json',
      timeoutMs: 15000,
    });
    if (res.status !== 200 || !res.body) throw new Error(`HTTP ${res.status}`);
    if (page.closed) return; // the user left while we were waiting
    page.set({
      status: 'ready',
      items: res.body.map((s) => ({ id: s.stationuuid, title: s.name, subtitle: s.country, cover: s.favicon })),
    });
  } catch (e) {
    if (!page.closed) page.set({ status: 'error', message: String(e) });
  }
}
```

```
widget StationsPage = switch data.status {
  "ready": MediaRowList(items: data.items, refreshEvent: "refresh", onTap: event "pick" {}),
  "error": ErrorView(message: data.message),
  default: Loader(),
};
```

## Play something when a row is tapped

Needs `player`. A stream's `id` must be stable and unique, so prefix it with something of your own.

```ts
elbert.ui.page('radio', {
  events: {
    async pick(page, args) {
      const station = { name: 'Example FM', url: 'https://example.com/stream.mp3' };
      await elbert.player.play([
        { id: `example:${args.id}`, url: station.url, title: station.name, artist: 'Live radio' },
      ]);
    },
  },
});
```

To play a file the user already owns instead, pass `{ libraryId }`; `elbert.library.match(songs)`
finds the library track for a song you know by ISRC or title.

## Remember something

`storage` is private to the plugin, needs no permission, and survives updates. Values must be JSON.

```ts
interface Prefs {
  country: string;
  favourites: string[];
}

const DEFAULTS: Prefs = { country: 'DE', favourites: [] };

async function prefs(): Promise<Prefs> {
  return { ...DEFAULTS, ...((await elbert.storage.get<Prefs>('prefs')) ?? {}) };
}

async function toggleFavourite(id: string) {
  const p = await prefs();
  const favourites = p.favourites.includes(id) ? p.favourites.filter((f) => f !== id) : [...p.favourites, id];
  await elbert.storage.set('prefs', { ...p, favourites });
}
```

Credentials go in `elbert.secrets` instead, never in `storage` or a log line.

## Add an action to song menus

Shows in the ⋯ menu of a song row. Leave `when` out to offer it on every track, or limit it to tracks
your plugin owns with an id prefix.

```ts
elbert.onActivate(async () => {
  await elbert.ui.setTrackActions([
    {
      id: 'copy-title',
      label: 'Show title',
      icon: 'info',
      run: (track) => `${track.artist} - ${track.title}`, // a returned string is shown as a snackbar
    },
  ]);
});
```

## Ask the user something

```ts
async function rename(current: string): Promise<string | null> {
  const name = await elbert.ui.prompt({ title: 'Rename', hint: 'New name', initial: current });
  if (name === null) return null; // cancelled
  if (name === current) return null;
  const ok = await elbert.ui.confirm({ title: `Rename to "${name}"?`, destructive: false });
  return ok ? name : null;
}
```

## React to what is playing

Needs `player`. Subscribe only while you need it; `player.onTick` fires every second.

```ts
elbert.onActivate(() => {
  const off = elbert.player.onChange(async (e) => {
    if (e.currentId?.startsWith('example:')) await elbert.ui.setBadge('/example', e.queue.length);
  });
  elbert.onDeactivate(() => off());
});
```

## Open one page from another

Give the detail route a `:param`, then `navigate` to it. The detail controller reads
`page.params`.

```ts
elbert.ui.page('detail', {
  open: async (page) => ({ title: `Item ${page.params.id}` }),
});

elbert.onActivate(async () => {
  await elbert.ui.setRoutes([
    { path: '/example', page: 'list', widget: 'example:ListPage', transition: 'fade' },
    { path: '/example/items/:id', page: 'detail', widget: 'example:DetailPage', transition: 'slide' },
  ]);
});

elbert.ui.page('list', {
  events: {
    pick: (_page, args) => elbert.ui.navigate(`/example/items/${args.id}`),
  },
});
```

## Give the plugin its own settings page

```ts
elbert.ui.page('settings', {
  open: async () => ({ country: (await elbert.storage.get<string>('country')) ?? 'DE' }),
  events: {
    setCountry: async (_page, args) => {
      await elbert.storage.set('country', String(args.value));
    },
  },
});

elbert.onActivate(async () => {
  await elbert.ui.setSettings({
    title: 'Example',
    subtitle: 'Country and quality',
    icon: 'settings',
    page: 'settings',
    widget: 'example:SettingsPage',
  });
});
```

## Do work in the background without freezing

One call into your plugin may run about ten seconds. Break long work into awaited steps; each `await`
on a host call gives the engine back.

```ts
async function importAll(ids: string[], onProgress: (done: number) => void) {
  let done = 0;
  for (const id of ids) {
    await elbert.http.request({ url: `https://example.com/items/${id}`, responseType: 'none' });
    onProgress(++done);
  }
}
```
