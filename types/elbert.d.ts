declare global {
  const elbert: Elbert;

  /** Timers, provided by the plugin runtime (QuickJS has none of its own). */
  function setTimeout(fn: (...args: any[]) => void, ms?: number, ...args: any[]): number;
  function setInterval(fn: (...args: any[]) => void, ms?: number, ...args: any[]): number;
  function clearTimeout(id: number): void;
  function clearInterval(id: number): void;
  function queueMicrotask(fn: () => void): void;

  /** Lines go to the plugin's log (Settings → Plugins → Log). */
  const console: {
    log(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
    debug(...args: unknown[]): void;
  };
}

/** Anything that survives a trip through JSON. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json | undefined };

export interface ElbertError extends Error {
  /**
   * `permission_denied`, `bad_args`, `not_found`, `network`, `timeout`,
   * `http_<status>`, `not_allowed`, `stopped`, `unknown_method`, `host_error`…
   */
  code: string;
  /** The host method that failed. */
  method?: string;
}

export type Permission = 'network' | 'storage' | 'process' | 'player' | 'library' | 'playlists' | 'lyrics' | 'history';

export interface Elbert {
  /** The plugin API version this Elbert implements. */
  readonly apiVersion: 1;
  readonly plugin: {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    /** `linux`, `windows`, `macos`, `android`, `ios`. */
    readonly platform: string;
    /** What the user granted (and the manifest asked for). */
    readonly permissions: Permission[];
  };
  readonly ElbertError: new (code: string, message: string) => ElbertError;

  /** Live development: reloads and state carried across them. */
  readonly dev: Dev;

  /** Runs once the plugin's code has loaded. Register pages, routes and the rest here. */
  onActivate(fn: () => void | Promise<void>): void;
  /** Runs (briefly) before the plugin is stopped. Everything it registered is removed anyway. */
  onDeactivate(fn: () => void | Promise<void>): void;

  /** Subscribes to a host event. Returns an unsubscribe function. */
  on(event: 'app.lifecycle', fn: (e: { state: 'paused' | 'detached' }) => void): () => void;
  on(event: string, fn: (data: any) => void): () => void;

  /** The raw call underneath every API below. */
  call<T = unknown>(method: string, args?: Json | object): Promise<T>;

  storage: Storage;
  secrets: Secrets;
  http: Http;
  fs: Files;
  process: Processes;
  native: Native;
  player: Player;
  library: Library;
  playlists: Playlists;
  history: History;
  lyrics: Lyrics;
  ui: Ui;
}

// ---- Storage ----------------------------------------------------------------

/** A JSON key/value store private to the plugin, kept across updates. No permission needed. */
export interface Storage {
  get<T = Json>(key: string): Promise<T | null>;
  set(key: string, value: Json | object): Promise<void>;
  remove(key: string): Promise<void>;
  all(): Promise<Record<string, Json>>;
}

/** The platform's secure storage (Keychain, libsecret, Keystore), namespaced to the plugin. */
export interface Secrets {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

// ---- Network ------------------------------------------------------------------

export interface HttpRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
  headers?: Record<string, string>;
  /** A raw body… */
  body?: string;
  /** …or a JSON one (sets content-type). */
  json?: Json | object;
  /** `text` (default), `json` (parsed; `body` is null when it isn't JSON) or `none`. */
  responseType?: 'text' | 'json' | 'none';
  timeoutMs?: number;
}

export interface HttpResponse<T = string> {
  status: number;
  /** Lower-case header names. */
  headers: Record<string, string>;
  body: T;
  /** With `responseType: 'json'`, the raw text when it didn't parse. */
  text?: string | null;
}

