// What a theme plugin's `theme.json` may say — the same rules Elbert applies at
// install time (lib/theme/theme_pack.dart there), so `check` finds the
// problems before a user does.

import fs from 'node:fs';
import path from 'node:path';

// biome-ignore lint/suspicious/noExplicitAny: theme.json is untrusted JSON, validated by hand below.
type Json = Record<string, any>;

export const COLOR_ROLES = [
  'primary',
  'onPrimary',
  'primaryContainer',
  'onPrimaryContainer',
  'secondary',
  'onSecondary',
  'secondaryContainer',
  'onSecondaryContainer',
  'tertiary',
  'onTertiary',
  'tertiaryContainer',
  'onTertiaryContainer',
  'error',
  'onError',
  'errorContainer',
  'onErrorContainer',
  'surface',
  'onSurface',
  'onSurfaceVariant',
  'surfaceDim',
  'surfaceBright',
  'surfaceContainerLowest',
  'surfaceContainerLow',
  'surfaceContainer',
  'surfaceContainerHigh',
  'surfaceContainerHighest',
  'outline',
  'outlineVariant',
  'inverseSurface',
  'onInverseSurface',
  'inversePrimary',
  'shadow',
  'scrim',
];
export const RADIUS_TOKENS = ['extraSmall', 'small', 'medium', 'large', 'largeIncreased', 'extraLarge', 'extraLargeIncreased'];
export const SLOTS = ['songRow', 'albumCard'];

/** Text a theme may replace (Elbert's own text in the comments of docs/themes.md). */
export const STRING_KEYS = [
  'app.name',
  'app.byline',
  'nav.home',
  'nav.search',
  'nav.albums',
  'nav.artists',
  'nav.songs',
  'nav.playlists',
  'nav.statistics',
  'nav.createPlaylist',
  'home.recentlyPlayed',
  'player.notPlaying',
  'player.selectTrack',
  'song.nowPlaying',
];

export const SURFACE = ['radius', 'color', 'borderColor', 'borderWidth'];
/** Which fields each component honours. */
export const COMPONENTS: Record<string, string[]> = {
  card: [...SURFACE, 'padding'],
  songRow: [...SURFACE, 'hoverColor', 'activeColor', 'padding', 'gap', 'coverSize', 'coverRadius'],
  albumCard: SURFACE,
  artistCard: SURFACE,
  playerBar: SURFACE,
  sidebar: SURFACE,
  dock: SURFACE,
  dialog: SURFACE,
  sheet: SURFACE,
  menu: SURFACE,
  input: SURFACE,
  chip: SURFACE,
  navigationBar: SURFACE,
};
export const COMPONENT_RANGES: Record<string, [number, number]> = {
  radius: [0, 200],
  borderWidth: [0, 12],
  gap: [0, 64],
  coverSize: [16, 160],
  coverRadius: [0, 200],
};

/** Widget names a theme's templates can't declare: Flutter core's and Elbert's decoration and slot widgets. */
const RESERVED_WIDGETS = [
  ...'AnimationDefaults Align AspectRatio Center ClipRRect ColoredBox Column Container DefaultTextStyle Directionality Expanded Flexible FittedBox FractionallySizedBox GestureDetector GridView Icon IconTheme IntrinsicHeight IntrinsicWidth Image ListBody ListView Opacity Padding Placeholder Positioned Rotation Row SafeArea Scale SingleChildScrollView SizedBox SizedBoxExpand SizedBoxShrink Spacer Stack Text Wrap'.split(
    ' ',
  ),
  ...'GradientFill Orb Particles Waves Spin Drift Pulse TrackCover NowPlaying ThemedText ThemedIcon Panel'.split(' '),
];

const COLOR_SETS = ['light', 'dark', 'amoled'];
const BUTTON_SHAPES = ['pill', 'rounded', 'square'];
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const safe = (p: unknown): p is string => typeof p === 'string' && !p.startsWith('/') && !p.split(/[\\/]/).includes('..') && !p.includes(':');

