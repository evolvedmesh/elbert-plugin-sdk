// `elbert-plugin dev` — the live-reload loop.
//
// Builds the plugin into dist/, then on every change rebuilds and writes only
// the files whose bytes changed (atomically, by rename), so Elbert can tell a
// template edit — re-parsed in place, page data kept — from a code edit, which
// restarts the engine and reopens the pages that were open.
//
// Two ways for Elbert to load what this builds, at the same time:
//
// - This machine: Settings → Plugins → Load development folder → dist/.
//   Elbert watches the folder, and talks back through dist/.elbert/ —
//   `log.jsonl` (its log, errors and reload results, tailed here) and
//   `open` (a route for it to navigate to, written here by --open).
// - Another device (a phone, a second computer): an HTTP + WebSocket server
//   on the LAN. Elbert connects to it from Settings → Plugins → Developer,
//   with the pairing code printed below; the code buys a session token, and
//   nothing is served without one.

import { createHash, randomBytes, randomInt } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ServerWebSocket } from 'bun';

// biome-ignore lint/suspicious/noExplicitAny: the manifest is untrusted JSON.
type Manifest = Record<string, any>;

export interface DevOptions {
  root: string;
  outDir: string;
  entry: string;
  /** Validates the manifest and templates; throws with the problems. */
  check: () => Manifest;
  readManifest: () => Manifest;
  port: number;
  /** Interface to listen on; `false` serves nothing (this machine only). */
  host: string | false;
  /** Route to open in a connected Elbert (true: the plugin's first one). */
  open: string | true | undefined;
}

