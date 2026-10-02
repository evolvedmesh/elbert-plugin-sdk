# The `elbert` API

`types/elbert.d.ts` is the contract; this page explains how the pieces fit and what the types do
not say. Every call into the host returns a promise and may reject with an `ElbertError` whose
`code` names the reason: `permission_denied`, `bad_args`, `not_found`, `network`, `timeout`,
`http_<status>`, `not_allowed`, `stopped`, `unknown_method`, `host_error`. The codes are part of
the API.

```ts
try {
  await elbert.player.play([{ libraryId: 'missing' }]);
} catch (e) {
  if ((e as ElbertError).code === 'not_found') { /* … */ }
}
```

## The runtime

- Plugins run in **QuickJS-ng** (ES2023), one engine per plugin, each in its own background
  isolate. A busy or hung plugin never touches the UI thread.
- There is **no event loop beyond promises**, and no Node or browser globals. `setTimeout`,
  `setInterval`, `queueMicrotask` and `console` are provided by the host; `fetch` and `URL` do not
  exist.
- Limits: 256 MB heap, 512 KB stack, and **10 s per call** into the plugin, enforced by a watchdog.
  Do long work in many short awaits, not one long synchronous loop.
- Unhandled promise rejections are reported in the plugin's log (Settings → Plugins → Log).
- Everything you register (pages, routes, actions, listeners, processes) is removed when the plugin
  stops. `elbert.onDeactivate` gets a brief chance to flush state first.

```ts
elbert.onActivate(async () => {
  // register navigation, routes, settings and actions here
});
elbert.onDeactivate(async () => {
  // flush anything you were holding back
});
```

`elbert.plugin` has `id`, `name`, `version`, `platform` (`linux`, `windows`, `macos`, `android`,
`ios`) and `permissions` (what is granted). `elbert.apiVersion` is the API version this Elbert
implements.

## Events

`elbert.on(name, fn)` subscribes to a host event and returns an unsubscribe function. Producers are
wired on first subscription, so an idle plugin costs nothing.

| Event            | Payload                                             | Also                                                                      |
| ---------------- | --------------------------------------------------- | ------------------------------------------------------------------------- |
| `app.lifecycle`  | `{ state: 'paused' \| 'detached' }`                 | Flush pending writes here; on mobile `paused` is all the warning you get. |
| `player.change`  | `{ currentId, playing, durationMs, queue, index }`  | `player.onChange(fn)`                                                     |
| `player.tick`    | `{ currentId, positionMs, playing }`, once a second | `player.onTick(fn)`                                                       |
| `library.change` | `{ tracks, playlists }`                             | `library.onChange(fn)`                                                    |

Subscribe to `player.tick` only while something needs it.

## Storage and secrets

```ts
await elbert.storage.set('favourites', list);        // JSON, private to the plugin, kept across updates
const list = await elbert.storage.get<Station[]>('favourites');   // null when absent
await elbert.secrets.set('token', value);            // platform secure storage
```

`storage` is a JSON key/value store (`get`, `set`, `remove`, `all`). Values must survive JSON.
`secrets` is for credentials only. Neither needs a permission.

## Network

Needs `network`. Requests never reject on an HTTP status; check `status`.

```ts
const res = await elbert.http.request<Station[]>({
  url: 'https://example.com/api/stations',
  headers: { 'User-Agent': `${elbert.plugin.name}/${elbert.plugin.version}` },
  responseType: 'json',            // 'text' (default) | 'json' | 'none'
  timeoutMs: 15000,
});
if (res.status !== 200) throw new elbert.ElbertError('network', `HTTP ${res.status}`);
```

`json: {…}` sends a JSON body; `body: '…'` sends raw text. With `responseType: 'json'`, `body` is
`null` when the answer wasn't JSON and `text` holds the raw text. Header names in the response are
lower-case.

`http.download({ url, path, onProgress })` streams a response straight to a file, natively; the
bytes never pass through the plugin. It rejects with `http_<status>` on a non-2xx answer.

## Files

