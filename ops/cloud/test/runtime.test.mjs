import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { Agent, createServer, request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { childSpecifications, inspectCloudBootstrap, inspectCloudDisk, validateCloudConfig } from '../config.mjs';
import { createCloudGateway, proxyHeaders, upstreamForHost, upstreamForRequest } from '../gateway.mjs';
import { startChildren, terminateChild, observeChildStdout, closeGateway } from '../process-group.mjs';
import { PassThrough } from 'node:stream';
import { assertCloudAccessReady, main, openCheckedGateway } from '../start.mjs';

const fixture = () => ({
  NODE_ENV: 'production', PORT: '10000',
  CROUPIER_DATABASE:'postgres', CROUPIER_GAME_DATABASE_URL:'postgresql://game:fixture-password@game.neon.tech/game?sslmode=require',
  CROUPIER_STUDIO_NEON_POLICY:'1', CROUPIER_STUDIO_ENVIRONMENT_ID:'production', CROUPIER_STUDIO_WORKSPACE_ID:'croupier',
  CROUPIER_MEDIA_STORAGE:'blob', BLOB_READ_WRITE_TOKEN:'fixture-private-blob-token',
  CROUPIER_CLOUD_DATA_ROOT: join(tmpdir(), 'croupier-cloud-test-volume'),
  PUBLIC_URL: 'https://game.example.test', BO_URL: 'https://bo.example.test',
  LAB_PUBLIC_URL: 'https://lab.example.test',
  CROUPIER_GAME_ORIGIN: 'https://game.example.test',
  BETTALOTTO_PARTNER_BASE_URL: 'https://game.example.test',
  CROUPIER_STREAM_LANE: 'lissabon-stream-lane',
  OPENCLAW_PRODUCT_SPEECH_URL: 'https://speech.example.test',
  OPENCLAW_PRODUCT_SPEECH_TOKEN: 'fixture-product-speech-token',
});

test('retired QA switches cannot activate cloud routes or forward private SDK credentials', () => {
  for (const key of ['CROUPIER_P6_QA_ROUTER', 'CROUPIER_P6_BOUNDED_TEST']) {
    for (const value of ['1', 'true', '0 ', 'false']) {
      assert.throws(() => validateCloudConfig({ ...fixture(), [key]: value }), /retired/);
    }
    for (const value of [undefined, '', '0']) {
      const env = { ...fixture(), [key]: value, CROUPIER_P6_SDK_WORKER_TOKEN: 'unused-fixture-private-token',
        CROUPIER_P6_SDK_OPENAI_API_KEY: 'unused-fixture-provider-token' };
      const specs = childSpecifications(validateCloudConfig(env), env);
      for (const child of Object.values(specs)) {
        assert.equal(Object.keys(child.env).some(name => name.startsWith('CROUPIER_P6_')), false);
      }
      assert.deepEqual(Object.keys(specs), ['web']);
    }
  }
});

test('chat deadline reaches only the product relay and does not extend Director advice', () => {
  const env = { ...fixture(), OPENCLAW_TIMEOUT_MS: '8000', OPENCLAW_SPEECH_TIMEOUT_MS: '20000',
    OPENCLAW_SPEECH_ROUTING: 'adaptive', OPENCLAW_SPEECH_DEEP_MODEL: 'gpt-6-sol' };
  const specs = childSpecifications(validateCloudConfig(env), env);
  assert.equal(specs.web.env.OPENCLAW_SPEECH_TIMEOUT_MS, '20000');
  assert.equal(specs.web.env.OPENCLAW_TIMEOUT_MS, '8000');
  for (const name of ['OPENCLAW_SPEECH_ROUTING', 'OPENCLAW_SPEECH_DEEP_MODEL']) {
    assert.equal(specs.web.env[name], undefined, 'routing policy belongs to the Director');
  }
  assert.equal(validateCloudConfig(fixture()).speechTimeoutMs, 8000);
  for (const value of ['', '0', '999', '30001', 'NaN', '20000.5']) {
    assert.throws(() => validateCloudConfig({ ...fixture(), OPENCLAW_SPEECH_TIMEOUT_MS: value }), /OPENCLAW_SPEECH_TIMEOUT_MS/);
  }
});

test('private media credentials reach only the game and zones credentials stay outside it', () => {
  const env = { ...fixture(), CROUPIER_MEDIA_STORAGE: 'blob', BLOB_READ_WRITE_TOKEN: 'fixture-private-blob-token',
    CROUPIER_ZONES_DATABASE_URL: 'postgresql://zones:fixture-password@zones.neon.tech/neondb?sslmode=require',
    DATABASE_URL: 'postgresql://game:never-forward@game.example/game', NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN: 'never-forward' };
  const specs = childSpecifications(validateCloudConfig(env), env);
  for (const server of Object.values(specs)) {
    assert.equal(server.env.CROUPIER_MEDIA_STORAGE, 'blob');
    assert.equal(server.env.BLOB_READ_WRITE_TOKEN, env.BLOB_READ_WRITE_TOKEN);
    assert.equal(server.env.DATABASE_URL, undefined);
    assert.equal(server.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN, undefined);
  }
  assert.equal(specs.web.env.CROUPIER_ZONES_DATABASE_URL, undefined);
  assert.throws(()=>validateCloudConfig({...fixture(),CROUPIER_MEDIA_STORAGE:'disk',BLOB_READ_WRITE_TOKEN:'staged-not-active'}));
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
    const specs = childSpecifications(validateCloudConfig(env), env);
    assert.equal(specs.web.env.CROUPIER_PLAYER_ACCOUNTS, value === '1' ? '1' : '');
  }
  assert.throws(() => validateCloudConfig({ ...fixture(), CROUPIER_PLAYER_ACCOUNTS: 'yes' }));
});

