// Dragge says a chat reply out loud: his cloned ElevenLabs voice, lip-synced by MuseTalk on his
// own RunPod endpoint (Emil's astrid-gpu-worker, avatar dragan_vila2x = his VILA rest image),
// the same way his recorded lines were made. Only already-guarded dealer text is ever sent.
// Keys come from ~/.config/croupier (agent.env: ELEVENLABS_VIDEO_KEY, runpod.env: RUNPOD_API_KEY).
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { normalizePcm16 } from './loudness.mjs';

// Per dealer: cloned ElevenLabs voice + own lip-sync endpoint (avatar = the dealer's VILA rest image).
// dragan-v2-lipsync: avatar dragan_vila2x (H3's KLARA plate of 2026-10-07); the old dragge-spel-lipsync
// (9hyt6a6e17223s, v1 green start image) stays for rollback. Paow: instant clone from 7 s of her podcast
// (videoplayback.mp4 7:31-7:38), avatar paow_vila2x on paow-v2-lipsync.
// reads: ElevenLabs model + voice_settings per language. Dragge keeps his calm read. Paow's whole demeanor shifted
// (Kevin, 10 Oct: robotic, odd pauses): the reads Kevin picked by ear, Swedish on eleven_v3, English a looser v2 read;
// her recorded lines were re-voiced the same way (paow-voice/revoice.py).
const DEALER_VOICES = {
  dragge: { voice: '7f95xPL4S3ySZ4OS1pw8', endpoint: process.env.DRAGGE_LIPSYNC_ENDPOINT ?? 'fxwf3rgwme748i',
    reads: { any: { model: 'eleven_multilingual_v2', settings: { stability: 0.5, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true } } } },
  paow: { voice: 'WZVEBKUreb9jAKojf0QF', endpoint: process.env.PAOW_LIPSYNC_ENDPOINT ?? '7tcfouz8jib4wb',
    reads: { sv: { model: 'eleven_v3', settings: { stability: 0.5, similarity_boost: 0.85, use_speaker_boost: true } },
      any: { model: 'eleven_multilingual_v2', settings: { stability: 0.38, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true } } } },
  // Astrid 2.0: the voice her recorded lines have, Cartesia Freja like the first Astrid (Emil 14 Oct: not ElevenLabs), through
  // the server's Cartesia socket (useCartesia). She is lip-synced by the moving lip sync (rorlig-lipsync.mjs) only: no
  // rest-image endpoint exists for her, so without that worker her answer is text.
  // Adebayor (Kevin 29 Oct: voice PiGyGh3I6t288DXzqeDV): ElevenLabs, lip-synced by the moving lip sync only (his pod lane);
  // no rest-image endpoint, so without that worker his answer is text. He exists only where LOCAL_DEALERS lists him.
  // His voice lives in Impactwin's ElevenLabs account (Kevin 29 Oct), not the game's: keyEnv names the env variable with that key
  adebayor: { voice: 'PiGyGh3I6t288DXzqeDV', keyEnv: 'ELEVENLABS_IMPACTWIN_KEY', endpoint: process.env.ADEBAYOR_LIPSYNC_ENDPOINT ?? null,
    reads: { any: { model: 'eleven_multilingual_v2', settings: { stability: 0.5, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true } } } },
  astrid2: { tts: 'cartesia', voice: null, endpoint: process.env.ASTRID2_LIPSYNC_ENDPOINT ?? null,
    reads: { any: { model: 'eleven_multilingual_v2', settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true } } } },
};
export const voiceRead = (dealer, language) => DEALER_VOICES[dealer].reads[language] ?? DEALER_VOICES[dealer].reads.any;
export const voiceSettings = (dealer, language) => voiceRead(dealer, language).settings;
export const hasVoice = dealer => Object.hasOwn(DEALER_VOICES, dealer);
// the server's Cartesia voice (server/cartesia.mjs say: text, language -> PCM s16le 24 kHz), for the dealers whose voice is there
let cartesia = null;
export function useCartesia(say) { cartesia = say; }
const onCartesia = dealer => DEALER_VOICES[dealer]?.tts === 'cartesia';
const RATE = 24000;

