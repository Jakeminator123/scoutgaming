import { mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { assertMovingSpeechSource, createMovingSpeechSourceSet, movingSpeechHash } from '../web/moving-speech-bank.mjs';

const exec = promisify(execFile);
const fail = code => { throw Error(code); };
export async function probeMovingSpeechSource(file, { signal, ffprobe = 'ffprobe' } = {}) {
  const { stdout } = await exec(ffprobe, ['-v', 'error', '-protocol_whitelist', 'file,pipe',
    '-format_whitelist', 'mov', '-select_streams', 'v:0', '-show_frames',
    '-show_entries', 'stream=width,height,avg_frame_rate,r_frame_rate:frame=best_effort_timestamp_time',
    '-of', 'json', file], { signal, timeout: 90000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  const result = JSON.parse(stdout), stream = result.streams?.[0], frames = result.frames;
  if (!stream || !Array.isArray(frames) || !frames.length || frames.length > 600) fail('moving_bank_frame_limit');
  if (stream.avg_frame_rate !== '24/1' || stream.r_frame_rate !== '24/1'
    || frames.some((f, i) => !Number.isFinite(Number(f.best_effort_timestamp_time))
      || Math.abs(Number(f.best_effort_timestamp_time) - i / 24) > 0.000002)) fail('moving_bank_requires_cfr24');
  if (stream.width !== 1080 || stream.height !== 1920) fail('moving_bank_geometry_unsupported');
  return { fps: 24, frameCount: frames.length, width: stream.width, height: stream.height };
}

async function readSource(response, video, signal) {
  if (response?.status !== 200 || !response.body
    || response.headers.get('content-type')?.split(';')[0] !== 'video/mp4') {
    await response?.body?.cancel(); fail('moving_bank_source_unavailable');
  }
  const chunks = [], reader = response.body.getReader();
  const stop = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', stop, { once: true });
  let length = 0;
  try {
    for (;;) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > video.bytes) fail('moving_bank_source_changed');
      chunks.push(Buffer.from(value));
    }
    signal.throwIfAborted();
    const bytes = Buffer.concat(chunks, length);
    if (length !== video.bytes || movingSpeechHash(bytes) !== video.sha256) fail('moving_bank_source_changed');
    return bytes;
  } finally { signal.removeEventListener('abort', stop); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

/** Authoring only: GET from the existing private registry, immutable staging.
 * The output directory must be new. No database or Blob writes, re-encoding,
 * voice calls, approval changes or automatic worker launch.
 */
export async function prepareMovingSpeechSources({ dealerId, workerAvatar = dealerId, rest, output,
  readRegistry, readVideoResponse, probe = probeMovingSpeechSource, signal } = {}) {
  if (!output || typeof readRegistry !== 'function' || typeof readVideoResponse !== 'function') fail('moving_bank_configuration');
  const operation = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(10 * 60 * 1000)]);
  operation.throwIfAborted();
  const registry = await readRegistry();
  const candidates = registry?.videos?.filter(v => v.dealer === dealerId && !v.classification?.archived
    && ['action', 'idle'].includes(v.classification?.kind) && !v.classification?.recordedSpeech);
  if (!candidates?.length || candidates.length > 128) fail('moving_bank_no_sources');
  const ids = new Set();
  for (const video of candidates) {
    assertMovingSpeechSource(video, dealerId);
    if (ids.has(video.id)) fail('moving_bank_duplicate_media');
    ids.add(video.id);
  }
  const directory = resolve(output);
  await mkdir(directory); // EEXIST deliberately protects prior work and originals.
  await mkdir(join(directory, 'sources'));
  const clips = [], skipped = [];
  for (const video of candidates.sort((a, b) => a.id.localeCompare(b.id))) {
    operation.throwIfAborted();
    const response = await readVideoResponse(video.id, new Request('https://studio.invalid/api/moving-speech-source', { signal: operation }));
    const bytes = await readSource(response, video, operation);
    const file = join(directory, 'sources', video.id + '.mp4');
    await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
    let metadata;
    try { metadata = await probe(file, { signal: operation }); }
    catch (error) {
      if (!['moving_bank_requires_cfr24', 'moving_bank_geometry_unsupported', 'moving_bank_frame_limit'].includes(error.message)) throw error;
      skipped.push({ videoId: video.id, sha256: video.sha256, reason: error.message }); continue;
    }
    clips.push({ videoId: video.id, sha256: video.sha256, bytes: video.bytes, ...metadata });
  }
  const current = await readRegistry();
  operation.throwIfAborted();
  for (const clip of clips) {
    const matches = current?.videos?.filter(v => v.id === clip.videoId);
    if (matches?.length !== 1) fail('moving_bank_source_changed');
    assertMovingSpeechSource(matches[0], dealerId, clip);
  }
  const sourceSet = createMovingSpeechSourceSet({ dealerId, workerAvatar, clips, rest });
  await writeFile(join(directory, 'export-receipt.json'), JSON.stringify({ status: 'sources-verified',
    sourceSetSha256: sourceSet.sourceSetSha256, verifiedAt: new Date().toISOString(), skipped,
    originalBytesPreserved: true, visualApproval: false, workerPrepared: false }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  // Written last; an incomplete directory can never look like a complete source set.
  await writeFile(join(directory, 'sources.json'), JSON.stringify(sourceSet, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return { sourceSet, skipped };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== '--dealer' || args[2] !== '--output') {
    fail('Usage: node tools/prepare-moving-speech-sources.mjs --dealer <id> --output <new-directory>');
  }
  const { studioGamePolicyConfiguration } = await import('../packages/presentation/server/saved-game-policy.mjs');
  const configuration = studioGamePolicyConfiguration();
  if (!configuration) fail('moving_bank_cloud_configuration_required');
  const { createStudioRepository } = await import('../packages/studio-registry/server/document-repository.mjs');
  const { createNeonVideoRegistry } = await import('../lab/lib/neon-video-registry.mjs');
  const { Pool } = createRequire(new URL('../web/package.json', import.meta.url))('pg');
  const pool = new Pool({ connectionString: configuration.connectionString, max: 1,
    options: '-c default_transaction_read_only=on' });
  try {
    const repository = createStudioRepository({ pool, scope: configuration.scope });
    const registry = createNeonVideoRegistry({ repository, scope: configuration.scope });
    const readReference = async () => {
      const project = await repository.readDocument('project');
      const dealers = project?.value?.dealers?.filter(d => d.id === args[1]);
      const reference = dealers?.length === 1 ? dealers[0].speechProfile?.reference : null;
      if (reference?.kind !== 'motion-video' || !Number.isSafeInteger(reference.offsetMs * 24 / 1000)) fail('moving_bank_motion_reference_required');
      return reference;
    };
    const reference = await readReference();
    const result = await prepareMovingSpeechSources({ dealerId: args[1], output: args[3],
      rest: { videoId: reference.videoId, frame: reference.offsetMs * 24 / 1000 },
      readRegistry: async () => {
        if (JSON.stringify(await readReference()) !== JSON.stringify(reference)) fail('moving_bank_reference_changed');
        const inventory = await registry.load();
        const source = inventory.videos.find(v => v.id === reference.videoId);
        if (source?.sha256 !== reference.sha256) fail('moving_bank_reference_changed');
        return inventory;
      }, readVideoResponse: registry.response });
    console.log(JSON.stringify({ status: 'sources-verified', clips: result.sourceSet.clips.length,
      skipped: result.skipped, sourceSetSha256: result.sourceSet.sourceSetSha256, workerPrepared: false }));
  } finally { await pool.end(); }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(/^moving_bank_|^Usage:/.test(error.message) ? error.message : 'moving_bank_export_failed'); process.exitCode = 1; });
}
