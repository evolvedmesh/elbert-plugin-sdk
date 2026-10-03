// `elbert-plugin init` - scaffolds a working plugin or theme project.
//
// Everything it writes runs as-is: `bun install && bun run dev` gives a
// project that builds, validates and loads in Elbert, with comments saying
// where to change things.

import fs from 'node:fs';
import path from 'node:path';

export interface InitOptions {
  /** Where to create the project (default: the working directory). */
  dir: string;
  theme: boolean;
  id?: string;
  name?: string;
  /** What to depend on for the SDK: a version range, `file:../path`... */
  sdk?: string;
  force: boolean;
}

const SCHEMAS = './node_modules/@evolvedmesh/elbert-plugin-sdk/schemas';

export function init(o: InitOptions): { dir: string; id: string; name: string; files: string[] } {
  const dir = path.resolve(o.dir);
  const slug = slugify(path.basename(dir)) || (o.theme ? 'my-theme' : 'my-plugin');
  const name = o.name ?? titleCase(slug);
  const id = o.id ?? `com.example.${slug}`;
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(id)) {
    throw new Error(`"${id}" is not a valid id: use lower-case reverse-DNS, like com.example.my-plugin (pass --id).`);
  }
  if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0 && !o.force) {
    throw new Error(`${dir} is not empty. Pass --force to scaffold into it anyway (existing files are kept).`);
  }
  const sdk = o.sdk ?? `^${sdkVersion()}`;
  const files = o.theme ? themeFiles({ id, name, sdk }) : pluginFiles({ id, name, sdk });

  const written: string[] = [];
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    if (fs.existsSync(abs)) continue; // never overwrite
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    written.push(rel);
  }
  return { dir, id, name, files: written };
}

function sdkVersion(): string {
  try {
    return JSON.parse(fs.readFileSync(path.join(import.meta.dir, '..', 'package.json'), 'utf8')).version;
  } catch {
    return '1.0.0';
  }
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const titleCase = (slug: string) =>
  slug
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');

const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

interface Ctx {
  id: string;
  name: string;
  sdk: string;
}

function common({ id, sdk }: Ctx, kind: 'plugin' | 'theme'): Record<string, string> {
  return {
    'package.json': json({
      name: id.replace(/\./g, '-'),
      version: '1.0.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'elbert-plugin dev',
        build: 'elbert-plugin build',
        check: 'elbert-plugin check',
        pack: 'elbert-plugin pack',
      },
      devDependencies: {
        '@evolvedmesh/elbert-plugin-sdk': sdk,
        ...(kind === 'plugin' ? { typescript: '^5.0.0' } : {}),
      },
    }),
    '.gitignore': 'node_modules/\ndist/\n*.elbx\n',
  };
}

function pluginFiles(c: Ctx): Record<string, string> {
  return {
    ...common(c, 'plugin'),
    'tsconfig.json': json({
      compilerOptions: {
        target: 'ES2023',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        noEmit: true,
        lib: ['ES2023'],
        types: ['@evolvedmesh/elbert-plugin-sdk'],
      },
      include: ['src'],
    }),
    'elbert-plugin.json': json({
      $schema: `${SCHEMAS}/manifest.schema.json`,
      id: c.id,
      name: c.name,
      version: '1.0.0',
      apiVersion: 1,
      description: `${c.name}, an Elbert plugin.`,
      icon: 'hand',
      entry: 'plugin.js',
      ui: { hello: 'ui/hello.rfwtxt' },
      // Ask only for what you use; the user sees this list. See docs/permissions.md.
      permissions: [],
    }),
    'src/index.ts': `// ${c.name} - an Elbert plugin.
//
// A plugin is this file plus the templates in ui/. It registers pages, routes
// and navigation in elbert.onActivate; Elbert draws the pages from the
// templates, using the data you hand it. Docs: docs/getting-started.md.

// A page controller: \`open\` returns the data the template reads as data.*,
// and each entry of \`events\` answers an \`event "name" {}\` in the template.
elbert.ui.page('hello', {
  open: async () => ({ greeting: ${JSON.stringify(`Hello from ${c.name}`)} }),
  events: {
    again: () => elbert.ui.toast('Hello again'),
  },
});

elbert.onActivate(async () => {
  // A sidebar / rail entry that opens the route below.
  await elbert.ui.setNavigation({
    destinations: [{ label: ${JSON.stringify(c.name)}, icon: 'hand', route: '/hello' }],
  });
  // Route -> page controller ('hello') + template widget (library:Widget).
  await elbert.ui.setRoutes([{ path: '/hello', page: 'hello', widget: 'hello:HelloPage' }]);
});
`,
    'ui/hello.rfwtxt': `// The page's look. 'core' is Flutter's layout widgets; 'elbert' is Elbert's
// own (docs/widgets.md). Text and colours are roles, so the page follows the
// user's theme with no styling code.
import core;
import elbert;

widget HelloPage = ScrollPage(
  slivers: [
    PageInset(
      sliver: true,
      child: Column(
        crossAxisAlignment: "stretch",
        children: [
          ThemedText(text: data.greeting, style: "headlineMedium"),
          SizedBox(height: 16.0),
          Button(variant: "filled", label: "Say it again", onPressed: event "again" {}),
        ],
      ),
    ),
  ],
);
`,
    'README.md': readme(c, 'plugin'),
  };
}

