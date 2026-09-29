import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gatewayConfig, dashboardOrigin, planGatewayConfig } from './gateway-config.mjs';

const example = {
  OPENCLAWAPI_KEY: 'test-only-gateway-secret',
  OPENCLAW_MODEL_API_KEY: 'test-only-provider-secret',
};

test('Render blueprint and local env example explicitly seed Terra', async () => {
  const blueprint = await readFile(new URL('../render.yaml', import.meta.url), 'utf8');
  const template = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(blueprint, /key: OPENCLAW_MODEL_ID\s+value: gpt-5\.6-terra\b/);
  assert.match(template, /^OPENCLAW_MODEL_ID=gpt-5\.6-terra\r?$/m);
});

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

test('the seeded provider keeps the approved OpenAI base URL, model and API tuple', () => {
  const config = gatewayConfig(example);
  const provider = config.models.providers['lab-provider'];
  assert.equal(provider.baseUrl, 'https://api.openai.com/v1');
  assert.equal(provider.api, 'openai-responses');
  assert.deepEqual(provider.models.map(model => model.id), ['gpt-5.6-terra','gpt-5.4-mini','gpt-6-luna']);
  for (const agent of Object.values(config.agents.entries)) {
    assert.equal(agent.model.primary, 'lab-provider/gpt-5.6-terra');
    assert.deepEqual(agent.model.fallbacks, []);
  }
});

test('Astrid vision metadata requires an explicit gate and changes only Luna and Terra', () => {
  const config = gatewayConfig(example);
  for (const gate of [undefined, '', '0', 'true']) {
    assert.deepEqual(planGatewayConfig(config, { ...example, CROUPIER_SPEECH_VISION: gate }), { action: 'reuse', config });
  }
  const planned = planGatewayConfig(config, { ...example, CROUPIER_SPEECH_VISION: '1' });
  const expected = structuredClone(config);
  for (const id of ['gpt-6-luna', 'gpt-5.6-terra']) expected.models.providers['lab-provider'].models.find(model => model.id === id).input = ['text', 'image'];
  assert.deepEqual(planned, { action: 'reconcile-speech', config: expected });
  assert.deepEqual(config.models.providers['lab-provider'].models.map(model => model.input),
    [['text'], ['text'], ['text']], 'planning does not mutate saved configuration');
  assert.deepEqual(planGatewayConfig(planned.config, { ...example, CROUPIER_SPEECH_VISION: '1' }),
    { action: 'reuse', config: expected }, 'reconciliation is idempotent');
});

test('vision opt-in preserves human model metadata, other providers and role configuration', () => {
  const env = { ...example, CROUPIER_SPEECH_VISION: '1', OPENCLAW_MODEL_API: 'openai-completions',
    OPENCLAW_DASHBOARD_ORIGIN: 'https://director.example.test' };
  const config = gatewayConfig({ ...env, CROUPIER_SPEECH_VISION: '0' });
  const provider = config.models.providers['lab-provider'];
  Object.assign(provider.models.find(model => model.id === 'gpt-6-luna'), { name: 'Custom Luna label', input: ['image', 'text'], contextWindow: 100000 });
  provider.models.find(model => model.id === 'gpt-5.6-terra').name = 'Custom Terra label';
  provider.models.push({ id: 'custom-model', name: 'Other model', input: ['text'] });
  config.models.providers['human-provider'] = { ...structuredClone(provider), baseUrl: 'https://models.example.test/v1' };
  const before = structuredClone(config);
  const expected = structuredClone(config);
  expected.models.providers['lab-provider'].models.find(model => model.id === 'gpt-5.6-terra').input = ['text', 'image'];
  assert.deepEqual(planGatewayConfig(config, env), { action: 'reconcile-speech', config: expected });
  assert.deepEqual(config, before);
});

test('vision opt-in never changes a custom provider origin or non-OpenAI API', () => {
  for (const change of [
    { baseUrl: 'https://models.example.test/v1' },
    { baseUrl: 'https://api.openai.com/v1/proxy' },
    { api: 'anthropic-messages' },
    { api: 'google-generative-ai' },
  ]) {
    const config = gatewayConfig(example);
    Object.assign(config.models.providers['lab-provider'], change);
    assert.deepEqual(planGatewayConfig(config, { ...example, CROUPIER_SPEECH_VISION: '1' }), { action: 'reuse', config });
  }
});

