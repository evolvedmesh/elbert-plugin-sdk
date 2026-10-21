// Writes schemas/*.schema.json - JSON Schemas for elbert-plugin.json and
// theme.json, so any editor completes and checks them as you type.
//
// Generated from the same tables `elbert-plugin check` validates with
// (bin/theme.ts), so the two cannot drift. `bun scripts/gen-schemas.ts` writes
// them; `--check` fails if the committed files are out of date (part of `bun run check`).

import fs from 'node:fs';
import path from 'node:path';
import {
  BLOCKS,
  COMMON_BLOCK_FIELDS,
  DISPLAYS,
  LAYOUT_VERSION,
  NAV_SOURCES,
  PIN_KINDS,
  PLUGIN_ONLY_BLOCKS,
  RANGES,
  SHORTCUT_ACTIONS,
  SIZES,
  SURFACES,
} from '../bin/layout';
import { LUCIDE_NAMES } from '../bin/lucide-names';
import { COLOR_ROLES, COMPONENT_RANGES, COMPONENTS, RADIUS_TOKENS, SLOTS, STRING_KEYS } from '../bin/theme';

const dir = path.join(import.meta.dir, '..', 'schemas');
const HEX = '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$';

const hexDef = { type: 'string', pattern: HEX, description: '#RGB, #RRGGBB or #AARRGGBB' };
const hex = { $ref: '#/definitions/hex' };
const colorRefDef = {
  description: 'A colour role (follows light, dark and AMOLED) or a fixed #RRGGBB / #AARRGGBB.',
  anyOf: [{ enum: COLOR_ROLES }, hexDef],
};
const colorRef = { $ref: '#/definitions/colorRef' };
const padding = {
  description: 'A number, [horizontal, vertical] or [left, top, right, bottom].',
  oneOf: [
    { type: 'number', minimum: 0, maximum: 200 },
    { type: 'array', items: { type: 'number', minimum: 0, maximum: 200 }, minItems: 2, maxItems: 2 },
    { type: 'array', items: { type: 'number', minimum: 0, maximum: 200 }, minItems: 4, maxItems: 4 },
  ],
};
const DESCRIPTIONS: Record<string, string> = {
  radius: 'Corner radius in logical pixels.',
  color: 'Background colour.',
  borderColor: 'Border colour.',
  borderWidth: 'Border width. Without a colour the border is transparent.',
  hoverColor: 'Background while the pointer is over it.',
  activeColor: 'Background while this is the track playing.',
  padding: 'Inner padding.',
  gap: 'Space between the artwork and the text.',
  coverSize: 'Artwork size.',
  coverRadius: 'Artwork corner radius.',
};

function componentSchema(fields: string[]) {
  const properties: Record<string, unknown> = {};
  for (const f of fields) {
    if (f === 'padding') properties[f] = { ...padding, description: DESCRIPTIONS[f] };
    else if (f === 'color' || f.endsWith('Color')) properties[f] = { ...colorRef, description: DESCRIPTIONS[f] };
    else {
      const [minimum, maximum] = COMPONENT_RANGES[f];
      properties[f] = { type: 'number', minimum, maximum, description: DESCRIPTIONS[f] };
    }
  }
  return { type: 'object', additionalProperties: false, properties };
}

const colorSetDef = {
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(COLOR_ROLES.map((r) => [r, hexDef])),
};
const colorSet = (what: string) => ({ description: what, $ref: '#/definitions/colorSet' });

const templateRef = {
  type: 'object',
  required: ['ui', 'widget'],
  additionalProperties: false,
  properties: {
    ui: { type: 'string', description: 'A library from the manifest\'s "ui".' },
    widget: { type: 'string', description: 'A widget that library declares. Not named like a core or Elbert widget.' },
  },
};

// ---- The layout format (bin/layout.ts) -------------------------------------

const range = ([minimum, maximum]: readonly [number, number], description?: string) => ({ type: 'number', minimum, maximum, description });
const intRange = ([minimum, maximum]: readonly [number, number], description?: string) => ({ type: 'integer', minimum, maximum, description });
const route = { type: 'string', pattern: '^/', description: 'A route, starting with "/".' };
const icon = { $ref: '#/definitions/lucideIcon' };

