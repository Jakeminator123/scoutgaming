import test from 'node:test';
import assert from 'node:assert/strict';
import { loadOriginalMediaCatalog, getOriginalMediaResponse } from '../lib/original-media-server.mjs';
import { resolveOriginalDefault, isOriginalMediaId } from '../lib/original-media.mjs';
import { validateContactTake, calibrationPayload } from '../../web/public/performance-contact.mjs';
import { createHash } from 'node:crypto';

const request = (pathname, options) => new Request(`http://127.0.0.1:4188/api/original-media/${pathname}`, options);
const catalog = await loadOriginalMediaCatalog();

test('all four dealers use exact available speech or idle without broad speech fallback', () => {
  for (const dealer of ['astrid', 'vera', 'amira', 'mei']) {
    const idle = resolveOriginalDefault(catalog, dealer, { type: 'idle' });
    const double = resolveOriginalDefault(catalog, dealer, { type: 'speak', line: 'double' });
    assert.equal(idle.dealerId, dealer); assert.equal(idle.kind, 'idle');
    assert.equal(double.situation, 'double'); assert.equal(double.eventId, 'speak.double');
    assert.equal(resolveOriginalDefault(catalog, dealer, { type: 'speak', line: 'unknown-sentence' }), null);
    assert.equal(resolveOriginalDefault(catalog, dealer, { type: 'speak', line: 'greeting' }).situation, 'greeting', 'recorded speech is reachable through speak.other');
  }
  for (const line of ['win', 'lose', 'push', 'placebets']) assert.equal(resolveOriginalDefault(catalog, 'astrid', { type: 'speak', line }).situation, line);
  assert.equal(resolveOriginalDefault(catalog, 'mei', { type: 'speak', line: 'push' }), null, 'missing exact video is not replaced with other speech');
});

test('staged presets are exact canonical directions, never old action, reveal or fabricated all-seat coverage', () => {
  for (const [box, expected] of [[0, 'left'], [3, 'centre'], [6, 'right']]) {
    const entry = resolveOriginalDefault(catalog, 'astrid', { type: 'deal', to: 'box', box });
    assert.equal(entry.situation, expected); assert.equal(entry.reviewStatus, 'review');
  }
  for (const box of [-1, 1, 2, 4, 5, 7]) assert.equal(resolveOriginalDefault(catalog, 'astrid', { type: 'deal', to: 'box', box }), null);
  for (const type of ['reveal', 'settle', 'turn']) assert.equal(resolveOriginalDefault(catalog, 'astrid', { type, to: 'dealer' }), null);
  assert.equal(resolveOriginalDefault(catalog, 'amira', { type: 'deal', to: 'box', box: 3 }), null);
  assert.ok(catalog.entries.every(entry => !entry.sourcePath.includes('actions_action-deal')));
  assert.ok(catalog.entries.every(entry => isOriginalMediaId(entry.id)));
});

test('native speech remains exact local source while staged definitions preserve calibration', async () => {
  for (const line of ['goodluck', 'win']) {
    const entry = resolveOriginalDefault(catalog, 'astrid', { type: 'speak', line });
    assert.equal(entry.playbackKind, 'native'); assert.equal(entry.sourcePath, `dealers/astrid/speech/${line}.mp4`);
  }
  const id = 'original:astrid:action:centre';
  const response = await getOriginalMediaResponse(['definition', id], request(`definition/${id}`));
  const { take } = await response.json();
  assert.deepEqual(validateContactTake(take, { approved: false }), []);
  assert.equal(createHash('sha256').update(calibrationPayload(take)).digest('hex'), take.calibrationSha256);
});

test('media routes reject foreign callers and non-allowlisted public/private files', async () => {
  for (const parts of [['assets', '..', '.env'], ['assets', 'app.mjs'], ['assets', 'dealers', 'astrid', 'streams', 'idle-1_actions_action-deal.h264'], ['assets', 'casino.html']]) {
    await assert.rejects(getOriginalMediaResponse(parts, request(parts.join('/'))), error => error.statusCode === 404);
  }
  await assert.rejects(getOriginalMediaResponse(['runtime.mjs'], request('runtime.mjs', { headers: { origin: 'https://evil.example' } })), error => error.statusCode === 403);
  await assert.rejects(getOriginalMediaResponse(['runtime.mjs'], new Request('https://other.example/api/original-media/runtime.mjs')), error => error.statusCode === 403);
});

test('allowlisted bytes support HEAD/range and correctly reject malformed byte ranges', async () => {
  const parts = ['assets', 'dealer-engine.mjs'];
  const complete = await getOriginalMediaResponse(parts, request(parts.join('/'))); const bytes = await complete.arrayBuffer();
  const head = await getOriginalMediaResponse(parts, request(parts.join('/'), { method: 'HEAD' }));
  assert.equal(Number(head.headers.get('content-length')), bytes.byteLength); assert.equal(await head.text(), '');
  const range = await getOriginalMediaResponse(parts, request(parts.join('/'), { headers: { range: 'bytes=0-7' } }));
  assert.equal(range.status, 206); assert.deepEqual(await range.arrayBuffer(), bytes.slice(0, 8));
  for (const rangeHeader of ['bytes=4-2', 'bytes=-0', 'bytes=999999999-', 'bytes=1-4,6-8']) {
    const result = await getOriginalMediaResponse(parts, request(parts.join('/'), { headers: { range: rangeHeader } })); assert.equal(result.status, 416);
  }
});