function themeFiles(c: Ctx): Record<string, string> {
  return {
    ...common(c, 'theme'),
    'elbert-plugin.json': json({
      $schema: `${SCHEMAS}/manifest.schema.json`,
      id: c.id,
      name: c.name,
      version: '1.0.0',
      apiVersion: 1,
      type: 'theme',
      description: `${c.name}, a theme for Elbert.`,
      icon: 'palette',
      theme: 'theme.json',
      ui: { background: 'ui/background.rfwtxt' },
    }),
    'theme.json': json({
      $schema: `${SCHEMAS}/theme.schema.json`,
      // The colour Elbert's palette is generated from. Remove it to let the user's own accent through.
      seed: '#6C8CFF',
      // Override single colour roles per mode when the generated palette isn't quite right.
      colors: {
        dark: { tertiary: '#FFB95C' },
        light: { tertiary: '#B26A00' },
      },
      shapes: { scale: 1.2 },
      components: {
        card: { borderColor: 'outlineVariant', borderWidth: 1 },
      },
      strings: { 'app.byline': `${c.name} theme` },
      background: { ui: 'background', widget: 'Backdrop', dim: 0.1 },
    }),
    'ui/background.rfwtxt': `// The backdrop behind every page. A background is data - no code, no network.
// Colours are roles, so it follows light, dark and AMOLED. Decoration widgets
// are in docs/widgets.md ("Decoration"). Keep it cheap: it repaints for as
// long as Elbert is open.
import core;
import elbert;

widget Backdrop = Stack(
  fit: "expand",
  children: [
    GradientFill(kind: "linear", colors: ["surface", "primaryContainer", "surface"], opacity: 0.5, spin: 300.0),
    Orb(color: "primary", opacity: 0.3, size: 0.8, x: -0.6, y: -0.5, seconds: 40.0),
    Orb(color: "tertiary", opacity: 0.2, size: 0.6, x: 0.7, y: 0.4, seconds: 55.0, phase: 0.5),
  ],
);
`,
    'README.md': readme(c, 'theme'),
  };
}

function readme(c: Ctx, kind: 'plugin' | 'theme'): string {
  const docs = kind === 'theme' ? 'docs/themes.md' : 'docs/getting-started.md';
  return `# ${c.name}

An Elbert ${kind}.

\`\`\`shell
bun install
bun run dev      # builds into dist/ and rebuilds on every save
\`\`\`

\`dev\` prints how to load it. On this computer: Elbert → **Settings → Plugins → Developer →
Load development folder**, then pick \`dist/\`. ${kind === 'theme' ? 'Choose it under **Settings → Appearance → Look**.' : 'Allow what it asks for.'}
Edits reload live.

\`\`\`shell
bun run check    # validate the manifest${kind === 'theme' ? ', theme.json' : ''} and templates
bun run pack     # writes ${c.id}-1.0.0.elbx, ready to install or attach to a release
\`\`\`

Documentation: \`node_modules/@evolvedmesh/elbert-plugin-sdk/${docs}\`.
`;
}