/** Needs `network`. Requests never throw on an HTTP status; check `status`. */
export interface Http {
  request<T = any>(req: HttpRequest & { responseType: 'json' }): Promise<HttpResponse<T>>;
  request(req: HttpRequest): Promise<HttpResponse<string>>;
  /**
   * Streams a response to a file, natively (bytes never pass through the
   * plugin). The path is checked like any `fs` write. Rejects with
   * `http_<status>` on a non-2xx answer.
   */
  download(req: {
    url: string;
    path: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
    onProgress?: (received: number, total: number) => void;
  }): Promise<{ status: number; bytes: number }>;
}

// ---- Files ----------------------------------------------------------------------

export interface Paths {
  /** The plugin's own persistent folder. Always writable. */
  data: string;
  /** The plugin's cache folder. Always writable; may be cleared. */
  cache: string;
  /** The plugin's own files (read-only). */
  assets: string;
  appSupport: string;
  /** The platform's Downloads folder, when it has one. */
  downloads: string | null;
  temp: string;
  /** The library's music folders. */
  music: string[];
  separator: '/' | '\\';
}

/**
 * Paths may be absolute, or relative to `paths().data`. Without `storage` a
 * plugin may write only inside its data and cache folders and read its own
 * files; with it, anywhere the app can.
 */
export interface Files {
  paths(): Promise<Paths>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<{ type: 'file' | 'directory'; size: number; modifiedMs: number } | null>;
  readText(path: string): Promise<string | null>;
  writeText(path: string, text: string, opts?: { append?: boolean }): Promise<void>;
  remove(path: string, opts?: { recursive?: boolean }): Promise<boolean>;
  rename(from: string, to: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  list(path: string): Promise<{ name: string; path: string; type: 'file' | 'directory' }[]>;
  /** Unpacks a `.zip`, `.tar` or `.tar.gz` (natively, off the UI thread). */
  extract(archive: string, dest: string): Promise<{ files: number }>;
  /**
   * Reads a CSV file a chunk of rows at a time (RFC 4180), so a file of any
   * size is never held whole. Closed at end of file, on `close()`, and when
   * the plugin stops.
   */
  openCsv(path: string): Promise<CsvCursor>;
  /** Absolute path of a file shipped inside the plugin. */
  asset(relativePath: string): Promise<string>;
  readAssetText(relativePath: string): Promise<string | null>;
  /** Joins path segments with `/` (accepted on every platform). */
  join(...parts: string[]): string;
}

export interface CsvCursor {
  /** The first row. */
  readonly header: string[];
  /** Up to [max] more rows (default 1000), only [columns] (indices) when given. */
  read(max?: number, columns?: number[]): Promise<{ rows: string[][]; done: boolean }>;
  close(): Promise<void>;
}

// ---- Processes ------------------------------------------------------------------

export interface ProcessOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface ProcessHandle {
  readonly handle: string;
  readonly pid: number;
  /** One call per output line. */
  onOutput(fn: (line: string, stream: 'stdout' | 'stderr') => void): () => void;
  onExit(fn: (code: number) => void): () => void;
  kill(signal?: 'term' | 'kill'): Promise<boolean>;
}

/**
 * Needs `process`. On Android only executables inside a runtime pack resolved
 * with `native.runtime` may be run (see docs/runtime-packs.md). Processes a
 * plugin starts are killed when it stops.
 */
export interface Processes {
  run(exe: string, args?: string[], opts?: ProcessOptions): Promise<{ exitCode: number; stdout: string; stderr: string }>;
  start(exe: string, args?: string[], opts?: Omit<ProcessOptions, 'timeoutMs'>): Promise<ProcessHandle>;
}

export interface Native {
  platform(): Promise<{ os: string; isDesktop: boolean; isMobile: boolean; isWeb: boolean; linuxAppArmor: boolean }>;
  /**
   * Android: a companion APK listed in the manifest's `android.runtimePackages`,
   * or null when it isn't installed. Null on every other platform.
   */
  runtime(packageName: string): Promise<{
    package: string;
    nativeLibraryDir: string;
    /** False when the pack was built with compressed libraries — nothing to run. */
    extracted: boolean;
    versionName: string | null;
    versionCode: number;
  } | null>;
}

// ---- Player & library -------------------------------------------------------------

/** A track the plugin streams. Exists only in the queue — never in the library. */
export interface StreamTrack {
  /** Stable and unique; prefix it with something of your own (`myservice:123`). */
  id: string;
  /** http(s). May carry credentials — it is never written to disk or shown. */
  url: string;
  title: string;
  artist: string;
  album?: string;
  albumArtist?: string;
  durationMs?: number;
  trackNumber?: number;
  discNumber?: number;
  coverUrl?: string;
  isrc?: string;
  hasLyrics?: boolean;
  /** Shown in errors and the statistics; defaults to the plugin's name. */
  providerName?: string;
  /** In-app routes for "Go to artist / album" (your own pages). */
  artistRoute?: string;
  albumRoute?: string;
}

/** A queue entry: a stream, or a track already in the library. */
export type QueueEntry = StreamTrack | { libraryId: string };

export interface LibraryTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  durationMs: number;
  trackNumber: number | null;
  discNumber: number | null;
  source: 'local' | 'subsonic' | 'plugin';
  pluginId: string | null;
  isrc: string | null;
  hasLyrics: boolean;
  isLocalFile: boolean;
  /** Only with `storage`, and only for files. */
  path?: string;
  /** Only for the plugin's own streams. */
  url?: string;
}

