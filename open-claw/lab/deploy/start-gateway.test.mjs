import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gatewayConfig } from './gateway-config.mjs';
import { gatewayEnvironment, parseGatewayConfig, prepareGatewayConfig } from './start-gateway.mjs';

const example = { OPENCLAWAPI_KEY: 'test-only-gateway-secret', OPENCLAW_MODEL_API_KEY: 'test-only-provider-secret' };

async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'croupier-gateway-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return { ...example, OPENCLAW_STATE_DIR: dir, OPENCLAW_CONFIG_PATH: path.join(dir, 'openclaw.json') };
}

async function validateFixture(configPath, env) {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  assert.equal(config.gateway.auth.mode, 'password');
  assert.equal(config.gateway.auth.password, '${OPENCLAW_GATEWAY_PASSWORD}');
  assert.equal(env.OPENCLAW_GATEWAY_PASSWORD, example.OPENCLAWAPI_KEY);
  assert.equal(env.OPENCLAW_GATEWAY_TOKEN, undefined);
  assert.equal(env.OPENCLAW_CONFIG_READONLY, undefined);
}

test('startup maps the one secret to native password auth and removes retired read-only/token defaults', async (t) => {
  const env = await fixture(t);
  const child = gatewayEnvironment({ ...env, OPENCLAW_GATEWAY_TOKEN: 'stale-test-key', OPENCLAW_CONFIG_READONLY: '1' });
  assert.equal(child.OPENCLAW_GATEWAY_PASSWORD, example.OPENCLAWAPI_KEY);
  assert.equal(child.OPENCLAW_GATEWAY_TOKEN, undefined);
  assert.equal(child.OPENCLAW_CONFIG_READONLY, undefined);
  assert.throws(() => gatewayEnvironment({ ...env, OPENCLAW_CONFIG_PATH: path.join(env.OPENCLAW_STATE_DIR, '..', 'outside.json') }), /inside/);
});

test('first start seeds once; a native settings edit and its raw formatting survive the next start', async (t) => {
  const env = await fixture(t);
  const first = await prepareGatewayConfig(env, { validateConfig: validateFixture });
  assert.equal(first.action, 'seed');
  const saved = JSON.parse(await readFile(first.configPath, 'utf8'));
  saved.agents.entries['croupier-operator'].name = 'My real OpenClaw operator';
  saved.agents.entries['croupier-operator'].tools = { profile: 'minimal', allow: ['session_status'] };
  const edited = JSON.stringify(saved);
  await writeFile(first.configPath, edited);
  const next = await prepareGatewayConfig({ ...env, OPENCLAW_MODEL_ID: 'ignored-new-seed-default' }, { validateConfig: validateFixture });
  assert.equal(next.action, 'reuse');
  assert.equal(await readFile(first.configPath, 'utf8'), edited);
  assert.equal((await readdir(env.OPENCLAW_STATE_DIR)).some((name) => name.endsWith('.tmp')), false);
});

test('exact legacy migration keeps a private backup and does not alter workspace/session state', async (t) => {
  const env = await fixture(t);
  const old = gatewayConfig(env);
  old.gateway.auth = { mode: 'token', token: '${OPENCLAW_GATEWAY_TOKEN}' };
  old.gateway.controlUi = { enabled: false };
  delete old.agents.entries['croupier-operator'];
  delete old.agents.entries['croupier-social'];
  delete old.agents.entries['croupier-speech'];
  delete old.agents.defaults;
  delete old.talk;
  old.tools.deny = ['*'];
  const original = `${JSON.stringify(old, null, 2)}\n`;
  await writeFile(env.OPENCLAW_CONFIG_PATH, original);
  const retainedDir = path.join(env.OPENCLAW_STATE_DIR, 'agents', 'croupier-chat', 'sessions');
  await mkdir(retainedDir, { recursive: true });
  const retainedFile = path.join(retainedDir, 'test-session.json');
  await writeFile(retainedFile, 'existing-session-state');
  const result = await prepareGatewayConfig(env, { validateConfig: validateFixture });
  assert.equal(result.action, 'migrate-legacy');
  assert.equal(await readFile(result.backupPath, 'utf8'), original);
  assert.equal(await readFile(retainedFile, 'utf8'), 'existing-session-state');
  assert.equal(result.config.gateway.controlUi.enabled, false);
  assert.equal((await prepareGatewayConfig(env, { validateConfig: validateFixture })).action, 'reuse');
});

