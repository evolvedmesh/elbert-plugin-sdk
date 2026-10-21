// What a layout may say (docs/layouts.md) — the same rules Elbert applies
// (lib/models/page_layout.dart there), so `check` finds a theme's layout
// problems before a user does. The tables also generate the JSON Schemas.

import { LUCIDE_NAMES } from './lucide-names';

// biome-ignore lint/suspicious/noExplicitAny: layouts are untrusted JSON, validated by hand below.
type Json = Record<string, any>;

export const LAYOUT_VERSION = 1;
export const SIZES = ['compact', 'medium', 'expanded'];
export const SURFACES = ['none', 'low', 'base', 'high', 'highest'];
export const DISPLAYS = ['rail', 'grid'];
export const SHORTCUT_ACTIONS = ['shuffleAll', 'quickMix', 'favourites', 'infinityRadio', 'openPlayer'];
export const NAV_SOURCES = ['playlists', 'services', 'smartPlaylists'];
export const PIN_KINDS = ['album', 'artist', 'track', 'playlist', 'smartPlaylist'];

/** Fields every block may carry. */
export const COMMON_BLOCK_FIELDS = ['id', 'type', 'span', 'visibleOn', 'style'];

/** Each block type and the fields it honours beyond the common ones. */
export const BLOCKS: Record<string, string[]> = {
  greeting: [],
  nowPlaying: [],
  weekStats: [],
  libraryTiles: [],
  otherServices: ['title'],
  forYou: ['title', 'tileSize'],
  recentlyPlayed: ['title', 'limit', 'tileSize'],
  recentlyAdded: ['title', 'limit', 'tileSize'],
  topArtists: ['title', 'limit', 'tileSize'],
  pinned: ['title', 'items', 'display', 'tileSize'],
  playlists: ['title', 'limit', 'tileSize'],
  smartPlaylists: ['title', 'tileSize'],
  topTracks: ['title', 'limit'],
  shortcut: ['title', 'text', 'icon', 'route', 'action'],
  note: ['title', 'text'],
  spacer: ['size'],
  cards: ['title', 'cards', 'display', 'tileSize'],
  widget: ['widget'],
};

/** Blocks only a plugin page can fill: what they show comes from the plugin. */
export const PLUGIN_ONLY_BLOCKS = ['cards', 'widget'];

/** Number fields and their ranges, by where they appear. */
export const RANGES = {
  row: { spaceBefore: [0, 400], stackBelow: [0, 10000], gap: [0, 200], stackGap: [0, 200], height: [48, 2000] },
  block: { span: [0.5, 12], tileSize: [64, 480], size: [0, 400] },
  limit: [1, 100],
  groupLimit: [1, 50],
  radius: [0, 64],
  dock: [2, 5],
} as const;

const ROW_FIELDS = ['id', 'blocks', ...Object.keys(RANGES.row)];
const CARD_FIELDS = ['title', 'subtitle', 'image', 'icon', 'route', 'event', 'args'];
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export interface LayoutOptions {
  /** Admit `cards` and `widget` (a plugin page's blocks). */
  allowPluginBlocks?: boolean;
}

/** One problem: where it is (`home.rows[2].blocks[0].span`) and what is wrong. */
export interface LayoutProblem {
  where: string;
  why: string;
}

/** Checks a whole layout (`{ home, sidebar, dock }`), naming each problem's path like Elbert does. */
export function validateLayout(layout: unknown, opts: LayoutOptions = {}): LayoutProblem[] {
  const v = new Validator(opts);
  v.layout(layout);
  return v.problems;
}

/** Checks the rows of a plugin page's `data.blocks`. */
export function validatePageBlocks(rows: unknown): LayoutProblem[] {
  const v = new Validator({ allowPluginBlocks: true });
  v.rows(rows, 'blocks');
  return v.problems;
}

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

class Validator {
  problems: LayoutProblem[] = [];
  private ids = new Map<string, Set<string>>();

  constructor(private opts: LayoutOptions) {}

  private bad(where: string, why: string) {
    this.problems.push({ where, why });
  }

  private onlyKeys(m: Json, where: string, allowed: string[]) {
    for (const k of Object.keys(m)) if (!allowed.includes(k)) this.bad(where, `has no field "${k}" (use ${allowed.join(', ')})`);
  }