const BLOCK_DESCRIPTIONS: Record<string, string> = {
  greeting: 'Good morning, and the date.',
  nowPlaying: "What's playing, or a way to start.",
  weekStats: 'Time listened this week, a bar per day.',
  libraryTiles: 'Song, album, artist and playlist counts.',
  otherServices: "Plugins' sections as chips.",
  forYou: 'Quick Mix, Favourites and Infinity Radio (with a Subsonic server).',
  recentlyPlayed: 'Albums, playlists and mixes played recently.',
  recentlyAdded: 'The newest albums.',
  topArtists: "This week's top artists.",
  pinned: 'Albums, artists, songs and playlists chosen by hand.',
  playlists: "The user's playlists.",
  smartPlaylists: "Elbert's smart playlists.",
  topTracks: "This week's most-played songs.",
  shortcut: 'One card that opens a route or starts a mix. Needs "route" or "action".',
  note: 'A heading and some words.',
  spacer: 'Empty space.',
  cards: 'Plugin pages only: tiles the plugin supplies.',
  widget: "Plugin pages only: one of the plugin's templates.",
};

const BLOCK_FIELDS: Record<string, unknown> = {
  id: { type: 'string', minLength: 1, description: 'Unique among blocks.' },
  span: range(RANGES.block.span, "Share of the row's width (a flex weight; Elbert's editor writes twelfths)."),
  visibleOn: { type: 'array', items: { enum: SIZES }, description: 'Page widths it shows at: compact < 600, medium < 900, expanded.' },
  style: {
    type: 'object',
    additionalProperties: false,
    properties: {
      accent: { ...hex, description: "Re-seeds the block's colours." },
      surface: { enum: SURFACES, description: 'The surface under the block.' },
      radius: range(RANGES.radius, 'Corner radius.'),
    },
  },
  title: { type: 'string' },
  text: { type: 'string' },
  limit: intRange(RANGES.limit, 'How many to show.'),
  tileSize: range(RANGES.block.tileSize, "Tile width; Elbert's size for the page width when left out."),
  display: { enum: DISPLAYS, description: 'One scrolling row, or a wrapping grid.' },
  items: {
    type: 'array',
    items: {
      type: 'object',
      minProperties: 1,
      maxProperties: 1,
      additionalProperties: false,
      properties: Object.fromEntries(PIN_KINDS.map((k) => [k, { type: 'string', minLength: 1 }])),
    },
    description: 'Pinned things: {"album": key}, {"artist": name}, {"track": id}, {"playlist": id}, {"smartPlaylist": id}.',
  },
  icon,
  route,
  action: { enum: SHORTCUT_ACTIONS },
  size: range(RANGES.block.size, 'Height.'),
  cards: {
    type: 'array',
    items: {
      type: 'object',
      required: ['title'],
      additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 1 },
        subtitle: { type: 'string' },
        image: { type: 'string', description: 'An http(s) image URL.' },
        icon: { type: 'string', description: 'A Lucide icon name, shown without an image.' },
        route,
        event: { type: 'string', description: "Sent to the page controller's events[event], with args." },
        args: { type: 'object' },
      },
    },
  },
  widget: { type: 'string', pattern: ':', description: '"library:Widget", a library from the manifest\'s "ui".' },
};

function blockSchema(type: string) {
  const fields = [...COMMON_BLOCK_FIELDS, ...BLOCKS[type]].filter((f) => f !== 'type');
  return {
    type: 'object',
    description: BLOCK_DESCRIPTIONS[type],
    required: type === 'widget' ? ['type', 'widget'] : ['type'],
    additionalProperties: false,
    properties: { type: { const: type }, ...Object.fromEntries(fields.map((f) => [f, BLOCK_FIELDS[f]])) },
  };
}

const rowSchema = (block: string) => ({
  type: 'object',
  required: ['blocks'],
  additionalProperties: false,
  description: 'Blocks side by side; below stackBelow they stack.',
  properties: {
    id: { type: 'string', minLength: 1, description: 'Unique among rows.' },
    blocks: { type: 'array', minItems: 1, items: { $ref: `#/definitions/${block}` } },
    spaceBefore: range(RANGES.row.spaceBefore, 'Space above the row (default 28). A hidden row hands its space on.'),
    stackBelow: range(RANGES.row.stackBelow, 'Page width below which the blocks stack.'),
    gap: range(RANGES.row.gap, 'Space between blocks side by side (default 16).'),
    stackGap: range(RANGES.row.stackGap, 'Space between stacked blocks (default 12).'),
    height: range(RANGES.row.height, 'Height while side by side; blocks size themselves when left out.'),
  },
});