test('adding explicit ownership backs up native config and preserves human tool/model choices', async (t) => {
  const env = await fixture(t);
  const existing = gatewayConfig(env);
  delete existing.agents.defaults;
  delete existing.talk;
  existing.agents.entries['croupier-operator'].tools = { profile: 'minimal', allow: ['session_status'] };
  const original = JSON.stringify(existing);
  await writeFile(env.OPENCLAW_CONFIG_PATH, original);
  const result = await prepareGatewayConfig(env, { validateConfig: validateFixture });
  assert.equal(result.action, 'reconcile-ownership');
  assert.equal(await readFile(result.backupPath, 'utf8'), original);
  assert.ok(result.backupPath.endsWith('.pre-ownership-migration.bak'));
  assert.deepEqual(result.config.agents.entries, existing.agents.entries);
  assert.deepEqual(result.config.models, existing.models);
  assert.equal((await prepareGatewayConfig(env, { validateConfig: validateFixture })).action, 'reuse');
});

test('adding the social role preserves existing agents and retains the pre-social config', async (t) => {
  const env = await fixture(t);
  const existing = gatewayConfig(env);
  delete existing.agents.entries['croupier-social'];
  existing.agents.entries['croupier-chat'].name = 'Hand-edited lab chat';
  const original = JSON.stringify(existing);
  await writeFile(env.OPENCLAW_CONFIG_PATH, original);
  const result = await prepareGatewayConfig(env, { validateConfig: validateFixture });
  assert.equal(result.action, 'reconcile-social');
  assert.ok(result.backupPath.endsWith('.pre-social-migration.bak'));
  assert.equal(await readFile(result.backupPath, 'utf8'), original);
  for (const [id, agent] of Object.entries(existing.agents.entries)) assert.deepEqual(result.config.agents.entries[id], agent);
  assert.deepEqual(result.config.models, existing.models);
  assert.equal((await prepareGatewayConfig(env, { validateConfig: validateFixture })).action, 'reuse');
});

test('adding the speech role preserves operator chat and retains the pre-speech config', async (t) => {
  const env = await fixture(t);
  const existing = gatewayConfig(env);
  delete existing.agents.entries['croupier-speech'];
  existing.agents.entries['croupier-chat'].name = 'Hand-edited lab chat';
  const original = JSON.stringify(existing);
  await writeFile(env.OPENCLAW_CONFIG_PATH, original);
  const result = await prepareGatewayConfig(env, { validateConfig: validateFixture });
  assert.equal(result.action, 'reconcile-speech');
  assert.ok(result.backupPath.endsWith('.pre-speech-migration.bak'));
  assert.equal(await readFile(result.backupPath, 'utf8'), original);
  assert.deepEqual(result.config.agents.entries['croupier-chat'], existing.agents.entries['croupier-chat']);
  assert.deepEqual(result.config.models, existing.models);
  assert.deepEqual(result.config.agents.entries['croupier-speech'].tools.deny, ['*']);
  assert.equal((await prepareGatewayConfig(env, { validateConfig: validateFixture })).action, 'reuse');
});

test('social role conflicts leave saved config byte-for-byte unchanged', async (t) => {
  const env = await fixture(t);
  const existing = gatewayConfig(env);
  existing.agents.entries['croupier-social'].tools = { allow: ['exec'] };
  const original = JSON.stringify(existing);
  await writeFile(env.OPENCLAW_CONFIG_PATH, original);
  await assert.rejects(prepareGatewayConfig(env, { validateConfig: validateFixture }), /social role conflict/);
  assert.equal(await readFile(env.OPENCLAW_CONFIG_PATH, 'utf8'), original);
});

