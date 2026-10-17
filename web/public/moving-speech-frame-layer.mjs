// Consumer for Emil's 24 fps Annex-B mouth frames. Protocol reference:
// kevin-staging ae9fedc54a2ef4f26a507eb98134f88f6011cc89, public/lip-layer.js.
// No sockets, provider calls or automatic activation live here. The caller must
// admit the session and verify the audio, source files and worker avatar bank.
const FPS = 24, LEAD_MS = 220, MAX_FRAMES = 600, MAX_CHUNK_FRAMES = 12;
const MAX_BYTES = 2 * 1024 * 1024, MAX_BUFFERED_FRAMES = 48;
const HASH = /^[a-f0-9]{64}$/, ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TAKE = /^[a-z][a-z0-9-]{0,63}$/;
const KEYS = ['dealerId', 'workerAvatar', 'sessionId', 'talkId', 'revision',
  'profileRevision', 'textSha256', 'audioSha256', 'avatarSha256'];
const int = n => Number.isSafeInteger(n) && n >= 0;
const fail = code => { throw Error(code); };
const sameBinding = (a, b) => a && KEYS.every(k => a[k] === b[k]);

/** Each worker chunk starts with an AUD and an independently decodable IDR. */
export function splitMovingSpeechAccessUnits(bytes) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > MAX_BYTES) fail('invalid_moving_speech_bytes');
  const nals = [];
  for (let i = 0; i + 3 < bytes.length; i++) {
    if (bytes[i] || bytes[i + 1]) continue;
    const head = bytes[i + 2] === 1 ? i + 3 : bytes[i + 2] === 0 && bytes[i + 3] === 1 ? i + 4 : -1;
    if (head < 0) continue;
    if (head >= bytes.length) fail('invalid_moving_speech_annexb');
    nals.push({ at: i, type: bytes[head] & 31 }); i = head;
  }
  if (nals[0]?.at !== 0 || nals[0]?.type !== 9) fail('invalid_moving_speech_annexb');
  const units = [];
  for (let i = 0; i < nals.length;) {
    let end = i + 1;
    while (end < nals.length && nals[end].type !== 9) end++;
    const group = nals.slice(i, end);
    if (!group.some(n => n.type === 1 || n.type === 5)) fail('invalid_moving_speech_annexb');
    units.push({ data: bytes.subarray(nals[i].at, nals[end]?.at ?? bytes.length), key: group.some(n => n.type === 5) });
    i = end;
  }
  if (!units[0]?.key || units.length > MAX_CHUNK_FRAMES) fail('invalid_moving_speech_annexb');
  return units;
}

/** Returned VideoFrames belong to the caller; all error paths close them. */
export async function decodeMovingSpeechChunk(bytes, { signal } = {}) {
  const units = splitMovingSpeechAccessUnits(bytes), frames = [];
  if (typeof VideoDecoder !== 'function' || typeof EncodedVideoChunk !== 'function') fail('moving_speech_decoder_unavailable');
  let error, terminal = false;
  const decoder = new VideoDecoder({
    output(frame) { if (terminal) frame.close(); else frames.push(frame); },
    error(cause) { error = cause; },
  });
  const abort = () => { error = Error('moving_speech_decode_cancelled'); if (decoder.state !== 'closed') decoder.close(); };
  const timer = setTimeout(abort, 5000);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    if (signal?.aborted) abort();
    if (error) throw error;
    decoder.configure({ codec: 'avc1.42E01F', optimizeForLatency: true });
    for (let i = 0; i < units.length; i++) decoder.decode(new EncodedVideoChunk({
      type: units[i].key ? 'key' : 'delta', timestamp: Math.round(i * 1e6 / FPS), data: units[i].data,
    }));
    await decoder.flush();
    if (error) throw error;
    frames.sort((a, b) => a.timestamp - b.timestamp);
    if (frames.length !== units.length || frames.some((frame, i) => frame.displayWidth !== 256
      || frame.displayHeight !== 512 || frame.timestamp !== Math.round(i * 1e6 / FPS))) fail('invalid_moving_speech_decoded_frames');
    return frames;
  } catch (cause) { frames.forEach(frame => frame.close()); throw cause; }
  finally { terminal = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); if (decoder.state !== 'closed') decoder.close(); }
}

