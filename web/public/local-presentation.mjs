import { createLiveIdleController } from '../../presentation-runtime/live-idle.mjs';

export async function createLocalPresentation({ player, host, dealerId, version, receipt, onIdle, onBusy, muted }) {
  const response = await fetch('/api/presentation/config', { cache: 'no-store' });
  if (!response.ok) throw new Error('Local presentation configuration unavailable');
  const config = await response.json();
  let action = false, speech = false, ready = false, closed = false, active = null, serial = 0, mode = 'off', presentationKind = null;
  const status = document.createElement('div'); status.className = 'local-presentation-status'; status.setAttribute('role', 'status'); host.append(status);
  const control = document.createElement('select'); control.setAttribute('aria-label', 'Klippval');
  for (const [value, text] of [['off','Standard'],['rules','Regler'],['random','Slump'],['active','OpenClaw'],['shadow','OpenClaw · skugga']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = text; control.append(option);
  }
  control.className = 'local-presentation-mode'; host.append(control);
  const idle = createLiveIdleController({ policy: config.idlePolicy, inventory: config.inventory, seed: crypto.getRandomValues(new Uint32Array(1))[0],
    initialScene: { active: true, visible: !document.hidden, identity: dealerId, revision: String(version()) } });
  const still = document.createElement('canvas'); still.className = 'local-presentation-film local-presentation-still'; host.append(still);
  const hold = video => { if (!video.videoWidth) return; still.width = video.videoWidth; still.height = video.videoHeight; still.getContext('2d').drawImage(video, 0, 0); };
  const stop = () => { active?.abort(); active = null; };
  const channel = crypto.randomUUID();
  let adviceController = null, chatSequence = 0;
  async function observeChat(text) {
    adviceController?.abort();
    if (!['active', 'shadow'].includes(mode)) return;
    const controller = new AbortController(); adviceController = controller;
    const at = new Date().toISOString(), requestId = crypto.randomUUID(), revision = version();
    const startedMode = mode;
    try {
      const response = await fetch('/api/presentation/idle-advice', { method: 'POST', signal: controller.signal, cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, dealerId, mode,
          sourceRef: { kind: 'renderer-idle', channel, revision, messageId: `native:${channel}:${++chatSequence}`, at },
          observedChat: { source: 'native-observation', before: at, messages: [{ role: 'user', text: text.slice(0, 600), at }] } }) });
      if (!response.ok) return;
      const result = await response.json();
      if (controller.signal.aborted || closed || mode !== startedMode || version() !== revision) return;
      receipt({ event: 'idle-advice', state: 'selected', result });
      if (mode === 'active' && result.videoId) idle.offerVariant({ videoId: result.videoId, requestId, expiresAt: performance.now() + Math.max(0, Math.min(30000, Date.parse(at) + 30000 - Date.now())) });
    } catch { /* Advice is optional; automatic idle and gameplay continue. */ }
    finally { if (adviceController === controller) adviceController = null; }
  }
  async function film(video, { signal, kind, details = {}, onFrame, onEvent } = {}) {
    const own = new AbortController(); active = own;
    const abort = () => own.abort(); signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) own.abort();
    host.dataset.presentationMedia = video.id; host.dataset.presentationFile = video.fileName; host.dataset.presentationKind = kind;
    try {
      await player.playLocalClip({ media: { src: video.src || `/api/presentation/videos/${video.id}`, sha256: video.sha256 } }, {
        signal: own.signal, muted: kind !== 'speech' || muted(), hold,
        onReceipt: event => { host.dataset.presentationState = event.state; receipt({ event: kind, ...details, ...event, mediaId: video.id, fileName: video.fileName, renderer: 'performance-local' });
          if (event.state === 'presented') onFrame?.(); onEvent?.(event); },
      });
    } finally { signal?.removeEventListener('abort', abort); if (active === own) active = null; }
  }
  let idleRun = 0;
  function resumeIdle() {
    if (closed || action || speech || document.hidden) return;
    const clip = idle.snapshot().clip;
    if (!clip || clip.playId === idleRun) return;
    presentationKind = 'idle'; onBusy();
    idleRun = clip.playId; const epoch = ++serial;
    const video = config.inventory.videos.find(item => item.id === clip.videoId);
    if (!video) { status.textContent = 'Ingen lokal idlefilm · 2D-reserv'; return; }
    void film(video, { kind: 'idle', details: { idleKind: clip.kind, standardBase: clip.standardBase, reason: clip.reason },
      onFrame: () => { if (epoch !== serial) return; idle.presented(clip.playId); if (clip.standardBase) onIdle(); },
      onEvent: event => { if (epoch === serial && event.state === 'start') idle.started(clip.playId); },
    }).then(() => { if (epoch !== serial) return; idle.completed(clip.playId); if (clip.repeat) idleRun = 0; resumeIdle(); })
      .catch(error => { if (epoch !== serial || closed) return; status.textContent = `Idle: ${error.message}`; idle.failed(clip.playId); resumeIdle(); });
  }
  function state(patch) {
    if (Object.hasOwn(patch, 'action')) action = patch.action;
    if (Object.hasOwn(patch, 'speech')) speech = patch.speech;
    if (Object.hasOwn(patch, 'ready')) ready = patch.ready;
    control.disabled = action || speech;
    // Chat can finish generating, or finish cancelling, during a deal. Neither
    // may revoke the current card's owner. Apply those flags on action release.
    if (action && presentationKind === 'deal' && !Object.hasOwn(patch, 'action') && !document.hidden) return;
    if (action || speech || document.hidden) adviceController?.abort();
    ++serial; stop(); idleRun = 0;
    idle.updateScene({ actionBusy: action, speechPlaying: speech, speechReady: ready, visible: !document.hidden, revision: `${version()}:${mode}` });
    if (action || speech) onBusy(); else resumeIdle();
  }
  async function present(event, { signal, onPresented } = {}) {
    const kind = event.type === 'speak' ? 'speech' : 'deal';
    presentationKind = kind;
    const requestVersion = version();
    ++serial; stop(); onBusy();
    status.textContent = '';
    const token = serial;
    try {
      const selected = await fetch('/api/presentation/select', { method: 'POST', cache: 'no-store', signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealerId, mode, version: requestVersion, event }) });
      if (!selected.ok) throw new Error('Inget verifierat klipp för instruktionen');
      const result = await selected.json();
      if (token !== serial || requestVersion !== version() || signal?.aborted) return false;
      receipt({ event: kind, state: 'selected', ...result.decision, sourceEvent: result.decision.sourceEvent, renderer: 'performance-local', provider: result.provider });
      if (!result.video) throw new Error('Exakt film saknas');
      const play = video => film(video, { kind, signal, details: { line: event.line, to: event.to, box: event.box, shoeDraw: event.shoeDraw, familyId: result.decision.media?.familyId, requestId: result.decision.requestId }, onFrame: onPresented });
      try { await play(result.video); }
      catch (error) { if (signal?.aborted || token !== serial || !result.standard || result.standard.id === result.video.id) throw error; await play(result.standard); }
      return true;
    } catch (error) {
      if (signal?.aborted || token !== serial) return false;
      status.textContent = `${error.message} · 2D-reserv`;
      receipt({ event: kind, state: 'fallback', sourceEvent: event, reason: error.message, renderer: '2d' }); return false;
    }
  }
  control.onchange = () => { adviceController?.abort(); mode = control.value; state({}); receipt({ event: 'configuration', state: 'selected', mode }); };
  const visibility = () => state({}); document.addEventListener('visibilitychange', visibility);
  return { present, state, observeChat, start: resumeIdle,
    close() { closed = true; adviceController?.abort(); ++serial; stop(); idle.close(); document.removeEventListener('visibilitychange', visibility); status.remove(); control.remove(); still.remove(); } };
}
