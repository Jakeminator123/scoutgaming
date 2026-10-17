import test from 'node:test';
import assert from 'node:assert/strict';
import { selectKey, checkVoice, generatePreview, PREVIEW } from '../../../tools/elevenlabs-lab-preview.mjs';

test('accepts primary, alias or identical copies, without returning extra environment data', () => {
  assert.deepEqual(selectKey({ ELEVENLABS_API_KEY: ' test ', ignored: 'x' }), { key: 'test', sameAliases: false });
  assert.equal(selectKey({ ELEVENLABS_OC_API: 'alias' }).key, 'alias');
  assert.equal(selectKey({ ELEVENLABS_API_KEY: 'same', ELEVENLABS_OC_API: 'same' }).sameAliases, true);
});
test('missing or conflicting keys fail without exposing values', () => {
  assert.throws(() => selectKey({}), /Missing/);
  assert.throws(() => selectKey({ ELEVENLABS_API_KEY: 'private-a', ELEVENLABS_OC_API: 'private-b' }), error =>
    /aliases differ/.test(error.message) && !error.message.includes('private'));
});
test('check uses official stock voice list and does not generate speech', async () => {
  const result = await checkVoice('fake', async (url, init) => {
    assert.equal(url.origin, 'https://api.elevenlabs.io');
    assert.equal(url.pathname, '/v2/voices');
    assert.equal(init.method, undefined);
    assert.equal(init.headers['xi-api-key'], 'fake');
    return Response.json({ voices: [{ voice_id: PREVIEW.voiceId, name: 'Sarah', category: 'premade' }] });
  });
  assert.equal(result.voiceName, 'Sarah');
});
test('unavailable voice and rejected listing fail closed', async () => {
  await assert.rejects(checkVoice('fake', async () => Response.json({ voices: [] })), /not available/);
  await assert.rejects(checkVoice('fake', async () => new Response('private provider message', { status: 403 })), /HTTP 403/);
});
test('generation is one bounded official request for fixed demo text, no video binding', async () => {
  let count = 0;
  const result = await generatePreview('fake', async (url, init) => {
    count += 1;
    assert.equal(new URL(url).hostname, 'api.elevenlabs.io');
    assert.equal(init.method, 'POST');
    assert.equal(init.redirect, 'error');
    const body = JSON.parse(init.body);
    assert.equal(body.text, PREVIEW.text);
    assert.equal(body.model_id, PREVIEW.modelId);
    return new Response(new Uint8Array([73, 68, 51]), { headers: { 'content-type': 'audio/mpeg' } });
  });
  assert.equal(count, 1);
  assert.equal(result.audio.length, 3);
});
test('TTS error or nonaudio response is not saved and never retried', async () => {
  let count = 0;
  await assert.rejects(generatePreview('fake', async () => {
    count += 1;
    return new Response('private provider message', { status: 401 });
  }), error => /HTTP 401/.test(error.message) && !error.message.includes('private'));
  assert.equal(count, 1);
  await assert.rejects(generatePreview('fake', async () => Response.json({ error: 'no' })), /Expected audio/);
});