async function readPlan(input) {
  const binding = Object.fromEntries(KEYS.map(k => [k, input?.binding?.[k]]));
  if (['dealerId', 'workerAvatar', 'sessionId', 'talkId'].some(k => typeof binding[k] !== 'string' || !ID.test(binding[k]))
    || ['profileRevision', 'textSha256', 'audioSha256', 'avatarSha256'].some(k => typeof binding[k] !== 'string' || !HASH.test(binding[k]))
    || !int(binding.revision) || !binding.revision || input.fps !== FPS || input.audioLeadMs !== LEAD_MS
    || !HASH.test(input.planSha256 ?? '') || !Array.isArray(input.timeline) || !input.timeline.length
    || input.timeline.length > MAX_FRAMES) fail('invalid_moving_speech_plan');
  const timeline = input.timeline.map(row => {
    if (!TAKE.test(row?.take ?? '') || !int(row.frame) || !HASH.test(row.sourceSha256 ?? '')
      || (row.take === 'vila' && row.frame !== 0)) fail('invalid_moving_speech_plan');
    return Object.freeze({ take: row.take, frame: row.frame, sourceSha256: row.sourceSha256 });
  });
  const fromFrame = input.start?.fran_ruta;
  if (!int(fromFrame) || fromFrame >= timeline.length) fail('invalid_moving_speech_plan');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ binding, timeline, fromFrame })));
  const planSha256 = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  const id = `${binding.talkId}#${binding.revision}#${planSha256}`;
  if (planSha256 !== input.planSha256 || id !== input.start.id) fail('moving_speech_plan_hash_mismatch');
  return Object.freeze({ binding: Object.freeze(binding), timeline: Object.freeze(timeline), fromFrame, planSha256, id });
}

/**
 * One instance per frozen plan/revision. Replanning MUST close the old instance.
 * push() pairs one authenticated `lapp` JSON message with its following binary.
 * paint() uses the playing audio clock and the actual presented body frame. It
 * never searches nearby frames and never uses wall time. Missing data leaves
 * the original body visible; no successful lip-sync receipt is implied.
 */
