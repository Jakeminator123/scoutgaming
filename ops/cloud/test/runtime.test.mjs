import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { childSpecifications, inspectCloudBootstrap, inspectCloudDisk, validateCloudConfig } from '../config.mjs';
import { createCloudGateway, proxyHeaders, upstreamForHost, upstreamForRequest } from '../gateway.mjs';
import { startChildren, terminateChild, observeChildStdout } from '../process-group.mjs';
import { PassThrough } from 'node:stream';
import { assertCloudAccessReady } from '../start.mjs';

const fixture = () => ({
  NODE_ENV: 'production', PORT: '10000',
  CROUPIER_CLOUD_DATA_ROOT: join(tmpdir(), 'croupier-cloud-test-volume'),
  PUBLIC_URL: 'https://game.example.test', BO_URL: 'https://bo.example.test',
  LAB_PUBLIC_URL: 'https://lab.example.test',
  CROUPIER_GAME_ORIGIN: 'https://game.example.test',
  BETTALOTTO_PARTNER_BASE_URL: 'https://game.example.test',
  CROUPIER_STREAM_LANE: 'lissabon-stream-lane',
  OPENCLAW_PRODUCT_SPEECH_URL: 'https://speech.example.test',
  OPENCLAW_PRODUCT_SPEECH_TOKEN: 'fixture-product-speech-token',
});
const LAB_SECRET = '0123456789abcdef'.repeat(4);

test('chat deadline reaches only the product relay and does not extend Director advice', () => {
  const env = { ...fixture(), OPENCLAW_TIMEOUT_MS: '8000', OPENCLAW_SPEECH_TIMEOUT_MS: '20000',
    OPENCLAW_SPEECH_ROUTING: 'adaptive', OPENCLAW_SPEECH_DEEP_MODEL: 'gpt-6-sol' };
  const specs = childSpecifications(validateCloudConfig(env), env, { labInternalSecret: LAB_SECRET });
  assert.equal(specs.web.env.OPENCLAW_SPEECH_TIMEOUT_MS, '20000');
  assert.equal(specs.web.env.OPENCLAW_TIMEOUT_MS, '8000');
  assert.equal(specs.lab.env.OPENCLAW_SPEECH_TIMEOUT_MS, undefined);
  for (const name of ['OPENCLAW_SPEECH_ROUTING', 'OPENCLAW_SPEECH_DEEP_MODEL']) {
    assert.equal(specs.web.env[name], undefined, 'routing policy belongs to the Director');
    assert.equal(specs.lab.env[name], undefined);
  }
  assert.equal(validateCloudConfig(fixture()).speechTimeoutMs, 8000);
  for (const value of ['', '0', '999', '30001', 'NaN', '20000.5']) {
    assert.throws(() => validateCloudConfig({ ...fixture(), OPENCLAW_SPEECH_TIMEOUT_MS: value }), /OPENCLAW_SPEECH_TIMEOUT_MS/);
  }
});

test('private media credentials reach both servers; scoped zones database reaches only Lab', () => {
  const env = { ...fixture(), CROUPIER_MEDIA_STORAGE: 'blob', BLOB_READ_WRITE_TOKEN: 'fixture-private-blob-token',
    CROUPIER_ZONES_DATABASE_URL: 'postgresql://zones:fixture-password@zones.neon.tech/neondb?sslmode=require',
    DATABASE_URL: 'postgresql://game:never-forward@game.example/game', NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN: 'never-forward' };
  const specs = childSpecifications(validateCloudConfig(env), env, { labInternalSecret: LAB_SECRET });
  for (const server of [specs.web, specs.lab]) {
    assert.equal(server.env.CROUPIER_MEDIA_STORAGE, 'blob');
    assert.equal(server.env.BLOB_READ_WRITE_TOKEN, env.BLOB_READ_WRITE_TOKEN);
    assert.equal(server.env.DATABASE_URL, undefined);
    assert.equal(server.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN, undefined);
  }
  assert.equal(specs.web.env.CROUPIER_ZONES_DATABASE_URL, undefined);
  assert.equal(specs.lab.env.CROUPIER_ZONES_DATABASE_URL, env.CROUPIER_ZONES_DATABASE_URL);
  const inactive = childSpecifications(validateCloudConfig({ ...fixture(), BLOB_READ_WRITE_TOKEN: 'staged-not-active' }), {}, { labInternalSecret: LAB_SECRET });
  assert.equal(inactive.web.env.CROUPIER_MEDIA_STORAGE, 'disk');
  assert.equal(inactive.web.env.BLOB_READ_WRITE_TOKEN, undefined);
  assert.equal(inactive.lab.env.CROUPIER_ZONES_DATABASE_URL, undefined);
  for (const change of [
    { BLOB_READ_WRITE_TOKEN: '' }, { CROUPIER_MEDIA_STORAGE: 'public' },
    { CROUPIER_MEDIA_STORAGE: 'disk' },
    { CROUPIER_ZONES_DATABASE_URL: 'https://zones.example.test/database' },
    { CROUPIER_ZONES_DATABASE_URL: 'postgresql://zones:secret@zones.neon.tech/neondb' },
  ]) {
    assert.throws(() => validateCloudConfig({ ...env, ...change }), /Invalid or missing/);
  }
});