test('shared tables reach the game process only through the validated cloud flag', () => {
  const name = 'CROUPIER_SHARED_TABLE_ENABLED';
  for (const value of [undefined, '0', '1']) {
    const env = { ...fixture(), ...(value === undefined ? {} : { [name]: value }) };
    const config = validateCloudConfig(env);
    // A later raw environment cannot turn on a feature validated as disabled.
    const specs = childSpecifications(config, { ...env, [name]: value === '1' ? '0' : '1' });
    const received = execFileSync(specs.web.command, ['-e',
      `process.stdout.write(JSON.stringify(process.env.${name} ?? null))`],
    { cwd: specs.web.cwd, env: specs.web.env, encoding: 'utf8', windowsHide: true, timeout: 10000 });
    assert.equal(JSON.parse(received), value === '1' ? '1' : '0');
  }
  for (const value of ['', 'true', 'false', '01', '1 ', '2', true]) {
    assert.throws(() => validateCloudConfig({ ...fixture(), [name]: value }), /CROUPIER_SHARED_TABLE_ENABLED/);
  }
  for (const change of [{ CROUPIER_DATABASE: 'sqlite', CROUPIER_GAME_DATABASE_URL: undefined },
    { CROUPIER_STUDIO_NEON_POLICY: '0' }, { CROUPIER_STUDIO_ENVIRONMENT_ID: '' }]) {
    assert.throws(() => validateCloudConfig({ ...fixture(), ...change, [name]: '1' }));
  }
});

test('one exact Vercel frontend origin is opt-in and reaches only Web', () => {
  const name = 'CROUPIER_VERCEL_FRONTEND_ORIGIN';
  const disabled = childSpecifications(validateCloudConfig(fixture()), fixture());
  assert.equal(disabled.web.env[name], '');
  const origin = 'https://preview.example.vercel.app';
  const env = { ...fixture(), [name]: origin };
  const config = validateCloudConfig(env);
  const specs = childSpecifications(config, env);
  assert.equal(config.frontendOrigin, origin);
  assert.equal(specs.web.env[name], origin);
  for (const bad of ['https://*.vercel.app', 'http://preview.example.vercel.app',
    'https://preview.example.vercel.app/', 'https://preview.example.vercel.app/path',
    'https://preview.example.vercel.app:443', 'https://user@preview.example.vercel.app',
    env.PUBLIC_URL, env.BO_URL, env.LAB_PUBLIC_URL]) {
    assert.throws(() => validateCloudConfig({ ...env, [name]: bad }), name);
  }
});

