/**
 * The layout format (see docs/layouts.md): how Home, the sidebar and the phone
 * dock are arranged, as data. The same format is:
 *
 * - what **Settings → Layout** in Elbert edits, exports and imports;
 * - what a **theme** ships as `layouts` in `theme.json`;
 * - what a **plugin page** routed with `layout: true` draws itself from
 *   (`data.blocks`), instead of a template.
 *
 * Mirrors Elbert's `lib/models/page_layout.dart`; `elbert-plugin check` applies
 * the same rules to a theme's `layouts`. Use it for editor completion:
 *
 * ```ts
 * import type { ElbertLayout } from '@evolvedmesh/elbert-plugin-sdk/layout';
 * ```
 */

/** `#RGB`, `#RRGGBB` or `#AARRGGBB`. */
export type LayoutColor = string;

/** A Lucide icon name, e.g. `music-4`, `chart-bar` (lucide.dev/icons). */
export type LayoutIcon = string;

/**
 * Page widths a block can be limited to: `compact` is narrower than 600,
 * `medium` 600 - 899, `expanded` 900 and wider. Measured on the page, not the window.
 */
export type LayoutSize = 'compact' | 'medium' | 'expanded';

/** How a block looks. Every field is optional; unset is Elbert's own. */
export interface BlockStyle {
  /** Re-seeds the block's colour scheme: buttons, glows and tiles inside take this hue. */
  accent?: LayoutColor;
  /** The surface under the block: `none` (the page) or a container tone. */
  surface?: 'none' | 'low' | 'base' | 'high' | 'highest';
  /** Corner radius, 0 - 64. */
  radius?: number;
}

interface BlockBase {
  /** Unique among blocks. Generated from the type when left out. */
  id?: string;
  /** Share of the row's width, a flex weight from 0.5 to 12 (Elbert's editor writes twelfths). */
  span?: number;
  /** The page widths it shows at; all of them when left out. */
  visibleOn?: LayoutSize[];
  style?: BlockStyle;
}

/** One thing in a `pinned` block. */
export type PinnedItem =
  | { album: string }
  | { artist: string }
  | { track: string }
  | { playlist: string }
  /** `favourites`, `top-rated`, `recently-added`, `most-played`, `recently-played`, `never-played`, `long-tracks`. */
  | { smartPlaylist: string };

/** What a `shortcut` block does when it isn't opening a route. */
export type ShortcutAction = 'shuffleAll' | 'quickMix' | 'favourites' | 'infinityRadio' | 'openPlayer';

/** Good morning, and the date. */
export interface GreetingBlock extends BlockBase {
  type: 'greeting';
}
/** What's playing, or a way to start. */
export interface NowPlayingBlock extends BlockBase {
  type: 'nowPlaying';
}
/** Time listened this week, a bar per day. */
export interface WeekStatsBlock extends BlockBase {
  type: 'weekStats';
}
/** Song, album, artist and playlist counts. */
export interface LibraryTilesBlock extends BlockBase {
  type: 'libraryTiles';
}
/** Plugins' sections as chips. */
export interface OtherServicesBlock extends BlockBase {
  type: 'otherServices';
  title?: string;
}
/** Quick Mix, Favourites and Infinity Radio (shown only with a Subsonic server). */
export interface ForYouBlock extends BlockBase {
  type: 'forYou';
  title?: string;
  /** Tile width, 64 - 480; Elbert's size for the page width when left out. */
  tileSize?: number;
}
export interface RecentlyPlayedBlock extends BlockBase {
  type: 'recentlyPlayed';
  title?: string;
  /** 1 - 100. */
  limit?: number;
  tileSize?: number;
}
/** The newest albums. */
export interface RecentlyAddedBlock extends BlockBase {
  type: 'recentlyAdded';
  title?: string;
  limit?: number;
  tileSize?: number;
}
/** This week's top artists. */
export interface TopArtistsBlock extends BlockBase {
  type: 'topArtists';
  title?: string;
  limit?: number;
  tileSize?: number;
}
/** Albums, artists, songs and playlists chosen by the user (or the theme). */
export interface PinnedBlock extends BlockBase {
  type: 'pinned';
  title?: string;
  items?: PinnedItem[];
  /** `rail` (one scrolling row, default) or `grid` (wrapping). */
  display?: 'rail' | 'grid';
  tileSize?: number;
}
/** The user's playlists. */
export interface PlaylistsBlock extends BlockBase {
  type: 'playlists';
  title?: string;
  limit?: number;
  tileSize?: number;
}
/** Elbert's smart playlists. */
export interface SmartPlaylistsBlock extends BlockBase {
  type: 'smartPlaylists';
  title?: string;
  tileSize?: number;
}
/** This week's most-played songs. */
export interface TopTracksBlock extends BlockBase {
  type: 'topTracks';
  title?: string;
  limit?: number;
}
/** One card that opens a route or starts a mix. Needs `route` or `action`. */
export interface ShortcutBlock extends BlockBase {
  type: 'shortcut';
  title?: string;
  /** The line under the title. */
  text?: string;
  icon?: LayoutIcon;
  route?: string;
  action?: ShortcutAction;
}
/** A heading and some words. */
export interface NoteBlock extends BlockBase {
  type: 'note';
  title?: string;
  text?: string;
}
/** Empty space. */
export interface SpacerBlock extends BlockBase {
  type: 'spacer';
  /** Height, 0 - 400. */
  size?: number;
}

