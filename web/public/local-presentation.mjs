import { createLiveIdleController } from '../../presentation-runtime/live-idle.mjs';

export async function createLocalPresentation({ player, host, dealerId, version, receipt, onIdle, onBusy, muted, composition = null }) {
  const response = await fetch('/api/presentation/config', { cache: 'no-store' });
  if (!response.ok) throw new Error('Local presentation configuration unavailable');
  const config = await response.json();
  // A registered bank without idle films (Dragge, Paow) rests on its baked
  // still; one without speech films (Paow) skips game speech. Astrid's bank has
  // both and is unchanged.
  const bank = (config.inventory.families ?? []).filter(row => row.dealerId === dealerId);
  const speechless = bank.length > 0 && !bank.some(row => row.eventId.startsWith('speak.'));
  const restStill = bank.length > 0 && !bank.some(row => row.playbackType === 'idle-pool');
  let upcoming = [], queueVersion;
  const prepare = event => {
    if (!event || queueVersion !== version() || closed) return;
    const family = config.inventory.families?.find(row => row.dealerId === dealerId && (
      event.type === 'speak' ? row.eventId.startsWith('speak.') && row.situation === event.line :
      event.type === 'reveal' ? row.eventId === 'reveal.dealer' :
      event.to === 'dealer' ? row.eventId === 'deal.dealer' && row.situation === (event.faceDown ? 'dealer-hole' : 'dealer-up') :
      row.eventId.startsWith('deal.player.') && row.situation === `box${event.box}`));
    const video = config.inventory.videos.find(row => family?.standardIds.includes(row.id) && row.available);
    if (video) player.prepareLocalClip?.({ media: { src: `/api/presentation/videos/${video.id}`, sha256: video.sha256 } });
  };
  let action = false, speech = false, ready = false, closed = false, active = null, serial = 0, mode = config.defaultMode === 'active' ? 'active' : 'off', presentationKind = null;
  const configurationSource = config.configurationSource || 'lab/project.json';
  receipt({ event: 'configuration', state: 'selected', mode, projectRevision: config.projectRevision || config.revision, configurationSource });
  const status = document.createElement('div'); status.className = 'local-presentation-status'; status.setAttribute('role', 'status'); host.append(status);
  const control = document.createElement('select'); control.setAttribute('aria-label', 'Klippval');
  for (const [value, text] of [['off','Standard'],['rules','Regler'],['random','Slump'],['active','OpenClaw'],['shadow','OpenClaw · skugga']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = text; control.append(option);
  }
  control.value = mode;
  control.className = 'local-presentation-mode'; host.append(control);
  const idle = createLiveIdleController({ policy: config.idlePolicy, inventory: config.inventory, dealerId, seed: crypto.getRandomValues(new Uint32Array(1))[0],
    initialScene: { active: true, visible: !document.hidden, identity: dealerId, revision: String(version()) } });
  const still = document.createElement('canvas'); still.className = 'local-presentation-film local-presentation-still'; host.append(still);
  const hold = video => { composition?.hold(video); if (!video.videoWidth) return; still.width = video.videoWidth; still.height = video.videoHeight; still.getContext('2d').drawImage(video, 0, 0); };
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
      receipt({ event: 'idle-advice', state: 'selected', result, projectRevision: result.projectRevision, configurationSource });
      if (mode === 'active' && result.videoId) idle.offerVariant({ videoId: result.videoId, requestId, expiresAt: performance.now() + Math.max(0, Math.min(30000, Date.parse(at) + 30000 - Date.now())) });
    } catch { /* Advice is optional; automatic idle and gameplay continue. */ }
    finally { if (adviceController === controller) adviceController = null; }
  }
  async function film(video, { signal, kind, details = {}, onFrame, onMediaFrame, onEvent } = {}) {
    const own = new AbortController(); active = own;
    const abort = () => own.abort(); signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) own.abort();
    host.dataset.presentationMedia = video.id; host.dataset.presentationFile = video.fileName; host.dataset.presentationKind = kind;
    try {
      if(composition)await composition.prepareClip(video.compositing);
      if(own.signal.aborted)throw new DOMException('Presentation cancelled','AbortError');
      await player.playLocalClip({ media: { src: video.src || `/api/presentation/videos/${video.id}`, sha256: video.sha256 } }, {
        signal: own.signal, muted: kind !== 'speech' || muted(), hold, onFrame: onMediaFrame,
        renderFrame: composition ? source => composition.renderFrame(source) : undefined,
        onReceipt: event => { host.dataset.presentationState = event.state; receipt({ event: kind, ...details, ...event, mediaId: video.id, fileName: video.fileName, renderer: 'performance-local' });
          if (event.state === 'presented') onFrame?.(); onEvent?.(event); },
      });
    } finally { signal?.removeEventListener('abort', abort); if (active === own) active = null; }
  }
  let idleRun = 0, idleError = null;
  function resumeOwnIdle() {
    if (dealerId !== 'nora' || closed || action || speech || document.hidden || idleRun) return;
    const video = config.dealerIdle?.nora;
    if (!video) { status.textContent = 'Ingen egen idlefilm · 2D-reserv'; return; }
    presentationKind = 'idle'; onBusy();
    const epoch = ++serial; idleRun = epoch;
    void film(video, { kind: 'idle', details: { idleKind: 'standard', standardBase: true,
      reason: 'saved_exact_baseline', projectRevision: config.projectRevision || config.revision, configurationSource },
      onFrame: () => { if (epoch !== serial || closed) return;
        if (idleError !== null && status.textContent === idleError) { status.textContent = ''; idleError = null; }
        onIdle(); },
    }).then(() => { if (epoch !== serial || closed) return; idleRun = 0; resumeOwnIdle(); })
      .catch(error => { if (epoch !== serial || closed) return;
        idleError = `Idle: ${error.message}`; status.textContent = idleError; });
  }
  function resumeIdle() {
    if (dealerId === 'nora') { resumeOwnIdle(); return; }
    if (dealerId !== 'astrid' || closed || action || speech || document.hidden) return;
    const clip = idle.snapshot().clip;
    if (!clip || clip.playId === idleRun) return;
    presentationKind = 'idle'; onBusy();
    idleRun = clip.playId; const epoch = ++serial;
    const video = config.inventory.videos.find(item => item.id === clip.videoId && item.dealer === dealerId);
    if (!video) { status.textContent = 'Ingen lokal idlefilm · 2D-reserv'; return; }
    void film(video, { kind: 'idle', details: { idleKind: clip.kind, standardBase: clip.standardBase, reason: clip.reason, projectRevision: config.projectRevision || config.revision, configurationSource },
      onFrame: () => { if (epoch !== serial || closed) return;
        if (idleError !== null && status.textContent === idleError) { status.textContent = ''; idleError = null; }
        idle.presented(clip.playId); if (clip.standardBase) onIdle(); },
      onEvent: event => { if (epoch === serial && event.state === 'start') idle.started(clip.playId); },
    }).then(() => { if (epoch !== serial) return; idle.completed(clip.playId); if (clip.repeat) idleRun = 0; resumeIdle(); })
      .catch(error => { if (epoch !== serial || closed) return; idleError = `Idle: ${error.message}`; status.textContent = idleError; idle.failed(clip.playId); resumeIdle(); });
  }
  function state(patch) {
    if (Object.hasOwn(patch, 'action')) action = patch.action;
    if (Object.hasOwn(patch, 'speech')) speech = patch.speech;
    if (Object.hasOwn(patch, 'ready')) ready = patch.ready;
    control.disabled = action || speech;
    // Chat can finish generating, or finish cancelling, during a deal. Neither
    // may revoke the current card's owner. Apply those flags on action release.
    if (action && ['deal', 'reveal'].includes(presentationKind) && !Object.hasOwn(patch, 'action') && !document.hidden) return;
    if (action || speech || document.hidden) adviceController?.abort();
    if (document.hidden) { upcoming = []; player.cancelLocalPreparation?.(); }
    ++serial; stop(); idleRun = 0;
    idle.updateScene({ actionBusy: action, speechPlaying: speech, speechReady: ready, visible: !document.hidden, revision: `${version()}:${mode}` });
    if (action || speech) onBusy(); else resumeIdle();
  }
  async function present(event, { signal, onPresented, onSelected, onFrame } = {}) {
    if (event.type === 'speak' && speechless) {
      // No 2D fallback before every deal: the line is skipped and receipted.
      if (queueVersion === version() && upcoming[0]?.type === 'speak' && upcoming[0].line === event.line) { upcoming.shift(); prepare(upcoming[0]); }
      receipt({ event: 'speech', state: 'skipped', sourceEvent: event, reason: 'Dealern har ingen talbank', renderer: 'none', projectRevision: config.projectRevision || config.revision, configurationSource });
      return false;
    }
    const kind = event.type === 'speak' ? 'speech' : event.type;
    presentationKind = kind;
    const requestVersion = version();
    ++serial; stop(); onBusy();
    status.textContent = '';
    const token = serial;
    let result;
    try {
      const selected = await fetch('/api/presentation/select', { method: 'POST', cache: 'no-store', signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealerId, mode, version: requestVersion, event }) });
      if (!selected.ok) throw new Error('Inget verifierat klipp för instruktionen');
      result = await selected.json();
      if (token !== serial || requestVersion !== version() || signal?.aborted) return false;
      receipt({ event: kind, state: 'selected', ...result.decision, sourceEvent: result.decision.sourceEvent, renderer: 'performance-local', provider: result.provider, mode, projectRevision: result.projectRevision, configurationSource });
      if (queueVersion === requestVersion && upcoming[0]?.type === event.type
        && (event.type === 'speak' ? upcoming[0].line === event.line : upcoming[0].shoeDraw === event.shoeDraw)) upcoming.shift();
      else upcoming = [];
      if (kind === 'deal' && !result.video && result.decision.media?.reason === 'position_clip_missing') {
        receipt({ event: kind, state: 'skipped', sourceEvent: result.decision.sourceEvent, reason: 'position_clip_missing', renderer: '2d',
          requestId: result.decision.requestId, familyId: result.decision.media.familyId, situation: result.decision.media.situation,
          projectRevision: result.projectRevision, configurationSource });
        return false;
      }
      if (!result.video) throw new Error('Exakt film saknas');
      let attempt = 0;
      const owns = current => current === attempt && token === serial && requestVersion === version() && !signal?.aborted;
      const play = async video => {
        const current = ++attempt;
        onSelected?.(video, result.decision.sourceEvent);
        try {
          await film(video, { kind, signal, details: { line: event.line, to: event.to, box: event.box, shoeDraw: event.shoeDraw, familyId: result.decision.media?.familyId, requestId: result.decision.requestId, projectRevision: result.projectRevision, configurationSource },
            onFrame: () => { if (owns(current)) onPresented?.(); },
            onMediaFrame: onFrame ? time => { if (owns(current)) onFrame(time); } : undefined,
            onEvent: event => { if (owns(current) && event.state === 'start') prepare(upcoming[0]); } });
        } finally { if (current === attempt) ++attempt; }
      };
      try { await play(result.video); }
      catch (error) { if (signal?.aborted || token !== serial || !result.standard || result.standard.id === result.video.id) throw error;
        receipt({ event: kind, state: 'fallback', sourceEvent: event, reason: error.message, renderer: 'performance-local', requestId: result.decision.requestId, mediaId: result.standard.id, projectRevision: result.projectRevision, configurationSource });
        await play(result.standard); }
      return token === serial && requestVersion === version() && !signal?.aborted;
    } catch (error) {
      if (signal?.aborted || token !== serial) return false;
      status.textContent = `${error.message} · 2D-reserv`;
      receipt({ event: kind, state: 'fallback', sourceEvent: event, reason: error.message, renderer: '2d', requestId: result?.decision?.requestId, familyId: result?.decision?.media?.familyId,
        projectRevision: result?.projectRevision, configurationSource }); return false;
    }
  }
  control.onchange = () => { adviceController?.abort(); mode = control.value; state({}); receipt({ event: 'configuration', state: 'selected', mode, projectRevision: config.projectRevision || config.revision, configurationSource }); };
  const visibility = () => state({}); document.addEventListener('visibilitychange', visibility);
  return { present, state, observeChat, start: resumeIdle,
    prepareSequence(events) { queueVersion = version(); upcoming = events; prepare(upcoming[0]); },
    get idleBackground() { return !closed && !action && !speech && presentationKind === 'idle'; },
    close() { closed = true; upcoming = []; player.cancelLocalPreparation?.(); adviceController?.abort(); ++serial; stop(); idle.close(); document.removeEventListener('visibilitychange', visibility); status.remove(); control.remove(); still.remove(); } };
}