export interface PlayerState {
  current: LibraryTrack | null;
  playing: boolean;
  positionMs: number;
  durationMs: number;
  queue: string[];
  index: number;
}

/** Needs `player`. */
export interface Player {
  state(): Promise<PlayerState>;
  /** Replaces the queue and plays from `startIndex`. */
  play(tracks: QueueEntry[], opts?: { startIndex?: number }): Promise<void>;
  /** Adds after the current track. */
  addToQueue(tracks: QueueEntry[]): Promise<void>;
  /** Adds at the end. */
  appendToQueue(tracks: QueueEntry[]): Promise<void>;
  togglePlayPause(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  seek(ms: number): Promise<void>;
  /** The current track, playing state or queue changed. */
  onChange(fn: (e: { currentId: string | null; playing: boolean; durationMs: number; queue: string[]; index: number }) => void): () => void;
  /** Once a second while subscribed. */
  onTick(fn: (e: { currentId: string | null; positionMs: number; playing: boolean }) => void): () => void;
}

export interface SongRef {
  id: string;
  title: string;
  artist: string;
  album?: string;
  isrc?: string;
  durationMs?: number;
}

/** Needs `library`. */
export interface Library {
  /**
   * For each song, the library track that is the same recording (by ISRC,
   * then title/artist/duration), or null. Play a match instead of streaming.
   */
  match(songs: SongRef[]): Promise<(LibraryTrack | null)[]>;
  /** Adds a file the plugin wrote to disk. `id` must be stable. */
  add(track: {
    id: string;
    path: string;
    title: string;
    artist: string;
    album?: string;
    albumArtist?: string;
    durationMs?: number;
    trackNumber?: number;
    discNumber?: number;
    hasLyrics?: boolean;
    coverUrl?: string;
    isrc?: string;
  }): Promise<LibraryTrack>;
  get(id: string): Promise<LibraryTrack | null>;
  folders(): Promise<string[]>;
  onChange(fn: (e: { tracks: number; playlists: number }) => void): () => void;
}

export interface LibraryPlaylist {
  id: string;
  name: string;
  trackIds: string[];
  linkPluginId: string | null;
  linkRemoteId: string | null;
  sourcePath: string | null;
}

/** Needs `playlists`. */
export interface Playlists {
  list(): Promise<LibraryPlaylist[]>;
  /** The library playlist this plugin linked to `remoteId`, if any. */
  linked(remoteId: string): Promise<LibraryPlaylist | null>;
  /**
   * Creates or updates the library playlist mirroring one of your service's
   * playlists. Matched by link first, then by name.
   */
  upsertLinked(opts: { remoteId: string; name: string; trackIds: string[]; sourcePath?: string }): Promise<LibraryPlaylist>;
}

/** A listen in Elbert's history. Times are epoch milliseconds. */
export interface PlayRecord {
  title: string;
  artist: string;
  album?: string;
  albumArtist?: string;
  /** `local`, `subsonic` or `plugin`. Set by Elbert; ignored on import. */
  source?: string;
  /** Who served a plugin listen. On import, defaults to the plugin's name. */
  provider?: string | null;
  startedAtMs: number;
  /** When it ended; defaults to `startedAtMs + listenedMs`. */
  playedAtMs?: number;
  /** Time actually spent playing. */
  listenedMs: number;
  /** The track's length, when known. */
  durationMs?: number;
}

/** Needs `history`. */
export interface History {
  query(opts?: { provider?: string; sinceMs?: number }): Promise<PlayRecord[]>;
  /**
   * Adds plays made elsewhere. Duplicates of logged plays are skipped. With
   * `lastFm`, the plays Last.fm still accepts are sent to the user's account;
   * with `history: false` they are only sent, not added to Elbert's log.
   */
  import(plays: PlayRecord[], opts?: { lastFm?: boolean; history?: boolean }): Promise<{ added: number; sentToLastFm: number }>;
  /** Whether Last.fm is signed in, and the oldest start time it still accepts. */
  lastFm(): Promise<{ signedIn: boolean; acceptsSinceMs: number }>;
}

/** Needs `lyrics`. */
export interface Lyrics {
  /** Supplies lyrics (LRC or plain text) for the plugin's own streams. */
  provide(fn: (track: LibraryTrack) => Promise<string | null> | string | null): Promise<void>;
}

// ---- UI ----------------------------------------------------------------------------

/** Lucide icon name, e.g. `music-4`, `radio`, `folder-down` (lucide.dev/icons). */
export type IconName = string;

export interface NavItem {
  label: string;
  icon: IconName;
  /** Absolute, under a first segment of your own (`/radio`). */
  route: string;
}

export interface RouteSpec {
  /** `/radio/stations/:id` — `:name` segments become `page.params.name`. */
  path: string;
  /** `fade` for a section's tabs, `slide` for detail pages. */
  transition?: 'fade' | 'slide';
  /** The page controller (`ui.page(name)`) … */
  page?: string;
  /** … and the template that renders it, `library:Widget`. */
  widget?: string;
  /** Or one of Elbert's own pages: `settings` (the Settings index) / `settingsSection` (path ends in `:section`). */
  host?: 'settings' | 'settingsSection';
}

/** One open page. `data` is what the template sees as `data.*`. */
export interface Page<D extends object = Record<string, any>, S extends object = Record<string, any>> {
  readonly id: string;
  readonly name: string;
  readonly route: string | null;
  readonly params: Record<string, string>;
  readonly query: Record<string, string>;
  readonly data: D;
  /**
   * Your own per-page state; never sent anywhere. In development, when a code
   * change restarts the plugin, each open page's `state` is carried to the
   * page that reopens in its place (see `restored`) — keep it JSON.
   */
  state: S;
  /**
   * True when this page reopened after a development reload with its earlier
   * `state`. `open` can show what it had instead of fetching again.
   */
  readonly restored: boolean;
  /** True once the user left the page. */
  readonly closed: boolean;
  /** Merges into `data` (top-level keys) and redraws. Nulls are dropped. */
  set(patch: Partial<D>): void;
  /** For a page shown with `ui.sheet`: closes it, resolving the sheet with `value`. */
  dismiss(value?: Json): Promise<void>;
}

/**
 * Development helpers. A plugin loaded from a development folder or a dev
 * server restarts on every code change; these carry values across that
 * restart. Elsewhere they do nothing harmful: `isDev` is false, `persist`
 * savers are never called and `restore` returns `undefined`.
 */
export interface Dev {
  /** Loaded from a development folder or a dev server. */
  readonly isDev: boolean;
  /**
   * Registers `save`, called just before a development reload; what it
   * returns (JSON) is handed to the next engine as `restore(key)`.
   */
  persist(key: string, save: () => Json | undefined | Promise<Json | undefined>): void;
  /** What `persist(key, …)` saved before the reload, once; `undefined` otherwise. */
  restore<T extends Json = Json>(key: string): T | undefined;
}

export interface PageController<D extends object = any, S extends object = any> {
  /** Return the initial data (or call `page.set` later). Keep it fast; load the rest async. */
  open?(page: Page<D, S>): D | void | Promise<D | void>;
  /**
   * Template events by name. `args` holds the event's own arguments plus,
   * for list widgets, `index`/`id`. Return values reach widgets that await
   * an answer (pull-to-refresh waits for its handler to finish).
   */
  events?: Record<string, (page: Page<D, S>, args: Record<string, any>) => unknown>;
  close?(page: Page<D, S>): void | Promise<void>;
}

export interface TrackAction {
  id: string;
  label: string;
  icon?: IconName;
  /** Offered on tracks whose id starts with one of these (default: every track). */
  when?: { idPrefix?: string[] };
  /** Runs with the track; a returned string is shown as a snackbar. */
  run(track: LibraryTrack): Promise<string | void> | string | void;
}

export interface PlaylistAction {
  id: string;
  label: string;
  /** Where room is short (a phone's chips). */
  shortLabel?: string;
  icon?: IconName;
  /** Runs on a playlist linked to this plugin; a returned string is shown. */
  run(playlist: LibraryPlaylist): Promise<string | void> | string | void;
}

export interface Ui {
  /**
   * Sidebar/rail destinations ("Other Services"), plus — optionally — the
   * phone dock's destinations while inside `compact.prefix`.
   */
  setNavigation(spec: { destinations: NavItem[]; compact?: { prefix: string; destinations: NavItem[] } }): Promise<void>;
  setRoutes(routes: RouteSpec[]): Promise<void>;
  page<D extends object = any, S extends object = any>(name: string, controller: PageController<D, S>): void;
  /** A page in Settings, listed under Services. Pass null to remove it. */
  setSettings(spec: { title: string; subtitle?: string; icon?: IconName; page: string; widget: string } | null): Promise<void>;
  setTrackActions(actions: TrackAction[]): Promise<void>;
  setPlaylistActions(actions: PlaylistAction[]): Promise<void>;
  /** A count on a route (badges show on navigation and `SubNav` tabs you pass it to). */
  setBadge(route: string, count: number): Promise<void>;
  /** `push` (default) stacks a page; `go` replaces the stack (switching sections). */
  navigate(route: string, opts?: { mode?: 'push' | 'go' | 'replace' | 'pop' }): Promise<void>;
  toast(message: string, opts?: { durationMs?: number; actionLabel?: string; actionRoute?: string }): Promise<void>;
  confirm(opts: { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean }): Promise<boolean>;
  /** A one-line text prompt; null when cancelled. */
  prompt(opts: { title: string; hint?: string; initial?: string; confirmLabel?: string }): Promise<string | null>;
  /** One of your pages in a bottom sheet; resolves with what it `dismiss`es (null if swiped away). */
  sheet<T = Json>(opts: { page: string; widget: string; params?: Record<string, string | number | boolean> }): Promise<T | null>;
  openUrl(url: string): Promise<boolean>;
  /** The system file picker; the chosen paths (empty when cancelled). Picked files are readable without `storage`. */
  pickFiles(opts?: { extensions?: string[]; multiple?: boolean; title?: string }): Promise<string[]>;
  /** Needs `storage`. Opens the file manager at a path. */
  reveal(path: string): Promise<boolean>;
  showLyrics(track: StreamTrack): Promise<void>;
  showTrackInfo(opts: { title?: string; icon?: IconName; rows: [label: string, value: string][] }): Promise<void>;
}
