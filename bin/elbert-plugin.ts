#!/usr/bin/env bun

// elbert-plugin — build, check, pack and live-develop Elbert plugins.
//
//   elbert-plugin build   [--entry src/index.ts] [--out dist] [--minify]
//   elbert-plugin dev     [--entry src/index.ts] [--out dist] [--open [route]]
//                         [--port 7357] [--host 0.0.0.0] [--no-lan]
//   elbert-plugin check
//   elbert-plugin pack    [--out dist] [--to .]
//   elbert-plugin version <semver>
//
// A plugin project is a folder with an `elbert-plugin.json` manifest, a
// TypeScript (or JavaScript) entry point, the `.rfwtxt` templates the
// manifest's `ui` map names, and optionally an `assets/` folder. `build`
// bundles the code into the manifest's `entry` file and copies the rest
// beside it; `pack` zips that folder into an installable `.elbx`.
//
// Runs on Bun, and bundles with `Bun.build`.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { zipSync } from 'fflate';
import { dev as devLoop } from './dev';

const API_VERSION = 1;
const PERMISSIONS = ['network', 'storage', 'process', 'player', 'library', 'playlists', 'lyrics', 'history'];
const PLATFORMS = ['linux', 'windows', 'macos', 'android', 'ios'];
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/;
const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

// biome-ignore lint/suspicious/noExplicitAny: the manifest is untrusted JSON, validated by hand below.
type Manifest = Record<string, any>;
type Flags = { _: string[]; [flag: string]: string | boolean | string[] };

const [, , command, ...rest] = process.argv;
const flags = parseFlags(rest);
const root = process.cwd();

