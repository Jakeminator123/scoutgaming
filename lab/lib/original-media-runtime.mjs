// Runs inside the same-origin preview iframe. Product rendering modules are
// served byte-for-byte; this adapter only owns preview lifecycle and receipts.
const ROOT = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const query = new URLSearchParams(location.search);
const mediaId = query.get('id'), channel = query.get('channel');
const host = document.getElementById('host'), canvas = document.getElementById('stream');
const caption = document.getElementById('caption'), status = document.getElementById('status');
const soundButton = document.getElementById('enable-audio');
let active = null, started = false, completed = false;
function send(phase, detail = {}) {
  parent.postMessage({ type: 'croupier-original-media', channel, mediaId, phase, medium: 'video', ...detail }, location.origin);
}
function receipt(phase, detail) {
  if (!active || active.signal.aborted) return;
  if (phase === 'started') { if (started) return; started = true; document.getElementById('poster')?.remove(); }
  send(phase, detail);
}
function stop() { active?.abort(); active = null; }
function untilAborted(promise, signal) {
  return new Promise((resolve, reject) => {
    const cancelled = () => reject(new DOMException('Avbrutet', 'AbortError'));
    signal.addEventListener('abort', cancelled, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', cancelled));
    if (signal.aborted) cancelled();
  });
}
function sound(audio) {
  audio.muted = true; soundButton.hidden = false;
  soundButton.onclick = () => { audio.muted = !audio.muted; soundButton.textContent = audio.muted ? 'Slå på tal' : 'Stäng av tal'; };
}
function waitEvent(element, success, errors, signal, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const clean = () => { clearTimeout(timer); element.removeEventListener(success, done); for (const event of errors) element.removeEventListener(event, failed); signal.removeEventListener('abort', cancelled); };
    const done = () => { clean(); resolve(); }, failed = () => { clean(); reject(new Error('Originalmediet kunde inte avkodas.')); };
    const cancelled = () => { clean(); reject(new DOMException('Avbrutet', 'AbortError')); };
    const timer = setTimeout(() => { clean(); reject(new Error('Originalmediet svarade inte i tid.')); }, timeoutMs);
    element.addEventListener(success, done, { once: true }); for (const event of errors) element.addEventListener(event, failed, { once: true });
    signal.addEventListener('abort', cancelled, { once: true }); if (signal.aborted) cancelled();
  });
}
async function native(definition, signal) {
  canvas.style.display = 'none';
  const video = document.createElement('video'); video.id = 'native'; video.playsInline = true; video.preload = 'auto'; sound(video); host.append(video);
  signal.addEventListener('abort', () => { video.pause(); video.removeAttribute('src'); video.load(); video.remove(); }, { once: true });
  const loaded = waitEvent(video, 'loadeddata', ['error'], signal);
  video.src = `${ROOT}/assets/${definition.sourcePath}`; await loaded;
  signal.throwIfAborted();
  if (!video.requestVideoFrameCallback) throw new Error('Webbläsaren saknar bildkvitton för originalvideo.');
  let frame;
  const presented = new Promise(resolve => { frame = video.requestVideoFrameCallback(() => { receipt('started', { sourcePath: definition.sourcePath, durationMs: Math.round(video.duration * 1000) }); resolve(); }); });
  signal.addEventListener('abort', () => video.cancelVideoFrameCallback(frame), { once: true });
  const finished = waitEvent(video, 'ended', ['error'], signal, 30000);
  // Attach rejection handling before play(): autoplay failure must not leave a
  // rejected event promise floating until the timeout fires.
  const all = Promise.all([presented, finished]); all.catch(() => {});
  await video.play(); await all;
}
async function indexed(definition, signal) {
  const [{ DealerEngine }, { waitForAudio, abortableDelay }] = await Promise.all([
    import(`${ROOT}/assets/dealer-engine.mjs`), import(`${ROOT}/assets/speech-playback.mjs`),
  ]);
  signal.throwIfAborted();
  const engine = new DealerEngine(canvas, `${ROOT}/assets/${definition.base}`);
  const close = () => { engine.stop(); try { engine.decoder?.close(); } catch {} try { engine.handsDecoder?.close(); } catch {} };
  signal.addEventListener('abort', close, { once: true });
  let audio;
  try {
    await engine.init(); signal.throwIfAborted();
    // Always return to the canonical idle, never the index's first entry (which
    // can be the rejected old action) and never replay a recorded sentence.
    engine.onIdlePick = () => 'idle-1/idle/idle';
    if (definition.audioPath) {
      audio = new Audio(`${ROOT}/assets/${definition.audioPath}`); sound(audio);
      signal.addEventListener('abort', () => { audio.pause(); audio.removeAttribute('src'); audio.load(); }, { once: true });
      await waitForAudio(audio, signal);
    }
    await engine.fetchClip(definition.clipKey); signal.throwIfAborted();
    const request = engine.interrupt(definition.clipKey);
    let firstResolve, lastResolve;
    const first = new Promise(resolve => { firstResolve = resolve; }), last = new Promise(resolve => { lastResolve = resolve; });
    const listener = presented => {
      if (presented.key !== definition.clipKey || presented.request !== request || signal.aborted) return;
      if (presented.frame === 0) { receipt('started', { sourcePath: definition.sourcePath, durationMs: definition.durationMs }); firstResolve(); }
      if (presented.frame >= definition.frameCount - 1) lastResolve();
    };
    engine.frameListeners.add(listener); await engine.start(); await untilAborted(first, signal);
    if (audio) {
      if (definition.audioDelayMs > 0) await abortableDelay(definition.audioDelayMs, signal);
      signal.throwIfAborted();
      const finished = waitEvent(audio, 'ended', ['error'], signal, 30000); finished.catch(() => {});
      await audio.play(); await untilAborted(Promise.all([last, finished]), signal);
    } else await untilAborted(last, signal);
    engine.frameListeners.delete(listener);
  } finally { close(); audio?.pause(); }
}
async function packed(definition, event, signal) {
  const [{ PerformancePlayer }, { uniformRegistration }] = await Promise.all([
    import(`${ROOT}/assets/performance-player.mjs`), import(`${ROOT}/assets/performance-contact.mjs`),
  ]);
  signal.throwIfAborted(); canvas.style.display = 'none';
  const take = structuredClone(definition.take);
  // Only the URL prefix changes. Media bytes, SHA, camera, contact frames,
  // masks, playback rate, and calibration payload stay intact.
  take.media.src = `assets/${take.media.src}`;
  const fit = uniformRegistration(take.camera, { width: innerWidth, height: innerHeight });
  const corners = take.frames[take.events.land].card.corners.map(([x, y]) => [fit.x + x * fit.width, fit.y + y * fit.height]);
  const card = event?.card && typeof event.card.r === 'string' && typeof event.card.s === 'string' ? { r: event.card.r.slice(0, 2), s: event.card.s.slice(0, 1) } : { r: '', s: '' };
  const player = new PerformancePlayer({ host, staged: true, onState: () => receipt('started', { sourcePath: definition.sourcePath, durationMs: definition.durationMs }) });
  signal.addEventListener('abort', () => player.dispose(), { once: true });
  await player.play(take, { card, faceDown: event?.faceDown === true || !event?.card, corners, onLand: () => receipt('landed', { sourcePath: definition.sourcePath }) });
  // Keep the completed picture until the parent advances; disposal belongs to
  // abort/unmount so the sequence never flashes an empty canvas at completion.
}
async function play(event) {
  stop(); active = new AbortController(); const controller = active, { signal } = controller; started = false; completed = false;
  const watchdog = setTimeout(() => { if (active === controller && !signal.aborted) { receipt('failed', { reason: 'Originaluppspelningen slutfördes inte inom 30 sekunder.' }); stop(); } }, 30000);
  try {
    const response = await fetch(`${ROOT}/definition/${encodeURIComponent(mediaId)}`, { signal });
    if (!response.ok) throw new Error('Originalklippet är inte tillgängligt lokalt.');
    const definition = await response.json(); if (!definition.available) throw new Error('Originalfil eller tillhörande ljud saknas.');
    caption.textContent = definition.caption ?? ''; status.textContent = definition.playbackKind === 'packed' ? 'Staged-grundfilm · granskningsmaterial' : 'Lokalt original · tal av från start';
    if (definition.playbackKind === 'native') await native(definition, signal);
    else if (definition.playbackKind === 'indexed') await indexed(definition, signal);
    else await packed(definition, event, signal);
    signal.throwIfAborted(); completed = true; receipt('completed', { sourcePath: definition.sourcePath });
  } catch (error) {
    if (!signal.aborted) { status.textContent = 'Originaluppspelning saknas'; receipt('failed', { reason: error.message }); stop(); }
  } finally { clearTimeout(watchdog); }
}
window.addEventListener('message', message => {
  if (message.origin !== location.origin || message.source !== parent || message.data?.type !== 'croupier-original-control' || message.data.channel !== channel || message.data.mediaId !== mediaId) return;
  if (message.data.command === 'play') void play(message.data.event);
  if (message.data.command === 'stop' && !completed) stop();
});
window.addEventListener('pagehide', stop);
document.addEventListener('visibilitychange', () => { if (document.hidden && active && !completed) { receipt('failed', { reason: 'Förhandsvisningen doldes under uppspelning.' }); stop(); } });
send('ready');