test('player registration is opt-in and reaches only the Web child', () => {
  for (const value of ['', '0', '1']) {
    const env = { ...fixture(), CROUPIER_PLAYER_ACCOUNTS: value };
    const specs = childSpecifications(validateCloudConfig(env), env, { labInternalSecret: LAB_SECRET });
    assert.equal(specs.web.env.CROUPIER_PLAYER_ACCOUNTS, value === '1' ? '1' : '');
    assert.equal(specs.lab.env.CROUPIER_PLAYER_ACCOUNTS, undefined);
  }
  assert.throws(() => validateCloudConfig({ ...fixture(), CROUPIER_PLAYER_ACCOUNTS: 'yes' }));
});

test('one exact Vercel frontend origin is opt-in and reaches only Web', () => {
  const name = 'CROUPIER_VERCEL_FRONTEND_ORIGIN';
  const disabled = childSpecifications(validateCloudConfig(fixture()), fixture(), { labInternalSecret: LAB_SECRET });
  assert.equal(disabled.web.env[name], '');
  const origin = 'https://preview.example.vercel.app';
  const env = { ...fixture(), [name]: origin };
  const config = validateCloudConfig(env);
  const specs = childSpecifications(config, env, { labInternalSecret: LAB_SECRET });
  assert.equal(config.frontendOrigin, origin);
  assert.equal(specs.web.env[name], origin);
  assert.equal(specs.lab.env[name], undefined);
  for (const bad of ['https://*.vercel.app', 'http://preview.example.vercel.app',
    'https://preview.example.vercel.app/', 'https://preview.example.vercel.app/path',
    'https://preview.example.vercel.app:443', 'https://user@preview.example.vercel.app',
    env.PUBLIC_URL, env.BO_URL, env.LAB_PUBLIC_URL]) {
    assert.throws(() => validateCloudConfig({ ...env, [name]: bad }), name);
  }
});

test('three exact public origins share one port and two loopback children', () => {
  const env = fixture();
  const config = validateCloudConfig(env);
  const specs = childSpecifications(config, { PATH: '/usr/bin', UNRELATED_SECRET: 'never-forward' }, { labInternalSecret: LAB_SECRET });
  assert.equal(upstreamForHost('game.example.test', config), 4173);
  assert.equal(upstreamForHost('bo.example.test', config), 4173);
  assert.equal(upstreamForHost('lab.example.test', config), 4188);
  assert.equal(upstreamForHost('evil.example.test', config), null);
  assert.equal(upstreamForHost('game.example.test:443', config), null);
  assert.equal(upstreamForHost('bo.example.test:443', config), null);
  assert.equal(config.boOrigin, 'https://bo.example.test');
  assert.equal(specs.web.env.HOST, '127.0.0.1');
  assert.equal(specs.web.env.PUBLIC_URL, config.gameOrigin);
  assert.equal(specs.web.env.BO_URL, config.boOrigin);
  assert.equal(specs.web.env.LAB_PUBLIC_URL, config.labOrigin);
  for (const name of ['LAB_STUDIO_DATA_DIR','CROUPIER_PRESENTATION_STUDIO_DIR','CROUPIER_GENERATIONS_DIR','CROUPIER_GENERATED_SPEECH_DIR']) {
    assert.equal(specs.web.env[name], undefined);
    assert.equal(specs.lab.env[name], undefined);
  }
  assert.equal(specs.web.env.CROUPIER_DATA_DIR, join(config.dataRoot, 'players'));
  assert.equal(specs.lab.env.CROUPIER_DATA_DIR, specs.web.env.CROUPIER_DATA_DIR);
  assert.equal(specs.lab.env.BO_URL, config.boOrigin);
  assert.equal(specs.web.env.CROUPIER_CLOUD_RUNTIME, '1');
  assert.equal(specs.web.env.OPENCLAW_TIMEOUT_MS, '8000');
  assert.equal(specs.web.env.UNRELATED_SECRET, undefined);
  assert.equal(specs.lab.env.UNRELATED_SECRET, undefined);
  assert.equal(specs.web.env.DEMO_GUEST_ACCESS, '');
  assert.equal(specs.lab.env.LAB_PUBLIC_URL, config.labOrigin);
  assert.equal(specs.lab.env.CROUPIER_LAB_INTERNAL_SECRET, LAB_SECRET);
  assert.equal(specs.web.env.CROUPIER_LAB_INTERNAL_SECRET, undefined);
});