const commands: Record<string, () => unknown> = { build, dev, check, pack, version, help };
const run = commands[command] ?? help;
Promise.resolve(run()).catch((e) => {
  console.error(`elbert-plugin: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});

function parseFlags(args: string[]): Flags {
  const out: Flags = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

function help() {
  console.log(`elbert-plugin <command>

  build    Bundle the plugin into dist/ (manifest, code, templates, assets)
  dev      Build, then rebuild on every change. Templates reload in place in
           Elbert, code changes restart the plugin and reopen its pages, and
           Elbert's log and errors print here. Load dist/ with Settings →
           Plugins → Load development folder, or connect another device
           (a phone) to the dev server it starts on your network
  check    Validate elbert-plugin.json and the files it names
  pack     Zip dist/ into <id>-<version>.elbx, ready to install
  version  Set the manifest's version (used by release tooling)

Options: --entry <file> (default src/index.ts, then src/index.js)
         --out <dir> (default dist)   --minify   --to <dir> (pack)
dev:     --open [route]  navigate a connected Elbert there (default: the
                         plugin's first page)
         --port <n> (default 7357)   --host <addr> (default 0.0.0.0)
         --no-lan        serve nothing; this machine's folder only`);
}

// ---- Manifest -----------------------------------------------------------------

function readManifest(): Manifest {
  const file = path.join(root, 'elbert-plugin.json');
  if (!fs.existsSync(file)) throw new Error('No elbert-plugin.json in this folder.');
  let m: Manifest;
  try {
    m = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`elbert-plugin.json is not valid JSON: ${e instanceof Error ? e.message : e}`);
  }
  return m;
}

/** The same rules Elbert applies at install time, so nothing fails later. */
function validate(m: Manifest): string[] {
  const problems: string[] = [];
  const str = (k: string) => typeof m[k] === 'string' && m[k].trim() !== '';
  if (!str('id') || !ID_PATTERN.test(m.id)) problems.push('"id" must be reverse-DNS in lowercase, like com.example.my-plugin');
  if (!str('name')) problems.push('"name" is required');
  if (!str('version') || !SEMVER.test(m.version)) problems.push('"version" must be semver, like 1.2.0');
  if (!Number.isInteger(m.apiVersion) || m.apiVersion < 1) problems.push('"apiVersion" must be a positive integer');
  else if (m.apiVersion > API_VERSION) problems.push(`"apiVersion" ${m.apiVersion} is newer than this SDK knows (${API_VERSION})`);
  if (!str('entry')) problems.push('"entry" is required (the bundled file, e.g. plugin.js)');
  for (const p of m.permissions ?? []) {
    if (!PERMISSIONS.includes(p)) problems.push(`unknown permission "${p}" (known: ${PERMISSIONS.join(', ')})`);
  }
  for (const p of m.platforms ?? []) {
    if (!PLATFORMS.includes(p)) problems.push(`unknown platform "${p}" (known: ${PLATFORMS.join(', ')})`);
  }
  const safe = (p: unknown): p is string => typeof p === 'string' && !p.startsWith('/') && !p.split(/[\\/]/).includes('..') && !p.includes(':');
  if (m.entry && !safe(m.entry)) problems.push('"entry" must be a path inside the plugin');
  for (const [name, p] of Object.entries(m.ui ?? {})) {
    if (!safe(p)) problems.push(`ui "${name}": path must stay inside the plugin`);
    else if (!fs.existsSync(path.join(root, p))) problems.push(`ui "${name}": ${p} does not exist`);
  }
  return problems;
}

function check(): Manifest {
  const m = readManifest();
  const problems = validate(m);
  for (const [name, p] of Object.entries(m.ui ?? {}) as [string, string][]) {
    const file = path.join(root, p);
    if (fs.existsSync(file)) problems.push(...lintTemplate(name, fs.readFileSync(file, 'utf8')));
  }
  if (problems.length) {
    for (const p of problems) console.error(`  ✗ ${p}`);
    throw new Error(`${problems.length} problem(s) in ${m.name ?? 'the plugin'}.`);
  }
  console.log(`✓ ${m.name} ${m.version} looks good.`);
  return m;
}

/**
 * A light structural check of an RFW template — balanced brackets and
 * imports present. Elbert's real parser reports anything finer in the
 * plugin's log when the page opens.
 */
function lintTemplate(name: string, text: string): string[] {
  const problems: string[] = [];
  const stripped = stripStringsAndComments(text);
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const stack: [close: string, line: number][] = [];
  let line = 1;
  for (const ch of stripped) {
    if (ch === '\n') line++;
    if (pairs[ch]) stack.push([pairs[ch], line]);
    else if (ch === ')' || ch === ']' || ch === '}') {
      const top = stack.pop();
      if (!top || top[0] !== ch) {
        problems.push(`ui "${name}": unbalanced "${ch}" on line ${line}`);
        break;
      }
    }
  }
  const open = stack.at(-1);
  if (open && !problems.length) problems.push(`ui "${name}": "${open[0]}" never closed (opened line ${open[1]})`);
  if (!/^\s*import\s+/m.test(stripped)) problems.push(`ui "${name}": no imports — templates usually start with "import core; import elbert;"`);
  return problems;
}

/**
 * [text] with string contents and comments blanked out (newlines kept, so
 * line numbers still match). One pass, so a `//` inside a string — a URL in a
 * hint — is not mistaken for a comment, nor a quote in a comment for a string.
 */
function stripStringsAndComments(text: string): string {
  let out = '';
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (lineComment) {
      if (ch === '\n') {
        lineComment = false;
        out += ch;
      }
    } else if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i++;
      } else if (ch === '\n') out += ch;
    } else if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) {
        quote = null;
        out += ch;
      } else if (ch === '\n') out += ch;
    } else if (ch === '/' && next === '/') {
      lineComment = true;
      i++;
    } else if (ch === '/' && next === '*') {
      blockComment = true;
      i++;
    } else {
      if (ch === '"' || ch === "'") quote = ch;
      out += ch;
    }
  }
  return out;
}

function version() {
  const v = flags._[0];
  if (!v || !SEMVER.test(v)) throw new Error('usage: elbert-plugin version <semver>');
  const file = path.join(root, 'elbert-plugin.json');
  const m = readManifest();
  m.version = v;
  fs.writeFileSync(file, `${JSON.stringify(m, null, 2)}\n`);
  console.log(`elbert-plugin.json → ${v}`);
}

// ---- Build ------------------------------------------------------------------------

