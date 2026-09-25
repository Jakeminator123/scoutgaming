#!/usr/bin/env node
// Isolated local product + lab relay launcher. Secrets are read from existing
// private env files, retained only in child environments, and never accepted as
// command-line arguments or copied to the disposable data directories.
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { boundedJson } from '../src/openclaw.mjs';
import { gatewayEndpoint, isLoopback } from '../src/settings.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DEFAULT_PRODUCT_PORT = 4196;
const DEFAULT_LAB_PORT = 4197;
const RESERVED_SHARED_PORTS = new Set([4192, 4194]);
const GUARD_INSTALLED = Symbol.for('croupier.openclaw-local-connection.guard');
const PRIVATE_KEYS = new Set([
  'LAB_REMOTE_URL', 'LAB_REMOTE_TOKEN', 'OPENCLAW_BASE_URL', 'OPENCLAWAPI_KEY',
  'OPENCLAW_AGENT', 'OPENCLAW_CHAT_AGENT', 'OPENCLAW_TIMEOUT_MS', 'OPENCLAW_MODEL_API_KEY',
]);

function blockedError() {
  return Object.assign(new Error('Only the isolated local services and configured OpenClaw origins are reachable.'), { code: 'OPENCLAW_CONNECTION_NETWORK_BLOCKED' });
}

// This guard is deliberately separate from tools/start-local-comparison.mjs.
// The comparison keeps its stricter no-network policy and empty providers.
export function installConnectionProcessGuard() {
  if (globalThis[GUARD_INSTALLED]) return;
  const origins = new Set(JSON.parse(process.env.CROUPIER_CONNECTION_ALLOWED_ORIGINS || '[]'));
  const localPorts = new Set((process.env.CROUPIER_CONNECTION_LOCAL_PORTS || '').split(',').filter(Boolean));
  if (!localPorts.size) throw new Error('Connection guard needs explicit local ports.');
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('Connection guard received an invalid origin.');
  }
  globalThis[GUARD_INSTALLED] = true;

  const blockedEnvFile = value => {
    let name;
    try { name = basename(value instanceof URL ? fileURLToPath(value) : String(value)).toLowerCase(); }
    catch { return false; }
    return name === '.env' || name.startsWith('.env.');
  };
  const absent = () => Object.assign(new Error('Environment files are disabled in isolated connection children.'), { code: 'ENOENT' });
  const readSync = fs.readFileSync, read = fs.readFile, readAsync = fsPromises.readFile;
  fs.readFileSync = function (file, ...args) { if (blockedEnvFile(file)) throw absent(); return readSync.call(this, file, ...args); };
  fs.readFile = function (file, ...args) {
    if (blockedEnvFile(file)) { queueMicrotask(() => args.at(-1)(absent())); return; }
    return read.call(this, file, ...args);
  };
  fsPromises.readFile = async function (file, ...args) { if (blockedEnvFile(file)) throw absent(); return readAsync.call(this, file, ...args); };
  syncBuiltinESMExports();

  const allowedUrl = value => {
    const url = new URL(value);
    return origins.has(url.origin) || (isLoopback(url.hostname) && localPorts.has(url.port || (url.protocol === 'https:' ? '443' : '80')));
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' || input instanceof URL ? input : input.url;
    if (!allowedUrl(url)) throw blockedError();
    return originalFetch(input, init);
  };

  const endpoints = new Set([...origins].map(origin => {
    const url = new URL(origin);
    return `${url.hostname.toLowerCase()}:${url.port || (url.protocol === 'https:' ? '443' : '80')}`;
  }));
  const originalConnect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    if (typeof first === 'object' && first?.path || typeof first === 'string' && !/^\d+$/.test(first)) return originalConnect.apply(this, args);
    const host = String(typeof first === 'object' ? first.host ?? first.hostname ?? 'localhost' : typeof args[1] === 'string' ? args[1] : 'localhost').toLowerCase();
    const port = String(typeof first === 'object' ? first.port : first);
    if (!(isLoopback(host) && localPorts.has(port)) && !endpoints.has(`${host}:${port}`)) throw blockedError();
    return originalConnect.apply(this, args);
  };
}