`fs.paths()` returns `data` and `cache` (the plugin's own, always writable), `assets` (its package,
read-only), `appSupport`, `downloads`, `temp`, `music` (the library's folders) and the path
`separator`. Relative paths resolve against `data`. Without `storage`, writes are confined to
`data` and `cache` and reads to those plus the plugin's own files.

`fs.extract(archive, dest)` unpacks `.zip`, `.tar` and `.tar.gz` natively. `fs.asset(rel)` is the
absolute path of a file shipped in the plugin; `fs.readAssetText(rel)` reads it. `fs.join(...)`
joins with `/`, which every platform accepts.

**Big CSV files.** `fs.readText` hands over a whole file as one string, which a file of a hundred
megabytes would not survive. `fs.openCsv(path)` reads RFC 4180 CSV a chunk at a time instead:

```ts
const csv = await elbert.fs.openCsv(path);      // { header, read, close }
const title = csv.header.indexOf('Song Name');
for (;;) {
  const { rows, done } = await csv.read(5000, [title]);   // only the columns you need
  for (const [name] of rows) count(name);
  if (done) break;                                // closed for you at the end
}
```

Pass column indices to `read` to receive only those. A cursor closes at the end of the file, on
`close()`, and when the plugin stops. Doing the work between `read` calls keeps each call into the
plugin short, which matters: one call may run for only a few seconds.

## Processes

Needs `process`. `process.run(exe, args, opts)` waits and returns `{ exitCode, stdout, stderr }`.
`process.start(exe, args, opts)` returns a handle with `onOutput`, `onExit` and `kill`. `opts` are
`cwd`, `env` and (for `run`) `timeoutMs`. Everything a plugin starts is killed when it stops. On
Android see [runtime-packs.md](runtime-packs.md). `native.platform()` reports the OS and whether
the host is a desktop, mobile or web build.

## Player, library and playlists

**Streams.** A plugin plays audio it doesn't own as `StreamTrack`s: an `id` that is stable and
prefixed with something of your own (`myservice:123`), an `http(s)` `url`, and tags. A stream
exists only in the queue; it is never saved to the library, the history or disk, because its URL
may carry credentials.

```ts
await elbert.player.play(stations.map(toStream), { startIndex: 3 });   // replaces the queue
await elbert.player.addToQueue([...]);                                  // after the current track
await elbert.player.appendToQueue([...]);                               // at the end
```

A queue entry is a `StreamTrack` or `{ libraryId }` for a track already in the library.

**Prefer a local copy.** `library.match(songs)` returns, for each song, the library track that is
the same recording (by ISRC, then normalised title/artist and a ±5 s duration check), or `null`.
Play the match instead of streaming: it is seekable, offline and free. It errs towards `null`,
because a false positive means the user taps one song and hears another.

**Adding files.** `library.add({ id, path, title, artist, … })` imports a file the plugin wrote to
disk. The `id` must be stable (it is stored in libraries and listening history). The file's own
tags supply the ISRC; give `isrc` when you already know it.

**Playlists.** `playlists.upsertLinked({ remoteId, name, trackIds, sourcePath? })` creates or
updates the library playlist that mirrors one of your service's playlists. It matches by link
first and **name** second, then stores the link, so a rename on either side doesn't split them.
`playlists.linked(remoteId)` finds it. Write a real `.m3u` beside the files and pass it as
`sourcePath` if you want other apps pointed at the folder to read the playlist too.

**Listening history.** Needs `history`. `history.query({ provider?, sinceMs? })` returns Elbert's
own listening history as `PlayRecord`s (times in epoch milliseconds). `history.import(plays,
{ lastFm?, history? })` adds plays that happened somewhere else — a service's data export, say — and returns
`{ added, sentToLastFm }`. Plays already logged (same title, artist and provider, starting within a
minute) are skipped, so a re-import is safe. Imported plays are filed under your plugin's name
unless one names its own `provider`. With `lastFm: true` and a signed-in user, the plays Last.fm
still accepts are sent too (`history: false` sends them without adding them to Elbert's log —
offer the two as separate choices, since sending alone puts nothing on Elbert's statistics); `history.lastFm()` returns `{ signedIn, acceptsSinceMs }` so you can
say up front how many that will be. Last.fm refuses plays older than about two weeks, and that is
true for every client.

**Lyrics.** `lyrics.provide(fn)` supplies lyrics (LRC or plain text) for your own streams; Elbert
asks you first for a track of yours. Return `null` for none.

## Pages and routes

```ts
elbert.ui.page('station', {
  open: async (page) => { /* page.params.id, page.query */ return { title: '…' }; },
  events: { play: (page, args) => { /* args.id, args.index */ } },
  close: (page) => { /* … */ },
});

await elbert.ui.setRoutes([
  { path: '/radio/stations/:id', page: 'station', widget: 'radio:StationPage', transition: 'slide' },
]);
```

- A **route** is `path` plus a controller (`page`) and a template (`widget`, `library:Widget`).
  `:name` segments arrive in `page.params`; the query string in `page.query`.
- Paths are absolute and must start with a segment of your own. `search`, `albums`, `artists`,
  `songs`, `playlists`, `stats`, `settings` and `plugins` are reserved. A route may also be one of
  Elbert's own pages: `{ path: '/radio/settings', host: 'settings' }` mounts the Settings index
  under your section (so the phone dock stays yours while it is open), and
  `{ path: '/radio/settings/:section', host: 'settingsSection' }` its section pages.
- `transition: 'fade'` suits a section's tabs, `'slide'` detail pages.
- `page.set(patch)` merges top-level keys into `data` and redraws. A patch set while `open` is still
  running wins over the object `open` returns, so cached data can be pushed straight away. Nulls
  are dropped, so don't use
  `null` to mean "unset". `page.state` is yours and is never sent anywhere. `page.closed` turns
  true once the user leaves: check it after every `await`.
- An event handler's return value reaches widgets that wait for it; pull-to-refresh stays open
  until the handler's promise settles.

### Navigation

```ts
await elbert.ui.setNavigation({
  destinations: [{ label: 'Radio', icon: 'radio', route: '/radio' }],      // sidebar/rail + a Home card on phones
  compact: { prefix: '/radio', destinations: [ /* the phone dock inside /radio */ ] },
});
await elbert.ui.navigate('/radio/search', { mode: 'go' });
```

Destinations appear under "Other Services" in the sidebar and at the end of the rail. With
`compact`, the phone dock is replaced by your destinations while the route is under `prefix`
(longest prefix wins). Entering such a section must be `mode: 'go'`, not `push`, because the shell
reads its path from the shell route. `setBadge(route, count)` puts a count on a destination or on
`SubNav` tab with that route.

### Settings page

`ui.setSettings({ title, subtitle, icon, page, widget })` adds your own page to Settings under
Services (section id `plugin.<id>`). Pass `null` to remove it.

### Actions

```ts
await elbert.ui.setTrackActions([{
  id: 'refresh', label: 'Refresh', icon: 'refresh-cw',
  when: { idPrefix: ['myservice:'] },            // omit to offer it on every track
  run: async (track) => 'Refreshed',             // a returned string is shown as a snackbar
}]);
await elbert.ui.setPlaylistActions([{ id: 'sync', label: 'Sync from service', shortLabel: 'Sync', run: (playlist) => '…' }]);
```

Track actions appear in a song row's ⋯ menu; playlist actions on the detail page of playlists
linked to your plugin.

### Dialogs and feedback

`ui.toast`, `ui.confirm({ title, message, destructive })` (resolves a boolean), `ui.prompt({ title,
hint, initial })` (a string, or `null` when cancelled), `ui.openUrl`, `ui.reveal(path)` (needs
`storage`), `ui.showLyrics(track)` and `ui.showTrackInfo({ rows })`, the same sheet Elbert uses for
its own tracks.

`ui.pickFiles({ extensions?, multiple?, title? })` opens the system file picker and resolves with
the chosen paths (an empty list when cancelled). The plugin may read a picked file without
`storage`.

`ui.sheet({ page, widget, params })` shows one of your pages in a bottom sheet and resolves with the
value its controller passes to `page.dismiss(value)`, or `null` if the user swiped it away.