export async function createMovingSpeechFrameLayer({ plan: input, document, decode = decodeMovingSpeechChunk } = {}) {
  const plan = await readPlan(input), frames = new Map(), seen = new Set();
  const controller = new AbortController();
  let closed = false, queued = 0, reserved = 0, tail = Promise.resolve(), floor = plan.fromFrame, lastPaint = -1;
  let source, patch, patchContext, packed, packedContext;
  const discard = before => { for (const [k, value] of frames) if (k < before) { value.frame?.close(); frames.delete(k); } };
  function tagsFor(meta) {
    if (meta?.id !== plan.id) return null;
    if (meta.t !== 'lapp' || !int(meta.del) || meta.del >= MAX_FRAMES || !int(meta.fran)
      || !Array.isArray(meta.rutor) || !meta.rutor.length || meta.rutor.length > MAX_CHUNK_FRAMES
      || meta.fran < plan.fromFrame || meta.fran + meta.rutor.length > plan.timeline.length) fail('invalid_moving_speech_chunk');
    // `fran` and rutor.length are the frame indices used by Kevin's consumer.
    // `till` is informational; do not guess an inclusive/exclusive convention.
    return meta.rutor.map((tag, i) => {
      if (tag === null) return null;
      const expected = plan.timeline[meta.fran + i], rect = tag?.rect;
      if (tag?.tagning !== expected.take || tag?.ruta !== expected.frame || !Array.isArray(rect) || rect.length !== 4
        || rect.some(v => !Number.isFinite(v) || v < 0) || rect[2] <= 0 || rect[3] <= 0) fail('invalid_moving_speech_tag');
      return Object.freeze({ rect: Object.freeze([...rect]) });
    });
  }
  async function push(meta, bytes) {
    if (closed) return false;
    const tags = tagsFor(meta);
    if (!tags || seen.has(meta.del)) return false;
    if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > MAX_BYTES) fail('invalid_moving_speech_bytes');
    if (queued >= 4 || frames.size + reserved + tags.length > MAX_BUFFERED_FRAMES) fail('moving_speech_buffer_full');
    const first = meta.fran, part = meta.del;
    if (first + tags.length <= floor) return false;
    const ownedBytes = bytes.slice();
    seen.add(part); queued++; reserved += tags.length;
    const task = tail.then(async () => {
      if (closed) { ownedBytes.fill(0); return false; }
      let decoded = [];
      try {
        decoded = await decode(ownedBytes, { signal: controller.signal });
        if (closed) return false;
        if (decoded.length !== tags.length || decoded.some(frame => frame.displayWidth !== 256 || frame.displayHeight !== 512)) fail('invalid_moving_speech_decoded_frames');
        if (tags.some((_, i) => frames.has(first + i))) fail('moving_speech_chunk_overlap');
        decoded.forEach((frame, i) => {
          const k = first + i;
          if (k >= floor) { frames.set(k, { frame: tags[i] ? frame : null, tag: tags[i] }); if (!tags[i]) frame.close(); }
          else frame.close();
        });
        decoded = []; return true;
      } finally { decoded.forEach(frame => frame.close()); ownedBytes.fill(0); }
    });
    tail = task.catch(() => {});
    try { return await task; }
    finally { queued--; reserved -= tags.length; }
  }
  function paint(video, presented) {
    if (closed || presented?.audioPlaying !== true || !sameBinding(presented.binding, plan.binding)
      || presented.planSha256 !== plan.planSha256 || !Number.isFinite(presented.audioTimeSeconds)
      || presented.audioTimeSeconds < 0) return video;
    // Playback PCM has no leading silence; the worker prepends 220 ms. A paused
    // audio element or a stale session cannot select a mouth frame.
    const k = Math.floor((presented.audioTimeSeconds + LEAD_MS / 1000) * FPS + 1e-7);
    floor = Math.max(floor, k); discard(floor);
    const expected = plan.timeline[k], item = frames.get(k);
    if (!expected || !item?.tag || presented.take !== expected.take || presented.frame !== expected.frame
      || presented.sourceSha256 !== expected.sourceSha256) return video;
    const width = video.videoWidth || video.naturalWidth, height = video.videoHeight || video.naturalHeight;
    const [x, y, w, h] = item.tag.rect;
    if (!width || !height || x + w > width || y + h > height) return video;
    source ??= document.createElement('canvas');
    if (source.width !== width || source.height !== height) { source.width = width; source.height = height; }
    if (lastPaint !== k) {
      packed ??= document.createElement('canvas'); packed.width = 256; packed.height = 512;
      packedContext ??= packed.getContext('2d', { willReadFrequently: true });
      packedContext.drawImage(item.frame, 0, 0);
      const color = packedContext.getImageData(0, 0, 256, 256), mask = packedContext.getImageData(0, 256, 256, 256);
      for (let i = 0; i < color.data.length; i += 4) color.data[i + 3] = mask.data[i];
      patch ??= document.createElement('canvas'); patch.width = patch.height = 256;
      patchContext ??= patch.getContext('2d'); patchContext.putImageData(color, 0, 0); lastPaint = k;
    }
    const context = source.getContext('2d');
    context.clearRect(0, 0, width, height); context.drawImage(video, 0, 0);
    context.drawImage(patch, x, y, w, h);
    return source;
  }
  return Object.freeze({ push, paint,
    // Playback may start/continue only with a decoded, tagged frame. A null
    // worker tag is missing visual evidence, not a license to keep audio going.
    hasFrame(index) { return !closed && int(index) && Boolean(frames.get(index)?.tag); },
    releaseBefore(index) {
      if (!int(index) || index > plan.timeline.length) fail('invalid_moving_speech_frame');
      floor = Math.max(floor, index); discard(floor);
    },
    get bufferedFrames() { return frames.size + reserved; },
    close() {
      if (closed) return; closed = true; controller.abort(); discard(Infinity); seen.clear();
      for (const canvas of [source, patch, packed]) if (canvas) canvas.width = canvas.height = 0;
    },
  });
}
