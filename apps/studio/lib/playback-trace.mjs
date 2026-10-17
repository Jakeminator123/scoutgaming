// Read-only projection of the existing observation channel. Instructions,
// selection and preparation never establish that a film was presented.
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = value => typeof value === 'string' && value ? value : null;
const version = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const kind = value => value === 'speech' ? 'speak' : value;
const terminal = new Set(['end', 'completed', 'interrupted', 'error', 'fallback']);
const actualStart = new Set(['media-playing', 'presented-frame', 'video-frame']);
const eventOf = data => {
  const source = object(data.sourceEvent);
  return { type: kind(source.type ?? data.event), line: source.line ?? data.line ?? null,
    to: source.to ?? data.to ?? null, box: source.box ?? data.box ?? null,
    shoeDraw: source.shoeDraw ?? data.shoeDraw ?? null };
};
const signature = event => JSON.stringify([event.type, event.line, event.to, event.box, event.shoeDraw]);

export function playbackOutcome(row) {
  if (row.interrupted) return 'Avbrutet';
  if (row.fallback) return 'Reserv';
  if (row.failed) return 'Fel';
  if (row.ended && row.played) return 'Spelat klart';
  if (row.ended) return 'Slutkvitto utan visad start';
  if (row.played) return 'Visad / spelad';
  if (row.started) return 'Start begärd · bild ej kvitterad';
  if (row.selected) return 'Valt · ej spelat';
  return 'Event mottaget · ej spelat';
}