function secret(name, files, { env = true } = {}) {
  if (env && process.env[name] && process.env[name] !== 'local-qa-disabled') return process.env[name];
  for (const f of files) {
    try { const m = new RegExp(`^${name}=(.+)$`, 'm').exec(readFileSync(f, 'utf8')); if (m) return m[1].trim().replace(/^["']|["']$/g, ''); } catch {}
  }
  return '';
}
const home = process.env.HOME ?? '';
// the game's ElevenLabs key, or a dealer's own account (DEALER_VOICES[dealer].keyEnv, e.g. Adebayor in Impactwin's account)
const XI = (dealer = null) => (dealer && DEALER_VOICES[dealer]?.keyEnv && process.env[DEALER_VOICES[dealer].keyEnv]) || secret('ELEVENLABS_VIDEO_KEY', [path.join(home, '.config/croupier/agent.env'), '/etc/croupier/agent.env']);
// Local QA sets RUNPOD_API_KEY=local-qa-disabled for Astrid's pipeline; Dragge's voice reads the real key file then.
const RP = () => secret('DRAGGE_RUNPOD_API_KEY', []) || secret('RUNPOD_API_KEY', [path.join(home, '.config/croupier/runpod.env')]);

// Emil's dedicated pod (server/pod-lipsync.mjs): server.mjs hands over the pool for the dealers in LIPSYNC_POD_DEALERS;
// those dealers are lip-synced by their own engine on the pod (avatar below) instead of their RunPod endpoint.
const POD_AVATARS = { dragge: 'dragan_vila2x', paow: 'paow_vila2x' };
const pod = { pool: null, dealers: new Set(), queue: {} };
export function useLipsyncPod(pool, dealers = []) { pod.pool = pool; pod.dealers = new Set(dealers.filter(d => Object.hasOwn(POD_AVATARS, d))); }
const onPod = dealer => Boolean(pod.pool && pod.dealers.has(dealer));
// The pod engine takes one utterance at a time per dealer; a second reply waits its turn instead of failing.
function podLipsync(dealer, pcm) {
  const run = (pod.queue[dealer] ?? Promise.resolve()).catch(() => {}).then(() => pod.pool.for(POD_AVATARS[dealer]).lipsync(pcm, RATE));
  pod.queue[dealer] = run;
  return run;
}

export const draggeVoiceReady = (dealer) => Boolean((onCartesia(dealer) ? cartesia : XI(dealer)) && (onPod(dealer) || RP()));
// The RunPod key his voice uses (the real one even where local QA disables Astrid's): the lip sync on the moving clips
// orders its worker with it too (rorlig-lipsync.mjs).
export const runpodKey = () => RP();

function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const H = () => ({ Authorization: `Bearer ${RP()}`, 'Content-Type': 'application/json' });
/** One lip-sync job: runsync answers directly when a worker is warm; a cold start falls back to fast polling. */
async function lipsync(input, fetchImpl = fetch, dealer = 'dragge') {
  const ENDPOINT = DEALER_VOICES[dealer].endpoint;
  if (!ENDPOINT) throw new Error(`no rest-image lip sync for ${dealer}`);
  let job = await fetchImpl(`https://api.runpod.ai/v2/${ENDPOINT}/runsync`, { method: 'POST', headers: H(), body: JSON.stringify({ input }), signal: AbortSignal.timeout(120000) }).then(r => r.json());
  const t0 = Date.now();
  while (job.status !== 'COMPLETED') {
    if (['FAILED', 'CANCELLED', 'TIMED_OUT'].includes(job.status) || !job.id || Date.now() - t0 > 240000) throw new Error(`lipsync ${job.status ?? 'timeout'}`);
    await new Promise(r => setTimeout(r, 250));
    job = await fetchImpl(`https://api.runpod.ai/v2/${ENDPOINT}/status/${job.id}`, { headers: H(), signal: AbortSignal.timeout(20000) }).then(r => r.json());
  }
  return job;
}

// The first job after a quiet spell pays ~30 s of GPU warm-up. A near-silent 0.8 s job when a
// Dragge viewer arrives takes that hit before anyone asks him anything (at most every 4 minutes).
const warmedAt = {};
export function draggeWarm(dealer = 'dragge') {
  if (!hasVoice(dealer) || onPod(dealer) || !DEALER_VOICES[dealer].endpoint || !draggeVoiceReady(dealer) || Date.now() - (warmedAt[dealer] ?? 0) < 240000) return;
  warmedAt[dealer] = Date.now();
  const pcm = Buffer.alloc(RATE * 2 * 0.8); for (let i = 0; i < pcm.length; i += 2) pcm.writeInt16LE(Math.round((Math.random() - .5) * 40), i);
  lipsync({ op: 'lipsync', wav_b64: wav(pcm).toString('base64'), crf: 13, preset: 'ultrafast' }, fetch, dealer).catch(() => { warmedAt[dealer] = 0; });
}

/** His voice saying `text`: s16le mono at RATE, at -16 LUFS (Emil's recipe), or throws. */
export async function draggeVoice(text, language, { fetchImpl = fetch, dealer = 'dragge' } = {}) {
  if (onCartesia(dealer)) {
    if (!cartesia) throw new Error('voice: no Cartesia');
    return normalizePcm16(Buffer.from(await cartesia(text, language)), RATE).pcm;
  }
  const VOICE = DEALER_VOICES[dealer].voice, read = voiceRead(dealer, language);
  const tts = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=pcm_${RATE}`, {
    method: 'POST', headers: { 'xi-api-key': XI(dealer), 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000),
    body: JSON.stringify({ text, model_id: read.model, ...(read.model === 'eleven_v3' ? {} : { language_code: ['sv', 'en', 'es', 'fr', 'zh', 'pt', 'ko'].includes(language) ? language : 'en' }),
      voice_settings: read.settings }),
  });
  if (!tts.ok) throw new Error(`voice ${tts.status}`);
  // Emil's lip-sync recipe (LAPPSYNK-DRAGAN-PAOW.md): the dry voice at -16 LUFS with one fixed gain.
  return normalizePcm16(Buffer.from(await tts.arrayBuffer()), RATE).pcm;
}

/** mp4 url in answersDir with Dragge saying `text`, or throws. */
export async function draggeSay(text, language, answersDir, { fetchImpl = fetch, dealer = 'dragge' } = {}) {
  // crf 13 costs nothing on the worker's NVENC; ultrafast keeps a worker without NVENC at ~4 s instead of ~7.5 s.
  const pcm = await draggeVoice(text, language, { fetchImpl, dealer });
  const t0 = Date.now();
  if (onPod(dealer)) {
    const { mp4, meta } = await podLipsync(dealer, pcm);
    await mkdir(answersDir, { recursive: true });
    const name = `${randomUUID()}.mp4`;
    await writeFile(path.join(answersDir, name), mp4);
    return { url: `/answers/${name}`, frames: meta.frames, ms: Date.now() - t0 };
  }
  let job = await lipsync({ op: 'lipsync', wav_b64: wav(pcm).toString('base64'), crf: 13, preset: 'ultrafast' }, fetchImpl, dealer);
  if (job.output?.error) throw new Error(job.output.error);
  await mkdir(answersDir, { recursive: true });
  const name = `${randomUUID()}.mp4`;   // the /answers route serves bare UUID names only
  await writeFile(path.join(answersDir, name), Buffer.from(job.output.mp4_b64, 'base64'));
  return { url: `/answers/${name}`, frames: job.output.frames, ms: Date.now() - t0 };
}
