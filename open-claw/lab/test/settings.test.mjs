import test from 'node:test';
import assert from 'node:assert/strict';
import { readSettings } from '../src/settings.mjs';
import { speechRoutingConfiguration } from '../src/speech-routing.mjs';

test('adaptive speech settings are opt-in and do not change other role deadlines', () => {
  const fixed = readSettings({ env: { OPENCLAW_TIMEOUT_MS: '8000' }, envFiles: [] });
  assert.equal(fixed.speechRouting, 'fixed'); assert.equal(fixed.speechDeepModel, 'gpt-6-sol');
  assert.equal(fixed.speechTimeoutMs, undefined); assert.equal(fixed.adviceTimeoutMs, 8000);
  assert.equal(speechRoutingConfiguration(fixed, 'astrid').adaptive, false);
  const adaptive = readSettings({ env: { OPENCLAW_TIMEOUT_MS: '8000', OPENCLAW_SPEECH_ROUTING: 'adaptive',
    OPENCLAW_SPEECH_DEEP_MODEL: 'gpt-6-sol', OPENCLAW_SPEECH_TIMEOUT_MS: '20000' }, envFiles: [] });
  assert.equal(adaptive.adviceTimeoutMs, 8000); assert.equal(adaptive.speechTimeoutMs, 20000);
  assert.equal(speechRoutingConfiguration(adaptive, 'astrid').adaptive, true);
  assert.equal(speechRoutingConfiguration(adaptive, 'vera').adaptive, false);
});

test('invalid speech timeout or routing never silently widens or enables provider calls', () => {
  for (const value of ['', 'NaN', 'Infinity', '-1', '49', '999', '30001', '2.5']) {
    const parsed = readSettings({ env: { OPENCLAW_SPEECH_TIMEOUT_MS: value }, envFiles: [] });
    assert.throws(() => speechRoutingConfiguration(parsed, 'astrid'), { code: 'product_speech_routing_not_configured' });
  }
  for (const value of ['1000', '30000']) {
    assert.equal(speechRoutingConfiguration(readSettings({ env: { OPENCLAW_SPEECH_TIMEOUT_MS: value }, envFiles: [] }), 'astrid').timeoutMs, Number(value));
  }
  assert.equal(speechRoutingConfiguration({ adviceTimeoutMs: 50 }, 'astrid').timeoutMs, 50);
  assert.throws(() => speechRoutingConfiguration(readSettings({ env: { OPENCLAW_SPEECH_ROUTING: 'true' }, envFiles: [] }), 'astrid'),
    { code: 'product_speech_routing_not_configured' });
});