const tab = {
  type: 'object',
  required: ['route'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 1 },
    route,
    label: { type: 'string', minLength: 1, description: "Left out, the destination's own name." },
    icon,
    color: hex,
  },
};

const layoutDefinitions = {
  lucideIcon: { enum: [...LUCIDE_NAMES], description: 'A Lucide icon name (lucide.dev/icons).' },
  layoutBlock: {
    oneOf: Object.keys(BLOCKS)
      .filter((t) => !PLUGIN_ONLY_BLOCKS.includes(t))
      .map(blockSchema),
  },
  layoutRow: rowSchema('layoutBlock'),
  layout: {
    type: 'object',
    additionalProperties: false,
    description: 'How Home, the sidebar and the phone dock are arranged. Any part left out is the next layout in line.',
    properties: {
      $schema: { type: 'string' },
      elbertLayout: { const: LAYOUT_VERSION },
      home: {
        type: 'object',
        additionalProperties: false,
        properties: { rows: { type: 'array', items: { $ref: '#/definitions/layoutRow' } } },
      },
      sidebar: {
        type: 'object',
        additionalProperties: false,
        properties: {
          groups: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', minLength: 1 },
                label: { type: 'string' },
                source: { enum: NAV_SOURCES, description: 'Rows added after its own tabs.' },
                limit: intRange(RANGES.groupLimit),
                items: { type: 'array', items: tab },
              },
            },
          },
        },
      },
      dock: {
        type: 'object',
        additionalProperties: false,
        properties: { items: { type: 'array', minItems: RANGES.dock[0], maxItems: RANGES.dock[1], items: tab } },
      },
    },
  },
};

const layout = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Elbert layout (exported from Settings → Layout, or a theme\'s "layouts")',
  definitions: { hex: hexDef, ...layoutDefinitions },
  $ref: '#/definitions/layout',
};

const theme = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Elbert theme (theme.json)',
  definitions: { hex: hexDef, colorRef: colorRefDef, colorSet: colorSetDef, ...layoutDefinitions },
  type: 'object',
  properties: {
    $schema: { type: 'string' },
    seed: { ...hex, description: "The colour Elbert's palette is generated from. Setting it takes the accent and wallpaper colours from the user." },
    colors: {
      type: 'object',
      additionalProperties: false,
      properties: {
        light: colorSet('Colour roles to override in light mode.'),
        dark: colorSet('Colour roles to override in dark mode.'),
        amoled: colorSet('Applied on top of dark after Elbert makes the surfaces true black.'),
      },
    },
    typography: {
      type: 'object',
      properties: {
        fontFamily: { type: 'string', description: 'A Google Fonts family.' },
        font: {
          type: 'object',
          description: 'A font the theme ships. Wins over fontFamily.',
          required: ['family', 'files'],
          properties: {
            family: { type: 'string' },
            files: { type: 'array', minItems: 1, items: { type: 'string', pattern: '\\.(ttf|otf)$' }, description: '.ttf or .otf files inside the package.' },
          },
        },
        scale: { type: 'number', minimum: 0.85, maximum: 1.25, description: 'Multiplies every text size.' },
      },
    },
    shapes: {
      type: 'object',
      properties: {
        scale: { type: 'number', minimum: 0, maximum: 2, description: "Multiplies every corner in the app. 0 is square, 1 is Elbert's own." },
        radii: {
          type: 'object',
          description: 'Pins named corners to an exact radius; these ignore scale.',
          additionalProperties: false,
          properties: Object.fromEntries(RADIUS_TOKENS.map((t) => [t, { type: 'number', minimum: 0, maximum: 200 }])),
        },
        buttons: { enum: ['pill', 'rounded', 'square'], description: 'Resting shape of buttons, chips and the navigation indicator.' },
      },
    },
    components: {
      type: 'object',
      description: "Per-component looks. Anything left out stays Elbert's own.",
      additionalProperties: false,
      properties: Object.fromEntries(Object.entries(COMPONENTS).map(([name, fields]) => [name, componentSchema(fields)])),
    },
    strings: {
      type: 'object',
      description: 'Replacement text, by key (80 characters at most).',
      additionalProperties: false,
      properties: Object.fromEntries(STRING_KEYS.map((k) => [k, { type: 'string', maxLength: 80 }])),
    },
    templates: {
      type: 'object',
      description: "Templates that draw a component's body. Elbert keeps its behaviour.",
      additionalProperties: false,
      properties: Object.fromEntries(SLOTS.map((s) => [s, templateRef])),
    },
    background: {
      type: 'object',
      required: ['ui', 'widget'],
      description: 'A backdrop drawn behind every page.',
      additionalProperties: false,
      properties: {
        ui: { type: 'string', description: 'A library from the manifest\'s "ui".' },
        widget: { type: 'string' },
        dim: { type: 'number', minimum: 0, maximum: 1, description: 'How far the surface colour is laid back over it.' },
      },
    },
    layouts: {
      $ref: '#/definitions/layout',
      description: 'How Home, the sidebar and the dock are arranged. Paste in a file exported from Settings → Layout, or write one.',
    },
  },
};

