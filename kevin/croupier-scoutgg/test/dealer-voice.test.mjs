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
