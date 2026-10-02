// Radio Browser — a sample Elbert plugin.
//
// It shows the whole shape of a plugin in one file: a section of the app with
// its own navigation (and phone dock), pages whose data this code produces and
// whose look lives in ui/radio.rfwtxt, live streams played through Elbert's
// player, a settings page, a track-menu action, and state kept in plugin
// storage. Read it alongside docs/getting-started.md.
//
// The directory is https://www.radio-browser.info — free, community-run, no
// key. Be a good citizen: identify yourself and cache what you can.

import type { Page, StreamTrack } from '../../../types/elbert';

const API = 'https://de1.api.radio-browser.info/json';
const ID_PREFIX = 'radio:';
const SECTION = '/radio';

interface Station {
  stationuuid: string;
  name: string;
  url_resolved: string;
  favicon: string;
  tags: string;
  country: string;
  countrycode: string;
  codec: string;
  bitrate: number;
  votes: number;
  homepage: string;
}

interface Settings {
  country: string;
  minBitrate: number;
}

// ---- Data -------------------------------------------------------------------

async function api<T>(path: string): Promise<T> {
  const res = await elbert.http.request<T>({
    url: `${API}${path}`,
    headers: { 'User-Agent': `Elbert/${elbert.plugin.name} ${elbert.plugin.version}` },
    responseType: 'json',
    timeoutMs: 15000,
  });
  if (res.status !== 200 || res.body == null) {
    throw new elbert.ElbertError('network', `Radio Browser answered ${res.status}.`);
  }
  return res.body;
}

async function settings(): Promise<Settings> {
  return {
    country: (await elbert.storage.get<string>('country')) ?? '',
    minBitrate: (await elbert.storage.get<number>('minBitrate')) ?? 0,
  };
}

async function topStations(): Promise<Station[]> {
  const s = await settings();
  const q = s.country
    ? `/stations/search?countrycode=${encodeURIComponent(s.country)}&order=votes&reverse=true&limit=40&hidebroken=true`
    : '/stations/topvote/40';
  return (await api<Station[]>(q)).filter((st) => st.bitrate >= s.minBitrate);
}

async function search(query: string): Promise<Station[]> {
  return api<Station[]>(`/stations/search?name=${encodeURIComponent(query)}&order=votes&reverse=true&limit=40&hidebroken=true`);
}

async function favourites(): Promise<Station[]> {
  return (await elbert.storage.get<Station[]>('favourites')) ?? [];
}

async function setFavourite(station: Station, on: boolean): Promise<void> {
  const list = (await favourites()).filter((s) => s.stationuuid !== station.stationuuid);
  if (on) list.unshift(station);
  await elbert.storage.set('favourites', list);
}

/** What the templates' cards and rows read. */
function card(st: Station) {
  return {
    id: st.stationuuid,
    title: st.name.trim() || 'Unnamed station',
    subtitle: [st.country, st.bitrate ? `${st.bitrate} kbps` : '', st.codec].filter(Boolean).join(' · '),
    cover: st.favicon || undefined,
    placeholderIcon: 'radio',
  };
}

function track(st: Station): StreamTrack {
  return {
    id: `${ID_PREFIX}${st.stationuuid}`,
    url: st.url_resolved,
    title: st.name.trim(),
    artist: st.tags.split(',').filter(Boolean).slice(0, 3).join(', ') || st.country,
    album: 'Radio Browser',
    coverUrl: st.favicon || undefined,
    providerName: 'Radio Browser',
    artistRoute: `${SECTION}/stations/${encodeURIComponent(st.stationuuid)}`,
  };
}

/** Plays [stations] from [index]: a "queue" of stations, so next/previous zap. */
async function play(stations: Station[], index: number) {
  await elbert.player.play(stations.map(track), { startIndex: index });
}

// ---- Chrome shared by the section's pages -------------------------------------

const tabs = () => [
  { label: 'Top', icon: 'trophy', route: SECTION },
  { label: 'Search', icon: 'search', route: `${SECTION}/search` },
  { label: 'Favourites', icon: 'heart', route: `${SECTION}/favourites` },
];

// ---- Pages ------------------------------------------------------------------------

/** What a list page's template switches on. */
type Status = 'loading' | 'error' | 'empty' | 'ready';

type ListData = {
  tabs: unknown;
  current: string;
  status: Status;
  error?: string;
  emptyText?: string;
  stations: unknown[];
};
type ListState = { stations: Station[] };
type ListPage = Page<ListData, ListState>;

async function loadInto(page: ListPage, load: () => Promise<Station[]>) {
  page.set({ status: 'loading' });
  try {
    const stations = await load();
    page.state.stations = stations;
    page.set({ status: stations.length ? 'ready' : 'empty', stations: stations.map(card) });
  } catch (e) {
    page.set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
  }
}

elbert.ui.page<ListData, ListState>('top', {
  open(page: ListPage) {
    page.state.stations = [];
    void loadInto(page, topStations);
    return { tabs: tabs(), current: SECTION, status: 'loading', stations: [] };
  },
  events: {
    async refresh(page: ListPage) {
      await loadInto(page, topStations);
    },
    play(page: ListPage, { index }) {
      return play(page.state.stations, index);
    },
    open(page: ListPage, { index }) {
      const st = page.state.stations[index];
      return elbert.ui.navigate(`${SECTION}/stations/${encodeURIComponent(st.stationuuid)}`);
    },
  },
});