function entryPoint() {
  if (typeof flags.entry === 'string') return flags.entry;
  for (const c of ['src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js']) {
    if (fs.existsSync(path.join(root, c))) return c;
  }
  throw new Error('No entry point: pass --entry or create src/index.ts.');
}

function outDir(): string {
  return path.resolve(root, typeof flags.out === 'string' ? flags.out : 'dist');
}

/**
 * One bundle: QuickJS-ng implements ES2023 and has no modules, so the whole
 * plugin becomes a single self-contained IIFE. Network and file access go
 * through `elbert.*`; there are no Node or Bun built-ins to bundle in.
 */
async function bundle(m: Manifest): Promise<boolean> {
  const result = await Bun.build({
    root,
    entrypoints: [path.resolve(root, entryPoint())],
    format: 'iife',
    target: 'browser',
    minify: Boolean(flags.minify),
    sourcemap: 'none',
    // Report failures in result.logs rather than throwing (Bun ≥ 1.2 throws by default).
    throw: false,
  });
  for (const log of result.logs) console.error(log);
  if (!result.success) return false;
  const out = path.join(outDir(), m.entry);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await Bun.write(out, result.outputs[0]);
  return true;
}

function copyStatic(m: Manifest) {
  const out = outDir();
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'elbert-plugin.json'), `${JSON.stringify(m, null, 2)}\n`);
  for (const p of Object.values(m.ui ?? {}) as string[]) {
    fs.mkdirSync(path.dirname(path.join(out, p)), { recursive: true });
    fs.copyFileSync(path.join(root, p), path.join(out, p));
  }
  const assets = path.join(root, 'assets');
  if (fs.existsSync(assets)) fs.cpSync(assets, path.join(out, 'assets'), { recursive: true });
}

async function build() {
  const m = check();
  // Empty dist/ rather than delete it: a running Elbert may be watching the
  // folder itself, and `.elbert/` holds `dev`'s paired sessions.
  const out = outDir();
  if (fs.existsSync(out)) {
    for (const e of fs.readdirSync(out)) {
      if (e !== '.elbert') fs.rmSync(path.join(out, e), { recursive: true, force: true });
    }
  }
  copyStatic(m);
  if (!(await bundle(m))) throw new Error('The build failed.');
  console.log(`✓ built ${path.relative(root, outDir()) || '.'}/`);
  return m;
}

function dev() {
  const port = typeof flags.port === 'string' ? Number(flags.port) : 7357;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error('--port must be a port number');
  return devLoop({
    root,
    outDir: outDir(),
    entry: entryPoint(),
    check,
    readManifest,
    port,
    host: flags['no-lan'] ? false : typeof flags.host === 'string' ? flags.host : '0.0.0.0',
    open: flags.open === true ? true : typeof flags.open === 'string' ? flags.open : undefined,
  });
}

// ---- Pack ---------------------------------------------------------------------------

async function pack() {
  const out = outDir();
  if (!fs.existsSync(path.join(out, 'elbert-plugin.json'))) await build();
  const m = JSON.parse(fs.readFileSync(path.join(out, 'elbert-plugin.json'), 'utf8'));
  const files: Record<string, Uint8Array> = {};
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      // Never ship what `dev` leaves behind: `.elbert/` (logs, paired dev
      // sessions) and source maps.
      if (e.name.startsWith('.') || e.name.endsWith('.map')) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else files[path.relative(out, abs).split(path.sep).join('/')] = fs.readFileSync(abs);
    }
  };
  walk(out);
  const target = path.resolve(root, typeof flags.to === 'string' ? flags.to : '.', `${m.id}-${m.version}.elbx`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  // Already-compressed archives (a bundled .tar.gz) gain nothing from deflate.
  const zipped = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [v, { level: /\.(gz|zip|png|jpg|jpeg|webp)$/i.test(k) ? 0 : 9 }]])));
  fs.writeFileSync(target, zipped);
  console.log(`✓ ${path.relative(root, target)} (${(zipped.length / 1024).toFixed(0)} KB, ${Object.keys(files).length} files)`);
}