function normalizedOrigin(value, { remote = false } = {}) {
  if (!value) return null;
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash) throw new Error(remote ? 'LAB_REMOTE_URL must not contain credentials, query or fragment.' : 'OPENCLAW_BASE_URL must not contain credentials, query or fragment.');
  if (remote && url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback(url.hostname))) throw new Error('LAB_REMOTE_URL requires HTTPS except on loopback.');
  if (!remote) gatewayEndpoint(value);
  return url.origin;
}

function readEnvFile(file) {
  try { return parseEnv(fs.readFileSync(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw new Error('Could not parse private OpenClaw environment configuration.'); }
}

export function loadPrivateConnection({ repoRoot = REPO_ROOT, envFiles, env = process.env } = {}) {
  repoRoot = resolve(repoRoot);
  envFiles ??= [join(repoRoot, '.env'), join(repoRoot, 'lab', '.env.local')];
  const values = {};
  for (const file of envFiles) {
    const parsed = readEnvFile(file);
    for (const key of PRIVATE_KEYS) if (parsed[key] !== undefined) values[key] = parsed[key];
  }
  for (const key of PRIVATE_KEYS) if (env[key] !== undefined) values[key] = env[key];
  const gatewayKey = values.OPENCLAWAPI_KEY?.trim() || '';
  const modelKey = values.OPENCLAW_MODEL_API_KEY?.trim() || '';
  const baseUrl = values.OPENCLAW_BASE_URL?.trim() || '';
  const remoteUrl = values.LAB_REMOTE_URL?.trim() || '';
  const timeout = Number(values.OPENCLAW_TIMEOUT_MS ?? 8000);
  if (!Number.isFinite(timeout) || timeout < 50 || timeout > 30000) throw new Error('OPENCLAW_TIMEOUT_MS must be between 50 and 30000.');
  const productAgent = values.OPENCLAW_CHAT_AGENT?.trim() || 'openclaw/croupier-chat';
  const directorAgent = values.OPENCLAW_AGENT?.trim() || 'openclaw/croupier-director';
  const role = productAgent === 'openclaw/croupier-chat'
    ? { status: 'conflict', detail: 'croupier-chat is the lab-operator role and explicitly says it is not player chat.' }
    : productAgent === 'openclaw/croupier-director'
      ? { status: 'conflict', detail: 'croupier-director returns presentation variant JSON, not the product speech-choice contract.' }
      : { status: 'unverified', detail: 'The target is not defined by this helper; verify its deployed AGENTS contract before a model probe.' };
  const remoteToken = values.LAB_REMOTE_TOKEN?.trim() || '';
  const configuration = { repoRoot, baseUrl, remoteUrl, productAgent, directorAgent, timeoutMs: Math.round(timeout) };
  // Keep credentials accessible to the in-memory launcher/probe, but make an
  // accidental JSON/string inspection safe by default.
  Object.defineProperties(configuration, {
    gatewayKey: { value: gatewayKey, enumerable: false },
    remoteToken: { value: remoteToken, enumerable: false },
  });
  const report = {
    productGateway: {
      configured: Boolean(baseUrl && gatewayKey), baseUrlPresent: Boolean(baseUrl), gatewayCredentialPresent: Boolean(gatewayKey),
      origin: normalizedOrigin(baseUrl), agent: productAgent, role,
    },
    labDirector: {
      configured: Boolean(remoteUrl && remoteToken), remoteUrlPresent: Boolean(remoteUrl),
      directorCredentialPresent: Boolean(remoteToken), origin: normalizedOrigin(remoteUrl, { remote: true }), agent: directorAgent,
    },
    credentials: {
      gatewayPresent: Boolean(gatewayKey), modelProviderPresent: Boolean(modelKey),
      gatewayAndModelDistinct: gatewayKey && modelKey ? gatewayKey !== modelKey : null,
      modelProviderForwardedToLocalChildren: false,
    },
  };
  // The model credential is needed only by the already deployed private Gateway.
  // Do not retain it in the returned configuration or pass it to either child.
  return { configuration, report };
}

function modelsEndpoint(baseUrl) {
  const endpoint = new URL(gatewayEndpoint(baseUrl));
  endpoint.pathname = endpoint.pathname.replace(/\/chat\/completions$/, '/models');
  return endpoint;
}

export async function probeConnections(configuration, { fetchImpl = fetch } = {}) {
  const result = {
    productGateway: { configured: Boolean(configuration.baseUrl && configuration.gatewayKey), reachable: false, functionalModelProbe: 'not_run' },
    labDirector: { configured: Boolean(configuration.remoteUrl && configuration.remoteToken), reachable: false, authenticatedApi: false, functionalModelProbe: 'not_run' },
  };
  if (result.productGateway.configured) {
    try {
      const response = await fetchImpl(modelsEndpoint(configuration.baseUrl), {
        redirect: 'error', signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${configuration.gatewayKey}` },
      });
      result.productGateway.httpStatus = response.status;
      result.productGateway.reachable = response.ok;
      if (response.ok) {
        const json = await boundedJson(response, 256 * 1024);
        result.productGateway.agentListed = Array.isArray(json.data) && json.data.some(item => item?.id === configuration.productAgent);
      } else await response.body?.cancel();
    } catch { result.productGateway.error = 'unreachable'; }
  }
  if (result.labDirector.configured) {
    try {
      const base = new URL(configuration.remoteUrl);
      const health = await fetchImpl(new URL('/healthz', base), { redirect: 'error', signal: AbortSignal.timeout(10000) });
      result.labDirector.healthStatus = health.status;
      result.labDirector.reachable = health.ok;
      await health.body?.cancel();
      const status = await fetchImpl(new URL('/api/status', base), {
        redirect: 'error', signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${configuration.remoteToken}` },
      });
      result.labDirector.apiStatus = status.status;
      result.labDirector.authenticatedApi = status.ok;
      await status.body?.cancel();
    } catch { result.labDirector.error = 'unreachable'; }
  }
  return result;
}

function cleanBaseEnvironment() {
  const env = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'COMSPEC', 'PATHEXT', 'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'SSL_CERT_DIR']) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}

function guardedEnvironment(extra, origins, ports) {
  const preload = `import {installConnectionProcessGuard} from ${JSON.stringify(import.meta.url)};installConnectionProcessGuard();`;
  return {
    ...cleanBaseEnvironment(),
    NODE_OPTIONS: `--import=data:text/javascript;base64,${Buffer.from(preload).toString('base64')}`,
    CROUPIER_CONNECTION_ALLOWED_ORIGINS: JSON.stringify(origins.filter(Boolean)),
    CROUPIER_CONNECTION_LOCAL_PORTS: ports.join(','),
    NEXT_TELEMETRY_DISABLED: '1',
    OPENCLAW_MODEL_API_KEY: '', OPENCLAW_MODEL_BASE_URL: '', OPENCLAW_MODEL_ID: '', OPENCLAW_MODEL_API: '',
    ...extra,
  };
}

export function childSpecifications(configuration, runDir, { productPort = DEFAULT_PRODUCT_PORT, labPort = DEFAULT_LAB_PORT } = {}) {
  runDir = resolve(runDir);
  const productUrl = `http://127.0.0.1:${productPort}`;
  const labUrl = `http://127.0.0.1:${labPort}`;
  const ports = [String(productPort), String(labPort)];
  const productData = join(runDir, 'product');
  const labData = join(runDir, 'lab-relay');
  const productOrigin = configuration.baseUrl ? normalizedOrigin(configuration.baseUrl) : null;
  const directorOrigin = configuration.remoteUrl ? normalizedOrigin(configuration.remoteUrl, { remote: true }) : null;
  const commonEmpty = {
    CROUPIER_ENV_FILE: join(runDir, 'disabled.env'), RESEND_API_KEY: '', AXEL_AGENT_TOKEN: '', AXEL_AGENT_URL: '',
    GENERATIONS_READ_TOKENS: '', ELEVENLABS_API_KEY: '', ELEVENLABS_OC_API: '',
    OPENCLAW_DASHBOARD_ENABLED: 'false', OPENCLAW_DASHBOARD_ORIGIN: '', OPENCLAW_HOSTPORT: '',
  };
  return {
    product: {
      command: process.execPath, args: [join(configuration.repoRoot, 'web', 'server.mjs')], cwd: runDir,
      readyText: 'croupier demo on', dataDir: productData,
      env: guardedEnvironment({ ...commonEmpty, NODE_ENV: 'development', HOST: '127.0.0.1', PORT: String(productPort),
        CROUPIER_DATA_DIR: productData, CROUPIER_GENERATIONS_DIR: join(runDir, 'generations'), DEMO_GUEST_ACCESS: '1',
        PUBLIC_URL: productUrl, BO_URL: productUrl, LAB_REMOTE_URL: '', LAB_REMOTE_TOKEN: '', LAB_API_TOKEN: '',
        OPENCLAW_BASE_URL: configuration.baseUrl, OPENCLAWAPI_KEY: configuration.gatewayKey,
        OPENCLAW_AGENT: configuration.directorAgent, OPENCLAW_CHAT_AGENT: configuration.productAgent,
        OPENCLAW_TIMEOUT_MS: String(configuration.timeoutMs), LAB_COMPANION_ENABLED: 'false', LAB_COMPANION_FUN_ENABLED: 'false', LAB_COMPANION_WEB_ENABLED: 'false',
      }, [productOrigin], ports),
    },
    lab: {
      command: process.execPath, args: [join(configuration.repoRoot, 'open-claw', 'lab', 'src', 'server.mjs')], cwd: runDir,
      readyText: 'Croupier lab:', dataDir: labData,
      env: guardedEnvironment({ ...commonEmpty, NODE_ENV: 'development', HOST: '127.0.0.1', PORT: String(labPort),
        LAB_DATA_DIR: labData, LAB_REMOTE_URL: configuration.remoteUrl, LAB_REMOTE_TOKEN: configuration.remoteToken, LAB_API_TOKEN: '',
        OPENCLAW_BASE_URL: '', OPENCLAWAPI_KEY: '', OPENCLAW_AGENT: configuration.directorAgent,
        OPENCLAW_CHAT_AGENT: 'openclaw/croupier-chat', OPENCLAW_TIMEOUT_MS: String(configuration.timeoutMs),
        LAB_COMPANION_ENABLED: 'false', LAB_COMPANION_FUN_ENABLED: 'false', LAB_COMPANION_WEB_ENABLED: 'false',
      }, [directorOrigin], ports),
    },
    urls: { product: productUrl, lab: labUrl },
  };
}

async function unusedPort(port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Local connection ports must be integers from 1024 to 65535.');
  if (RESERVED_SHARED_PORTS.has(port)) throw new Error(`Port ${port} is reserved for the shared comparison and will not be touched.`);
  const server = net.createServer();
  await new Promise((resolveReady, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolveReady); });
  await new Promise(resolveClosed => server.close(resolveClosed));
}

async function stopChild(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const force = setTimeout(() => child.kill('SIGKILL'), 5000); force.unref();
  try { await exited; } finally { clearTimeout(force); }
}

async function startChild(specification) {
  const child = spawn(specification.command, specification.args, {
    cwd: specification.cwd, env: specification.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await new Promise((resolveReady, reject) => {
      const timer = setTimeout(() => reject(new Error('An isolated connection process did not become ready.')), 30000);
      child.stdout.on('data', chunk => { if (String(chunk).includes(specification.readyText)) { clearTimeout(timer); resolveReady(); } });
      // Consume startup output. The product can generate a disposable BO password;
      // child output must therefore never be copied into the parent log.
      child.stderr.on('data', () => {});
      child.once('error', () => { clearTimeout(timer); reject(new Error('Could not start an isolated connection process.')); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('An isolated connection process exited before readiness.')); });
    });
    return child;
  } catch (error) { await stopChild(child); throw error; }
}

export async function startIsolatedConnection({ repoRoot = REPO_ROOT, envFiles, env = process.env,
  productPort = DEFAULT_PRODUCT_PORT, labPort = DEFAULT_LAB_PORT } = {}) {
  if (productPort === labPort) throw new Error('Product and lab relay need separate ports.');
  await unusedPort(productPort); await unusedPort(labPort);
  const { configuration, report } = loadPrivateConnection({ repoRoot, envFiles, env });
  if (!report.labDirector.configured) throw new Error('LAB_REMOTE_URL and LAB_REMOTE_TOKEN are required for the connected lab relay.');
  if (report.productGateway.configured && report.productGateway.role.status === 'conflict') {
    throw new Error('Refusing a connected product start because the configured OpenClaw agent has a conflicting runtime contract.');
  }
  const runDir = await fsPromises.mkdtemp(join(tmpdir(), 'croupier-openclaw-connection-'));
  const specs = childSpecifications(configuration, runDir, { productPort, labPort });
  let product, lab, stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    await stopChild(lab); await stopChild(product);
    const absolute = resolve(runDir);
    if (dirname(absolute) !== resolve(tmpdir()) || !basename(absolute).startsWith('croupier-openclaw-connection-')) throw new Error('Invalid isolated connection cleanup path.');
    await fsPromises.rm(absolute, { recursive: true, force: true });
  };
  try {
    await Promise.all([specs.product.dataDir, specs.lab.dataDir, join(runDir, 'generations')].map(directory => fsPromises.mkdir(directory, { recursive: true })));
    product = await startChild(specs.product);
    lab = await startChild(specs.lab);
    return {
      urls: Object.freeze(specs.urls), runDir, report, stop,
      get pids() { return { product: product?.pid ?? null, lab: lab?.pid ?? null }; },
      toJSON() { return { urls: specs.urls, report }; },
    };
  } catch (error) { await stop(); throw error; }
}

