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

test('each dealer speaks with its own voice settings: Paow gets the livelier read (Kevin: more energy)', async () => {
  const dir = path.join(os.tmpdir(), 'dealer-voice-test');
  for (const dealer of ['dragge', 'paow']) {
    const seen = [];
    await draggeSay('Place your bets.', 'en', dir, { fetchImpl: fakeFetch(seen), dealer });
    assert.equal(seen.length, 1);
    assert.deepEqual(seen[0].body.voice_settings, voiceSettings(dealer));
  }
  const d = voiceSettings('dragge'), p = voiceSettings('paow');
  assert.deepEqual(d, { stability: 0.5, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true });   // Dragge unchanged
  assert.ok(p.stability < d.stability && p.style > d.style && p.speed > 1 && p.speed <= 1.2);
});
