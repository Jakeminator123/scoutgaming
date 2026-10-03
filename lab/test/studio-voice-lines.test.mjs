import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createRegisteredVoiceLines, studioVoiceIdentity, voiceReviewMatches } from '../lib/studio-voice-lines.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'croupier-voice-registry-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = [], blobs = [];
  let firstBank, firstBlob;
  for (const dealer of ['vera', 'astrid', 'amira', 'mei']) {
    const base = dealer === 'vera' ? 'dealer' : `dealers/${dealer}`;
    const clip = { file: 'idle-1_speak_goodluck.h264', audioDelayMs: 42, fps: 24, frames: [[0, 128]] };
    for (const [tail, content] of [['audio/en/bank.json', JSON.stringify({ goodluck: { text: `Exact ${dealer} text` }, win: { text: `Win ${dealer}` } })],
      ['streams/index.json', JSON.stringify({ clips: { 'idle-1/speak/goodluck': clip } })],
      ['audio/en/goodluck.mp3', 'ID3-fixture-audio'], ['preview/goodluck.mp4', 'registered-preview'], ['streams/' + clip.file, 'registered-stream']]) {
      const path = `dealers/${dealer}/runtime/indexed/${tail}`, bytes = Buffer.from(content), sha256 = hash(bytes);
      const row = { path, legacyPath: `web/public/${base}/${tail}`, publicUrl: `/${base}/${tail}`, access: 'public', sha256, size: bytes.length };
      files.push(row);
      const file = join(root, 'media', path); await mkdir(join(file, '..'), { recursive: true }); await writeFile(file, bytes);
      const extension = tail.split('.').at(-1), id = '00000000-0000-4000-8000-000000000001';
      blobs.push({ logicalPath: path, access: 'public', sha256, size: bytes.length,
        storage: { provider: 'vercel-blob', pathname: `croupier/media/dealers/${dealer}/runtime/${id}/${sha256}.${extension}`,
          sha256, size: bytes.length, contentType: extension === 'mp3' ? 'audio/mpeg' : extension === 'mp4' ? 'video/mp4' : extension === 'json' ? 'application/json' : 'application/octet-stream' } });
      if (dealer === 'vera' && tail === 'audio/en/bank.json') firstBank = file;
      if (dealer === 'vera' && tail === 'audio/en/goodluck.mp3') firstBlob = blobs.at(-1);
    }
  }
  await writeFile(join(root, 'media/layout.json'), JSON.stringify({ schemaVersion: 1, roots: {}, files }));
  const indexPath = join(root, 'blob-index.json');
  const index = { schemaVersion: 1, namespace: 'croupier/media', verification: 'readback-sha256', files: blobs };
  await writeFile(indexPath, JSON.stringify(index));
  const env = { CROUPIER_MEDIA_STORAGE: 'blob', BLOB_READ_WRITE_TOKEN: 'fixture-never-used', CROUPIER_MEDIA_BLOB_INDEX: indexPath };
  return { root, env, firstBank, firstBlob, indexPath, index, loader: createRegisteredVoiceLines({ env, repositoryRoot: root }) };
}

test('all four exact registered banks expose identity only for complete available paired speech; none is automatically approved', async t => {
  const f = await fixture(t), result = await f.loader();
  assert.deepEqual(result.dealers.map(row => row.dealer), ['vera', 'astrid', 'amira', 'mei']);
  assert.equal(result.automaticVisualApproval, false);
  for (const dealer of result.dealers) {
    const goodluck = dealer.lines.find(line => line.key === 'goodluck'), win = dealer.lines.find(line => line.key === 'win');
    assert.equal(goodluck.text, `Exact ${dealer.dealer} text`); assert.equal(goodluck.reviewable, true);
    assert.ok(studioVoiceIdentity(goodluck.identity)); assert.equal(goodluck.identity.audioDelayMs, 42);
    assert.equal(goodluck.productionApproved, false);
    assert.equal(win.reviewable, false); assert.equal(win.identity, null); assert.equal(win.audio, null);
  }
  assert.equal(voiceReviewMatches('approved', result.dealers[0].lines[0].identity), false);
});

test('changed bundled metadata, mismatched Blob metadata and absent native media configuration fail closed', async t => {
  const f = await fixture(t);
  for (const env of [{}, { ...f.env, CROUPIER_MEDIA_STORAGE: 'disk' }])
    await assert.rejects(createRegisteredVoiceLines({ env, repositoryRoot: f.root })(), error => error.code === 'studio_voice_registry_unavailable');
  await writeFile(f.firstBank, JSON.stringify({ goodluck: { text: 'Changed words' } }));
  await assert.rejects(f.loader(), error => error.code === 'studio_voice_registry_unavailable');
  const g = await fixture(t); g.firstBlob.sha256 = 'f'.repeat(64); g.firstBlob.storage.sha256 = 'f'.repeat(64);
  g.firstBlob.storage.pathname = g.firstBlob.storage.pathname.replace(/[a-f0-9]{64}\.mp3$/, 'f'.repeat(64) + '.mp3');
  await writeFile(g.indexPath, JSON.stringify(g.index));
  await assert.rejects(g.loader(), error => error.code === 'studio_voice_registry_unavailable');
});