function parseCli(argv) {
  if (argv.some(value => /^--.*(?:key|token|secret|password)/i.test(value))) throw new Error('Credentials must be read from existing private configuration, never command-line arguments.');
  let mode = 'check', productPort = DEFAULT_PRODUCT_PORT, labPort = DEFAULT_LAB_PORT;
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === '--check') mode = 'check';
    else if (value === '--start') mode = 'start';
    else if (value === '--product-port') productPort = Number(argv[++index]);
    else if (value === '--lab-port') labPort = Number(argv[++index]);
    else throw new Error(`Unknown option: ${value}`);
  }
  return { mode, productPort, labPort };
}

async function main() {
  const cli = parseCli(process.argv.slice(2));
  if (cli.mode === 'check') {
    const { configuration, report } = loadPrivateConnection();
    const probe = await probeConnections(configuration);
    console.log(JSON.stringify({ report, probe }, null, 2));
    return;
  }
  const fixture = await startIsolatedConnection(cli);
  console.log(`Isolated product: ${fixture.urls.product}`);
  console.log(`Isolated lab relay: ${fixture.urls.lab}`);
  console.log(fixture.report.productGateway.configured
    ? `Product Gateway configured; role contract: ${fixture.report.productGateway.role.status}.`
    : `Product Gateway is not configured; missing ${[
      !fixture.report.productGateway.baseUrlPresent && 'OPENCLAW_BASE_URL',
      !fixture.report.productGateway.gatewayCredentialPresent && 'OPENCLAWAPI_KEY',
    ].filter(Boolean).join(' and ')}.`);
  console.log('Disposable databases are removed on Ctrl+C. Shared ports 4192/4194 are untouched.');
  const shutdown = async () => { await fixture.stop(); process.exit(0); };
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