/** A block Home, a theme and a plugin page can all use. */
export type LayoutBlock =
  | GreetingBlock
  | NowPlayingBlock
  | WeekStatsBlock
  | LibraryTilesBlock
  | OtherServicesBlock
  | ForYouBlock
  | RecentlyPlayedBlock
  | RecentlyAddedBlock
  | TopArtistsBlock
  | PinnedBlock
  | PlaylistsBlock
  | SmartPlaylistsBlock
  | TopTracksBlock
  | ShortcutBlock
  | NoteBlock
  | SpacerBlock;

/** One tile of a plugin page's `cards` block. Give it a `route` to open or an `event` to raise. */
export interface LayoutCard {
  title: string;
  subtitle?: string;
  /** An `http(s)` image URL. */
  image?: string;
  /** Shown when there is no image (a puzzle piece for a name Elbert doesn't know). */
  icon?: LayoutIcon;
  route?: string;
  /** Sent to the page controller's `events[event]`, with `args`. */
  event?: string;
  args?: Record<string, any>;
}

/** Plugin pages only: tiles the plugin supplies. */
export interface CardsBlock extends BlockBase {
  type: 'cards';
  title?: string;
  cards?: LayoutCard[];
  display?: 'rail' | 'grid';
  tileSize?: number;
}
/** Plugin pages only: one of the plugin's own templates, given the page's data. */
export interface WidgetBlock extends BlockBase {
  type: 'widget';
  /** `library:Widget`, a library from the manifest's `ui`. */
  widget: string;
}

/** What a plugin page may use: every block, plus `cards` and `widget`. */
export type PageBlock = LayoutBlock | CardsBlock | WidgetBlock;

/** Blocks side by side; below `stackBelow` they stack. */
export interface LayoutRow<B = LayoutBlock> {
  /** Unique among rows. Generated (`row-3`) when left out. */
  id?: string;
  /** One or more. */
  blocks: B[];
  /**
   * Space above the row, 0 - 400 (default 28). A row with nothing to show
   * collapses and hands its space to the next row that does, which takes the larger.
   */
  spaceBefore?: number;
  /** Page width below which the blocks stack. Never stacks when left out. */
  stackBelow?: number;
  /** Space between blocks side by side (default 16) and stacked (default 12), 0 - 200. */
  gap?: number;
  stackGap?: number;
  /** The row's height while side by side, 48 - 2000. Blocks size themselves when left out. */
  height?: number;
}

/** A row of a plugin page: `data.blocks` is a list of these. */
export type PageRow = LayoutRow<PageBlock>;

/** A sidebar or dock tab: a route, with optional name, icon and colour. */
export interface LayoutTab {
  /** Unique among tabs. Generated from the route when left out. */
  id?: string;
  /**
   * Any route: Elbert's pages (`/`, `/search`, `/stats`, `/folders`, `/settings`…), a plugin's
   * section, `/playlists/<id>`, `/playlists/smart/<id>`, `/albums/<key>`, `/artists/<name>`.
   */
  route: string;
  /** Left out, the destination's own name (which a theme's `strings` can reword). */
  label?: string;
  icon?: LayoutIcon;
  color?: LayoutColor;
}

/** A titled run of sidebar tabs. */
export interface LayoutGroup {
  id?: string;
  label?: string;
  /**
   * Rows added after the group's own tabs: `playlists` (the first `limit`, plus the Create
   * playlist button), `services` (every plugin section not placed as a tab elsewhere) or
   * `smartPlaylists`.
   */
  source?: 'playlists' | 'services' | 'smartPlaylists';
  /** 1 - 50. */
  limit?: number;
  items?: LayoutTab[];
}

export interface ElbertLayout {
  /** A JSON Schema for editors (the SDK's `schemas/layout.schema.json`); ignored by Elbert. */
  $schema?: string;
  /** The format version, 1. */
  elbertLayout?: 1;
  home?: { rows: LayoutRow[] };
  /** The rail on tablet widths shows the sidebar's tabs in order, then the services. */
  sidebar?: { groups: LayoutGroup[] };
  /** The phone's bottom navigation: 2 to 5 tabs. */
  dock?: { items: LayoutTab[] };
}

/** What a theme's `layouts` holds: a whole layout file, so one exported from Elbert pastes in as is. */
export type ThemeLayouts = ElbertLayout;
