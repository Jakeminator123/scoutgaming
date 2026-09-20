// Standalone opt-in voice check. Never imported by the game, studio or Gateway.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';

export const PREVIEW = Object.freeze({
  voiceId: 'EXAVITQu4vr4xnSDxMaL',
  voiceName: 'Sarah',
  modelId: 'eleven_multilingual_v2',
  text: 'Hej och välkommen till bordet! Jag heter Astrid. Nu provar vi rösten i vårt lokala labb.',
});

export function selectKey(env) {
  const primary = env.ELEVENLABS_API_KEY?.trim();
  const alias = env.ELEVENLABS_OC_API?.trim();
  if (primary && alias && primary !== alias) throw new Error('ElevenLabs aliases differ; choose one account before testing.');
  if (!primary && !alias) throw new Error('Missing ELEVENLABS_API_KEY (or ELEVENLABS_OC_API) in root .env.');
  return { key: primary || alias, sameAliases: !!primary && primary === alias };
}

export async function checkVoice(key, fetchImpl = fetch) {
  const url = new URL('https://api.elevenlabs.io/v2/voices');
  url.search = new URLSearchParams({ voice_type: 'default', gender: 'female', page_size: '100' }).toString();
  const response = await fetchImpl(url, {
    headers: { 'xi-api-key': key }, signal: AbortSignal.timeout(15_000), redirect: 'error',
  });
  if (!response.ok) throw new Error(`ElevenLabs voice listing HTTP ${response.status}; this alone does not test TTS permission.`);
  const data = await response.json();
  const voice = data.voices?.find(item => item.voice_id === PREVIEW.voiceId && item.category === 'premade');
  if (!voice) throw new Error('Selected stock voice is not available; no audio generated.');
  return { http: response.status, voiceId: voice.voice_id, voiceName: voice.name };
}

export async function generatePreview(key, fetchImpl = fetch) {
  const started = performance.now();
  const response = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${PREVIEW.voiceId}?output_format=mp3_44100_128`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000),
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: PREVIEW.text, model_id: PREVIEW.modelId,
      voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
    }),
  });
  if (!response.ok) throw new Error(`ElevenLabs TTS HTTP ${response.status}; no automatic retry or key change.`);
  if (!response.headers.get('content-type')?.startsWith('audio/')) throw new Error('Expected audio response; no file saved.');
  const audio = Buffer.from(await response.arrayBuffer());
  if (!audio.length || audio.length > 5 * 1024 * 1024) throw new Error('Unexpected audio size; no file saved.');
  return { audio, http: response.status, elapsedMs: Math.round(performance.now() - started) };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !['--check', '--generate'].includes(args[0])) {
    console.log('Usage: node tools/elevenlabs-lab-preview.mjs --check | --generate');
    console.log('--check lists the selected voice; --generate additionally spends credits on one short audio sample.');
    return;
  }
  const root = fileURLToPath(new URL('../', import.meta.url));
  const { key, sameAliases } = selectKey(parseEnv(await readFile(join(root, '.env'), 'utf8')));
  const checked = await checkVoice(key);
  console.log(JSON.stringify({ ...checked, sameAliases, ttsTested: false }));
  if (args[0] !== '--generate') return;
  const generated = await generatePreview(key);
  const directory = join(root, 'lab', 'data', 'voice-previews');
  await mkdir(directory, { recursive: true });
  const stem = `sarah-sv-${randomUUID()}`;
  const output = join(directory, `${stem}.mp3`);
  await writeFile(output, generated.audio, { flag: 'wx' });
  const metadata = {
    schemaVersion: 1, purpose: 'standalone-lab-voice-preview', generatedAt: new Date().toISOString(),
    ...PREVIEW, http: generated.http, elapsedMs: generated.elapsedMs,
    bytes: generated.audio.length, sha256: createHash('sha256').update(generated.audio).digest('hex'),
    audioFile: `${stem}.mp3`, productionApproved: false, syncedVideo: null,
  };
  await writeFile(join(directory, `${stem}.json`), `${JSON.stringify(metadata, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ ttsTested: true, http: generated.http, elapsedMs: generated.elapsedMs, bytes: generated.audio.length, output }));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    // Do not dump provider response bodies, credentials, request objects or stacks.
    console.error(error instanceof Error && !error.cause ? error.message : 'Voice preview failed; no automatic retry.');
    process.exitCode = 1;
  });
}