export function buildPlaybackTrace(records, { inventory = {}, clipInventory = null, dealerId, savedRevision = null } = {}) {
  const rows = [], speech = [], seen = new Set(), attachments = new Set(), active = new Map(), requests = new Map(), floors = new Map(), sequences = new Map();
  const chats = new Map(), knownMedia = new Set();
  let epoch = 0, latestChannel = null, latestVersion = null, mode = null, projectRevision = null, activeDealer = dealerId;
  let duplicates = 0, stale = 0, diagnostics = 0, gaps = 0;
  const makeRow = (channel, data, time, event, instruction = false) => {
    const row = { id: `playback:${rows.length}`, channel, epoch, event, time, dealerId: text(data.dealerId) ?? text(data.dealer) ?? activeDealer,
      requestId: text(data.requestId), commandRequestId: instruction ? text(data.requestId) : null,
      version: version(data.version), projectRevision: null, familyId: null, variantId: null,
      mediaId: null, fileName: null, reason: null, provider: null, mode: null,
      selected: false, started: false, played: false, ended: false, interrupted: false,
      failed: false, fallback: false, historical: false, receipts: [] };
    rows.push(row); return row;
  };
  const chatFor = (channel, requestId) => {
    const key = JSON.stringify([epoch, channel, requestId]);
    if (!chats.has(key)) {
      const row = { id: `speech:${speech.length}`, channel, epoch, requestId, stages: [],
        started: false, played: false, ended: false, interrupted: false, failed: false, fallback: false, historical: false };
      speech.push(row); chats.set(key, row);
    }
    return chats.get(key);
  };
  for (const input of Array.isArray(records) ? records : []) {
    const record = object(input), data = object(record.data), channel = text(record.channel) ?? 'configured-partner';
    if (data.state === 'observation-reset') {
      active.clear(); requests.clear(); chats.clear(); epoch++; gaps++;
      for (const [id, value] of Object.entries(object(data.previousVersionByChannel))) if (version(value) !== null) floors.set(id, value);
      for (const [id, value] of Object.entries(object(data.previousNativeSequenceByChannel))) if (version(value) !== null) sequences.set(id, value);
      continue;
    }
    if (record.source !== 'native') { if (record.source === 'partner') diagnostics++; continue; }
    if (record.kind === 'status' && data.state === 'attached') {
      const attachment = JSON.stringify([channel, record.id, record.time]);
      if (attachments.has(attachment)) { duplicates++; continue; }
      attachments.add(attachment);
      active.clear(); requests.clear(); chats.clear(); epoch++; latestChannel = channel; sequences.delete(channel); floors.delete(channel);
      activeDealer = text(data.dealerId) ?? text(data.dealer) ?? dealerId;
      latestVersion = null; mode = null; projectRevision = null; continue;
    }
    const rawIdentity = text(record.id) ?? (version(record.nativeSequence) !== null ? String(record.nativeSequence) : null);
    const identity = rawIdentity ? `${epoch}:${channel}:${rawIdentity}` : null;
    if (identity && seen.has(identity)) { duplicates++; continue; }
    if (version(record.nativeSequence) !== null && record.nativeSequence <= (sequences.get(channel) ?? -1)) { stale++; continue; }
    if (identity) seen.add(identity);
    if (version(record.nativeSequence) !== null) sequences.set(channel, record.nativeSequence);
    const historical = record.origin === 'import' || record.replay === true || record.replayed === true;
    if (record.kind === 'status' && ['gap', 'reconnected'].includes(data.state)) {
      active.clear(); requests.clear(); chats.clear(); gaps++; continue;
    }
    if (!historical) latestChannel = channel;
    const tableVersion = version(data.version);
    if (tableVersion !== null && tableVersion < (floors.get(channel) ?? -1)) { stale++; continue; }
    if (!historical && tableVersion !== null) latestVersion = tableVersion;
    if (record.kind === 'status' && ['chat-progress', 'chat-failed', 'probe'].includes(data.state)) {
      if (!text(data.requestId)) continue;
      const chat = chatFor(channel, data.requestId); chat.historical ||= historical;
      if (data.state === 'chat-failed' || data.stage === 'failed') chat.failed = true;
      // Probe's decision/played status is an initiative diagnostic; the media
      // lifecycle remains the only source of a generated-video played badge.
      chat.stages.push({ stage: data.state === 'probe' ? `probe-${data.stage}` : data.stage ?? 'failed',
        time: record.time, elapsedMs: data.elapsedMs, reason: data.reason });
      continue;
    }
    if (['round', 'state'].includes(record.kind)) {
      if (tableVersion !== null && tableVersion <= (floors.get(channel) ?? -1)) { stale++; continue; }
      for (const event of Array.isArray(data.events) ? data.events : []) {
        const source = eventOf({ sourceEvent: event });
        const key = JSON.stringify([epoch, channel, tableVersion, signature(source)]);
        if (active.has(key)) continue;
        const row = makeRow(channel, data, record.time, source, true);
        row.historical = historical; active.set(key, row);
      }
      continue;
    }
    if (record.kind !== 'playback') continue;
    if (data.event === 'configuration') {
      if (!historical) { mode = text(data.mode); projectRevision = text(data.projectRevision); }
      continue;
    }
    if (data.event === 'idle-advice') continue;
    const phase = text(data.state), event = eventOf(data);
    const generated = /^generated-lipsync/.test(String(data.source)) || Boolean(data.streamId || data.packageId);
    if (generated) {
      const requestId = text(data.requestId) ?? text(data.streamId) ?? text(data.packageId);
      if (!requestId) continue;
      const chat = chatFor(channel, requestId); chat.historical ||= historical;
      chat.started ||= phase === 'start'; chat.played ||= phase === 'presented' || phase === 'start' && actualStart.has(data.evidence);
      chat.ended ||= ['end', 'completed'].includes(phase); chat.interrupted ||= phase === 'interrupted'; chat.failed ||= phase === 'error';
      chat.fallback ||= phase === 'fallback';
      chat.stages.push({ stage: phase, time: record.time, evidence: data.evidence, reason: data.reason });
      continue;
    }
    const key = JSON.stringify([epoch, channel, tableVersion, signature(event)]);
    let row = active.get(key);
    const mediaId = text(data.mediaId) ?? text(object(data.media).videoId) ?? text(data.takeId) ?? text(data.clip);
    const requestKey = text(data.requestId) ? JSON.stringify([epoch, channel, tableVersion, data.requestId, signature(event)]) : null;
    const mediaRequestKey = requestKey && mediaId ? `${requestKey}:${mediaId}` : null;
    if (phase !== 'selected' && requestKey) {
      const correlated = mediaRequestKey ? requests.get(mediaRequestKey) : requests.get(requestKey);
      if (correlated) row = correlated;
      else if (row?.selected && (row.requestId !== data.requestId || mediaId && row.mediaId !== mediaId)) row = null;
    }
    const newAttempt = row && (terminal.has(row.receipts.at(-1)?.state) && ['selected', 'start'].includes(phase)
      || phase === 'selected' && row.selected && (row.requestId !== data.requestId || mediaId && row.mediaId !== mediaId)
      || phase === 'start' && row.started && row.mediaId !== mediaId);
    if (!row || newAttempt) { row = makeRow(channel, data, record.time, event); row.historical = historical; active.set(key, row); }
    if (!row.commandRequestId && !row.selected && row.requestId !== data.requestId) row.commandRequestId = row.requestId;
    if (text(data.requestId)) row.requestId = data.requestId;
    row.projectRevision = text(data.projectRevision) ?? row.projectRevision;
    row.familyId = text(data.familyId) ?? text(object(data.media).familyId) ?? row.familyId;
    row.variantId = text(data.variantId) ?? row.variantId;
    row.mediaId = mediaId ?? row.mediaId;
    row.fileName = text(data.fileName) ?? text(object(data.media).fileName) ?? row.fileName;
    row.reason = text(data.reason) ?? row.reason; row.provider = text(data.provider) ?? row.provider;
    row.mode = text(data.mode) ?? row.mode;
    row.selected ||= phase === 'selected'; row.started ||= phase === 'start';
    row.played ||= phase === 'presented' && data.evidence === 'video-frame'
      || phase === 'start' && actualStart.has(data.evidence);
    row.ended ||= ['end', 'completed'].includes(phase); row.interrupted ||= phase === 'interrupted';
    row.failed ||= phase === 'error'; row.fallback ||= phase === 'fallback';
    row.historical ||= historical;
    row.receipts.push({ state: phase, time: record.time, evidence: data.evidence, reason: data.reason });
    if (requestKey) requests.set(requestKey, row);
    if (mediaRequestKey) requests.set(mediaRequestKey, row);
    if (row.played && row.mediaId && !row.historical) knownMedia.add(`${row.dealerId ?? ''}:${row.mediaId}`);
    if (!historical) { mode = text(data.mode) ?? mode; projectRevision = row.projectRevision ?? projectRevision; }
  }
  const videos = (Array.isArray(inventory.videos) ? inventory.videos : []).filter(video => !dealerId || video.dealer === dealerId || !video.dealer);
  const runtimeIds = new Set((Array.isArray(inventory.families) ? inventory.families : [])
    .filter(family => !dealerId || family.dealerId === dealerId).flatMap(family => [...(family.standardIds ?? []), ...(family.variantIds ?? [])]));
  const sources = ['vera', 'astrid', 'amira', 'mei'].map(id => {
    const clips = (clipInventory?.clips ?? []).filter(clip => clip.dealerId === id);
    const configured = object(clipInventory?.runtime?.dealers?.[id]);
    const runtimeIds = new Set([...Object.values(object(configured.engine)).map(key => `${id}:${key}`), ...Object.values(object(configured.staged))]);
    return { dealerId: id, registered: clips.length,
      previewAvailable: clips.filter(clip => clip.available && clip.previewSrc).length,
      runtimeConfigured: clips.filter(clip => clip.available && runtimeIds.has(clip.id)).length,
      played: clips.filter(clip => knownMedia.has(`${id}:${clip.id}`) || knownMedia.has(`${id}:${clip.engineKey}`)).length };
  });
  return { rows, speech, mode, projectRevision, savedRevision, latestChannel, latestVersion, sources,
    duplicates, stale, diagnostics, gaps, inventory: { registered: videos.length,
      previewAvailable: videos.filter(video => video.available && video.previewUrl).length,
      runtimeFamily: videos.filter(video => video.available && runtimeIds.has(video.id)).length,
      played: knownMedia.size } };
}