test('exact public origins share one gateway and one game process', () => {
  const env = fixture();
  const config = validateCloudConfig(env);
  const specs = childSpecifications(config, { PATH: '/usr/bin', UNRELATED_SECRET: 'never-forward' });
  assert.equal(upstreamForHost('game.example.test', config), 4173);
  assert.equal(upstreamForHost('bo.example.test', config), 4173);
  assert.equal(upstreamForHost('lab.example.test', config), null);
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
  }
  assert.equal(specs.web.env.CROUPIER_DATA_DIR, undefined);
  assert.equal(specs.web.env.CROUPIER_CLOUD_RUNTIME, '1');
  assert.equal(specs.web.env.OPENCLAW_TIMEOUT_MS, '8000');
  assert.equal(specs.web.env.UNRELATED_SECRET, undefined);
  assert.equal(specs.web.env.DEMO_GUEST_ACCESS, '');
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
    CROUPIER_MEDIA_STORAGE:'blob', BLOB_READ_WRITE_TOKEN:'fixture-private-blob-token' };
  delete env.CROUPIER_CLOUD_DATA_ROOT;
  const config = validateCloudConfig(env);
  assert.equal(config.dataRoot, null); assert.deepEqual(config.paths, {});
  await assert.doesNotReject(inspectCloudDisk(config));
  const specs = childSpecifications(config, env);
  for (const name of ['CROUPIER_DATA_DIR','LAB_STUDIO_DATA_DIR','CROUPIER_PRESENTATION_STUDIO_DIR','CROUPIER_GENERATIONS_DIR','CROUPIER_GENERATED_SPEECH_DIR']) {
    assert.equal(specs.web.env[name], undefined);
  }
  assert.equal(specs.web.env.BO_URL, config.boOrigin);
  for(const server of Object.values(specs))assert.equal(server.env.CROUPIER_MEDIA_BLOB_INDEX,undefined);
  const obsolete={...env,CROUPIER_MEDIA_BLOB_INDEX:join(tmpdir(),'ignored-retired-index.json')};
  assert.equal(childSpecifications(validateCloudConfig(obsolete),obsolete).web.env.CROUPIER_MEDIA_BLOB_INDEX,undefined);
  for (const patch of [{CROUPIER_MEDIA_STORAGE:'disk'},{CROUPIER_STUDIO_NEON_POLICY:'0'},
    {CROUPIER_STUDIO_ENVIRONMENT_ID:''},{CROUPIER_STUDIO_WORKSPACE_ID:''},{CROUPIER_DATABASE:'sqlite'},
    {BLOB_READ_WRITE_TOKEN:''},{CROUPIER_CLOUD_DATA_ROOT:''}]) {
    assert.throws(() => validateCloudConfig({...env,...patch}));
    assert.throws(() => validateCloudConfig({...fixture(),...patch}),'a volume cannot enable the retired cloud fallback');
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
    CROUPIER_SPEECH_FULLFILE_RESERVE_USD:'0.5', CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD:'1',
    AMBIENT_SECRET: 'do-not-forward',
  };
  const specs = childSpecifications(validateCloudConfig(env), env);
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
  const inactive = childSpecifications(validateCloudConfig(fixture()), fixture());
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
  const specs = childSpecifications(config, env);
  assert.equal(config.streaming, true);
  const ownProfiles={...env,CROUPIER_DEALER_SPEECH_PROFILES:'1',CROUPIER_STUDIO_NEON_POLICY:'1',ELEVENLABS_API_KEY:'fixture-own-voice-key'};
  const ownSpecs=childSpecifications(validateCloudConfig(ownProfiles),ownProfiles);
  assert.equal(ownSpecs.web.env.CROUPIER_DEALER_SPEECH_PROFILES,'1');
  assert.equal(ownSpecs.web.env.ELEVENLABS_API_KEY,ownProfiles.ELEVENLABS_API_KEY);
  const off={...env,ELEVENLABS_API_KEY:'must-not-leak',ELEVENLABS_VIDEO_KEY:'different-account',ELEVENLABS_OC_API:'different-purpose'};
  const offSpecs=childSpecifications(validateCloudConfig(off),off);
  for(const key of ['ELEVENLABS_API_KEY','ELEVENLABS_VIDEO_KEY','ELEVENLABS_OC_API'])assert.equal(offSpecs.web.env[key],undefined);
  for(const patch of [{CROUPIER_DEALER_SPEECH_PROFILES:'yes'},{CROUPIER_STUDIO_NEON_POLICY:'0'},{CROUPIER_GENERATED_SPEECH_STREAMING:'0'},{ELEVENLABS_API_KEY:'key\r\ninjection'}])assert.throws(()=>validateCloudConfig({...ownProfiles,...patch}));
  assert.equal(specs.web.env.CROUPIER_GENERATED_SPEECH_STREAMING, '1');
  assert.equal(specs.web.env.CROUPIER_SPEECH_STREAM_WORKER_SECRET, env.CROUPIER_SPEECH_STREAM_WORKER_SECRET);
  assert.equal(specs.web.env.CROUPIER_SPEECH_STREAM_TICKET_SECRET, env.CROUPIER_SPEECH_STREAM_TICKET_SECRET);
  assert.equal(specs.web.env.CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD, '0.25');
  assert.equal(specs.web.env.CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD, '9.94');
  for (const change of [
    { CROUPIER_GENERATED_SPEECH: '0' }, { CROUPIER_SPEECH_STREAM_WORKER_SECRET: '' },
    { CROUPIER_SPEECH_STREAM_TICKET_SECRET: env.CROUPIER_SPEECH_STREAM_WORKER_SECRET },
  ]) assert.throws(() => validateCloudConfig({ ...env, ...change }));
  for (const value of ['', '0', '-1', '10.01', 'Infinity', '1e-2', ' 0.25', '0.0000001']) {
    assert.throws(() => validateCloudConfig({ ...env, CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD: value }), /CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD/);
  }
  for (const value of ['0.000001', '10']) assert.equal(validateCloudConfig({ ...env, CROUPIER_SPEECH_RUNPOD_SESSION_RESERVE_USD: value, CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD: '10' }).streamSecrets.sessionReserveUsd, value);
  for(const value of ['10.01','20']) assert.equal(validateCloudConfig({...env,CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD:value}).streamSecrets.dailyBudgetUsd,value);
  for (const value of ['', '0', '-1', '20.000001', 'NaN', '0.20']) {
    assert.throws(() => validateCloudConfig({ ...env, CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD: value }), /CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD/);
  }
});

