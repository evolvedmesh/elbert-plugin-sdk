// Compiles the TypeScript blocks in docs/cookbook.md against types/elbert.d.ts,
// so the recipes can't drift from the API. Each block is wrapped in its own
// function scope (they reuse names like `load`), then handed to tsc.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateLayout } from '../bin/layout';
import { validateTheme } from '../bin/theme';

const root = path.join(import.meta.dir, '..');
const docs = ['docs/cookbook.md', 'docs/layouts.md'];
const blocks: string[] = [];
for (const doc of docs) {
  const text = fs.readFileSync(path.join(root, doc), 'utf8');
  for (const m of text.matchAll(/```ts\n([\s\S]*?)```/g)) blocks.push(m[1]);
}

// The theme recipes must pass the same rules `elbert-plugin check` applies.
const themeDoc = fs.readFileSync(path.join(root, 'docs/themes.md'), 'utf8');
const recipes = themeDoc.slice(themeDoc.indexOf('## Recipes'), themeDoc.indexOf('## Packaging and updates'));
const themeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'elbert-theme-docs-'));
fs.mkdirSync(path.join(themeDir, 'ui'));
fs.writeFileSync(path.join(themeDir, 'ui/background.rfwtxt'), 'import core;\nwidget Backdrop = SizedBox();\n');
const manifest = { type: 'theme', theme: 'theme.json', ui: { background: 'ui/background.rfwtxt' } };
let recipeCount = 0;
const recipeProblems: string[] = [];
for (const m of recipes.matchAll(/```json\n([\s\S]*?)```/g)) {
  recipeCount++;
  fs.writeFileSync(path.join(themeDir, 'theme.json'), m[1]);
  recipeProblems.push(...validateTheme(themeDir, manifest).map((p) => `recipe ${recipeCount}: ${p}`));
}
fs.rmSync(themeDir, { recursive: true, force: true });
if (recipeProblems.length) {
  console.error(recipeProblems.join('\n'));
  console.error('docs/themes.md has a recipe that fails the theme rules.');
  process.exit(1);
}

// Every layout in docs/layouts.md (whole files, or "home"/"sidebar"/"dock"
// fragments) must pass the rules Elbert applies.
const layoutDoc = fs.readFileSync(path.join(root, 'docs/layouts.md'), 'utf8');
const layoutProblems: string[] = [];
let layoutCount = 0;
for (const m of layoutDoc.matchAll(/```json\n([\s\S]*?)```/g)) {
  layoutCount++;
  const text = m[1].trim();
  const json = JSON.parse(text.startsWith('{') ? text : `{${text}}`);
  layoutProblems.push(...validateLayout(json).map((p) => `layout example ${layoutCount}: ${p.where} ${p.why}`));
}
if (layoutProblems.length) {
  console.error(layoutProblems.join('\n'));
  console.error('docs/layouts.md has a layout that fails the layout rules.');
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'elbert-docs-'));
const body = blocks.map((b, i) => `function recipe${i}() {\n${b}\n}\nvoid recipe${i};`).join('\n\n');
fs.writeFileSync(path.join(tmp, 'recipes.ts'), `import type {} from ${JSON.stringify(path.join(root, 'types/elbert'))};\n${body}\n`);
fs.writeFileSync(
  path.join(tmp, 'tsconfig.json'),
  JSON.stringify({
    compilerOptions: {
      target: 'ES2023',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      strict: true,
      noEmit: true,
      lib: ['ES2023'],
      types: [],
      skipLibCheck: false,
    },
    files: ['recipes.ts', path.join(root, 'types/elbert.d.ts')],
  }),
);
const proc = Bun.spawnSync(['bunx', 'tsc', '-p', tmp], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
fs.rmSync(tmp, { recursive: true, force: true });
if (proc.exitCode !== 0) {
  console.error(proc.stdout.toString() || proc.stderr.toString());
  console.error('docs/cookbook.md or docs/layouts.md has code that does not compile against types/elbert.d.ts.');
  process.exit(1);
}
console.log(
  `✓ ${blocks.length} doc snippets compile, ${recipeCount} theme recipes pass the theme rules, ${layoutCount} layout examples pass the layout rules.`,
);
