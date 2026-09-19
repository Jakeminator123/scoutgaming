import test from 'node:test';
import assert from 'node:assert/strict';
import { gatewayConfig, dashboardOrigin, planGatewayConfig } from './gateway-config.mjs';

const example = {
  OPENCLAWAPI_KEY: 'test-only-gateway-secret',
  OPENCLAW_MODEL_API_KEY: 'test-only-provider-secret',
};

test('an unrelated inherited model key cannot configure the Gateway', () => {
  assert.throws(() => gatewayConfig({ OPENAI_API_KEY: 'inherited-test-only-key' }), /OPENCLAWAPI_KEY/);
  assert.throws(() => gatewayConfig({ OPENCLAWAPI_KEY: example.OPENCLAWAPI_KEY, OPENAI_API_KEY: 'inherited-test-only-key' }), /OPENCLAW_MODEL_API_KEY/);
  assert.throws(() => gatewayConfig({ ...example, OPENCLAW_MODEL_API_KEY: example.OPENCLAWAPI_KEY }), /different/);
});

test('generated configuration refers to secrets without writing their values', () => {
  const config = gatewayConfig(example);
  const serialized = JSON.stringify(config);
  assert.equal(serialized.includes(example.OPENCLAWAPI_KEY), false);
  assert.equal(serialized.includes(example.OPENCLAW_MODEL_API_KEY), false);
  assert.equal(config.gateway.auth.mode, 'password');
  assert.equal(config.gateway.auth.password, '${OPENCLAW_GATEWAY_PASSWORD}');
  assert.equal(config.gateway.auth.token, undefined);
  assert.equal(config.models.providers['lab-provider'].apiKey.id, 'OPENCLAW_MODEL_API_KEY');
});

test('chat cannot gain tools or share the presentation agent workspace', () => {
  const config = gatewayConfig(example);
  const director = config.agents.entries['croupier-director'];
  const chat = config.agents.entries['croupier-chat'];
  assert.notEqual(director.workspace, chat.workspace);
  assert.notEqual(director.agentDir, chat.agentDir);
  const operator = config.agents.entries['croupier-operator'];
  assert.notEqual(operator.workspace, chat.workspace);
  assert.notEqual(operator.agentDir, director.agentDir);
  for (const agent of [director, chat, operator]) {
    assert.deepEqual(agent.tools.deny, ['*']);
    assert.deepEqual(agent.model.fallbacks, []);
    assert.equal(agent.memory.search.enabled, false);
    assert.equal(agent.heartbeat.every, '0m');
  }
  assert.equal(config.tools.deny, undefined);
  assert.equal(config.gateway.controlUi.enabled, false);
  assert.equal(config.gateway.terminal.enabled, false);
  assert.equal(config.cron.enabled, false);
  assert.equal(config.gateway.http.endpoints.chatCompletions.enabled, true);
});

test('native dashboard uses one exact explicit HTTPS origin and no auth bypass', () => {
  const config = gatewayConfig({ ...example, OPENCLAW_DASHBOARD_ORIGIN: 'https://director.example.test/' });
  assert.equal(config.gateway.controlUi.enabled, true);
  assert.equal(config.gateway.controlUi.basePath, '/openclaw');
  assert.deepEqual(config.gateway.controlUi.allowedOrigins, ['https://director.example.test']);
  assert.equal(config.gateway.publicOrigin, 'https://director.example.test');
  assert.equal(config.gateway.controlUi.dangerouslyDisableDeviceAuth, undefined);
  assert.equal(config.gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback, undefined);
  assert.equal(config.gateway.auth.allowTailscale, false);
  assert.deepEqual(config.gateway.auth.rateLimit, {
    maxAttempts: 10, windowMs: 60000, lockoutMs: 300000, exemptLoopback: false,
  });
  assert.equal(dashboardOrigin({}), null);
});

test('malformed, credential-bearing and plaintext public origins fail closed', () => {
  for (const origin of [
    'not-a-url', 'https:director.example.test', 'https://director.example.test/openclaw',
    'http://director.example.test', 'https://user:secret@director.example.test',
    'https://director.example.test?secret=example', 'https://director.example.test/#',
    'https://*.example.test', ' https://director.example.test', '   ',
  ]) {
    assert.throws(() => gatewayConfig({ ...example, OPENCLAW_DASHBOARD_ORIGIN: origin }), /DASHBOARD_ORIGIN/);
  }
});