test('Neon fullfile budget must be explicit and reaches only the Web fullfile child', () => {
  const env={...fixture(),CROUPIER_STUDIO_NEON_POLICY:'1',CROUPIER_GENERATED_SPEECH:'1',CROUPIER_CLOUD_GENERATED_SPEECH:'1',
    CARTESIA_API_KEY:'fixture-cartesia',RUNPOD_API_KEY:'fixture-runpod',CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID:'fixture-endpoint',
    CROUPIER_SPEECH_FULLFILE_RESERVE_USD:'0.50',CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD:'1'};
  const config=validateCloudConfig(env),specs=childSpecifications(config,env);
  assert.deepEqual(config.fullfileBudget,{reserveUsd:'0.50',dailyBudgetUsd:'1'});
  assert.throws(() => validateCloudConfig({ ...env, OPENCLAW_PRODUCT_SPEECH_URL: '', OPENCLAW_PRODUCT_SPEECH_TOKEN: '' }),
    /OPENCLAW_PRODUCT_SPEECH_URL/);
  assert.equal(specs.web.env.CROUPIER_SPEECH_FULLFILE_RESERVE_USD,'0.50');
  assert.equal(specs.web.env.CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD,'1');
  for(const value of [undefined,'','0','-1','10.01','1e-2','0.0000001',' 0.5'])
    assert.throws(()=>validateCloudConfig({...env,CROUPIER_SPEECH_FULLFILE_RESERVE_USD:value}),/CROUPIER_SPEECH_FULLFILE_RESERVE_USD/);
  assert.equal(validateCloudConfig({...env,CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD:'20'}).fullfileBudget.dailyBudgetUsd,'20');
  for(const value of [undefined,'','0','0.49','20.000001','Infinity','1.0000001'])
    assert.throws(()=>validateCloudConfig({...env,CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD:value}),/CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD/);
  assert.throws(()=>validateCloudConfig({...env,CROUPIER_STUDIO_NEON_POLICY:'0',CROUPIER_SPEECH_FULLFILE_RESERVE_USD:''}),/CROUPIER_STUDIO_NEON_POLICY/);
  const off={...env,CROUPIER_GENERATED_SPEECH:'0',CROUPIER_CLOUD_GENERATED_SPEECH:'0'};
  assert.equal(childSpecifications(validateCloudConfig(off),off).web.env.CROUPIER_SPEECH_FULLFILE_RESERVE_USD,undefined);
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
    // Isolated read-only SQLite migration preflight, never a cloud-start config.
    const config = {database:'sqlite',dataRoot:directory,paths:{players:join(directory,'players')}};
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
  assert.equal(route('lab.example.test', 'GET', '/'), null);
  assert.equal(route('lab.example.test', 'GET', '/_next/static/chunk.js'), null);
  assert.equal(route('lab.example.test', 'POST', '/api/project'), null);
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
  const gateway = createCloudGateway(validateCloudConfig(fixture()));
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

test('gateway correlates only exact health/version probes across its real listener lifecycle',
  { timeout:5000 }, async t => {
  const origin = 'https://preview.example.test', transportOrigin = 'https://isolated.onrender.com';
  const ingress = { publicOrigin:origin, transportOrigin, secret:'fixture-private-ingress-'.repeat(3) };
  const config = { ...validateCloudConfig(fixture()), singleOrigin:true, gameOrigin:origin, boOrigin:origin,
    labOrigin:origin, publicPort:0, vercelIngress:ingress };
  const events = [], instanceId = 'srv-fixture-instance', sha = 'a'.repeat(40);
  let observerFails = false;
  const options = { renderInstanceId:instanceId, renderGitCommit:sha,
    onGatewayDiagnostic:event => {
      events.push(structuredClone(event));
      if (observerFails) throw Error('fixture-observer-failed');
    } };
  const gateway = createCloudGateway(config, options);
  t.after(() => closeGateway(gateway, 100));
  options.renderInstanceId = 'must-not-replace-snapshot';
  options.renderGitCommit = 'b'.repeat(40);
  const get = ({ path='/__cloud/health', method='GET', headers={} }={}) => new Promise((resolve, reject) => {
    const request = httpRequest({ hostname:'127.0.0.1', port:gateway.address().port, path, method, agent:false,
      headers:{ host:new URL(transportOrigin).host, ...headers } }, response => {
      response.resume(); response.on('error', reject);
      response.on('end', () => resolve({status:response.statusCode, headers:response.headers}));
    });
    request.on('error', reject); request.end();
  });
  const preflightId = '714d2a35-5552-45b1', publicId = '8a74dfd0-6154-4ab8-9c12-0123456789ab';
  await openCheckedGateway(gateway, config, { checkAccess:async () => {
    assert.equal((await get({headers:{'rndr-id':preflightId}})).status, 200);
  } });
  assert.deepEqual(events.filter(e => e.event === 'cloud_gateway_lifecycle').map(e => [e.phase, e.listenerId]),
    [['listening',1], ['draining',1], ['closed',1], ['listening',2]]);
  assert.deepEqual(events.filter(e => e.phase === 'listening').map(e => e.binding.address), ['127.0.0.1','0.0.0.0']);
  assert.ok(events.filter(e => e.phase === 'listening').every(e => e.binding.port > 0));
  const privateHeaders = { cookie:'fixture-private-cookie', authorization:'Bearer fixture-private-token',
    'x-render-instance-id':'fixture-private-spoof', 'x-croupier-vercel-secret':'fixture-private-secret' };
  const version = await get({path:'/__cloud/version', method:'HEAD', headers:{...privateHeaders, 'rndr-id':publicId}});
  assert.equal(version.status, 200);
  assert.equal(version.headers['cache-control'], 'no-store');
  assert.equal(version.headers['rndr-id'], undefined, 'diagnostics do not reflect input into responses');
  assert.equal((await get({headers:{host:'evil.example.test', 'rndr-id':'360af8ff-80b9-4df9'}})).status, 421);
  for (const rawId of ['fixture-private-id', `${preflightId}, ${preflightId}`, 'f'.repeat(500)]) {
    assert.equal((await get({headers:{...privateHeaders, 'rndr-id':rawId}})).status, 200);
  }
  const beforeExcluded = events.length;
  assert.equal((await get({path:'/__cloud/health?token=fixture-private-query', headers:privateHeaders})).status, 421);
  assert.equal((await get({path:'/api/table?token=fixture-private-query', headers:privateHeaders})).status, 421);
  assert.equal(events.length, beforeExcluded, 'no arbitrary API, query or credential logging');
  observerFails = true;
  assert.equal((await get()).status, 200, 'a failed log sink cannot fail health');
  observerFails = false;
  // Fault-inject a peer closing before the response is handed to the OS.
  const abortedId = '9f003b7e-de24-4e22';
  gateway.prependOnceListener('request', (_incoming, outgoing) => outgoing.destroy());
  await assert.rejects(get({headers:{'rndr-id':abortedId}}), {code:'ECONNRESET'});
  await closeGateway(gateway, 100);
  const requests = events.filter(e => e.event === 'cloud_gateway_request');
  const received = requests.filter(e => e.phase === 'received');
  assert.equal(received.length, 8);
  for (const start of received) {
    const terminal = requests.filter(e => e.requestNumber === start.requestNumber && e.phase !== 'received');
    assert.equal(terminal.length, 1, 'finish followed by close must not duplicate completion');
    assert.equal(terminal[0].requestId, start.requestId);
    assert.equal(terminal[0].listenerId, start.listenerId);
    assert.ok(Number.isFinite(terminal[0].durationMs) && terminal[0].durationMs >= 0);
  }
  assert.equal(requests.find(e => e.requestId === preflightId).listenerId, 1);
  assert.equal(requests.find(e => e.requestId === publicId).listenerId, 2);
  assert.equal(requests.find(e => e.requestId === abortedId && e.phase !== 'received').phase, 'closed');
  assert.equal(requests.find(e => e.requestId === '360af8ff-80b9-4df9' && e.phase !== 'received').status, 421);
  assert.equal(received.filter(e => e.requestId === null).length, 4, 'unknown or duplicate IDs are omitted');
  assert.ok(events.every(e => e.instanceId === instanceId && e.commitSha === sha));
  assert.equal(new Set(events.map(e => e.runtimeId)).size, 1);
  assert.match(events[0].runtimeId, /^[a-f0-9-]{36}$/);
  assert.ok(events.every(e => Number.isFinite(Date.parse(e.at))));
  assert.equal(JSON.stringify(events).includes('fixture-private'), false);
  assert.deepEqual(events.slice(-2).map(e => e.phase), ['draining','closed']);
});

test('gateway diagnostics omit malformed deployment metadata and record version unavailability', async t => {
  const events = [];
  const gateway = createCloudGateway(validateCloudConfig(fixture()), {
    renderInstanceId:'private=invalid\ninstance', renderGitCommit:'private-invalid-sha',
    onGatewayDiagnostic:event => events.push(event),
  });
  t.after(() => closeGateway(gateway, 100));
  gateway.listen(0, '127.0.0.1'); await once(gateway, 'listening');
  const status = await new Promise((resolve, reject) => {
    const request = httpRequest({ hostname:'127.0.0.1', port:gateway.address().port,
      path:'/__cloud/version', headers:{host:'game.example.test'}, agent:false }, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject); request.end();
  });
  assert.equal(status, 503);
  assert.equal(events.find(e => e.phase === 'finished').status, 503);
  assert.ok(events.every(e => e.instanceId === null && e.commitSha === null));
  assert.equal(JSON.stringify(events).includes('private'), false);
});

test('checked gateway reopens authorized room sockets and still drains them on shutdown',
  { timeout: 5000 }, async t => {
  const {WebSocket, WebSocketServer} = createRequire(new URL('../../../services/astrid-gpu-worker/gateway/package.json', import.meta.url))('ws');
  const origin = 'https://preview.example.test', transportOrigin = 'https://isolated.onrender.com';
  const ingress = { publicOrigin:origin, transportOrigin, secret:'fixture-private-ingress-'.repeat(3) };
  const config = { ...validateCloudConfig(fixture()), singleOrigin:true, gameOrigin:origin, boOrigin:origin,
    labOrigin:origin, publicPort:0, vercelIngress:ingress };
  const web = createServer((request, response) => {
    response.writeHead(request.url === '/api/bo/speech-qa' ? 403 : 401); response.end();
  });
  const room = new WebSocketServer({ noServer:true }), clients = [];
  let gateway, admitted = 0;
  web.on('upgrade', (request, socket, head) => {
    if (request.url !== '/shared-room/fixture-room' || request.headers.cookie !== 'player=owner') {
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); return;
    }
    assert.equal(request.headers.host, new URL(origin).host);
    assert.equal(request.headers.origin, origin);
    assert.equal(request.headers['x-croupier-vercel-secret'], undefined);
    room.handleUpgrade(request, socket, head, ws => {
      admitted++; ws.on('message', data => ws.send(data));
    });
  });
  t.after(async () => {
    clients.forEach(ws => ws.terminate()); room.clients.forEach(ws => ws.terminate()); room.close();
    await closeGateway(gateway, 100);
    web.closeAllConnections(); await new Promise(resolve => web.close(resolve));
  });
  web.listen(0, '127.0.0.1'); await once(web, 'listening');
  gateway = createCloudGateway(config, { webPort:web.address().port,
    sessionCheck:async () => ({ authorized:false, available:true }) });
  const addresses = [];
  gateway.on('listening', () => addresses.push(gateway.address().address));
  // Exercise the real startup sequence, including all actual access probes,
  // the loopback close, and reopening the same server on the public listener.
  await openCheckedGateway(gateway, config);
  assert.deepEqual(addresses, ['127.0.0.1', '0.0.0.0']);
  const connect = (changes={}) => {
    const ws = new WebSocket(`ws://127.0.0.1:${gateway.address().port}/shared-room/fixture-room`, {
      headers:{ host:new URL(transportOrigin).host, origin, cookie:'player=owner',
        'x-croupier-vercel-secret':ingress.secret, 'x-croupier-public-origin':origin,
        'x-forwarded-host':new URL(origin).host, 'x-forwarded-proto':'https', ...changes } });
    clients.push(ws); ws.on('error', () => {}); return ws;
  };
  const client = connect(); await once(client, 'open');
  const echoed = once(client, 'message'); client.send('authorized-after-preflight');
  assert.equal((await echoed)[0].toString(), 'authorized-after-preflight');
  const rejected = ws => new Promise(resolve => ws.once('error', error => resolve(error.message)));
  assert.match(await rejected(connect({'x-croupier-vercel-secret':'incorrect'})), /421/);
  assert.match(await rejected(connect({origin:'https://evil.example.test'})), /421/);
  assert.match(await rejected(connect({cookie:'player=other'})), /401/);
  assert.equal(admitted, 1, 'reopening must not bypass transport or child session checks');
  const clientClosed = once(client, 'close');
  await closeGateway(gateway, 200); await clientClosed;
  assert.equal(gateway.listening, false);
  assert.equal(client.readyState, WebSocket.CLOSED);
});

test('gateway preserves an idle proxy connection beyond the Node default without widening ingress',
  { timeout: 15000 }, async t => {
  const origin = 'https://preview.example.test', transportOrigin = 'https://isolated.onrender.com';
  const ingress = { publicOrigin:origin, transportOrigin, secret:'fixture-private-ingress-'.repeat(3) };
  const config = { ...validateCloudConfig(fixture()), singleOrigin:true, gameOrigin:origin, boOrigin:origin,
    labOrigin:origin, vercelIngress:ingress };
  const gateway = createCloudGateway(config);
  // Model a proxy whose own idle lifetime outlasts Node's former 5s + 1s buffer.
  // Otherwise the client's Keep-Alive hint handling could hide a server close.
  const agent = new class extends Agent {
    keepSocketAlive(socket) {
      const keep = super.keepSocketAlive(socket);
      socket.setTimeout(0);
      return keep;
    }
  }({ keepAlive:true, maxSockets:1 });
  t.after(async () => {
    agent.destroy(); gateway.closeAllConnections();
    await new Promise((resolve, reject) => gateway.close(error => error ? reject(error) : resolve()));
  });
  gateway.listen(0, '127.0.0.1'); await once(gateway, 'listening');
  const get = (path='/__cloud/health', host=new URL(transportOrigin).host) => new Promise((resolve, reject) => {
    const request = httpRequest({ hostname:'127.0.0.1', port:gateway.address().port, path,
      agent, headers:{ host } }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('error', reject);
      response.on('end', () => resolve({ status:response.statusCode, body, socket:request.socket,
        reused:request.reusedSocket, keepAlive:response.headers['keep-alive'] }));
    });
    request.on('error', reject);
    request.setTimeout(2000, () => request.destroy(Error('gateway request timed out')));
    request.end();
  });
  const first = await get();
  assert.equal(first.status, 200); assert.equal(first.body, 'ok');
  await new Promise(resolve => setTimeout(resolve, 6500));
  assert.equal(first.socket.destroyed, false, 'gateway must retain the idle proxy connection');
  const second = await get();
  assert.equal(second.status, 200); assert.equal(second.body, 'ok');
  assert.equal(second.reused, true); assert.equal(second.socket, first.socket);
  assert.match(first.keepAlive, /(?:^|,\s*)timeout=120(?:,|$)/);
  assert.equal((await get('/__cloud/health', 'evil.example.test')).status, 421);
  assert.equal((await get('/api/table')).status, 421, 'persistent transport still requires signed ingress');
  assert.equal(gateway.headersTimeout, 120000, 'header parsing retains a finite deadline');
  assert.equal(gateway.requestTimeout, 0, 'existing streaming request policy is unchanged');
});

