import test from 'node:test';
import assert from 'node:assert/strict';
import { gatewayConfig } from './gateway-config.mjs';

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
  assert.equal(config.gateway.auth.mode, 'token');
  assert.equal(config.gateway.auth.token, '${OPENCLAW_GATEWAY_TOKEN}');
  assert.equal(config.models.providers['lab-provider'].apiKey.id, 'OPENCLAW_MODEL_API_KEY');
});

test('chat cannot gain tools or share the presentation agent workspace', () => {
  const config = gatewayConfig(example);
  const director = config.agents.entries['croupier-director'];
  const chat = config.agents.entries['croupier-chat'];
  assert.notEqual(director.workspace, chat.workspace);
  assert.notEqual(director.agentDir, chat.agentDir);
  for (const agent of [director, chat]) {
    assert.deepEqual(agent.tools.deny, ['*']);
    assert.deepEqual(agent.model.fallbacks, []);
    assert.equal(agent.memory.search.enabled, false);
    assert.equal(agent.heartbeat.every, '0m');
  }
  assert.deepEqual(config.tools.deny, ['*']);
  assert.equal(config.gateway.controlUi.enabled, false);
  assert.equal(config.gateway.terminal.enabled, false);
  assert.equal(config.cron.enabled, false);
  assert.equal(config.gateway.http.endpoints.chatCompletions.enabled, true);
});

test('provider endpoint rejects accidental plaintext transport or embedded credentials', () => {
  for (const url of ['http://example.com/v1', 'https://secret@example.com/v1', 'https://example.com/v1?key=secret']) {
    assert.throws(() => gatewayConfig({ ...example, OPENCLAW_MODEL_BASE_URL: url }), /HTTPS API base URL/);
  }
  const custom = gatewayConfig({ ...example, OPENCLAW_MODEL_BASE_URL: 'https://models.example.test/v1', OPENCLAW_MODEL_ID: 'approved/model-1', OPENCLAW_MODEL_API: 'openai-completions' });
  assert.equal(custom.models.providers['lab-provider'].baseUrl, 'https://models.example.test/v1');
  assert.equal(custom.agents.entries['croupier-director'].model.primary, 'lab-provider/approved/model-1');
});