test('configuration rejects local or ambiguous exposure and conflicting storage', () => {
  for (const change of [
    { LAB_PUBLIC_URL: 'http://lab.example.test' },
    { LAB_PUBLIC_URL: 'https://game.example.test' },
    { LAB_PUBLIC_URL: 'https://bo.example.test' },
    { PUBLIC_URL: 'https://game.example.test:444' },
    { BO_URL: 'https://game.example.test' },
    { BO_URL: 'https://lab.example.test' },
    { BO_URL: 'http://bo.example.test' },
    { BO_URL: 'https://bo.example.test:443' },
    { BO_URL: 'https://bo.example.test/path' },
    { BO_URL: 'https://bo.example.test?next=/bo' },
    { CROUPIER_GAME_ORIGIN: 'https://other.example.test' },
    { PORT: '4173' },
    { DEMO_GUEST_ACCESS: '1' },
    { OPENCLAW_PRODUCT_SPEECH_URL: '' },
    { OPENCLAW_TIMEOUT_MS: '100' },
    { CROUPIER_GENERATED_SPEECH_STREAMING: '1' },
    { LAB_STUDIO_DATA_DIR: join(tmpdir(), 'unrelated-studio') },
    { CROUPIER_PRESENTATION_STUDIO_DIR: join(tmpdir(), 'unrelated-studio') },
    { CROUPIER_GENERATIONS_DIR: join(tmpdir(), 'generations') },
    { CROUPIER_GENERATED_SPEECH_DIR: join(tmpdir(), 'speech') },
    { CROUPIER_CLOUD_DATA_ROOT: '.' },
  ]) {
    assert.throws(() => validateCloudConfig({ ...fixture(), ...change }));
  }
});

test('Postgres, Neon and private Blob can start without a persistent product mount', async () => {
  const env = { ...fixture(), CROUPIER_DATABASE:'postgres',
    CROUPIER_GAME_DATABASE_URL:'postgresql://game:fixture-password@game.neon.tech/game?sslmode=require',
    CROUPIER_STUDIO_NEON_POLICY:'1', CROUPIER_STUDIO_ENVIRONMENT_ID:'production', CROUPIER_STUDIO_WORKSPACE_ID:'croupier',
    CROUPIER_MEDIA_STORAGE:'blob', BLOB_READ_WRITE_TOKEN:'fixture-private-blob-token',
    CROUPIER_MEDIA_BLOB_INDEX:join(resolve('.'),'media','blob-index.json') };
  delete env.CROUPIER_CLOUD_DATA_ROOT;
  const config = validateCloudConfig(env);
  assert.equal(config.dataRoot, null); assert.deepEqual(config.paths, {});
  await assert.doesNotReject(inspectCloudDisk(config));
  const specs = childSpecifications(config, env, { labInternalSecret:LAB_SECRET });
  for (const name of ['CROUPIER_DATA_DIR','LAB_STUDIO_DATA_DIR','CROUPIER_PRESENTATION_STUDIO_DIR','CROUPIER_GENERATIONS_DIR','CROUPIER_GENERATED_SPEECH_DIR']) {
    assert.equal(specs.web.env[name], undefined); assert.equal(specs.lab.env[name], undefined);
  }
  assert.equal(specs.web.env.BO_URL, config.boOrigin);
  assert.equal(specs.lab.env.CROUPIER_GAME_ORIGIN, config.gameOrigin);
  for (const patch of [{CROUPIER_MEDIA_STORAGE:'disk'},{CROUPIER_STUDIO_NEON_POLICY:'0'},
    {CROUPIER_MEDIA_BLOB_INDEX:join(tmpdir(),'retired-media-blob-index.json')},{CROUPIER_CLOUD_DATA_ROOT:''}]) {
    assert.throws(() => validateCloudConfig({...env,...patch}));
  }
});

