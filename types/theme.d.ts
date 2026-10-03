/**
 * The shape of a theme's `theme.json` (see docs/themes.md). A theme is a package
 * of `"type": "theme"` in its manifest: data only, no code, no permissions.
 *
 * Mirrors Elbert's `lib/theme/theme_pack.dart`; `elbert-plugin check` applies the
 * same rules. Use it for editor completion:
 *
 * ```ts
 * import type { ThemeFile } from '@evolvedmesh/elbert-plugin-sdk/theme';
 * ```
 */

/** `#RGB`, `#RRGGBB` or `#AARRGGBB`. */
export type ThemeColor = string;

/** Every colour role a theme may set. */
export type ColorRole =
  | 'primary'
  | 'onPrimary'
  | 'primaryContainer'
  | 'onPrimaryContainer'
  | 'secondary'
  | 'onSecondary'
  | 'secondaryContainer'
  | 'onSecondaryContainer'
  | 'tertiary'
  | 'onTertiary'
  | 'tertiaryContainer'
  | 'onTertiaryContainer'
  | 'error'
  | 'onError'
  | 'errorContainer'
  | 'onErrorContainer'
  | 'surface'
  | 'onSurface'
  | 'onSurfaceVariant'
  | 'surfaceDim'
  | 'surfaceBright'
  | 'surfaceContainerLowest'
  | 'surfaceContainerLow'
  | 'surfaceContainer'
  | 'surfaceContainerHigh'
  | 'surfaceContainerHighest'
  | 'outline'
  | 'outlineVariant'
  | 'inverseSurface'
  | 'onInverseSurface'
  | 'inversePrimary'
  | 'shadow'
  | 'scrim';

/** Elbert's corner scale: 4, 8, 12, 16, 20, 28 and 32 by default. */
export type CornerToken = 'extraSmall' | 'small' | 'medium' | 'large' | 'largeIncreased' | 'extraLarge' | 'extraLargeIncreased';

/** A colour role (`surfaceContainerHigh`, follows light/dark/AMOLED) or a fixed `#RRGGBB` / `#AARRGGBB`. */
export type ColorRef = ColorRole | ThemeColor;

/** Styling shared by every component. Unset leaves Elbert's own. */
export interface SurfaceStyle {
  /** Corner radius in logical pixels, 0 - 200. */
  radius?: number;
  color?: ColorRef;
  borderColor?: ColorRef;
  /** Border width, 0 - 12. Setting it without `borderColor` draws a transparent border. */
  borderWidth?: number;
}

/** A padding: all sides, `[horizontal, vertical]` or `[left, top, right, bottom]`. */
export type Padding = number | [number, number] | [number, number, number, number];

export interface SongRowStyle extends SurfaceStyle {
  /** Background while the pointer is over the row. */
  hoverColor?: ColorRef;
  /** Background while this is the track playing. */
  activeColor?: ColorRef;
  padding?: Padding;
  /** Space between the artwork and the text, 0 - 64. */
  gap?: number;
  /** Artwork size, 16 - 160. */
  coverSize?: number;
  /** Artwork corner radius, 0 - 200. */
  coverRadius?: number;
}

/** What a theme can style, and how. Each is applied by Elbert's own widget. */
export interface ComponentStyles {
  /** The standard content surface: settings groups, home sections, tiles. */
  card?: SurfaceStyle & { padding?: Padding };
  /** A track row in any list. */
  songRow?: SongRowStyle;
  albumCard?: SurfaceStyle;
  artistCard?: SurfaceStyle;
  /** The player bar docked on tablets and desktop. */
  playerBar?: SurfaceStyle;
  sidebar?: SurfaceStyle;
  /** The phone dock: player bar and bottom navigation. */
  dock?: SurfaceStyle;
  dialog?: SurfaceStyle;
  /** A bottom sheet; the radius is its top corners. */
  sheet?: SurfaceStyle;
  menu?: SurfaceStyle;
  input?: SurfaceStyle;
  chip?: SurfaceStyle;
  navigationBar?: SurfaceStyle;
}

/** Text a theme may replace, by key. */
export interface ThemeStrings {
  'app.name'?: string;
  'app.byline'?: string;
  'nav.home'?: string;
  'nav.search'?: string;
  'nav.albums'?: string;
  'nav.artists'?: string;
  'nav.songs'?: string;
  'nav.playlists'?: string;
  'nav.statistics'?: string;
  'nav.createPlaylist'?: string;
  'home.recentlyPlayed'?: string;
  'player.notPlaying'?: string;
  'player.selectTrack'?: string;
  'song.nowPlaying'?: string;
}

/** A widget in one of the manifest's `ui` libraries that draws a component. */
export interface TemplateRef {
  ui: string;
  widget: string;
}

export type ColorOverrides = Partial<Record<ColorRole, ThemeColor>>;

export interface ThemeFile {
  /**
   * The colour Elbert's palette is generated from. Setting it takes the choice
   * of accent colour (and the Android wallpaper palette) away from the user
   * while the theme is in use. Leave it out to let the user's accent through.
   */
  seed?: ThemeColor;

  /** Roles to override on top of the generated palette. */
  colors?: {
    light?: ColorOverrides;
    dark?: ColorOverrides;
    /**
     * Applied on top of `dark` when the user picks AMOLED, after Elbert has made
     * the surfaces true black - so a theme that says nothing here still gets black.
     */
    amoled?: ColorOverrides;
  };

  typography?: {
    /** A Google Fonts family, for a theme that bundles no font files. */
    fontFamily?: string;
    /** A font the theme ships: .ttf/.otf files inside the package. */
    font?: { family: string; files: string[] };
    /** Multiplies every text size, 0.85 - 1.25. */
    scale?: number;
  };

  shapes?: {
    /** Multiplies every corner in the app (cards, rows, covers, sheets, dialogs, menus, fields), 0 - 2. */
    scale?: number;
    /** Pins named corners to an exact radius in logical pixels, 0 - 200. These ignore `scale`. */
    radii?: Partial<Record<CornerToken, number>>;
    /** Resting shape of buttons and chips. `pill` (default) also squeezes when pressed. */
    buttons?: 'pill' | 'rounded' | 'square';
  };

  /** Per-component looks: corner, colours, border, padding. */
  components?: ComponentStyles;

  /** Replacement text. */
  strings?: ThemeStrings;

  /**
   * Templates that draw a component's body, replacing Elbert's own. Elbert keeps
   * the behaviour (tap, hover, menus, now-playing state); the template is only
   * what it looks like. See docs/themes.md for the data each receives.
   */
  templates?: {
    songRow?: TemplateRef;
    albumCard?: TemplateRef;
  };

  /** A backdrop drawn behind every page. */
  background?: {
    /** A library from the manifest's `ui`. */
    ui: string;
    /** A widget that library declares. */
    widget: string;
    /** How far the surface colour is laid back over the background, 0 - 1. */
    dim?: number;
  };
}