  private num(m: Json, where: string, key: string, [lo, hi]: readonly [number, number]) {
    const v = m[key];
    if (v === undefined) return;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) this.bad(`${where}.${key}`, `must be a number from ${lo} to ${hi}`);
  }

  private int(m: Json, where: string, key: string, [lo, hi]: readonly [number, number]) {
    const v = m[key];
    if (v === undefined) return;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < lo || v > hi) this.bad(`${where}.${key}`, `must be a whole number from ${lo} to ${hi}`);
  }

  private text(m: Json, where: string, key: string, nonEmpty = false): string | undefined {
    const v = m[key];
    if (v === undefined) return undefined;
    if (typeof v !== 'string') this.bad(`${where}.${key}`, 'must be text');
    else if (nonEmpty && !v.trim()) this.bad(`${where}.${key}`, 'must not be empty');
    else return v;
    return undefined;
  }

  private color(m: Json, where: string, key: string) {
    const v = m[key];
    if (v !== undefined && (typeof v !== 'string' || !HEX.test(v.trim()))) this.bad(`${where}.${key}`, 'must be a colour like #RRGGBB');
  }

  private icon(m: Json, where: string, key: string) {
    const v = this.text(m, where, key, true);
    if (v !== undefined && !LUCIDE_NAMES.has(v)) this.bad(`${where}.${key}`, `"${v}" is not a Lucide icon name (e.g. "music-4")`);
  }

  private route(m: Json, where: string, key: string): string | undefined {
    const v = this.text(m, where, key, true);
    if (v !== undefined && !v.startsWith('/')) this.bad(`${where}.${key}`, 'must be a route starting with "/"');
    return v;
  }

  private id(m: Json, where: string, kind: string) {
    const v = this.text(m, where, 'id', true);
    if (v === undefined) return;
    const used = this.ids.get(kind) ?? new Set();
    this.ids.set(kind, used);
    if (used.has(v)) this.bad(`${where}.id`, `"${v}" is used twice; ids must be unique`);
    used.add(v);
  }

  layout(t: unknown) {
    if (!isObject(t)) {
      this.bad('layout', 'must be an object');
      return;
    }
    this.onlyKeys(t, 'layout', ['$schema', 'elbertLayout', 'home', 'sidebar', 'dock']);
    const version = t.elbertLayout;
    if (version !== undefined && (typeof version !== 'number' || !Number.isInteger(version))) this.bad('elbertLayout', 'must be a number');
    else if (typeof version === 'number' && version > LAYOUT_VERSION)
      this.bad('elbertLayout', `is ${version}; Elbert reads layouts up to ${LAYOUT_VERSION} (update the SDK)`);
    if (t.home !== undefined) {
      if (!isObject(t.home)) this.bad('home', 'must be an object');
      else {
        this.onlyKeys(t.home, 'home', ['rows']);
        this.rows(t.home.rows ?? [], 'home.rows');
      }
    }
    if (t.sidebar !== undefined) this.sidebar(t.sidebar);
    if (t.dock !== undefined) this.dock(t.dock);
  }

  rows(rows: unknown, where: string) {
    if (!Array.isArray(rows)) {
      this.bad(where, 'must be a list');
      return;
    }
    rows.forEach((row, i) => {
      this.row(row, `${where}[${i}]`);
    });
  }

  private row(row: unknown, where: string) {
    if (!isObject(row)) {
      this.bad(where, 'must be an object');
      return;
    }
    this.onlyKeys(row, where, ROW_FIELDS);
    this.id(row, where, 'row');
    for (const [key, range] of Object.entries(RANGES.row)) this.num(row, where, key, range);
    const blocks = row.blocks ?? [];
    if (!Array.isArray(blocks)) {
      this.bad(`${where}.blocks`, 'must be a list');
      return;
    }
    if (blocks.length === 0) this.bad(`${where}.blocks`, 'must hold at least one block');
    blocks.forEach((b, i) => {
      this.block(b, `${where}.blocks[${i}]`);
    });
  }

  private block(b: unknown, where: string) {
    if (!isObject(b)) {
      this.bad(where, 'must be an object');
      return;
    }
    const type = this.text(b, where, 'type', true);
    if (type === undefined) {
      if (b.type === undefined) this.bad(`${where}.type`, 'is required');
      return;
    }
    const fields = BLOCKS[type];
    if (!fields || (!this.opts.allowPluginBlocks && PLUGIN_ONLY_BLOCKS.includes(type))) {
      const known = Object.keys(BLOCKS).filter((t) => this.opts.allowPluginBlocks || !PLUGIN_ONLY_BLOCKS.includes(t));
      const hint = PLUGIN_ONLY_BLOCKS.includes(type) ? ' - only a plugin page can use it' : ` (use ${known.join(', ')})`;
      return this.bad(`${where}.type`, `"${type}" is not a block type${hint}`);
    }
    this.onlyKeys(b, where, [...COMMON_BLOCK_FIELDS, ...fields]);
    this.id(b, where, 'block');
    for (const [key, range] of Object.entries(RANGES.block)) this.num(b, where, key, range);
    this.int(b, where, 'limit', RANGES.limit);
    this.text(b, where, 'title');
    this.text(b, where, 'text');

    if (b.visibleOn !== undefined) {
      if (!Array.isArray(b.visibleOn)) this.bad(`${where}.visibleOn`, 'must be a list');
      else for (const s of b.visibleOn) if (!SIZES.includes(s)) this.bad(`${where}.visibleOn`, `"${s}" is not a size (use ${SIZES.join(', ')})`);
    }
    if (b.display !== undefined && !DISPLAYS.includes(b.display)) this.bad(`${where}.display`, 'must be "rail" or "grid"');
    if (b.action !== undefined && !SHORTCUT_ACTIONS.includes(b.action))
      this.bad(`${where}.action`, `"${b.action}" is not an action (use ${SHORTCUT_ACTIONS.join(', ')})`);
    const route = this.route(b, where, 'route');
    if (type === 'shortcut' && route === undefined && b.action === undefined) this.bad(where, 'needs a "route" or an "action"');
    this.icon(b, where, 'icon');
    if (type === 'widget' && (typeof b.widget !== 'string' || !b.widget.includes(':'))) this.bad(`${where}.widget`, 'must name a widget as "library:Widget"');

    if (b.style !== undefined) {
      if (!isObject(b.style)) this.bad(`${where}.style`, 'must be an object');
      else {
        const s = b.style;
        this.onlyKeys(s, `${where}.style`, ['accent', 'surface', 'radius']);
        this.color(s, `${where}.style`, 'accent');
        if (s.surface !== undefined && !SURFACES.includes(s.surface))
          this.bad(`${where}.style.surface`, `"${s.surface}" is not a surface (use ${SURFACES.join(', ')})`);
        this.num(s, `${where}.style`, 'radius', RANGES.radius);
      }
    }

    if (b.items !== undefined) {
      if (!Array.isArray(b.items)) this.bad(`${where}.items`, 'must be a list');
      else
        b.items.forEach((item, i) => {
          const at = `${where}.items[${i}]`;
          if (!isObject(item) || Object.keys(item).length !== 1) {
            this.bad(at, `must have exactly one of ${PIN_KINDS.join(', ')}`);
            return;
          }
          const [kind, ref] = Object.entries(item)[0];
          if (!PIN_KINDS.includes(kind)) this.bad(at, `"${kind}" is not something to pin (use ${PIN_KINDS.join(', ')})`);
          else if (typeof ref !== 'string' || !ref) this.bad(`${at}.${kind}`, 'must be non-empty text');
        });
    }

    if (b.cards !== undefined) {
      if (!Array.isArray(b.cards)) this.bad(`${where}.cards`, 'must be a list');
      else
        b.cards.forEach((c, i) => {
          const at = `${where}.cards[${i}]`;
          if (!isObject(c)) {
            this.bad(at, 'must be an object');
            return;
          }
          this.onlyKeys(c, at, CARD_FIELDS);
          if (this.text(c, at, 'title', true) === undefined && c.title === undefined) this.bad(`${at}.title`, 'is required');
          this.text(c, at, 'subtitle');
          this.text(c, at, 'image', true);
          this.text(c, at, 'event', true);
          this.route(c, at, 'route');
        });
    }
  }

  private sidebar(s: unknown) {
    if (!isObject(s)) {
      this.bad('sidebar', 'must be an object');
      return;
    }
    this.onlyKeys(s, 'sidebar', ['groups']);
    const groups = s.groups ?? [];
    if (!Array.isArray(groups)) {
      this.bad('sidebar.groups', 'must be a list');
      return;
    }
    groups.forEach((g, i) => {
      const where = `sidebar.groups[${i}]`;
      if (!isObject(g)) {
        this.bad(where, 'must be an object');
        return;
      }
      this.onlyKeys(g, where, ['id', 'label', 'source', 'limit', 'items']);
      this.id(g, where, 'group');
      this.text(g, where, 'label');
      if (g.source !== undefined && !NAV_SOURCES.includes(g.source))
        this.bad(`${where}.source`, `"${g.source}" is not a source (use ${NAV_SOURCES.join(', ')})`);
      this.int(g, where, 'limit', RANGES.groupLimit);
      this.tabs(g.items ?? [], `${where}.items`, 'tab');
    });
  }

  private dock(d: unknown) {
    if (!isObject(d)) {
      this.bad('dock', 'must be an object');
      return;
    }
    this.onlyKeys(d, 'dock', ['items']);
    const items = d.items ?? [];
    const [lo, hi] = RANGES.dock;
    if (Array.isArray(items) && (items.length < lo || items.length > hi)) this.bad('dock.items', `must hold ${lo} to ${hi} destinations`);
    this.tabs(items, 'dock.items', 'dock');
  }

  private tabs(items: unknown, where: string, kind: string) {
    if (!Array.isArray(items)) {
      this.bad(where, 'must be a list');
      return;
    }
    items.forEach((t, i) => {
      const at = `${where}[${i}]`;
      if (!isObject(t)) {
        this.bad(at, 'must be an object');
        return;
      }
      this.onlyKeys(t, at, ['id', 'route', 'label', 'icon', 'color']);
      this.id(t, at, kind);
      if (this.route(t, at, 'route') === undefined && t.route === undefined) this.bad(`${at}.route`, 'is required');
      this.text(t, at, 'label', true);
      this.icon(t, at, 'icon');
      this.color(t, at, 'color');
    });
  }
}