const DOT = '.elbert';
const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string) => (s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = paint('31');
const green = paint('32');
const yellow = paint('33');
const dim = paint('2');
const bold = paint('1');
const cyan = paint('36');

const time = () => dim(new Date().toLocaleTimeString());

export async function dev(o: DevOptions) {
  const manifest = o.check();
  const outputs = new Outputs(o.outDir);
  const server = o.host === false ? null : new DevServer(o, outputs);
  const tail = new LogTail(path.join(o.outDir, DOT, 'log.jsonl'), (m) => report(m, 'this machine'));

  // ---- Building ---------------------------------------------------------------

  let building = false;
  let again = false;
  let firstBuild = true;

  /** One build of everything; writes only what changed. */
  const build = async (reason: string) => {
    if (building) {
      again = true;
      return;
    }
    building = true;
    const started = performance.now();
    try {
      let m: Manifest;
      try {
        m = o.readManifest();
      } catch (e) {
        return fail(e instanceof Error ? e.message : String(e));
      }
      const changed: string[] = [];
      changed.push(...staticFiles(o.root, m, outputs));
      const result = await Bun.build({
        root: o.root,
        entrypoints: [path.resolve(o.root, o.entry)],
        format: 'iife',
        target: 'browser',
        sourcemap: 'external',
        naming: m.entry,
        // Failures come back in result.logs; a throw would end the loop.
        throw: false,
      });
      if (!result.success) {
        return fail(result.logs.map(formatBuildLog).join('\n\n') || 'The build failed.');
      }
      for (const out of result.outputs) {
        const rel = out.kind === 'sourcemap' ? `${m.entry}.map` : m.entry;
        if (outputs.write(rel, new Uint8Array(await out.arrayBuffer()))) changed.push(rel);
      }
      for (const log of result.logs) console.warn(yellow(formatBuildLog(log)));
      outputs.clearBuildError();
      server?.broadcast({ t: 'build', ok: true });
      const ms = Math.round(performance.now() - started);
      const real = changed.filter((f) => !f.endsWith('.map'));
      if (firstBuild) {
        console.log(`${time()} ${green('✓')} built ${dim(`in ${ms} ms`)}`);
      } else if (real.length === 0) {
        console.log(`${time()} ${dim(`no output change (${reason})`)}`);
      } else {
        const templates = new Set(Object.values(m.ui ?? {}) as string[]);
        const kind = real.every((f) => templates.has(f)) ? 'templates' : 'code';
        console.log(`${time()} ${green('✓')} ${kind === 'templates' ? 'templates' : 'rebuilt'} ${dim(`in ${ms} ms`)} ${dim(`(${real.join(', ')})`)}`);
        server?.changed(changed);
      }
    } finally {
      building = false;
      firstBuild = false;
      if (again) {
        again = false;
        queueMicrotask(() => build('queued change'));
      }
    }
  };

  /** The last good dist/ stays in place; Elbert is told why nothing changed. */
  const fail = (message: string) => {
    console.error(`${time()} ${red('✗ build failed')}\n${message}\n`);
    outputs.setBuildError(message);
    server?.broadcast({ t: 'build', ok: false, message });
  };

  const rebuild = debounce((reason: string) => build(reason), 40);

  fs.mkdirSync(o.outDir, { recursive: true });
  await build('start');

  // Every source file except what this writes. One recursive watch on the
  // project; dist/ and node_modules/ are ignored by path.
  const ignored = [path.relative(o.root, o.outDir), 'node_modules', '.git'];
  fs.watch(o.root, { recursive: true }, (_event, file) => {
    if (!file) return rebuild('change');
    const rel = String(file).split(path.sep).join('/');
    if (ignored.some((i) => i && (rel === i || rel.startsWith(`${i}/`)))) return;
    if (rel.split('/').some((s) => s.startsWith('.')) || rel.endsWith('~')) return;
    rebuild(rel);
  });

  tail.start();
  server?.start();
  printBanner(manifest, o, server);

  if (o.open !== undefined) {
    const route = o.open === true ? '' : o.open;
    outputs.writeRaw(path.join(DOT, 'open'), route);
    server?.requestOpen(route);
  }
}

function printBanner(m: Manifest, o: DevOptions, server: DevServer | null) {
  const dist = o.outDir;
  console.log('');
  console.log(`${bold(`${m.name} ${m.version}`)} ${dim('— watching for changes')}`);
  console.log(`  ${bold('This machine')}    Settings → Plugins → Load development folder → ${cyan(dist)}`);
  if (server) {
    const addrs = server.addresses();
    console.log(`  ${bold('Other devices')}   Settings → Plugins → Developer → Connect to a dev server`);
    if (addrs.length) {
      console.log(`                  address ${addrs.map((a) => cyan(a)).join(dim(' or '))}`);
    } else {
      console.log(`                  ${yellow('no LAN address found')} — port ${server.port}`);
    }
    console.log(`                  code    ${bold(server.prettyCode())}`);
  }
  console.log(dim('  Template edits reload in place; code edits restart the plugin and reopen its pages.'));
  console.log('');
}

// ---- Output folder ------------------------------------------------------------------

/** dist/, written file by file, each only when its bytes changed. */
class Outputs {
  private hashes = new Map<string, string>();

  constructor(readonly dir: string) {}

  /** Writes [rel] if it differs from what is there; true when it did. */
  write(rel: string, bytes: Uint8Array): boolean {
    const hash = sha1(bytes);
    const abs = path.join(this.dir, rel);
    const known = this.hashes.get(rel) ?? (fs.existsSync(abs) ? sha1(fs.readFileSync(abs)) : undefined);
    if (known === hash) {
      this.hashes.set(rel, hash);
      return false;
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    // A rename is atomic: Elbert never reads half a file.
    const tmp = `${abs}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, bytes);
    fs.renameSync(tmp, abs);
    this.hashes.set(rel, hash);
    return true;
  }

  writeRaw(rel: string, text: string) {
    const abs = path.join(this.dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const tmp = `${abs}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, abs);
  }

  setBuildError(message: string) {
    this.writeRaw(path.join(DOT, 'build-error'), stripAnsi(message));
  }

  clearBuildError() {
    fs.rmSync(path.join(this.dir, DOT, 'build-error'), { force: true });
  }

  /** Every file a remote Elbert needs, with its hash. */
  list(): { path: string; sha1: string; size: number }[] {
    const out: { path: string; sha1: string; size: number }[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.') || e.name.endsWith('.tmp')) continue;
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) walk(abs);
        else {
          const rel = path.relative(this.dir, abs).split(path.sep).join('/');
          const bytes = fs.readFileSync(abs);
          const hash = sha1(bytes);
          this.hashes.set(rel, hash);
          out.push({ path: rel, sha1: hash, size: bytes.length });
        }
      }
    };
    if (fs.existsSync(this.dir)) walk(this.dir);
    return out;
  }
}

