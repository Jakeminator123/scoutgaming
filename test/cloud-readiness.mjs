import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { collectCloudReadiness } from '../tools/cloud-readiness.mjs';

async function fixture(t, items) {
  const root = await mkdtemp(join(tmpdir(), 'croupier-cloud-readiness-'));
  t.after(async () => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith('croupier-cloud-readiness-'));
    await rm(root, { recursive: true, force: true });
  });
  const media = join(root, 'emil/dealklipp-v1');
  await mkdir(media, { recursive: true });
  await writeFile(join(media, 'lab-video-manifest.json'), JSON.stringify({ schemaVersion: 2, items }));
  return { root, media };
}

test('configuration and present media never bypass known cloud migration blockers or reveal secrets', async t => {
  const { root, media } = await fixture(t, [{ relativePath: 'idle.mp4', size: 4 }]);
  await writeFile(join(media, 'idle.mp4'), 'test');
  const state = join(root, 'state');
  await mkdir(state);
  const env = {
    LAB_REMOTE_TOKEN: 'private-test-token-never-print', PUBLIC_URL: 'https://user:private-url-password@demo.example.invalid/private',
    CROUPIER_ASTRID_TRANSLATION_KEY: 'private-translation-key-never-print',
    LAB_REMOTE_URL: 'https://director.example.invalid/private?token=hidden-value',
    LAB_STUDIO_DATA_DIR: state, CROUPIER_PRESENTATION_STUDIO_DIR: state,
    CROUPIER_GENERATED_SPEECH_DIR: state, CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID: 'endpoint_123',
    HOST: '0.0.0.0', CROUPIER_GENERATED_SPEECH: '1', CROUPIER_GENERATED_SPEECH_PREVIEW: '1',
  };
  const report = await collectCloudReadiness({ root, env });
  assert.equal(report.ready, false);
  assert.equal(report.configuration.credentials.find(item => item.name === 'CROUPIER_ASTRID_TRANSLATION_KEY').configured, true);
  assert.equal(report.media.status, 'metadata-present');
  assert.equal(report.configuration.sharedStudioDirectory, true);
  assert.equal(report.configuration.currentSpeechHostGateSatisfied, false);
  assert.equal(report.configuration.directories.find(item => item.name === 'CROUPIER_GENERATED_SPEECH_DIR').outsideCheckout, false);
  assert.equal(report.configuration.urls.find(item => item.name === 'PUBLIC_URL').status, 'invalid-cloud-url');
  assert.equal(report.configuration.urls.find(item => item.name === 'LAB_REMOTE_URL').status, 'invalid-cloud-url');
  assert.equal(report.configuration.partnerOrigin, 'not-configured-or-mismatch');
  assert.ok(report.blockers.some(item => item.id === 'studio-access'));
  const serialized = JSON.stringify(report);
  for (const secret of ['private-test-token-never-print', 'private-translation-key-never-print', 'private-url-password', 'hidden-value', 'director.example.invalid']) assert.ok(!serialized.includes(secret), secret);
  assert.ok(!serialized.includes(JSON.stringify(state)));
});

test('one explicit media archive and matching cloud game origin are reported without printing their values', async t => {
  const { root } = await fixture(t, []);
  const archive = join(root, 'shared-media');
  await mkdir(archive);
  await writeFile(join(archive, 'lab-video-manifest.json'), JSON.stringify({ schemaVersion: 2,
    items: [{ relativePath: 'idle.mp4', size: 4 }] }));
  await writeFile(join(archive, 'idle.mp4'), 'test');
  const env = { LAB_VIDEO_ARCHIVE: archive, BETTALOTTO_PARTNER_BASE_URL: 'https://game.example.com',
    CROUPIER_GAME_ORIGIN: 'https://game.example.com' };
  const report = await collectCloudReadiness({ root, env });
  assert.equal(report.media.status, 'metadata-present');
  assert.equal(report.media.present, 1);
  assert.equal(report.configuration.mediaArchive.status, 'directory');
  assert.equal(report.configuration.mediaArchive.absolute, true);
  assert.equal(report.configuration.partnerOrigin, 'matched-https-origin');
  assert.ok(!JSON.stringify(report).includes(archive));
  assert.ok(!JSON.stringify(report).includes('game.example.com'));
  const rejected = await collectCloudReadiness({ root, env: { ...env, LAB_VIDEO_ARCHIVE: './relative',
    CROUPIER_GAME_ORIGIN: 'https://different.example.com' } });
  assert.equal(rejected.media.status, 'unavailable');
  assert.equal(rejected.configuration.mediaArchive.status, 'invalid-path');
  assert.equal(rejected.configuration.partnerOrigin, 'not-configured-or-mismatch');
  for (const origin of ['https://127.0.0.2', 'https://game.local', 'https://[2001:db8::1]']) {
    const invalid = await collectCloudReadiness({ root, env: {
      BETTALOTTO_PARTNER_BASE_URL: origin, CROUPIER_GAME_ORIGIN: origin,
    } });
    assert.equal(invalid.configuration.partnerOrigin, 'not-configured-or-mismatch');
  }
});

test('media inventory rejects traversal, reports missing and changed sizes without trusting file presence', async t => {
  const { root, media } = await fixture(t, [
    { relativePath: '../../outside.mp4', size: 4 },
    { relativePath: 'absent.mp4', size: 4 },
    { relativePath: 'changed.mp4', size: 1 },
  ]);
  await writeFile(join(media, 'changed.mp4'), 'test');
  const report = await collectCloudReadiness({ root, env: {} });
  assert.equal(report.media.status, 'incomplete');
  assert.equal(report.media.invalid, 1);
  assert.equal(report.media.missing, 1);
  assert.equal(report.media.sizeMismatch, 1);
  assert.equal(report.configuration.sharedStudioDirectory, null);
  assert.ok(report.configuration.credentials.every(item => !item.configured));
});

test('mismatched storage, relative paths and local cloud URLs are reported without reading .env or DBs', async t => {
  const { root } = await fixture(t, []);
  await writeFile(join(root, '.env'), 'LAB_REMOTE_TOKEN=do-not-load-me\n');
  const report = await collectCloudReadiness({ root, env: {
    LAB_STUDIO_DATA_DIR: join(root, 'one'), CROUPIER_PRESENTATION_STUDIO_DIR: join(root, 'two'),
    CROUPIER_DATA_DIR: './data', PUBLIC_URL: 'https://localhost',
  } });
  assert.equal(report.configuration.sharedStudioDirectory, false);
  assert.equal(report.configuration.directories[0].status, 'relative-path');
  assert.equal(report.configuration.urls[0].status, 'invalid-cloud-url');
  assert.equal(report.configuration.credentials[0].configured, false);
  assert.equal(report.media.status, 'incomplete');
  assert.ok(!JSON.stringify(report).includes('do-not-load-me'));
});

test('strict CLI returns a migration failure code with a machine-readable redacted report', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../tools/cloud-readiness.mjs', import.meta.url)), '--json', '--strict'],
    { encoding: 'utf8', env: { ...process.env, LAB_REMOTE_TOKEN: 'cli-private-marker' } });
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).ready, false);
  assert.ok(!result.stdout.includes('cli-private-marker'));
  assert.equal(result.stderr, '');
});
