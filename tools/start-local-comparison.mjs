#!/usr/bin/env node
// Disposable real-game + built-lab fixture. No .env edits, real databases or
// external providers. Import startLocalComparison() for credentials in memory.
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import net from 'node:net';
import { syncBuiltinESMExports } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync, createHash, createHmac } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';
import { installPartnerApi } from '../web/partner-api.mjs';
import { acquireLocalSession } from '../open-claw/lab/deploy/local-session.mjs';

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const GUARD_INSTALLED = Symbol.for('croupier.local-comparison.guard');

// Installed only in spawned QA processes through NODE_OPTIONS. The production
// modules are unchanged, including their normal env-file discovery behavior.
export function installComparisonProcessGuard() {
  if (globalThis[GUARD_INSTALLED]) return;
  const ports = new Set((process.env.CROUPIER_QA_ALLOWED_PORTS || '').split(',').filter(Boolean));
  if (!ports.size) throw new Error('Comparison guard needs explicit local ports.');
  globalThis[GUARD_INSTALLED] = true;
  const blockedEnv = value => {
    if (typeof value === 'number') return false;
    let name;
    try { name = basename(value instanceof URL ? fileURLToPath(value) : String(value)).toLowerCase(); }
    catch { return false; }
    return name === 'agent.env' || name === '.env' || name.startsWith('.env.');
  };
  const absent = () => Object.assign(new Error('Environment files are disabled in isolated comparison.'), { code: 'ENOENT' });
  const readSync = fs.readFileSync, read = fs.readFile, readAsync = fsPromises.readFile;
  fs.readFileSync = function (file, ...args) { if (blockedEnv(file)) throw absent(); return readSync.call(this, file, ...args); };
  fs.readFile = function (file, ...args) {
    if (blockedEnv(file)) { queueMicrotask(() => args.at(-1)(absent())); return; }
    return read.call(this, file, ...args);
  };
  fsPromises.readFile = async function (file, ...args) { if (blockedEnv(file)) throw absent(); return readAsync.call(this, file, ...args); };
  syncBuiltinESMExports();
  const blockedNetwork = () => Object.assign(new Error('Only the isolated comparison servers are reachable.'), { code: 'QA_NETWORK_BLOCKED' });
  const allowed = (host, port) => LOOPBACK.has(String(host || 'localhost').toLowerCase()) && ports.has(String(port));
  const fetchLocal = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (!['http:', 'https:'].includes(url.protocol) || !allowed(url.hostname, url.port || (url.protocol === 'https:' ? 443 : 80))) throw blockedNetwork();
    return fetchLocal(input, init);
  };
  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    // Keep local IPC pipes available to Node/Next workers. TCP is restricted.
    if (typeof first === 'object' && first?.path || typeof first === 'string' && !/^\d+$/.test(first)) return connect.apply(this, args);
    const host = typeof first === 'object' ? first.host ?? first.hostname : typeof args[1] === 'string' ? args[1] : 'localhost';
    const port = typeof first === 'object' ? first.port : first;
    if (!allowed(host, port)) throw blockedNetwork();
    return connect.apply(this, args);
  };
}

function isolatedEnv(runDir, ports) {
  const env = {};
  // Preserve only OS/runtime locations, never inherited app/provider credentials.
  for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'COMSPEC', 'PATHEXT']) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  const preload = `import {installComparisonProcessGuard} from ${JSON.stringify(import.meta.url)};installComparisonProcessGuard();`;
  return Object.assign(env, {
    NODE_OPTIONS: `--import=data:text/javascript;base64,${Buffer.from(preload).toString('base64')}`,
    CROUPIER_QA_ALLOWED_PORTS: ports.join(','), NEXT_TELEMETRY_DISABLED: '1',
    CROUPIER_ENV_FILE: join(runDir, 'disabled-agent.env'), RESEND_API_KEY: '', AXEL_AGENT_TOKEN: '',
    AXEL_AGENT_URL: 'http://localhost:1/disabled', GENERATIONS_READ_TOKENS: '',
    LAB_REMOTE_URL: '', LAB_REMOTE_TOKEN: '', LAB_API_TOKEN: '',
    OPENCLAW_BASE_URL: '', OPENCLAW_HOSTPORT: '', OPENCLAWAPI_KEY: '',
    OPENCLAW_DASHBOARD_ENABLED: 'false', OPENCLAW_DASHBOARD_ORIGIN: '', RENDER_EXTERNAL_URL: '',
    LAB_COMPANION_ENABLED: 'false', LAB_COMPANION_FUN_ENABLED: 'false', LAB_COMPANION_WEB_ENABLED: 'false',
    ELEVENLABS_API_KEY: '', ELEVENLABS_OC_API: '',
    LAB_STUDIO_DATA_DIR: join(runDir, 'studio'), LAB_DATA_DIR: join(runDir, 'director'),
    LAB_VIDEO_ARCHIVE: join(runDir, 'archive'),
  });
}