elbert.ui.page<ListData, ListState>('search', {
  open(page: ListPage) {
    page.state.stations = [];
    const hint = 'Search over 50,000 stations by name.';
    return { tabs: tabs(), current: `${SECTION}/search`, status: 'empty', emptyText: hint, stations: [] };
  },
  events: {
    async query(page: ListPage, { query }) {
      const q = String(query ?? '').trim();
      if (q.length < 2) {
        page.state.stations = [];
        page.set({ status: 'empty', emptyText: 'Search over 50,000 stations by name.', stations: [] });
        return;
      }
      page.set({ emptyText: `Nothing found for "${q}".` });
      await loadInto(page, () => search(q));
    },
    play(page: ListPage, { index }) {
      return play(page.state.stations, index);
    },
  },
});

elbert.ui.page<ListData, ListState>('favourites', {
  async open(page: ListPage) {
    const list = await favourites();
    page.state.stations = list;
    return {
      tabs: tabs(),
      current: `${SECTION}/favourites`,
      status: list.length ? 'ready' : 'empty',
      stations: list.map(card),
    };
  },
  events: {
    play(page: ListPage, { index }) {
      return play(page.state.stations, index);
    },
    async remove(page: ListPage, { id }) {
      const station = page.state.stations.find((s) => s.stationuuid === id);
      if (!station) return;
      await setFavourite(station, false);
      page.state.stations = await favourites();
      page.set({ status: page.state.stations.length ? 'ready' : 'empty', stations: page.state.stations.map(card) });
    },
  },
});

type StationPage = Page<Record<string, unknown>, { station?: Station; favourite: boolean }>;

/** The station page's buttons — their labels follow the favourite state. */
function stationActions(st: Station, favourite: boolean) {
  return [
    { id: 'favourite', label: favourite ? 'Favourite' : 'Add to favourites', icon: favourite ? 'heart-off' : 'heart' },
    ...(st.homepage ? [{ id: 'homepage', label: 'Website', icon: 'external-link' }] : []),
  ];
}

elbert.ui.page('station', {
  async open(page: StationPage) {
    const id = page.params.id;
    const found = (await api<Station[]>(`/stations/byuuid/${encodeURIComponent(id)}`))[0];
    if (!found) throw new elbert.ElbertError('not_found', 'That station is no longer listed.');
    page.state.station = found;
    page.state.favourite = (await favourites()).some((s) => s.stationuuid === id);
    return {
      ...card(found),
      tags: found.tags.split(',').filter(Boolean).join(' · '),
      info: [
        { label: 'Country', value: found.country || '—' },
        { label: 'Quality', value: found.bitrate ? `${found.bitrate} kbps ${found.codec}` : found.codec || '—' },
        { label: 'Votes', value: `${found.votes}` },
      ],
      actions: stationActions(found, page.state.favourite),
    };
  },
  events: {
    play(page: StationPage) {
      const st = page.state.station;
      if (st) return play([st], 0);
    },
    async action(page: StationPage, { id }) {
      const st = page.state.station;
      if (!st) return;
      if (id === 'homepage') return elbert.ui.openUrl(st.homepage);
      page.state.favourite = !page.state.favourite;
      await setFavourite(st, page.state.favourite);
      page.set({ actions: stationActions(st, page.state.favourite) });
      await elbert.ui.toast(page.state.favourite ? 'Added to favourites' : 'Removed from favourites');
    },
  },
});

elbert.ui.page('settings', {
  async open() {
    const s = await settings();
    return { country: s.country, highQuality: s.minBitrate >= 128 };
  },
  events: {
    async country(_page, { value }) {
      const code = String(value ?? '')
        .trim()
        .toUpperCase()
        .slice(0, 2);
      await elbert.storage.set('country', code);
    },
    async highQuality(page, { value }) {
      await elbert.storage.set('minBitrate', value ? 128 : 0);
      page.set({ highQuality: !!value });
    },
  },
});

// ---- Wiring -------------------------------------------------------------------------

elbert.onActivate(async () => {
  await elbert.ui.setNavigation({
    destinations: [{ label: 'Radio', icon: 'radio', route: SECTION }],
    // On a phone the dock becomes the section's while you're in it.
    compact: {
      prefix: SECTION,
      destinations: [...tabs(), { label: 'Settings', icon: 'settings', route: `${SECTION}/settings` }],
    },
  });

  await elbert.ui.setRoutes([
    { path: SECTION, page: 'top', widget: 'radio:TopPage' },
    { path: `${SECTION}/search`, page: 'search', widget: 'radio:SearchPage' },
    { path: `${SECTION}/favourites`, page: 'favourites', widget: 'radio:FavouritesPage' },
    { path: `${SECTION}/stations/:id`, page: 'station', widget: 'radio:StationPage', transition: 'slide' },
    // Elbert's own Settings, mounted inside the section for the phone dock.
    { path: `${SECTION}/settings`, host: 'settings' },
    { path: `${SECTION}/settings/:section`, host: 'settingsSection', transition: 'slide' },
  ]);

  await elbert.ui.setSettings({
    title: 'Radio Browser',
    subtitle: 'Country and stream quality',
    icon: 'radio',
    page: 'settings',
    widget: 'radio:SettingsPage',
  });

  await elbert.ui.setTrackActions([
    {
      id: 'favourite',
      label: 'Add station to favourites',
      icon: 'heart',
      when: { idPrefix: [ID_PREFIX] },
      async run(t) {
        const uuid = t.id.slice(ID_PREFIX.length);
        const found = (await api<Station[]>(`/stations/byuuid/${encodeURIComponent(uuid)}`))[0];
        if (!found) return 'That station is no longer listed.';
        await setFavourite(found, true);
        return `Added "${found.name.trim()}" to favourites.`;
      },
    },
  ]);

  console.log('Radio Browser ready');
});
