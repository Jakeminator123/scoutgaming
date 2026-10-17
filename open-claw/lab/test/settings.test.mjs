import test from 'node:test';
import assert from 'node:assert/strict';
import { readSettings, LAB_ROOT } from '../src/settings.mjs';
import { speechRoutingConfiguration } from '../../../packages/director/speech-routing.mjs';
import { readSettings as readStudioSettings } from '../../../lab/lib/director-settings.mjs';
import { readSettings as readGameSettings } from '../../../web/director-settings.mjs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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

test('app-owned settings keep ordered file/env precedence, empty aliases and the established data root', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'croupier-director-settings-'));
  t.after(() => rm(directory, { recursive:true, force:true }));
  const first = join(directory, 'first.env'), later = join(directory, 'later.env');
  await writeFile(first, 'OPENCLAW_API_KEY=synthetic-first\nOPENCLAW_TIMEOUT_MS=8000\nUNRELATED_CREDENTIAL=synthetic-unrelated\n');
  await writeFile(later, 'OPENCLAWAPI_KEY=synthetic-later\nOPENCLAW_CHAT_AGENT=fixture-chat\n');
  const readers = [readSettings, readStudioSettings, readGameSettings];
  for (const env of [{}, {OPENCLAWAPI_KEY:'synthetic-env'}, {OPENCLAW_API_KEY:'', OPENCLAWAPI_KEY:'ignored-alias'},
    {OPENCLAW_API_KEY:undefined, OPENCLAWAPI_KEY:''}, {OPENCLAW_API_KEY:null, OPENCLAWAPI_KEY:'synthetic-nullish'},
    {LAB_DATA_DIR:'relative-fixture-data', OPENCLAW_TIMEOUT_MS:'NaN', LAB_COMPANION_ENABLED:'false'}]) {
    const options = {env, envFiles:[first, join(directory, 'absent.env'), later]};
    const expectedKey = env.OPENCLAW_API_KEY !== undefined || env.OPENCLAWAPI_KEY !== undefined
      ? (env.OPENCLAW_API_KEY ?? env.OPENCLAWAPI_KEY) || '' : 'synthetic-later';
    for (const read of readers) {
      const settings = read(options);
      assert.deepEqual(settings, readSettings(options));
      assert.equal(settings.gatewayKey, expectedKey);
      assert.equal(settings.chatAgent, 'fixture-chat');
      assert.equal(settings.dataDir, resolve(env.LAB_DATA_DIR || resolve(LAB_ROOT, 'data')));
      assert.equal(Object.hasOwn(settings, 'UNRELATED_CREDENTIAL'), false);
    }
  }
  for (const read of readers) {
    assert.equal(read({env:{}, envFiles:[later, first]}).gatewayKey, 'synthetic-first');
    const defaults = read({env:{}, envFiles:[]});
    assert.equal(defaults.dataDir, resolve(LAB_ROOT, 'data'));
    assert.equal(defaults.host, '127.0.0.1'); assert.equal(defaults.port, 4188);
    assert.equal(defaults.adviceTimeoutMs, 2500); assert.equal(defaults.speechTimeoutMs, undefined);
    assert.equal(defaults.speechRouting, 'fixed'); assert.equal(defaults.speechDeepModel, 'gpt-6-sol');
    assert.throws(() => read({env:{}, envFiles:[directory]}), /Could not parse lab environment file/);
  }
});
