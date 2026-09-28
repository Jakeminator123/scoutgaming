import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { childSpecifications, validateCloudConfig } from '../config.mjs';
import { upstreamForHost } from '../gateway.mjs';
import { startChildren, terminateChild } from '../process-group.mjs';
import { assertCloudAccessReady } from '../start.mjs';

const fixture = () => ({
  NODE_ENV: 'production', PORT: '10000',
  CROUPIER_CLOUD_DATA_ROOT: join(tmpdir(), 'croupier-cloud-test-volume'),
  PUBLIC_URL: 'https://game.example.test', BO_URL: 'https://game.example.test',
  LAB_PUBLIC_URL: 'https://lab.example.test',
  CROUPIER_GAME_ORIGIN: 'https://game.example.test',
  BETTALOTTO_PARTNER_BASE_URL: 'https://game.example.test',
  CROUPIER_STREAM_LANE: 'lissabon-stream-lane',
});

test('exact public origins and one external port define two loopback children', () => {
  const env = fixture();
  const config = validateCloudConfig(env);
  const specs = childSpecifications(config, { PATH: '/usr/bin', UNRELATED_SECRET: 'never-forward' });
  assert.equal(upstreamForHost('game.example.test', config), 4173);
  assert.equal(upstreamForHost('lab.example.test', config), 4188);
  assert.equal(upstreamForHost('evil.example.test', config), null);
  assert.equal(upstreamForHost('game.example.test:443', config), null);
  assert.equal(specs.web.env.HOST, '127.0.0.1');
  assert.equal(specs.lab.env.LAB_STUDIO_DATA_DIR, specs.web.env.CROUPIER_PRESENTATION_STUDIO_DIR);
  assert.equal(specs.web.env.CROUPIER_DATA_DIR, join(config.dataRoot, 'players'));
  assert.equal(specs.web.env.UNRELATED_SECRET, undefined);
  assert.equal(specs.lab.env.UNRELATED_SECRET, undefined);
  assert.equal(specs.web.env.DEMO_GUEST_ACCESS, '');
});

test('configuration rejects local or ambiguous exposure and conflicting storage', () => {
  for (const change of [
    { LAB_PUBLIC_URL: 'http://lab.example.test' },
    { LAB_PUBLIC_URL: 'https://game.example.test' },
    { PUBLIC_URL: 'https://game.example.test:444' },
    { BO_URL: 'https://bo.example.test' },
    { CROUPIER_GAME_ORIGIN: 'https://other.example.test' },
    { PORT: '4173' },
    { DEMO_GUEST_ACCESS: '1' },
    { LAB_STUDIO_DATA_DIR: join(tmpdir(), 'unrelated-studio') },
    { CROUPIER_CLOUD_DATA_ROOT: '.' },
  ]) {
    assert.throws(() => validateCloudConfig({ ...fixture(), ...change }));
  }
});

test('only paired credentials reach the intended child and errors do not echo secret values', () => {
  const env = { ...fixture(), LAB_REMOTE_URL: 'https://director.example.test',
    LAB_REMOTE_TOKEN: 'private-director-token',
    OPENCLAW_PRODUCT_SPEECH_URL: 'https://speech.example.test',
    OPENCLAW_PRODUCT_SPEECH_TOKEN: 'private-speech-token' };
  const specs = childSpecifications(validateCloudConfig(env), env);
  assert.equal(specs.lab.env.LAB_REMOTE_TOKEN, 'private-director-token');
  assert.equal(specs.web.env.LAB_REMOTE_TOKEN, undefined);
  assert.equal(specs.web.env.OPENCLAW_PRODUCT_SPEECH_TOKEN, 'private-speech-token');
  assert.equal(specs.lab.env.OPENCLAW_PRODUCT_SPEECH_TOKEN, undefined);
  assert.throws(() => validateCloudConfig({ ...env, LAB_REMOTE_URL: 'https://private-director-token@director.example.test' }),
    error => !error.message.includes('private-director-token'));
  assert.throws(() => validateCloudConfig({ ...env, LAB_REMOTE_TOKEN: '' }),
    error => !error.message.includes('private-director-token'));
});

test('deployment environment cannot enable the access gate', () => {
  process.env.CROUPIER_CLOUD_AUTH_READY = '1';
  try { assert.throws(() => assertCloudAccessReady(), /Cloud start blocked/); }
  finally { delete process.env.CROUPIER_CLOUD_AUTH_READY; }
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

test('process group starts Web then Lab and stops Lab then Web without real servers', async () => {
  const activity = [];
  class FakeChild extends EventEmitter {
    pid = 123;
    exitCode = null;
    signalCode = null;
    constructor(name) { super(); this.name = name; }
    kill(signal) {
      activity.push(`stop:${this.name}:${signal}`);
      queueMicrotask(() => { this.signalCode = signal; this.emit('close', 0, signal); });
      return true;
    }
  }
  const specs = childSpecifications(validateCloudConfig(fixture()), fixture());
  const group = await startChildren(specs, {
    spawnProcess: (_command, _args, options) => {
      const name = options.cwd.endsWith('lab') ? 'lab' : 'web';
      activity.push(`start:${name}`);
      return new FakeChild(name);
    },
    wait: async () => {},
    portCheck: async () => {},
  });
  await group.stop();
  assert.deepEqual(activity, ['start:web', 'start:lab', 'stop:lab:SIGTERM', 'stop:web:SIGTERM']);
});