/** The `typography.font` files a theme bundles. */
export function fontFiles(theme: Json): string[] {
  const files = theme.typography?.font?.files;
  return Array.isArray(files) ? files.filter((f): f is string => typeof f === 'string') : [];
}

/** Reads `theme.json` for the manifest, or undefined if it can't be read. */
export function readTheme(root: string, m: Json): Json | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, m.theme), 'utf8'));
  } catch {
    return undefined;
  }
}

/** Every file of a theme beyond the manifest and templates: theme.json and fonts. */
export function themeFiles(root: string, m: Json): string[] {
  if (m.type !== 'theme' || typeof m.theme !== 'string') return [];
  const theme = readTheme(root, m);
  return [m.theme, ...(theme ? fontFiles(theme) : [])];
}

export function validateTheme(root: string, m: Json): string[] {
  const problems: string[] = [];
  const file = m.theme;
  if (typeof file !== 'string' || file.trim() === '') return ['"theme" is required for a theme (e.g. "theme.json")'];
  if (!safe(file)) return ['"theme" must be a path inside the plugin'];
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) return [`${file} does not exist`];
  let t: Json;
  try {
    t = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    return [`${file} is not valid JSON: ${e instanceof Error ? e.message : e}`];
  }
  if (typeof t !== 'object' || t === null || Array.isArray(t)) return [`${file} must be a JSON object`];

  const bad = (where: string, why: string) => problems.push(`${file}: "${where}" ${why}`);
  const hex = (where: string, v: unknown) => {
    if (typeof v !== 'string' || !HEX.test(v.trim())) bad(where, `must be a colour like #RRGGBB (got ${JSON.stringify(v)})`);
  };
  const inRange = (where: string, v: unknown, lo: number, hi: number) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) bad(where, `must be a number from ${lo} to ${hi}`);
  };

  if (t.seed !== undefined) hex('seed', t.seed);

  for (const [set, roles] of Object.entries(t.colors ?? {})) {
    if (!COLOR_SETS.includes(set)) {
      bad(`colors.${set}`, `is not a colour set (use ${COLOR_SETS.join(', ')})`);
      continue;
    }
    if (typeof roles !== 'object' || roles === null) {
      bad(`colors.${set}`, 'must map colour roles to colours');
      continue;
    }
    for (const [role, v] of Object.entries(roles)) {
      if (!COLOR_ROLES.includes(role)) bad(`colors.${set}.${role}`, 'is not a colour role');
      else hex(`colors.${set}.${role}`, v);
    }
  }

  const type = t.typography;
  if (type !== undefined) {
    if (type.fontFamily !== undefined && (typeof type.fontFamily !== 'string' || !type.fontFamily.trim()))
      bad('typography.fontFamily', 'must be a non-empty string');
    if (type.scale !== undefined) inRange('typography.scale', type.scale, 0.85, 1.25);
    const font = type.font;
    if (font !== undefined) {
      if (typeof font.family !== 'string' || !font.family.trim()) bad('typography.font.family', 'is required');
      if (!Array.isArray(font.files) || font.files.length === 0) bad('typography.font.files', 'must be a non-empty list');
      else {
        for (const f of font.files) {
          if (!safe(f)) bad('typography.font.files', `"${f}" must stay inside the theme`);
          else if (!/\.(ttf|otf)$/i.test(f)) bad('typography.font.files', `"${f}" must be a .ttf or .otf file`);
          else if (!fs.existsSync(path.join(root, f))) bad('typography.font.files', `${f} does not exist`);
        }
      }
    }
  }

  const shapes = t.shapes;
  if (shapes !== undefined) {
    if (shapes.scale !== undefined) inRange('shapes.scale', shapes.scale, 0, 2);
    if (shapes.buttons !== undefined && !BUTTON_SHAPES.includes(shapes.buttons)) bad('shapes.buttons', `must be one of ${BUTTON_SHAPES.join(', ')}`);
  }

  for (const [token, v] of Object.entries(t.shapes?.radii ?? {})) {
    if (!RADIUS_TOKENS.includes(token)) bad(`shapes.radii.${token}`, `is not a corner (use ${RADIUS_TOKENS.join(', ')})`);
    else inRange(`shapes.radii.${token}`, v, 0, 200);
  }

  for (const [name, style] of Object.entries(t.components ?? {}) as [string, Json][]) {
    const fields = COMPONENTS[name];
    if (!fields) {
      bad(`components.${name}`, `is not a component (use ${Object.keys(COMPONENTS).join(', ')})`);
      continue;
    }
    for (const [key, v] of Object.entries(style ?? {})) {
      const where = `components.${name}.${key}`;
      if (!fields.includes(key)) bad(where, `does nothing for ${name} (it uses ${fields.join(', ')})`);
      else if (key.endsWith('Color') || key === 'color') {
        if (typeof v !== 'string' || !(COLOR_ROLES.includes(v) || HEX.test(v))) bad(where, 'must be a colour role (like surfaceContainerHigh) or #RRGGBB');
      } else if (key === 'padding') {
        const ok =
          (typeof v === 'number' && v >= 0 && v <= 200) ||
          (Array.isArray(v) && [2, 4].includes(v.length) && v.every((n) => typeof n === 'number' && n >= 0 && n <= 200));
        if (!ok) bad(where, 'must be a number, [horizontal, vertical] or [left, top, right, bottom]');
      } else {
        const [lo, hi] = COMPONENT_RANGES[key];
        inRange(where, v, lo, hi);
      }
    }
  }

  for (const [key, v] of Object.entries(t.strings ?? {})) {
    if (!STRING_KEYS.includes(key)) bad(`strings.${key}`, `is not text a theme can change (use ${STRING_KEYS.join(', ')})`);
    else if (typeof v !== 'string' || v.length > 80) bad(`strings.${key}`, 'must be a string of at most 80 characters');
  }

  const declared = (lib: unknown): string[] => {
    if (typeof lib !== 'string' || !fs.existsSync(path.join(root, lib))) return [];
    return [...fs.readFileSync(path.join(root, lib), 'utf8').matchAll(/^\s*widget\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  };
  for (const [name, lib] of Object.entries(m.ui ?? {})) {
    for (const w of declared(lib)) {
      if (RESERVED_WIDGETS.includes(w))
        problems.push(`ui "${name}": declares a widget named ${w}, which is already an Elbert or Flutter widget - pick another name`);
    }
  }

  for (const [slot, ref] of Object.entries(t.templates ?? {}) as [string, Json][]) {
    if (!SLOTS.includes(slot)) {
      bad(`templates.${slot}`, `is not a slot (use ${SLOTS.join(', ')})`);
      continue;
    }
    if (typeof ref?.ui !== 'string' || typeof ref?.widget !== 'string') bad(`templates.${slot}`, 'needs "ui" (a library from the manifest) and "widget"');
    else if (typeof m.ui?.[ref.ui] !== 'string') bad(`templates.${slot}.ui`, `"${ref.ui}" is not in the manifest's "ui"`);
    else if (!declared(m.ui[ref.ui]).includes(ref.widget)) bad(`templates.${slot}.widget`, `${m.ui[ref.ui]} declares no widget named "${ref.widget}"`);
  }

  const bg = t.background;
  if (bg !== undefined) {
    if (typeof bg.ui !== 'string' || typeof bg.widget !== 'string') bad('background', 'needs "ui" (a library from the manifest) and "widget"');
    else {
      const lib = m.ui?.[bg.ui];
      if (typeof lib !== 'string') bad('background.ui', `"${bg.ui}" is not in the manifest's "ui"`);
      else if (fs.existsSync(path.join(root, lib)) && !new RegExp(`^\\s*widget\\s+${bg.widget}\\b`, 'm').test(fs.readFileSync(path.join(root, lib), 'utf8'))) {
        bad('background.widget', `${lib} declares no widget named "${bg.widget}"`);
      }
    }
    if (bg.dim !== undefined) inRange('background.dim', bg.dim, 0, 1);
  }
  return problems;
}
