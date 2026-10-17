// The PCM clock addresses exact source samples. Never use an independently
// playing video or a nearest-frame seek for the original body.
const fail = code => { throw Error(code); };
const digest = async b => [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map(v => v.toString(16).padStart(2, '0')).join('');

// Deliberately limited to progressive AVC MP4 with one CFR video track. The
// authenticated descriptor and every sample's presentation time must agree.
export function readMovingSourceSamples(bytes, descriptor) {
  const invalid = () => fail('moving_source_mp4');
  if (!(bytes instanceof Uint8Array) || !Number.isSafeInteger(descriptor.frameCount)
    || descriptor.frameCount < 1 || descriptor.frameCount > 600 || descriptor.fps !== 24) invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = at => view.getUint32(at), i32 = at => view.getInt32(at);
  const u64 = at => { const n = Number(view.getBigUint64(at)); if (!Number.isSafeInteger(n)) invalid(); return n; };
  const text = at => String.fromCharCode(...bytes.subarray(at, at + 4));
  function boxes(start, end) {
    const result = [];
    while (start < end) {
      if (start + 8 > end) invalid();
      const type = text(start + 4), head = u32(start) === 1 ? 16 : 8;
      if (start + head > end) invalid();
      const size = u32(start) === 1 ? u64(start + 8) : u32(start) || end - start;
      if (size < head || start + size > end) invalid();
      result.push({ type, start: start + head, end: start + size }); start += size;
    }
    return result;
  }
  function one(list, type, optional = false) {
    const found = list.filter(b => b.type === type);
    if (found.length > 1 || (!optional && found.length !== 1)) invalid();
    return found[0];
  }
  const children = b => boxes(b.start, b.end);
  const need = (b, size) => { if (!b || b.end - b.start < size) invalid(); return b.start; };
  const table = (b, stride, offset = 8) => {
    const at = need(b, offset), count = u32(at + offset - 4);
    if (count > 600 || at + offset + count * stride !== b.end) invalid();
    return Array.from({ length: count }, (_, i) => at + offset + i * stride);
  };
  try {
    const root = boxes(0, bytes.length), moov = children(one(root, 'moov'));
    if (one(root, 'moof', true) || one(moov, 'mvex', true)) invalid();
    const tracks = moov.filter(b => b.type === 'trak').map(trak => ({ trak, mdia: children(one(children(trak), 'mdia')) }))
      .filter(({ mdia }) => text(need(one(mdia, 'hdlr'), 12) + 8) === 'vide');
    if (tracks.length !== 1) invalid();
    const { trak, mdia } = tracks[0], mdhd = one(mdia, 'mdhd');
    const tkhd = one(children(trak), 'tkhd'), tk = need(tkhd, bytes[tkhd.start] === 1 ? 96 : 84);
    if (bytes[tk] > 1) invalid();
    const matrix = tk + (bytes[tk] ? 52 : 40);
    if ([0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000].some((v, i) => u32(matrix + i * 4) !== v)
      || u32(matrix + 36) !== descriptor.width * 65536 || u32(matrix + 40) !== descriptor.height * 65536) invalid();
    const md = need(mdhd, bytes[mdhd.start] === 1 ? 32 : 20);
    if (bytes[md] > 1) invalid();
    const timescale = u32(md + (bytes[md] === 1 ? 20 : 12));
    if (!timescale) invalid();
    const stbl = children(one(children(one(mdia, 'minf')), 'stbl'));
    const stsd = one(stbl, 'stsd'), sd = need(stsd, 8);
    if (u32(sd + 4) !== 1) invalid();
    const entry = one(boxes(sd + 8, stsd.end), 'avc1'), av = need(entry, 78);
    if (view.getUint16(av + 24) !== descriptor.width || view.getUint16(av + 26) !== descriptor.height) fail('moving_source_dimensions');
    const extensions = boxes(av + 78, entry.end), pasp = one(extensions, 'pasp', true);
    if (one(extensions, 'clap', true) || (pasp && (need(pasp, 8), !u32(pasp.start) || u32(pasp.start) !== u32(pasp.start + 4)))) invalid();
    const avcC = one(extensions, 'avcC'); need(avcC, 7);
    const description = bytes.slice(avcC.start, avcC.end);
    if (description[0] !== 1) invalid();
    const codec = 'avc1.' + [...description.slice(1, 4)].map(v => v.toString(16).padStart(2, '0')).join('');
    const stsz = one(stbl, 'stsz'), sz = need(stsz, 12), fixedSize = u32(sz + 4), count = u32(sz + 8);
    if (count !== descriptor.frameCount || stsz.end !== sz + 12 + (fixedSize ? 0 : count * 4)) invalid();
    const samples = Array.from({ length: count }, (_, i) => ({ size: fixedSize || u32(sz + 12 + i * 4) }));
    const durations = [], composition = [];
    for (const at of table(one(stbl, 'stts'), 8)) {
      if (!u32(at) || durations.length + u32(at) > count || u32(at + 4) * descriptor.fps !== timescale) fail('moving_source_frame_timing');
      for (let i = 0; i < u32(at); i++) durations.push(u32(at + 4));
    }
    if (durations.length !== count) invalid();
    const ctts = one(stbl, 'ctts', true);
    if (ctts) {
      if (bytes[ctts.start] > 1) invalid();
      for (const at of table(ctts, 8)) {
        if (!u32(at) || composition.length + u32(at) > count) invalid();
        for (let i = 0; i < u32(at); i++) composition.push(bytes[ctts.start] ? i32(at + 4) : u32(at + 4));
      }
      if (composition.length !== count) invalid();
    }
    const stco = one(stbl, 'stco', true), co64 = one(stbl, 'co64', true);
    if (!!stco === !!co64) invalid();
    const chunks = table(stco || co64, stco ? 4 : 8).map(at => stco ? u32(at) : u64(at));
    const mapping = table(one(stbl, 'stsc'), 12).map(at => ({ first: u32(at), count: u32(at + 4), description: u32(at + 8) }));
    if (mapping[0]?.first !== 1 || mapping.some((m, i) => !m.count || m.description !== 1 || m.first > chunks.length || (i && m.first <= mapping[i - 1].first))) invalid();
    const mdats = root.filter(b => b.type === 'mdat'); let sample = 0, group = 0;
    chunks.forEach((start, index) => {
      while (mapping[group + 1]?.first <= index + 1) group++;
      for (let i = 0; i < mapping[group].count; i++) {
        const row = samples[sample++];
        if (!row?.size || !mdats.some(b => start >= b.start && start + row.size <= b.end)) invalid();
        row.data = bytes.subarray(start, start + row.size); start += row.size;
      }
    });
    if (sample !== count) invalid();
    const stss = one(stbl, 'stss', true), keys = stss ? table(stss, 4).map(at => u32(at) - 1) : samples.map((_, i) => i);
    if (keys[0] !== 0 || keys.some((k, i) => k >= count || (i && k <= keys[i - 1]))) invalid();
    let mediaStart = 0;
    const edts = one(children(trak), 'edts', true);
    if (edts) {
      const elst = one(children(edts), 'elst'), at = need(elst, 8), version = bytes[at];
      if (version > 1 || u32(at + 4) !== 1 || elst.end !== at + (version ? 28 : 20)) invalid();
      mediaStart = version ? Number(view.getBigInt64(at + 16)) : i32(at + 12);
      if (!Number.isSafeInteger(mediaStart) || mediaStart < 0 || u32(at + (version ? 24 : 16)) !== 0x10000) invalid();
      const mvhd = one(moov, 'mvhd'), mv = need(mvhd, bytes[mvhd.start] === 1 ? 32 : 20);
      if (bytes[mv] > 1) invalid();
      const movieScale = u32(mv + (bytes[mv] ? 20 : 12)), duration = version ? u64(at + 8) : u32(at + 8);
      if (!movieScale || Math.abs(duration - count * movieScale / descriptor.fps) > 1) invalid();
    }
    const seen = new Set(); let dts = 0;
    samples.forEach((row, i) => {
      const ticks = dts + (composition[i] || 0) - mediaStart, frame = ticks * descriptor.fps / timescale;
      if (!Number.isInteger(frame) || frame < 0 || frame >= count || seen.has(frame)) fail('moving_source_frame_timing');
      seen.add(frame); row.frame = frame; row.timestamp = Math.round(frame * 1e6 / descriptor.fps); row.key = keys.includes(i); dts += durations[i];
    });
    return { samples, config: { codec, description, codedWidth: descriptor.width, codedHeight: descriptor.height } };
  } catch (error) {
    if (error instanceof RangeError) invalid();
    throw error;
  }
}

export function createMovingSourceFrames(sequence, { signal, document = globalThis.document, fetchImpl = fetch,
  makeFrame, Decoder = globalThis.VideoDecoder, Chunk = globalThis.EncodedVideoChunk, limit = 24 } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 24) fail('moving_source_buffer_limit');
  const lifetime = new AbortController(); signal = signal ? AbortSignal.any([signal, lifetime.signal]) : lifetime.signal;
  const frames = new Map(), sources = new Map(), canvas = document.createElement('canvas'), copy = document.createElement('canvas');
  let floor = 0, closed = false, job = null, error = null, totalBytes = 0;
  const check = () => { signal.throwIfAborted(); if (closed) fail('moving_source_closed'); if (error) throw error; };
  // Copy pixels off the decoder surface immediately. Holding VideoFrame(video)
  // or clone() can exhaust Chrome's 1080p surface pool before 24 frames exist.
  const snapshot = makeFrame || (frame => {
    if (copy.width !== frame.displayWidth || copy.height !== frame.displayHeight) { copy.width = frame.displayWidth; copy.height = frame.displayHeight; }
    copy.getContext('2d').drawImage(frame, 0, 0);
    return new VideoFrame(copy, { timestamp: frame.timestamp });
  });
  async function source(take) {
    if (sources.has(take)) return sources.get(take);
    const descriptor = sequence.sources.find(s => 'clip-' + s.videoId === take); if (!descriptor) fail('moving_source_missing');
    totalBytes += descriptor.bytes; if (totalBytes > 96 * 1024 * 1024) fail('moving_source_budget');
    const response = await fetchImpl(descriptor.url, { signal, credentials: 'same-origin', redirect: 'error', cache: 'no-store' });
    if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'video/mp4') fail('moving_source_unavailable');
    const reader = response.body?.getReader(); if (!reader) fail('moving_source_unavailable');
    const parts = []; let size = 0;
    try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length;
      if (size > descriptor.bytes) { await reader.cancel(); fail('moving_source_size'); } parts.push(part.value); } }
    finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    if (size !== descriptor.bytes || await digest(bytes) !== descriptor.sha256) fail('moving_source_hash'); check();
    const owned = { descriptor, ...readMovingSourceSamples(bytes, descriptor) }; sources.set(take, owned); return owned;
  }
  async function decodeWindow(take, wanted) {
    const { descriptor, samples, config } = await source(take); check();
    if (typeof Decoder !== 'function' || typeof Chunk !== 'function') fail('moving_source_decoder_unavailable');
    const first = samples.findIndex(s => wanted.has(s.frame));
    if (first < 0 || [...wanted.keys()].some(k => !samples.some(s => s.frame === k))) fail('moving_source_frame_index');
    let start = first; while (start && !samples[start].key) start--;
    const end = Math.max(...samples.map((s, i) => wanted.has(s.frame) ? i : -1));
    const expected = new Map(samples.slice(start, end + 1).map(s => [s.timestamp, s.frame])), seen = new Set();
    let decoder, terminal = false, batchError, rejectPromise;
    const failure = new Promise((_, reject) => { rejectPromise = reject; });
    const rejectFailure = cause => { batchError ||= cause; rejectPromise(cause); };
    void failure.catch(() => {});
    const abort = () => rejectFailure(Error('moving_source_aborted'));
    const timer = setTimeout(() => rejectFailure(Error('moving_source_timeout')), 5000);
    signal.addEventListener('abort', abort, { once: true });
    try {
      decoder = new Decoder({ output(frame) {
        try {
          if (terminal || batchError) return;
          const index = expected.get(frame.timestamp);
          if (index === undefined || seen.has(index) || frame.displayWidth !== descriptor.width || frame.displayHeight !== descriptor.height) fail('moving_source_decoded_frame');
          seen.add(index);
          for (const k of wanted.get(index) || []) if (k >= floor && !closed) frames.set(k, snapshot(frame));
        } catch (cause) { rejectFailure(cause); } finally { frame.close(); }
      }, error: rejectFailure });
      decoder.configure(config); check();
      for (let i = start; i <= end; i++) decoder.decode(new Chunk({ type: samples[i].key ? 'key' : 'delta', timestamp: samples[i].timestamp, data: samples[i].data }));
      // Flush only at a batch boundary; the next batch restarts at its exact
      // preceding key sample. Twelve-frame refills amortize that dependency work.
      await Promise.race([decoder.flush(), failure]); if (batchError) throw batchError; check();
      if ([...wanted.keys()].some(k => !seen.has(k))) fail('moving_source_frame_missing');
    } finally {
      terminal = true; clearTimeout(timer); signal.removeEventListener('abort', abort);
      if (decoder && decoder.state !== 'closed') decoder.close();
    }
  }
  async function fill() {
    const end = Math.min(sequence.frames.length, floor + limit), groups = new Map();
    for (let k = floor; k < end; k++) if (!frames.has(k)) {
      const row = sequence.frames[k];
      if (!groups.has(row.take)) groups.set(row.take, new Map());
      const group = groups.get(row.take); if (!group.has(row.frame)) group.set(row.frame, []); group.get(row.frame).push(k);
    }
    for (const [take, wanted] of groups) await decodeWindow(take, wanted);
  }
  function prefetch(from) {
    if (!Number.isSafeInteger(from) || from < 0 || from > sequence.frames.length) fail('moving_source_frame_index');
    check(); floor = Math.max(floor, from);
    for (const [k, frame] of frames) if (k < floor) { frame.close(); frames.delete(k); }
    if (!job && frames.size <= Math.floor(limit / 2)) job = fill().catch(cause => { error = cause; }).finally(() => { job = null; });
    return (job || Promise.resolve()).then(check);
  }
  return { prefetch, get(k) { check(); const frame = frames.get(k); if (!frame) fail('moving_source_frame_unavailable');
    canvas.width = canvas.videoWidth = frame.displayWidth; canvas.height = canvas.videoHeight = frame.displayHeight;
    canvas.getContext('2d').drawImage(frame, 0, 0); return canvas; }, has: k => frames.has(k), get buffered() { return frames.size; },
    close() { closed = true; lifetime.abort(); for (const frame of frames.values()) frame.close(); frames.clear(); sources.clear(); canvas.width = canvas.height = copy.width = copy.height = 0; },
  };
}