test('cloud bootstrap, camera, and paid speech credentials are opt-in and Web-only', () => {
  const env = { ...fixture(),
    CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER: 'cloudadmin',
    CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD: 'fixture-private-passphrase-2026',
    CROUPIER_ASTRID_CAMERA: '1',
    CROUPIER_ASTRID_TRANSLATION_KEY: 'fixture-openai-key',
    CROUPIER_GENERATED_SPEECH: '1', CROUPIER_CLOUD_GENERATED_SPEECH: '1',
    CARTESIA_API_KEY: 'fixture-cartesia-key', RUNPOD_API_KEY: 'fixture-runpod-key',
    CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID: 'fixture-endpoint', OPENCLAW_TIMEOUT_MS: '12000',
    AMBIENT_SECRET: 'do-not-forward',
  };
  const specs = childSpecifications(validateCloudConfig(env), env, { labInternalSecret: LAB_SECRET });
  assert.equal(specs.web.env.CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER, env.CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER);
  assert.equal(specs.web.env.CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD, env.CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD);
  assert.equal(specs.web.env.CROUPIER_ASTRID_CAMERA, '1');
  assert.equal(specs.web.env.CROUPIER_ASTRID_TRANSLATION_KEY, env.CROUPIER_ASTRID_TRANSLATION_KEY);
  assert.equal(specs.web.env.CROUPIER_GENERATED_SPEECH, '1');
  assert.equal(specs.web.env.CROUPIER_CLOUD_GENERATED_SPEECH, '1');
  assert.equal(specs.web.env.CARTESIA_API_KEY, env.CARTESIA_API_KEY);
  assert.equal(specs.web.env.RUNPOD_API_KEY, env.RUNPOD_API_KEY);
  assert.equal(specs.web.env.CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID, env.CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID);
  assert.equal(specs.web.env.OPENCLAW_TIMEOUT_MS, '12000');
  for (const name of ['CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD', 'CROUPIER_ASTRID_TRANSLATION_KEY',
    'CARTESIA_API_KEY', 'RUNPOD_API_KEY', 'AMBIENT_SECRET']) assert.equal(specs.lab.env[name], undefined, name);
  assert.equal(specs.web.env.AMBIENT_SECRET, undefined);
  assert.equal(specs.web.env.CROUPIER_GENERATED_SPEECH_STREAMING, '');
  for (const change of [
    { CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER: '' },
    { CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER: 'kevin' },
    { CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER: 'CloudAdmin' },
    { CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD: 'short' },
    { CROUPIER_ASTRID_TRANSLATION_KEY: '' },
    { CROUPIER_GENERATED_SPEECH: '0' },
    { CARTESIA_API_KEY: '' },
    { CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID: '' },
  ]) assert.throws(() => validateCloudConfig({ ...env, ...change }));
  const inactive = childSpecifications(validateCloudConfig(fixture()), fixture(), { labInternalSecret: LAB_SECRET });
  assert.equal(inactive.web.env.CROUPIER_ASTRID_CAMERA, '');
  assert.equal(inactive.web.env.CROUPIER_GENERATED_SPEECH, '');
  assert.equal(inactive.web.env.CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD, undefined);
});

test('streaming secrets and switch reach Web only after explicit paid speech opt-in', () => {
  const env = { ...fixture(), CROUPIER_GENERATED_SPEECH: '1', CROUPIER_CLOUD_GENERATED_SPEECH: '1',
    CROUPIER_GENERATED_SPEECH_STREAMING: '1', CARTESIA_API_KEY: 'fixture-cartesia',
    RUNPOD_API_KEY: 'fixture-runpod', CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID: 'fixture-endpoint',
    CROUPIER_SPEECH_STREAM_WORKER_SECRET: 'fixture-worker-secret-longer-than-32-characters',
    CROUPIER_SPEECH_STREAM_TICKET_SECRET: 'fixture-ticket-secret-longer-than-32-characters',
    CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD: '0.25', CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD: '9.94' };
  const config = validateCloudConfig(env);
  const specs = childSpecifications(config, env, { labInternalSecret: LAB_SECRET });
  assert.equal(config.streaming, true);
  const ownProfiles={...env,CROUPIER_DEALER_SPEECH_PROFILES:'1',CROUPIER_STUDIO_NEON_POLICY:'1',ELEVENLABS_API_KEY:'fixture-own-voice-key'};
  const ownSpecs=childSpecifications(validateCloudConfig(ownProfiles),ownProfiles,{labInternalSecret:LAB_SECRET});
  assert.equal(ownSpecs.web.env.CROUPIER_DEALER_SPEECH_PROFILES,'1');
  assert.equal(ownSpecs.web.env.ELEVENLABS_API_KEY,ownProfiles.ELEVENLABS_API_KEY);
  assert.equal(ownSpecs.lab.env.ELEVENLABS_API_KEY,undefined);
  assert.equal(ownSpecs.lab.env.CROUPIER_DEALER_SPEECH_PROFILES,undefined);
  const off={...env,ELEVENLABS_API_KEY:'must-not-leak',ELEVENLABS_VIDEO_KEY:'different-account',ELEVENLABS_OC_API:'different-purpose'};
  const offSpecs=childSpecifications(validateCloudConfig(off),off,{labInternalSecret:LAB_SECRET});
  for(const key of ['ELEVENLABS_API_KEY','ELEVENLABS_VIDEO_KEY','ELEVENLABS_OC_API'])assert.equal(offSpecs.web.env[key],undefined);
  for(const patch of [{CROUPIER_DEALER_SPEECH_PROFILES:'yes'},{CROUPIER_STUDIO_NEON_POLICY:'0'},{CROUPIER_GENERATED_SPEECH_STREAMING:'0'},{ELEVENLABS_API_KEY:'key\r\ninjection'}])assert.throws(()=>validateCloudConfig({...ownProfiles,...patch}));
  assert.equal(specs.web.env.CROUPIER_GENERATED_SPEECH_STREAMING, '1');
  assert.equal(specs.web.env.CROUPIER_SPEECH_STREAM_WORKER_SECRET, env.CROUPIER_SPEECH_STREAM_WORKER_SECRET);
  assert.equal(specs.web.env.CROUPIER_SPEECH_STREAM_TICKET_SECRET, env.CROUPIER_SPEECH_STREAM_TICKET_SECRET);
  assert.equal(specs.web.env.CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD, '0.25');
  assert.equal(specs.web.env.CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD, '9.94');
  for (const name of ['CROUPIER_GENERATED_SPEECH_STREAMING', 'CROUPIER_SPEECH_STREAM_WORKER_SECRET',
    'CROUPIER_SPEECH_STREAM_TICKET_SECRET', 'CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD', 'CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD']) assert.equal(specs.lab.env[name], undefined);
  for (const change of [
    { CROUPIER_GENERATED_SPEECH: '0' }, { CROUPIER_SPEECH_STREAM_WORKER_SECRET: '' },
    { CROUPIER_SPEECH_STREAM_TICKET_SECRET: env.CROUPIER_SPEECH_STREAM_WORKER_SECRET },
  ]) assert.throws(() => validateCloudConfig({ ...env, ...change }));
  for (const value of ['', '0', '-1', '10.01', 'Infinity', '1e-2', ' 0.25', '0.0000001']) {
    assert.throws(() => validateCloudConfig({ ...env, CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD: value }), /CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD/);
  }
  for (const value of ['0.000001', '10']) assert.equal(validateCloudConfig({ ...env, CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD: value, CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD: '10' }).streamSecrets.sessionReserveUsd, value);
  for (const value of ['', '0', '-1', '10.01', 'NaN', '0.20']) {
    assert.throws(() => validateCloudConfig({ ...env, CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD: value }), /CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD/);
  }
});