const PERMISSIONS = ['network', 'storage', 'process', 'player', 'library', 'playlists', 'lyrics', 'history'];
const path_ = { type: 'string', pattern: '^(?!/)(?!.*(^|[\\\\/])\\.\\.([\\\\/]|$))[^:]*$', description: 'A path inside the package.' };
const manifest = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Elbert plugin manifest (elbert-plugin.json)',
  type: 'object',
  required: ['id', 'name', 'version', 'apiVersion'],
  properties: {
    $schema: { type: 'string' },
    id: {
      type: 'string',
      pattern: '^[a-z0-9]+(?:[.-][a-z0-9]+)+$',
      description: 'Lower-case reverse-DNS, like com.example.my-plugin. Never changes once published.',
    },
    name: { type: 'string', minLength: 1 },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+(?:[-+][0-9A-Za-z.-]+)?$', description: 'Semver.' },
    apiVersion: { const: 1, description: 'The plugin API version you wrote against.' },
    type: { enum: ['plugin', 'theme'], default: 'plugin', description: 'A theme changes how Elbert looks and runs no code.' },
    description: { type: 'string' },
    author: { type: 'string' },
    icon: { type: 'string', description: 'A Lucide icon name.' },
    entry: { ...path_, description: 'The bundled JavaScript file (plugins only).' },
    theme: { ...path_, description: "A theme's theme.json (themes only)." },
    ui: { type: 'object', additionalProperties: path_, description: 'Library name -> .rfwtxt template file.' },
    permissions: { type: 'array', items: { enum: PERMISSIONS }, uniqueItems: true, description: 'Plugins only. Ask only for what you use.' },
    platforms: { type: 'array', items: { enum: ['linux', 'windows', 'macos', 'android', 'ios'] }, uniqueItems: true },
    android: { type: 'object', properties: { runtimePackages: { type: 'array', items: { type: 'string' } } } },
    migrate: {
      type: 'object',
      properties: {
        settingsKeys: { type: 'array', items: { type: 'string' } },
        secureKeys: { type: 'array', items: { type: 'string' } },
        playlistLinks: { type: 'boolean' },
        legacySources: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  // A theme has a theme file and no code; a plugin (the default) has an entry.
  anyOf: [
    {
      properties: { type: { const: 'theme' } },
      required: ['type', 'theme'],
      not: { anyOf: [{ required: ['entry'] }, { required: ['android'] }, { required: ['migrate'] }, { required: ['permissions'] }] },
    },
    { properties: { type: { const: 'plugin' } }, required: ['entry'], not: { required: ['theme'] } },
  ],
};

const outputs: Record<string, unknown> = { 'theme.schema.json': theme, 'layout.schema.json': layout, 'manifest.schema.json': manifest };
const stale: string[] = [];
fs.mkdirSync(dir, { recursive: true });
for (const [file, schema] of Object.entries(outputs)) {
  const text = `${JSON.stringify(schema, null, 2)}\n`;
  const target = path.join(dir, file);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== text) stale.push(file);
  } else fs.writeFileSync(target, text);
}
if (stale.length) {
  console.error(`schemas/${stale.join(', schemas/')} out of date - run "bun run schemas".`);
  process.exit(1);
}