/** Manifest, templates and assets → dist/; returns what changed. */
function staticFiles(root: string, m: Manifest, outputs: Outputs): string[] {
  const changed: string[] = [];
  const put = (rel: string, bytes: Uint8Array) => {
    if (outputs.write(rel, bytes)) changed.push(rel);
  };
  put('elbert-plugin.json', new TextEncoder().encode(`${JSON.stringify(m, null, 2)}\n`));
  for (const p of Object.values(m.ui ?? {}) as string[]) {
    const abs = path.join(root, p);
    if (fs.existsSync(abs)) put(p, fs.readFileSync(abs));
  }
  const assets = path.join(root, 'assets');
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else put(path.relative(root, abs).split(path.sep).join('/'), fs.readFileSync(abs));
    }
  };
  if (fs.existsSync(assets)) walk(assets);
  return changed;
}

// ---- What Elbert reports ------------------------------------------------------------

type DevMessage = Record<string, unknown> & { t: string };

/** Prints one message from Elbert (log line, error, reload result). */
function report(m: DevMessage, from: string) {
  const who = dim(`[${from}]`);
  switch (m.t) {
    case 'log': {
      const level = String(m.level ?? 'log');
      const text = String(m.text ?? '');
      const tint = level === 'error' ? red : level === 'warn' ? yellow : level === 'debug' ? dim : (s: string) => s;
      console.log(`${time()} ${who} ${tint(`${level.padEnd(5)} ${text}`)}`);
      break;
    }
    case 'issue': {
      const detail = String(m.detail ?? '');
      console.log(`${time()} ${who} ${red(bold(`${labelFor(String(m.kind))}:`))} ${red(String(m.message ?? ''))}`);
      if (detail && detail !== m.message) console.log(indent(detail));
      break;
    }
    case 'reloaded': {
      const ok = m.ok !== false;
      const what =
        m.kind === 'templates' ? `templates reloaded in place (${(m.libraries as string[] | undefined)?.join(', ')})` : 'plugin restarted, pages reopened';
      const carried = typeof m.carried === 'number' && m.carried > 0 ? dim(` · ${m.carried} state value(s) carried`) : '';
      console.log(`${time()} ${who} ${ok ? green('↻') : red('✗')} ${ok ? what : `${what} — with errors`} ${dim(`${m.ms} ms`)}${carried}`);
      break;
    }
    case 'state':
      if (m.state === 'failed') console.log(`${time()} ${who} ${red(`plugin failed to start: ${m.error ?? ''}`)}`);
      else if (m.state === 'running') console.log(`${time()} ${who} ${green('●')} running`);
      break;
    case 'opened':
      console.log(`${time()} ${who} opened ${cyan(String(m.route))}`);
      break;
  }
}

const labelFor = (kind: string) => ({ template: 'Template error', render: 'Render error', build: 'Build failed' })[kind] ?? 'JavaScript error';

const indent = (s: string) =>
  s
    .split('\n')
    .map((l) => `      ${dim(l)}`)
    .join('\n');

/** Follows dist/.elbert/log.jsonl, which a local Elbert appends to. */
class LogTail {
  private offset = 0;
  private partial = '';
  private ino = 0;

  constructor(
    readonly file: string,
    readonly onMessage: (m: DevMessage) => void,
  ) {}