test('Neon fullfile budget must be explicit and reaches only the Web fullfile child', () => {
  const env={...fixture(),CROUPIER_STUDIO_NEON_POLICY:'1',CROUPIER_GENERATED_SPEECH:'1',CROUPIER_CLOUD_GENERATED_SPEECH:'1',
    CARTESIA_API_KEY:'fixture-cartesia',RUNPOD_API_KEY:'fixture-runpod',CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID:'fixture-endpoint',
    CROUPIER_SPEECH_FULLFILE_RESERVE_USD:'0.50',CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD:'1'};
  const config=validateCloudConfig(env),specs=childSpecifications(config,env,{labInternalSecret:LAB_SECRET});
  assert.deepEqual(config.fullfileBudget,{reserveUsd:'0.50',dailyBudgetUsd:'1'});
  assert.equal(specs.web.env.CROUPIER_SPEECH_FULLFILE_RESERVE_USD,'0.50');
  assert.equal(specs.web.env.CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD,'1');
  for(const name of ['CROUPIER_SPEECH_FULLFILE_RESERVE_USD','CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD'])assert.equal(specs.lab.env[name],undefined);
  for(const value of [undefined,'','0','-1','10.01','1e-2','0.0000001',' 0.5'])
    assert.throws(()=>validateCloudConfig({...env,CROUPIER_SPEECH_FULLFILE_RESERVE_USD:value}),/CROUPIER_SPEECH_FULLFILE_RESERVE_USD/);
  for(const value of [undefined,'','0','0.49','Infinity','1.0000001'])
    assert.throws(()=>validateCloudConfig({...env,CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD:value}),/CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD/);
  assert.equal(validateCloudConfig({...env,CROUPIER_STUDIO_NEON_POLICY:'0',CROUPIER_SPEECH_FULLFILE_RESERVE_USD:''}).fullfileBudget,null);
  const off={...env,CROUPIER_GENERATED_SPEECH:'0',CROUPIER_CLOUD_GENERATED_SPEECH:'0'};
  assert.equal(childSpecifications(validateCloudConfig(off),off,{labInternalSecret:LAB_SECRET}).web.env.CROUPIER_SPEECH_FULLFILE_RESERVE_USD,undefined);
});

test('disk preflight accepts its actual directory despite Windows path casing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-cloud-disk-'));
  try { await inspectCloudDisk(validateCloudConfig({ ...fixture(), CROUPIER_CLOUD_DATA_ROOT: directory })); }
  finally {
    assert.equal(dirname(resolve(directory)).toLowerCase(), resolve(tmpdir()).toLowerCase());
    assert.match(basename(directory), /^croupier-cloud-disk-/);
    await rm(directory, { recursive: true, force: true });
  }
});