test('enabling and disabling the explicit dashboard origin changes only ingress policy', async (t) => {
  const env = await fixture(t);
  await prepareGatewayConfig(env, { validateConfig: validateFixture });
  const before = JSON.parse(await readFile(env.OPENCLAW_CONFIG_PATH, 'utf8'));
  before.agents.entries['croupier-chat'].name = 'Preserved name';
  await writeFile(env.OPENCLAW_CONFIG_PATH, JSON.stringify(before));
  const enabled = await prepareGatewayConfig({ ...env, OPENCLAW_DASHBOARD_ORIGIN: 'https://director.example.test' }, { validateConfig: validateFixture });
  assert.equal(enabled.action, 'reconcile-ingress');
  assert.equal(enabled.config.gateway.controlUi.enabled, true);
  assert.deepEqual(enabled.config.agents, before.agents);
  const disabled = await prepareGatewayConfig(env, { validateConfig: validateFixture });
  assert.equal(disabled.config.gateway.controlUi.enabled, false);
  assert.deepEqual(disabled.config.agents, before.agents);
});

test('a failed native CLI validation never replaces persisted configuration', async (t) => {
  const env = await fixture(t);
  await prepareGatewayConfig(env, { validateConfig: validateFixture });
  const before = await readFile(env.OPENCLAW_CONFIG_PATH, 'utf8');
  await assert.rejects(prepareGatewayConfig({ ...env, OPENCLAW_DASHBOARD_ORIGIN: 'https://director.example.test' }, {
    validateConfig: async () => { throw new Error('test validation rejected'); },
  }), /validation rejected/);
  assert.equal(await readFile(env.OPENCLAW_CONFIG_PATH, 'utf8'), before);
  assert.equal((await readdir(env.OPENCLAW_STATE_DIR)).some((name) => name.endsWith('.tmp')), false);
});

test('invalid persisted config or origin is never reset to a seed', async (t) => {
  const env = await fixture(t);
  const broken = '{ broken native configuration';
  await writeFile(env.OPENCLAW_CONFIG_PATH, broken);
  await assert.rejects(prepareGatewayConfig(env, { validateConfig: validateFixture }), /could not be parsed/);
  await assert.rejects(prepareGatewayConfig({ ...env, OPENCLAW_DASHBOARD_ORIGIN: 'http://public.example.test' }, { validateConfig: validateFixture }), /HTTPS/);
  assert.equal(await readFile(env.OPENCLAW_CONFIG_PATH, 'utf8'), broken);
  assert.deepEqual(await readdir(env.OPENCLAW_STATE_DIR), ['openclaw.json']);
  await writeFile(env.OPENCLAW_CONFIG_PATH, 'null');
  await assert.rejects(prepareGatewayConfig(env, { validateConfig: validateFixture }), /cannot be null/);
});

test('native JSON5 can be parsed by the bundled-parser seam without rewriting untouched content', async (t) => {
  const env = await fixture(t);
  const config = gatewayConfig(env);
  const raw = `// retained native operator comment\n${JSON.stringify(config)}`;
  await writeFile(env.OPENCLAW_CONFIG_PATH, raw);
  let parsed = false;
  const result = await prepareGatewayConfig(env, {
    parseConfig: (text) => { assert.equal(text, raw); parsed = true; return config; },
    validateConfig: async (file) => assert.equal(await readFile(file, 'utf8'), raw),
  });
  assert.equal(parsed, true);
  assert.equal(result.action, 'reuse');
  assert.equal(await readFile(env.OPENCLAW_CONFIG_PATH, 'utf8'), raw);
  assert.deepEqual(parseGatewayConfig('{"valid":"json"}'), { valid: 'json' });
});

test('a concurrent config writer is not overwritten during initial seeding', async (t) => {
  const env = await fixture(t);
  await assert.rejects(prepareGatewayConfig(env, {
    validateConfig: async () => { await writeFile(env.OPENCLAW_CONFIG_PATH, 'other-writer'); },
  }), { code: 'EEXIST' });
  assert.equal(await readFile(env.OPENCLAW_CONFIG_PATH, 'utf8'), 'other-writer');
});