  start() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    if (fs.existsSync(this.file)) {
      const st = fs.statSync(this.file);
      this.offset = st.size;
      this.ino = st.ino;
    }
    // fs.watch on a file that is replaced or truncated is unreliable across
    // platforms; a short poll is simple and cheap.
    setInterval(() => this.poll(), 150);
  }

  private poll() {
    let size: number;
    try {
      const st = fs.statSync(this.file);
      size = st.size;
      if (st.ino !== this.ino || size < this.offset) {
        // Elbert started a new file (it loaded the plugin again).
        this.ino = st.ino;
        this.offset = 0;
        this.partial = '';
      }
    } catch {
      return;
    }
    if (size === this.offset) return;
    const fd = fs.openSync(this.file, 'r');
    try {
      const buf = Buffer.alloc(size - this.offset);
      fs.readSync(fd, buf, 0, buf.length, this.offset);
      this.offset = size;
      const text = this.partial + buf.toString('utf8');
      const lines = text.split('\n');
      this.partial = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          this.onMessage(JSON.parse(line));
        } catch {
          // a torn line: skip it
        }
      }
    } finally {
      fs.closeSync(fd);
    }
  }
}

// ---- LAN dev server -----------------------------------------------------------------

interface Session {
  token: string;
  device: string;
}

/**
 * Serves dist/ to an Elbert on another device. Elbert always connects out to
 * this, never the other way, and the user types this server's address and
 * code into Elbert themselves. The code is exchanged for a random session
 * token (`POST /pair`); every other request needs that token. Five wrong codes
 * replace the code, so it can't be guessed by trying.
 */
class DevServer {
  readonly port: number;
  private code = newCode();
  private failures = 0;
  private sessions = new Map<string, Session & { at: number }>();
  /** Paired devices survive restarting `dev` for a day (never served: dot-folder). */
  private readonly sessionsFile: string;
  private sockets = new Set<ServerWebSocket<Session>>();
  private pendingOpen: string | undefined;

  constructor(
    readonly o: DevOptions,
    readonly outputs: Outputs,
  ) {
    this.port = o.port;
    this.sessionsFile = path.join(outputs.dir, DOT, 'sessions.json');
    try {
      const saved = JSON.parse(fs.readFileSync(this.sessionsFile, 'utf8')) as (Session & { at: number })[];
      const fresh = Date.now() - SESSION_TTL_MS;
      for (const s of saved) if (s.at > fresh) this.sessions.set(s.token, s);
    } catch {
      // none yet
    }
  }

  private saveSessions() {
    try {
      fs.mkdirSync(path.dirname(this.sessionsFile), { recursive: true });
      fs.writeFileSync(this.sessionsFile, JSON.stringify([...this.sessions.values()]), { mode: 0o600 });
    } catch {
      // pairing still works this run
    }
  }

  prettyCode() {
    return `${this.code.slice(0, 3)} ${this.code.slice(3)}`;
  }

  addresses(): string[] {
    const out: string[] = [];
    for (const [name, list] of Object.entries(os.networkInterfaces())) {
      // Container and VM bridges are not where a phone can reach this.
      if (/^(docker|br-|veth|virbr|vmnet|vboxnet|podman|cni|flannel|tailscale|zt)/.test(name)) continue;
      for (const a of list ?? []) {
        if (a.family === 'IPv4' && !a.internal) out.push(`${a.address}:${this.port}`);
      }
    }
    return out;
  }

  start() {
    try {
      Bun.serve<Session>({
        hostname: this.o.host as string,
        port: this.port,
        fetch: (req, server) => this.handle(req, server),
        websocket: {
          open: (ws) => {
            this.sockets.add(ws);
            console.log(`${time()} ${green('●')} ${ws.data.device} connected`);
            if (this.pendingOpen !== undefined) {
              ws.send(JSON.stringify({ t: 'open', route: this.pendingOpen }));
              this.pendingOpen = undefined;
            }
          },
          message: (ws, raw) => {
            try {
              report(JSON.parse(String(raw)), ws.data.device);
            } catch {
              // not ours
            }
          },
          close: (ws) => {
            this.sockets.delete(ws);
            console.log(`${time()} ${dim(`${ws.data.device} disconnected`)}`);
          },
        },
      });
    } catch (e) {
      console.error(red(`Could not serve on port ${this.port}: ${e instanceof Error ? e.message : e}. Pass --port, or --no-lan.`));
      process.exit(1);
    }
  }