test('read-only bootstrap preflight requires credentials until CRAIG has an account', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-cloud-bootstrap-check-'));
  try {
    const env = { ...fixture(), CROUPIER_CLOUD_DATA_ROOT: directory };
    const config = validateCloudConfig(env);
    const dbPath = join(config.paths.players, 'craig.db');
    await assert.rejects(inspectCloudBootstrap(config), /CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER/);
    await assert.rejects(stat(dbPath), { code: 'ENOENT' });
    assert.equal(await inspectCloudBootstrap(validateCloudConfig({ ...env,
      CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER: 'cloudadmin',
      CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD: 'fixture-private-passphrase-2026',
    })), undefined);
    await mkdir(config.paths.players);
    const db = new DatabaseSync(dbPath);
    try {
      db.exec('CREATE TABLE users (username TEXT NOT NULL)');
      await assert.rejects(inspectCloudBootstrap(config), /CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER/);
      db.prepare('INSERT INTO users (username) VALUES (?)').run('cloudadmin');
      assert.equal(await inspectCloudBootstrap(config), undefined);
    } finally { db.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('game Host cannot reach BO routes except the exact public config GET', () => {
  const config = validateCloudConfig(fixture());
  const route = (method, url, headers = {}) => upstreamForRequest({
    method, url, headers: { host: 'game.example.test', ...headers },
  }, config);
  for (const url of ['/', '/v2/', '/api/table', '/api/auth/bo/start']) {
    assert.equal(route('GET', url), 4173, url);
  }
  assert.equal(route('GET', '/api/bo/config'), 4173);
  for (const [method, url] of [
    ['HEAD', '/api/bo/config'], ['POST', '/api/bo/config'],
    ['GET', '/api/bo/config?extra=1'], ['GET', '/api/bo/me'],
    ['GET', '/bo'], ['GET', '/bo/'], ['GET', '/bo/login.html'],
    ['POST', '/api/bo/login'], ['GET', '/api/auth/lab/check'],
    ['GET', '/%62o/login.html'], ['GET', '/bo%2flogin.html'],
    ['GET', '/x/../bo/login.html'], ['GET', '/BO/login.html'],
    ['GET', '/bo./login.html'], ['GET', '/%5cbo%5clogin.html'],
    ['GET', '//bo.example.test/bo/'], ['GET', 'https://bo.example.test/bo/'],
  ]) assert.equal(route(method, url), null, `${method} ${url}`);
  assert.equal(route('GET', '/bo/', { origin: config.boOrigin }), null,
    'a spoofed BO Origin cannot override the game Host');
});

test('BO Host serves BO routes only; Lab handoff routes reach Web but public check is closed', () => {
  const config = validateCloudConfig(fixture());
  const route = (host, method, url) => upstreamForRequest({ headers: { host }, method, url }, config);
  for (const url of ['/bo', '/bo/', '/bo/login.html', '/api/bo/config', '/api/bo/lab-login?state=abc']) {
    assert.equal(route('bo.example.test', 'GET', url), 4173, url);
  }
  for (const url of ['/', '/v2/', '/api/table', '/api/auth/lab/start', '/api/auth/lab/check']) {
    assert.equal(route('bo.example.test', 'GET', url), null, url);
  }
  assert.equal(route('lab.example.test', 'GET', '/'), 4188);
  assert.equal(route('lab.example.test', 'GET', '/_next/static/chunk.js'), 4188);
  assert.equal(route('lab.example.test', 'POST', '/api/project'), 4188);
  assert.equal(route('lab.example.test', 'GET', '/api/auth/lab/start'), 4173);
  assert.equal(route('lab.example.test', 'GET', '/api/auth/lab/callback?state=abc&code=def'), 4173);
  for (const url of ['/api/auth/lab/check', '/%61pi/auth/lab/check', '/%61pi/auth/lab/start']) {
    assert.equal(route('lab.example.test', 'GET', url), null, url);
  }
  assert.equal(route('evil.example.test', 'GET', '/api/bo/config'), null);
  assert.equal(route('game.example.test:443', 'GET', '/'), null);
});

test('proxy keeps the exact public Host and Origin but drops spoofed forwarding and Lab auth', () => {
  const incoming = { host: 'bo.example.test', origin: 'https://evil.example.test',
    forwarded: 'host=evil.example.test;proto=http',
    'x-forwarded-host': 'evil.example.test', 'x-forwarded-proto': 'http',
    'x-forwarded-for': '203.0.113.10', 'x-forwarded-uri': '/api/bo/me',
    'x-croupier-lab-authorized': 'fake-authorization',
    cookie: 'bo_jwt=browser-cookie', connection: 'keep-alive' };
  const headers = proxyHeaders(incoming, incoming.host);
  assert.equal(headers.host, 'bo.example.test');
  assert.equal(headers.origin, 'https://evil.example.test');
  assert.equal(headers.cookie, 'bo_jwt=browser-cookie');
  assert.equal(headers['x-forwarded-host'], 'bo.example.test');
  assert.equal(headers['x-forwarded-proto'], 'https');
  assert.equal(headers['x-forwarded-port'], '443');
  for (const name of ['forwarded', 'x-forwarded-for', 'x-forwarded-uri',
    'x-croupier-lab-authorized', 'connection']) assert.equal(headers[name], undefined, name);
  const config = validateCloudConfig(fixture());
  assert.equal(upstreamForRequest({ headers: { ...incoming, host: 'evil.example.test' },
    method: 'GET', url: '/bo/' }, config), null,
    'neither Origin nor X-Forwarded-Host can substitute for an allowed Host');
});

test('public gateway rejects misdirected requests before contacting a child', async () => {
  const gateway = createCloudGateway(validateCloudConfig(fixture()), { labInternalSecret: LAB_SECRET });
  await new Promise((resolve, reject) => {
    gateway.once('error', reject);
    gateway.listen(0, '127.0.0.1', resolve);
  });
  try {
    const status = (host, path, origin = 'https://bo.example.test') => new Promise((resolve, reject) => {
      const request = httpRequest({ hostname: '127.0.0.1', port: gateway.address().port,
        method: 'GET', path, headers: { Host: host, Origin: origin,
          'X-Forwarded-Host': 'bo.example.test' } }, response => {
        response.resume();
        response.on('end', () => resolve(response.statusCode));
      });
      request.on('error', reject);
      request.end();
    });
    assert.equal(await status('evil.example.test', '/bo/'), 421);
    assert.equal(await status('game.example.test', '/bo/'), 421);
    assert.equal(await status('lab.example.test', '/api/auth/lab/check'), 421);
    assert.equal(await status('evil.example.test', '/__cloud/health'), 421);
    assert.equal(await status('bo.example.test', '/__cloud/health'), 200);
  } finally {
    await new Promise((resolve, reject) => gateway.close(error => error ? reject(error) : resolve()));
  }
});

test('gateway checks every Lab request with Web before adding its private Lab header', async () => {
  const checks = [], labRequests = [], handoffs = [];
  const web = createServer((request, response) => {
    if (request.url === '/api/auth/lab/check') {
      checks.push({ host: request.headers.host, cookie: request.headers.cookie });
      response.writeHead(request.headers.cookie === 'lab_session=valid' ? 200
        : request.headers.cookie === 'lab_session=outage' ? 503 : 401);
    } else {
      handoffs.push({ host: request.headers.host, path: request.url,
        authorized: request.headers['x-croupier-lab-authorized'] });
      response.writeHead(200);
    }
    response.end();
  });
  const lab = createServer((request, response) => {
    labRequests.push({ host: request.headers.host,
      authorized: request.headers['x-croupier-lab-authorized'],
      forwardedHost: request.headers['x-forwarded-host'],
      forwardedProto: request.headers['x-forwarded-proto'] });
    response.writeHead(200);
    response.end();
  });
  web.listen(0, '127.0.0.1'); lab.listen(0, '127.0.0.1');
  await Promise.all([once(web, 'listening'), once(lab, 'listening')]);
  const gateway = createCloudGateway(validateCloudConfig(fixture()), {
    labInternalSecret: LAB_SECRET, webPort: web.address().port, labPort: lab.address().port,
  });
  gateway.listen(0, '127.0.0.1');
  await once(gateway, 'listening');
  const hit = (path, headers = {}) => new Promise((resolve, reject) => {
    const request = httpRequest({ hostname: '127.0.0.1', port: gateway.address().port,
      method: 'GET', path, headers: { Host: 'lab.example.test', ...headers } }, response => {
      response.resume();
      response.on('end', () => resolve({ status: response.statusCode,
        location: response.headers.location }));
    });
    request.on('error', reject);
    request.end();
  });
  try {
    assert.equal((await hit('/api/project')).status, 401);
    assert.equal((await hit('/api/project', {
      'X-Croupier-Lab-Authorized': LAB_SECRET, Cookie: 'lab_session=old',
    })).status, 401, 'browser-supplied internal header never authorizes Lab');
    const document = await hit('/lissabon', {
      'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document',
    });
    assert.equal(document.status, 303);
    assert.equal(document.location, '/api/auth/lab/start?next=%2Flissabon');
    assert.equal((await hit('/api/project', { Cookie: 'lab_session=outage' })).status, 503);
    assert.equal((await hit('/api/auth/lab/start')).status, 200);
    assert.equal((await hit('/api/project', { Cookie: 'lab_session=valid',
      'X-Croupier-Lab-Authorized': 'fake' })).status, 200);
    assert.equal(labRequests.length, 1);
    assert.deepEqual(labRequests[0], { host: 'lab.example.test', authorized: LAB_SECRET,
      forwardedHost: 'lab.example.test', forwardedProto: 'https' });
    assert.deepEqual(handoffs, [{ host: 'lab.example.test', path: '/api/auth/lab/start',
      authorized: undefined }]);
    assert.deepEqual(checks, [
      { host: 'lab.example.test', cookie: 'lab_session=old' },
      { host: 'lab.example.test', cookie: 'lab_session=outage' },
      { host: 'lab.example.test', cookie: 'lab_session=valid' },
    ]);
  } finally {
    await Promise.all([gateway, web, lab].map(server => new Promise(resolve => server.close(resolve))));
  }
});

test('only paired credentials reach the intended child and errors do not echo secret values', () => {
  const env = { ...fixture(), LAB_REMOTE_URL: 'https://director.example.test',
    LAB_REMOTE_TOKEN: 'private-director-token',
    OPENCLAW_PRODUCT_SPEECH_URL: 'https://speech.example.test',
    OPENCLAW_PRODUCT_SPEECH_TOKEN: 'private-speech-token' };
  const specs = childSpecifications(validateCloudConfig(env), env, { labInternalSecret: LAB_SECRET });
  assert.equal(specs.lab.env.LAB_REMOTE_TOKEN, 'private-director-token');
  assert.equal(specs.web.env.LAB_REMOTE_TOKEN, undefined);
  assert.equal(specs.web.env.OPENCLAW_PRODUCT_SPEECH_TOKEN, 'private-speech-token');
  assert.equal(specs.lab.env.OPENCLAW_PRODUCT_SPEECH_TOKEN, undefined);
  assert.throws(() => validateCloudConfig({ ...env, LAB_REMOTE_URL: 'https://private-director-token@director.example.test' }),
    error => !error.message.includes('private-director-token'));
  assert.throws(() => validateCloudConfig({ ...env, LAB_REMOTE_TOKEN: '' }),
    error => !error.message.includes('private-director-token'));
});

test('cloud launch requires an explicit pilot selection, not an auth-ready assertion', () => {
  for (const env of [{}, { CROUPIER_CLOUD_AUTH_READY: '1' },
    { CROUPIER_CLOUD_LAUNCH: 'production' }, { CROUPIER_CLOUD_LAUNCH: '1' }]) {
    assert.throws(() => assertCloudAccessReady(env), /CROUPIER_CLOUD_LAUNCH=pilot/);
  }
  assert.doesNotThrow(() => assertCloudAccessReady({ CROUPIER_CLOUD_LAUNCH: 'pilot' }));
});

test('child shutdown sends TERM once and waits for close', async () => {
  class FakeChild extends EventEmitter {
    pid = 123;
    exitCode = null;
    signalCode = null;
    signals = [];
    kill(signal) {
      this.signals.push(signal);
      queueMicrotask(() => { this.signalCode = signal; this.emit('close', 0, signal); });
      return true;
    }
  }
  const child = new FakeChild();
  await terminateChild(child, 50);
  await terminateChild(child, 50);
  assert.deepEqual(child.signals, ['SIGTERM']);
});

test('explicit child stdout observer handles chunks and drops oversized incomplete lines', () => {
  const stream = new PassThrough(), lines = [];
  observeChildStdout(stream, line => lines.push(line));
  stream.write('first'); stream.write(' line\nsecond\n');
  stream.write('x'.repeat(8193)); stream.write('discarded\nthird\n');
  assert.deepEqual(lines, ['first line', 'second', 'third']);
  const throwing = new PassThrough();
  observeChildStdout(throwing, () => {throw Error('Unavailable diagnostic destination');});
  assert.doesNotThrow(() => throwing.write('ignored\n'));
  assert.doesNotThrow(() => throwing.emit('error', Error('Diagnostic pipe closed')));
  stream.end(); throwing.end();
});

test('process group starts Web then Lab and signals both before waiting, once even on repeated shutdown', async () => {
  const activity = [];
  class FakeChild extends EventEmitter {
    pid = 123;
    exitCode = null;
    signalCode = null;
    constructor(name) { super(); this.name = name; }
    kill(signal) {
      activity.push(`stop:${this.name}:${signal}`);
      if (this.name === 'web') queueMicrotask(() => {
        this.signalCode = signal; this.emit('close', 0, signal);
        lab.signalCode = signal; lab.emit('close', 0, signal);
      });
      return true;
    }
  }
  let lab;
  const specs = childSpecifications(validateCloudConfig(fixture()), fixture(), { labInternalSecret: LAB_SECRET });
  const group = await startChildren(specs, {
    spawnProcess: (_command, _args, options) => {
      assert.equal(options.stdio, 'ignore');
      const name = options.cwd.endsWith('lab') ? 'lab' : 'web';
      activity.push(`start:${name}`);
      const child = new FakeChild(name);
      if (name === 'lab') lab = child;
      return child;
    },
    wait: async () => {},
    portCheck: async () => {},
  });
  await Promise.all([group.stop(), group.stop()]);
  assert.deepEqual(activity, ['start:web', 'start:lab', 'stop:lab:SIGTERM', 'stop:web:SIGTERM']);
});
