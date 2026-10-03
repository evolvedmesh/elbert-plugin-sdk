// Writes schemas/*.schema.json - JSON Schemas for elbert-plugin.json and
// theme.json, so any editor completes and checks them as you type.
//
// Generated from the same tables `elbert-plugin check` validates with
// (bin/theme.ts), so the two cannot drift. `bun scripts/gen-schemas.ts` writes
// them; `--check` fails if the committed files are out of date (part of `bun run check`).

import fs from 'node:fs';
import path from 'node:path';
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

const theme = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Elbert theme (theme.json)',
  definitions: { hex: hexDef, colorRef: colorRefDef, colorSet: colorSetDef },
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

const outputs: Record<string, unknown> = { 'theme.schema.json': theme, 'manifest.schema.json': manifest };
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