  private async handle(req: Request, server: import('bun').Server<Session>): Promise<Response | undefined> {
    const url = new URL(req.url);
    if (url.pathname === '/pair' && req.method === 'POST') return this.pair(req);
    const session = this.authorize(req, url);
    if (!session) return json({ error: 'unauthorized' }, 401);
    switch (url.pathname) {
      case '/ws':
        return server.upgrade(req, { data: session }) ? undefined : json({ error: 'upgrade failed' }, 400);
      case '/files':
        return json({ manifest: this.o.readManifest(), files: this.outputs.list() });
      case '/file': {
        const rel = url.searchParams.get('path') ?? '';
        const abs = path.resolve(this.outputs.dir, rel);
        // Only files inside dist/, and never the dot-folder.
        if (!abs.startsWith(path.resolve(this.outputs.dir) + path.sep) || rel.split('/').some((s) => s.startsWith('.'))) {
          return json({ error: 'not found' }, 404);
        }
        const file = Bun.file(abs);
        return (await file.exists()) ? new Response(file) : json({ error: 'not found' }, 404);
      }
    }
    return json({ error: 'not found' }, 404);
  }

  private async pair(req: Request): Promise<Response> {
    let body: { code?: string; device?: string } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return json({ error: 'bad request' }, 400);
    }
    const given = String(body.code ?? '').replace(/\D/g, '');
    if (given !== this.code) {
      this.failures++;
      if (this.failures >= 5) {
        this.failures = 0;
        this.code = newCode();
        console.log(`${time()} ${yellow(`too many wrong pairing codes — the new code is ${bold(this.prettyCode())}`)}`);
      }
      return json({ error: 'wrong code' }, 403);
    }
    this.failures = 0;
    const device = String(body.device ?? 'Elbert').slice(0, 60);
    const token = randomBytes(24).toString('hex');
    this.sessions.set(token, { token, device, at: Date.now() });
    this.saveSessions();
    const m = this.o.readManifest();
    console.log(`${time()} ${green('●')} paired with ${bold(device)}`);
    return json({ token, id: m.id, name: m.name });
  }

  private authorize(req: Request, url: URL): Session | undefined {
    const header = req.headers.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : (url.searchParams.get('token') ?? '');
    return this.sessions.get(token);
  }

  /** dist/ files changed: connected Elbert instances fetch them. */
  changed(files: string[]) {
    this.broadcast({ t: 'changed', files });
  }

  requestOpen(route: string) {
    if (this.sockets.size === 0) this.pendingOpen = route;
    else this.broadcast({ t: 'open', route });
  }

  broadcast(m: Record<string, unknown>) {
    const text = JSON.stringify(m);
    for (const ws of this.sockets) ws.send(text);
  }
}

// ---- Helpers -------------------------------------------------------------------------

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

const sha1 = (bytes: Uint8Array) => createHash('sha1').update(bytes).digest('hex');

const json = (body: unknown, status = 200) => Response.json(body, { status });

// biome-ignore lint/suspicious/noControlCharactersInRegex: matching ANSI escapes is the point.
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

/** A Bun build log as `file:line:column: message` plus the offending line. */
function formatBuildLog(log: BuildMessage | ResolveMessage): string {
  const pos = log.position;
  if (!pos) return String(log.message);
  const where = `${path.relative(process.cwd(), pos.file) || pos.file}:${pos.line}:${pos.column + 1}`;
  const caret = pos.lineText ? `\n    ${pos.lineText}\n    ${' '.repeat(Math.max(0, pos.column))}^` : '';
  return `  ${where}: ${log.message}${caret}`;
}

function debounce<A extends unknown[]>(fn: (...a: A) => unknown, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...a: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