async function unusedPort(port, host) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid comparison port.');
  const socket = net.createServer();
  await new Promise((resolveReady, reject) => { socket.once('error', reject); socket.listen(port, host, resolveReady); });
  await new Promise(resolveClosed => socket.close(resolveClosed));
}

async function stopChild(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const force = setTimeout(() => child.kill('SIGKILL'), 5000);
  force.unref();
  try { await exited; } finally { clearTimeout(force); }
}

async function startChild(args, options, readyText, onSpawn = () => {}) {
  const child = spawn(process.execPath, args, { ...options, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  onSpawn(child);
  try {
    await new Promise((resolveReady, reject) => {
      const timer = setTimeout(() => reject(new Error('Isolated comparison server did not become ready.')), 30000);
      const ready = chunk => { if (String(chunk).includes(readyText)) { clearTimeout(timer); resolveReady(); } };
      child.stdout.on('data', ready);
      // Consume child logs without exposing generated tokens, passwords or URLs.
      child.stderr.on('data', () => {});
      child.once('error', () => { clearTimeout(timer); reject(new Error('Could not start isolated comparison process.')); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Isolated comparison process exited (${code}).`)); });
    });
    return child;
  } catch (error) { await stopChild(child); throw error; }
}

/**
 * const fixture = await startLocalComparison({startLab:false});
 * fixture.credentials.backoffice // {username,password,email}, memory only
 * fixture.credentials.partner    // {keyId,secret,playerId,playerRef,launchUrl}
 * await fixture.startLab();       // after `npm run build` has completed in lab/
 * await fixture.stop();           // stops children and removes its own temp data
 */
export async function startLocalComparison({ startLab = true, gamePort = 4194, labPort = 4192, repoRoot = DEFAULT_ROOT, generationDirectory } = {}) {
  repoRoot = resolve(repoRoot);
  if (generationDirectory !== undefined) {
    generationDirectory = resolve(generationDirectory);
    const supplied = await fsPromises.lstat(generationDirectory);
    if (!supplied.isDirectory() || supplied.isSymbolicLink()) throw new Error('Comparison media directory must be an existing regular directory.');
  }
  if (gamePort === labPort) throw new Error('Game and lab need separate ports.');
  const session = await acquireLocalSession({ repoRoot, productPort: gamePort, labPort });
  let runDir;
  try {
    await unusedPort(gamePort, 'localhost');
    if (startLab) await unusedPort(labPort, '127.0.0.1');
    runDir = await fsPromises.mkdtemp(join(tmpdir(), 'croupier-comparison-'));
  } catch (error) { await session.release(); throw error; }
  const dataDir = join(runDir, 'game');
  const gameUrl = `http://localhost:${gamePort}`, labUrl = `http://127.0.0.1:${labPort}`;
  const urls = Object.freeze({ game: gameUrl, original: `${gameUrl}/?dealer=astrid`, v2: `${gameUrl}/v2/?dealer=astrid`, backoffice: `${gameUrl}/bo/`, lab: labUrl });
  const password = randomBytes(24).toString('base64url'), username = 'comparison-qa', email = 'comparison@example.invalid';
  const readToken = randomBytes(32).toString('base64url');
  const env = session.environment(isolatedEnv(runDir, [gamePort, labPort]));
  if (generationDirectory) env.LAB_VIDEO_ARCHIVE = generationDirectory;
  env.CROUPIER_GENERATIONS_DIR = generationDirectory || env.LAB_VIDEO_ARCHIVE;
  let gameChild, labChild, stopped = false, stopping, labStarting = null;
  let credentials;
  const stop = () => stopping ??= (async () => {
    stopped = true;
    try {
      await stopChild(labChild); await stopChild(gameChild);
      // Delete only the mkdtemp directory created above, never a user-supplied path.
      if (dirname(resolve(runDir)) !== resolve(tmpdir()) || !basename(runDir).startsWith('croupier-comparison-')) throw new Error('Invalid comparison cleanup path.');
      await fsPromises.rm(runDir, { recursive: true, force: true });
    } finally { await session.release(); }
  })();
  const startBuiltLab = async () => {
    if (stopped) throw new Error('Comparison fixture has stopped.');
    if (labStarting) return labStarting;
    if (labChild && labChild.exitCode === null && labChild.signalCode === null) return labUrl;
    labChild = null;
    labStarting = (async () => {
      const labDir = join(repoRoot, 'lab');
      if (!fs.existsSync(join(labDir, '.next', 'BUILD_ID'))) throw new Error('Build lab first, or start with {startLab:false} and call fixture.startLab() afterward.');
      await unusedPort(labPort, '127.0.0.1');
      labChild = await startChild([join(labDir, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(labPort)], {
        cwd: labDir, env: { ...env, NODE_ENV: 'production', PORT: String(labPort),
          BETTALOTTO_PARTNER_BASE_URL: gameUrl, BETTALOTTO_PARTNER_KEY_ID: credentials.partner.keyId,
          BETTALOTTO_PARTNER_SECRET: credentials.partner.secret, BETTALOTTO_PARTNER_PLAYER_ID: credentials.partner.playerId,
          BETTALOTTO_API: readToken },
      }, 'Ready in', child => { labChild = child; session.trackChild(child); });
      return labUrl;
    })();
    try { return await labStarting; } catch (error) { labChild = null; throw error; } finally { labStarting = null; }
  };
  try {
    await Promise.all([dataDir, env.LAB_STUDIO_DATA_DIR, env.LAB_DATA_DIR, ...(!generationDirectory ? [env.LAB_VIDEO_ARCHIVE] : [])].map(dir => fsPromises.mkdir(dir, { recursive: true })));
    const seed = new DatabaseSync(join(dataDir, 'craig.db'));
    try {
      seed.exec('CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE NOT NULL,email TEXT,salt TEXT,hash TEXT,role TEXT NOT NULL,created_at TEXT NOT NULL)');
      const salt = randomBytes(16).toString('hex');
      seed.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?)').run(1, username, email, salt, scryptSync(password, salt, 64).toString('hex'), 'superadmin', new Date().toISOString());
    } finally { seed.close(); }
    gameChild = await startChild([join(repoRoot, 'web/server.mjs')], {
      cwd: runDir, env: { ...env, NODE_ENV: 'development', CROUPIER_DATA_DIR: dataDir, HOST: 'localhost', PORT: String(gamePort),
        PUBLIC_URL: gameUrl, BO_URL: gameUrl, DEMO_GUEST_ACCESS: '1', GENERATIONS_READ_TOKENS: createHash('sha256').update(readToken).digest('hex') },
    }, 'croupier demo on', child => { gameChild = child; session.trackChild(child); });
    const db = new DatabaseSync(join(dataDir, 'croupier.db')), boDb = new DatabaseSync(join(dataDir, 'craig.db'));
    try {
      const secret = Buffer.from(boDb.prepare("SELECT v FROM meta WHERE k='jwt_secret'").get().v, 'hex');
      const jwtSign = payload => {
        const text = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify(payload)).toString('base64url');
        return text + '.' + createHmac('sha256', secret).update(text).digest('base64url');
      };
      const partner = installPartnerApi({ db, boDb, jwtSign, publicUrl: gameUrl, root: join(repoRoot, 'web/public'),
        getPlayer: id => db.prepare('SELECT * FROM players WHERE id=?').get(id),
        logTx: (playerId, type, amount, currency, meta) => db.prepare('INSERT INTO transactions(player_id,type,amount,currency,meta,at) VALUES(?,?,?,?,?,?)').run(playerId, type, amount, currency, meta, new Date().toISOString()),
      });
      const key = partner.keys.create({ name: 'Isolated comparison QA', scopes: ['launch', 'events'] }, username);
      const playerId = 'comparison-' + randomUUID();
      const launch = partner.keys.mintLaunch(key.id, { playerId, currency: 'USD' });
      partner.keys.credit(key.id, { playerId, amount: 1000 });
      credentials = Object.freeze({ backoffice: Object.freeze({ username, password, email }),
        partner: Object.freeze({ keyId: key.key, secret: key.secret, playerId, playerRef: launch.playerRef, launchUrl: launch.url }),
        generations: Object.freeze({ token: readToken }) });
    } finally { db.close(); boDb.close(); }
    if (startLab) await startBuiltLab();
    const fixture = { urls, gameUrl, labUrl, runDir, dataDir, startLab: startBuiltLab, stop,
      get pids() { return { game: gameChild?.pid, lab: labChild?.pid ?? null }; },
      toJSON() { return { urls }; }, [inspect.custom]() { return { urls, credentials: '[memory only]' }; } };
    Object.defineProperty(fixture, 'credentials', { value: credentials, enumerable: false });
    Object.defineProperty(fixture, 'bo', { value: credentials.backoffice, enumerable: false });
    return fixture;
  } catch (error) { await stop(); throw error; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const mediaOption = process.argv.indexOf('--media-directory');
    if (mediaOption >= 0 && (!process.argv[mediaOption + 1] || process.argv[mediaOption + 1].startsWith('--'))) throw new Error('--media-directory needs an existing read-only media directory.');
    const fixture = await startLocalComparison({ startLab: !process.argv.includes('--game-only'), generationDirectory: mediaOption >= 0 ? process.argv[mediaOption + 1] : undefined });
    for (const [name, url] of Object.entries(fixture.urls)) if (name !== 'lab' || fixture.pids.lab) console.log(url);
    const shutdown = async () => { await fixture.stop(); process.exit(0); };
    process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