test('retired provider and playback routes cannot bypass authenticated Vercel ingress', async t => {
  let forwarded = 0;
  const child = createServer((req, res) => { forwarded++; res.end('unexpected upstream'); });
  child.listen(0, '127.0.0.1'); await once(child, 'listening');
  t.after(() => { child.closeAllConnections(); child.close(); });
  const origin = 'https://preview.example.test', transportOrigin = 'https://isolated.onrender.com';
  const ingress = { publicOrigin:origin, transportOrigin, secret:'fixture-private-ingress-'.repeat(3) };
  const config = { ...validateCloudConfig(fixture()), singleOrigin:true, gameOrigin:origin, boOrigin:origin,
    labOrigin:origin, vercelIngress:ingress };
  const gateway = createCloudGateway(config, { webPort:child.address().port,
    sessionCheck:() => assert.fail('retired route cannot acquire Lab access') });
  gateway.listen(0, '127.0.0.1'); await once(gateway, 'listening');
  t.after(() => { gateway.closeAllConnections(); gateway.close(); });
  const status = (path, headers, method) => new Promise((resolve, reject) => {
    const request = httpRequest({ hostname:'127.0.0.1', port:gateway.address().port, method, path,
      headers:{ host:new URL(transportOrigin).host, ...headers } }, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    }); request.on('error', reject); request.end();
  });
  const authenticated = { origin, 'x-croupier-vercel-secret':ingress.secret, 'x-croupier-public-origin':origin,
    'x-forwarded-host':new URL(origin).host, 'x-forwarded-proto':'https' };
  for (const path of ['/api/product/speech', '/api/studio/advice', '/internal/p6/qa-routing', '/api/presentation/native-p6-playback-context']) {
    for (const method of ['GET', 'POST']) {
      assert.equal(await status(path, { authorization:'Bearer unused-fixture-token' }, method), 421, path);
      assert.equal(await status(path, authenticated, method), 421, path);
    }
  }
  assert.equal(await status('/__cloud/health', {}, 'GET'), 200);
  assert.equal(forwarded, 0);
});