test('loopback is an explicit local-only opt-in, never an automatic extra origin', () => {
  for (const origin of ['http://127.0.0.1:4188', 'http://localhost:4188', 'https://[::1]:4188']) {
    assert.throws(() => dashboardOrigin({ OPENCLAW_DASHBOARD_ORIGIN: origin }), /loopback/);
    assert.equal(dashboardOrigin({ OPENCLAW_DASHBOARD_ORIGIN: origin, OPENCLAW_DASHBOARD_ALLOW_LOOPBACK: 'true' }), origin);
  }
  assert.throws(() => dashboardOrigin({ OPENCLAW_DASHBOARD_ALLOW_LOOPBACK: 'maybe' }), /true or false/);
  assert.throws(() => dashboardOrigin({ OPENCLAW_DASHBOARD_ORIGIN: 'http://192.168.1.2:4188', OPENCLAW_DASHBOARD_ALLOW_LOOPBACK: 'true' }), /HTTPS/);
});

function legacyConfig(env = example) {
  const config = gatewayConfig(env);
  config.gateway.auth = { mode: 'token', token: '${OPENCLAW_GATEWAY_TOKEN}' };
  config.gateway.controlUi = { enabled: false };
  delete config.gateway.publicOrigin;
  delete config.agents.entries['croupier-operator'];
  config.tools.deny = ['*'];
  return config;
}

test('only the exact old generated configuration receives the legacy migration', () => {
  const legacy = legacyConfig({ ...example, OPENCLAW_MODEL_ID: 'original/model' });
  const before = structuredClone(legacy);
  const result = planGatewayConfig(legacy, { ...example, OPENCLAW_MODEL_ID: 'new/env-default' });
  assert.equal(result.action, 'migrate-legacy');
  assert.deepEqual(legacy, before);
  assert.equal(result.config.models.providers['lab-provider'].models[0].id, 'original/model');
  assert.equal(result.config.agents.entries['croupier-director'].model.primary, 'lab-provider/original/model');
  assert.equal(result.config.gateway.controlUi.enabled, false);
  assert.equal(result.config.tools.deny, undefined);
  assert.deepEqual(result.config.agents.entries['croupier-director'].tools.deny, ['*']);
  assert.deepEqual(result.config.agents.entries['croupier-chat'].tools.deny, ['*']);
  assert.deepEqual(result.config.agents.entries['croupier-operator'].tools.deny, ['*']);

  legacy.agents.entries['croupier-chat'].name = 'Human customized name';
  const custom = planGatewayConfig(legacy, example);
  assert.equal(custom.action, 'reconcile-ingress');
  assert.equal(custom.config.agents.entries['croupier-chat'].name, 'Human customized name');
  assert.equal(custom.config.agents.entries['croupier-operator'], undefined);
  assert.deepEqual(custom.config.tools.deny, ['*']);
});

test('native settings survive restart while removing dashboard opt-in closes ingress', () => {
  const env = { ...example, OPENCLAW_DASHBOARD_ORIGIN: 'https://director.example.test' };
  const config = gatewayConfig(env);
  config.agents.entries['croupier-operator'].tools = { profile: 'minimal', allow: ['session_status'] };
  config.gateway.terminal.enabled = true;
  config.models.providers['lab-provider'].models[0].name = 'Human-edited model label';
  const same = planGatewayConfig(config, env);
  assert.equal(same.action, 'reuse');
  assert.deepEqual(same.config, config);
  const closed = planGatewayConfig(config, example);
  assert.equal(closed.action, 'reconcile-ingress');
  assert.equal(closed.config.gateway.controlUi.enabled, false);
  assert.equal(closed.config.gateway.controlUi.allowedOrigins, undefined);
  assert.deepEqual(closed.config.agents, config.agents);
  assert.deepEqual(closed.config.models, config.models);
  assert.equal(closed.config.gateway.terminal.enabled, true);
});

test('unsafe legacy bypass flags are not silently accepted from a customized config', () => {
  for (const key of ['dangerouslyDisableDeviceAuth', 'dangerouslyAllowHostHeaderOriginFallback', 'allowInsecureAuth']) {
    const config = gatewayConfig(example);
    config.gateway.controlUi[key] = true;
    assert.throws(() => planGatewayConfig(config, example), /unsafe Control UI/);
  }
});

test('provider endpoint rejects accidental plaintext transport or embedded credentials', () => {
  for (const url of ['http://example.com/v1', 'https://secret@example.com/v1', 'https://example.com/v1?key=secret']) {
    assert.throws(() => gatewayConfig({ ...example, OPENCLAW_MODEL_BASE_URL: url }), /HTTPS API base URL/);
  }
  const custom = gatewayConfig({ ...example, OPENCLAW_MODEL_BASE_URL: 'https://models.example.test/v1', OPENCLAW_MODEL_ID: 'approved/model-1', OPENCLAW_MODEL_API: 'openai-completions' });
  assert.equal(custom.models.providers['lab-provider'].baseUrl, 'https://models.example.test/v1');
  assert.equal(custom.agents.entries['croupier-director'].model.primary, 'lab-provider/approved/model-1');
});
