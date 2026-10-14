import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
process.env.ELEVENLABS_VIDEO_KEY = 'test-key'; process.env.DRAGGE_RUNPOD_API_KEY = 'test-key';
const { draggeSay, voiceSettings } = await import('../server/dragge-voice.mjs');

// Records the ElevenLabs request; RunPod answers at once with an empty clip.
function fakeFetch(seen) {
  return async (url, opts) => {
    if (url.includes('elevenlabs')) { seen.push({ url, body: JSON.parse(opts.body) }); return { ok: true, arrayBuffer: async () => new ArrayBuffer(4800) }; }
    return { json: async () => ({ status: 'COMPLETED', output: { mp4_b64: '', frames: 1 } }) };
  };
}

test('each dealer speaks with its own voice and read: Dragge calm, Paow the reads Kevin picked (sv eleven_v3, en looser v2)', async () => {
  const dir = path.join(os.tmpdir(), 'dealer-voice-test');
  for (const [dealer, language] of [['dragge', 'en'], ['dragge', 'sv'], ['paow', 'en'], ['paow', 'sv']]) {
    const seen = [];
    await draggeSay('Place your bets.', language, dir, { fetchImpl: fakeFetch(seen), dealer });
    assert.equal(seen.length, 1);
    assert.deepEqual(seen[0].body.voice_settings, voiceSettings(dealer, language));
    assert.equal(seen[0].body.model_id, dealer === 'paow' && language === 'sv' ? 'eleven_v3' : 'eleven_multilingual_v2');
  }
  assert.deepEqual(voiceSettings('dragge', 'sv'), { stability: 0.5, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true });   // Dragge unchanged
  assert.deepEqual(voiceSettings('paow', 'en'), { stability: 0.38, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true });
});

test('Astrid 2.0 speaks with the voice of her recorded lines and has no rest-image lip sync: only the moving one draws her mouth', async () => {
  const seen = [];
  await assert.rejects(draggeSay('Place your bets.', 'en', path.join(os.tmpdir(), 'dealer-voice-test'), { fetchImpl: fakeFetch(seen), dealer: 'astrid2' }), /no rest-image lip sync/);
  assert.equal(seen.length, 1);
  assert.ok(seen[0].url.includes('/d1PjUBrElTJTH5EkXPZp'));
  assert.equal(seen[0].body.model_id, 'eleven_multilingual_v2');
});

test('Mårten speaks with the voice Kevin made, read like Paow (sv eleven_v3; en and es v2 with their own language code)', async () => {
  const dir = path.join(os.tmpdir(), 'dealer-voice-test');
  for (const [language, model] of [['sv', 'eleven_v3'], ['en', 'eleven_multilingual_v2'], ['es', 'eleven_multilingual_v2']]) {
    const seen = [];
    await assert.rejects(draggeSay('Hagan sus apuestas.', language, dir, { fetchImpl: fakeFetch(seen), dealer: 'marten' }), /no rest-image lip sync/);
    assert.ok(seen[0].url.includes('/ik47JUrkaNt6DSPKAk1t'));
    assert.equal(seen[0].body.model_id, model);
    assert.equal(seen[0].body.language_code, model === 'eleven_v3' ? undefined : language);
    assert.deepEqual(seen[0].body.voice_settings, voiceSettings('paow', language));
  }
});