test('retired Studio credentials stay outside the game and active relay credentials remain validated', () => {
  const env = { ...fixture(), LAB_REMOTE_URL: 'https://director.example.test',
    LAB_REMOTE_TOKEN: 'private-director-token',
    OPENCLAW_PRODUCT_SPEECH_URL: 'https://speech.example.test',
    OPENCLAW_PRODUCT_SPEECH_TOKEN: 'private-speech-token' };
  const specs = childSpecifications(validateCloudConfig(env), env);
  assert.equal(specs.web.env.LAB_REMOTE_TOKEN, undefined);
  assert.equal(specs.web.env.OPENCLAW_PRODUCT_SPEECH_TOKEN, 'private-speech-token');
  assert.throws(() => validateCloudConfig({ ...env, OPENCLAW_PRODUCT_SPEECH_URL: 'https://private-speech-token@speech.example.test' }),
    error => !error.message.includes('private-speech-token'));
  assert.throws(() => validateCloudConfig({ ...env, OPENCLAW_PRODUCT_SPEECH_TOKEN: '' }),
    error => !error.message.includes('private-speech-token'));
});

test('cloud game without AI does not require a relay, but partial or active AI configuration fails closed', () => {
  const env = fixture();
  delete env.OPENCLAW_PRODUCT_SPEECH_URL;
  delete env.OPENCLAW_PRODUCT_SPEECH_TOKEN;
  const config = validateCloudConfig(env);
  assert.deepEqual(config.productSpeech, { url: '', token: '' });
  const specs = childSpecifications(config, env);
  assert.deepEqual(Object.keys(specs), ['web']);
  assert.equal(specs.web.env.OPENCLAW_PRODUCT_SPEECH_URL, '');
  assert.equal(specs.web.env.OPENCLAW_PRODUCT_SPEECH_TOKEN, '');
  assert.equal(specs.web.env.OPENCLAW_BASE_URL, undefined);
  assert.equal(specs.web.env.OPENCLAW_API_KEY, undefined);
  for (const change of [
    { OPENCLAW_PRODUCT_SPEECH_URL: 'https://speech.example.test' },
    { OPENCLAW_PRODUCT_SPEECH_TOKEN: 'unused-fixture-token' },
    { CROUPIER_ASTRID_CAMERA: '1', CROUPIER_ASTRID_TRANSLATION_KEY: 'unused-camera-key' },
  ]) assert.throws(() => validateCloudConfig({ ...env, ...change }), /OPENCLAW_PRODUCT_SPEECH_URL/);
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

test('Cloud always starts one game child; retired activation is rejected and no Next build is needed', async () => {
  const gameOnly = { ...fixture(), CROUPIER_CLOUD_LAB_CHILD: '0',
    CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER: 'fixture-admin', CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD: 'fixture-bootstrap-password' };
  delete gameOnly.CROUPIER_CLOUD_DATA_ROOT; // Mountless Neon/Blob like production.
  const config = validateCloudConfig(gameOnly);
  for (const value of [undefined, '', '0']) {
    const allowed = { ...fixture(), CROUPIER_CLOUD_LAB_CHILD:value };
    assert.deepEqual(Object.keys(childSpecifications(validateCloudConfig(allowed), allowed)), ['web']);
  }
  for (const value of ['1', '0 ', 'off', 'false', 'no']) assert.throws(() => validateCloudConfig({ ...fixture(), CROUPIER_CLOUD_LAB_CHILD: value }), /CROUPIER_CLOUD_LAB_CHILD/);
  const specs = childSpecifications(config, gameOnly);
  assert.deepEqual(Object.keys(specs), ['web']);
  assert.equal(specs.web.env.CROUPIER_CLOUD_RUNTIME, '1');
  assert.equal(specs.web.env.CROUPIER_CLOUD_LAYOUT, 'separate-hosts');
  assert.equal(specs.web.env.CROUPIER_LAB_INTERNAL_SECRET, undefined);
  assert.equal(specs.web.env.CROUPIER_CLOUD_LAB_CHILD, undefined, 'the switch is a launcher setting, not a game setting');
  const activity = [];
  const group = await startChildren(specs, {
    spawnProcess: (_command, _args, options) => {
      activity.push(`start:${options.cwd.endsWith('studio') ? 'lab' : 'web'}`);
      const child = Object.assign(new EventEmitter(), { pid: 321, exitCode: null, signalCode: null,
        kill(signal) { activity.push(`stop:${signal}`); queueMicrotask(() => { child.signalCode = signal; child.emit('exit', null, signal); child.emit('close', null, signal); }); return true; } });
      return child;
    },
    wait: async (_child, url) => { activity.push(`wait:${new URL(url).port}`); },
    portCheck: async ports => { activity.push(`ports:${ports.join(',')}`); },
  });
  assert.equal(Object.hasOwn(group, 'lab'), false);
  await Promise.all([group.stop(), group.stop()]);
  assert.deepEqual(activity, ['ports:4173', 'start:web', 'wait:4173', 'stop:SIGTERM']);
  assert.equal(await group.ended, 'web-exit');
  // Read-only --check succeeds without apps/studio/.next: no disk, database or Lab build is read.
  assert.equal(await main(['--check'], gameOnly), 0);
});

test('single-child startup rejects extra processes and cleans up failed readiness or cancellation', async () => {
  for (const failure of ['extra-child', 'already-aborted', 'aborted-during-port', 'readiness', 'aborted-after-wait', 'exited']) {
    const activity = [], controller = new AbortController();
    const specs = childSpecifications(validateCloudConfig(fixture()), fixture());
    if (failure === 'extra-child') specs.lab = { command:'must-not-start' };
    if (failure === 'already-aborted') controller.abort();
    let child;
    await assert.rejects(startChildren(specs, { signal:controller.signal,
      portCheck:async () => { activity.push('port'); if (failure === 'aborted-during-port') controller.abort(); },
      spawnProcess:() => {
        activity.push('spawn'); child = Object.assign(new EventEmitter(), { pid:321, exitCode:null, signalCode:null,
          kill(signal) { activity.push(signal); queueMicrotask(() => { child.signalCode=signal; child.emit('close', null, signal); }); return true; } });
        return child;
      },
      wait:async () => {
        if (failure === 'readiness') throw new Error('readiness rejected');
        if (failure === 'aborted-after-wait') controller.abort();
        if (failure === 'exited') { child.exitCode=1; child.emit('exit', 1); child.emit('close', 1); }
      },
    }), /only the game child|interrupted|readiness/);
    assert.deepEqual(activity, ['extra-child','already-aborted'].includes(failure) ? []
      : failure === 'aborted-during-port' ? ['port'] : failure === 'exited' ? ['port','spawn'] : ['port','spawn','SIGTERM'], failure);
  }
});