test('chat cannot gain tools or share the presentation agent workspace', () => {
  const config = gatewayConfig(example);
  const director = config.agents.entries['croupier-director'];
  const chat = config.agents.entries['croupier-chat'];
  assert.notEqual(director.workspace, chat.workspace);
  assert.notEqual(director.agentDir, chat.agentDir);
  const operator = config.agents.entries['croupier-operator'];
  const social = config.agents.entries['croupier-social'];
  const speech = config.agents.entries['croupier-speech'];
  assert.notEqual(operator.workspace, chat.workspace);
  assert.notEqual(operator.agentDir, director.agentDir);
  assert.notEqual(social.workspace, chat.workspace);
  assert.notEqual(social.agentDir, operator.agentDir);
  assert.notEqual(speech.workspace, chat.workspace);
  assert.notEqual(speech.agentDir, director.agentDir);
  for (const agent of [director, chat, operator, social, speech]) {
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
  delete config.agents.entries['croupier-social'];
  delete config.agents.entries['croupier-speech'];
  delete config.agents.defaults;
  delete config.talk;
  config.tools.deny = ['*'];
  config.models.providers['lab-provider'].models=config.models.providers['lab-provider'].models.slice(0,1);
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
  assert.deepEqual(result.config.agents.entries['croupier-speech'].tools.deny, ['*']);

  legacy.agents.entries['croupier-chat'].name = 'Human customized name';
  const custom = planGatewayConfig(legacy, example);
  assert.equal(custom.action, 'reconcile-roles');
  assert.equal(custom.config.agents.entries['croupier-chat'].name, 'Human customized name');
  assert.equal(custom.config.agents.entries['croupier-operator'], undefined);
  assert.deepEqual(custom.config.tools.deny, ['*']);
});

test('social role reconciliation is additive and reuses the persisted model, not a new env default', () => {
  const config = gatewayConfig(example);
  delete config.agents.entries['croupier-social'];
  config.agents.entries['croupier-chat'].model.primary = 'custom-provider/existing-model';
  config.agents.entries['croupier-speech'].model.primary = 'custom-provider/existing-model';
  config.agents.entries['croupier-operator'].name = 'Human operator';
  const before = structuredClone(config);
  const result = planGatewayConfig(config, { ...example, OPENCLAW_MODEL_ID: 'different-env-default' });
  assert.equal(result.action, 'reconcile-social');
  assert.deepEqual(config, before);
  const social = result.config.agents.entries['croupier-social'];
  assert.equal(social.model.primary, 'custom-provider/existing-model');
  assert.deepEqual(social.tools.deny, ['*']);
  const withoutSocial = structuredClone(result.config);
  delete withoutSocial.agents.entries['croupier-social'];
  assert.deepEqual(withoutSocial, before);
  social.name = 'Own Astrid name';
  social.model.primary = 'custom-provider/social-model';
  assert.deepEqual(planGatewayConfig(result.config, example), { action: 'reuse', config: result.config });
});

test('speech role reconciliation is additive, isolated, tool-denied and preserves operator-chat meaning', () => {
  const config = gatewayConfig(example);
  const chatBefore = structuredClone(config.agents.entries['croupier-chat']);
  delete config.agents.entries['croupier-speech'];
  config.agents.entries['croupier-chat'].model.primary = 'custom-provider/existing-model';
  const result = planGatewayConfig(config, { ...example, OPENCLAW_MODEL_ID: 'different-env-default' });
  assert.equal(result.action, 'reconcile-speech');
  const speech = result.config.agents.entries['croupier-speech'];
  assert.equal(speech.model.primary, 'custom-provider/existing-model');
  assert.deepEqual(speech.model.fallbacks, []);
  assert.deepEqual(speech.tools, { profile: 'minimal', deny: ['*'], elevated: { enabled: false } });
  assert.notEqual(speech.workspace, result.config.agents.entries['croupier-chat'].workspace);
  assert.notEqual(speech.agentDir, result.config.agents.entries['croupier-chat'].agentDir);
  assert.deepEqual({ ...result.config.agents.entries['croupier-chat'], model: chatBefore.model }, chatBefore);
});

test('speech role rejects model, tool or state-sharing drift without rewriting it', () => {
  for (const edit of [
    config => { config.agents.entries['croupier-speech'].model.primary = 'other/provider'; },
    config => { config.agents.entries['croupier-speech'].model.fallbacks = ['other/fallback']; },
    config => { config.agents.entries['croupier-speech'].tools.deny = []; },
    config => { config.agents.entries['croupier-speech'].workspace = config.agents.entries['croupier-chat'].workspace; },
  ]) {
    const config = gatewayConfig(example); edit(config);
    const original = structuredClone(config);
    assert.throws(() => planGatewayConfig(config, example), /speech role conflict/);
    assert.deepEqual(config, original);
  }
});

test('conflicting social tools or shared state are rejected without overwriting custom config', () => {
  for (const edit of [
    config => { config.agents.entries['croupier-social'].tools.deny = []; },
    config => { config.agents.entries['croupier-social'].workspace = config.agents.entries['croupier-chat'].workspace; },
    config => { config.agents.entries['croupier-social'].agentDir = config.agents.entries['croupier-operator'].agentDir; },
    config => { config.agents.entries['croupier-social'].memory.search.enabled = true; },
  ]) {
    const config = gatewayConfig(example); edit(config);
    const original = structuredClone(config);
    assert.throws(() => planGatewayConfig(config, example), /social role conflict/);
    assert.deepEqual(config, original);
  }
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

test('missing system and Talk owners are filled without enabling tools or jobs', () => {
  const config = gatewayConfig(example);
  delete config.agents.defaults;
  delete config.talk;
  const before = structuredClone(config);
  const result = planGatewayConfig(config, example);
  assert.equal(result.action, 'reconcile-ownership');
  assert.deepEqual(config, before);
  assert.equal(result.config.agents.defaults.systemAgent.agentId, 'croupier-operator');
  assert.equal(result.config.talk.agentId, 'croupier-operator');
  assert.equal(result.config.cron.enabled, false);
  assert.deepEqual(result.config.tools, config.tools);
  assert.deepEqual(result.config.agents.entries, config.agents.entries);
  assert.equal(planGatewayConfig(result.config, example).action, 'reuse');
});

test('explicit human ownership and other Talk settings survive restarts', () => {
  const config = gatewayConfig(example);
  config.agents.defaults.systemAgent.agentId = 'croupier-chat';
  config.talk = { agentId: 'croupier-director', interruptOnSpeech: false };
  assert.deepEqual(planGatewayConfig(config, example), { action: 'reuse', config });
  delete config.agents.entries['croupier-operator'];
  delete config.agents.defaults;
  delete config.talk;
  assert.deepEqual(planGatewayConfig(config, example), { action: 'reuse', config });
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
