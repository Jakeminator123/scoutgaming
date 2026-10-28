import { isActiveDealerId } from '../../../packages/presentation/contracts/dealer-identity.mjs';
import { recordedSpeechForVideo } from '../../../packages/presentation/contracts/recorded-speech.mjs';
import { createLiveIdleController } from '../../../packages/presentation/runtime/live-idle.mjs';

// Player-facing speech and action-film texts. The browser's, server's or
// provider's reason (and HTTP status/code) stays in the receipt.
const SPEECH_FAILED = 'Talet kunde inte spelas.';
const FILM_FAILED = 'Filmen kunde inte spelas.';
// A failed step's text stays readable while the following steps start.
const FAILURE_NOTICE_MS = 6000;
// The exact file is missing (404/410) or declared unavailable by the server:
// this step ends at once, without a fallback film or another attempt.
const unavailableMedia = error => error?.code === 'local_film_unavailable' && error.retryable === false;
// K04 F5: how many server answers for a shared plan's filmed steps are asked for at a time.
const SELECT_AHEAD = 2;
// Waits for work that this step does not own; leaving the step does not cancel it.
const untilAborted = (work, signal) => !signal ? work : new Promise((resolve, reject) => {
  if (signal.aborted) { reject(signal.reason); return; }
  const abort = () => reject(signal.reason); signal.addEventListener('abort', abort, { once: true });
  work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
});

export async function createLocalPresentation({ player, host, dealerId, version, receipt, onIdle, onBusy, onError = () => {}, onGestureWait = () => {}, muted, composition = null, entry = null, transport = null, idlePhase = () => 'bets' }) {
  if (!isActiveDealerId(dealerId)) throw new Error('Invalid presentation dealer');
  const preview=Boolean(transport?.context);
  const request=transport?.request??((...args)=>globalThis.fetch(...args));
  const mediaUrl=transport?.mediaUrl??(video=>video.src||`/api/presentation/videos/${video.id}`);
  const context = entry?.operator ? { operatorSlug: entry.operator, roomId: entry.roomId, packageRevision: entry.packageRevision, dealerId } : null;
  const configUrl = '/api/presentation/config' + (context ? '?' + new URLSearchParams(Object.entries(context).map(([key,value])=>[key,String(value)])) : '?dealerId=' + encodeURIComponent(dealerId));
  const packageError = () => Object.assign(new Error('Presentationspaketet har ändrats. Ladda om spelet.'), { code:'studio_presentation_idle_package_changed' });
  const configurationConflict = async response => {
    const failure = await response.json().catch(() => null);
    // A shared window can advance while this read is in flight. Its next WS
    // snapshot must reauthorize the binding; the published package is not revoked.
    return failure?.error === 'shared_room_presentation_stale'
      ? Object.assign(new Error('shared_room_presentation_stale'), {code:'shared_room_presentation_stale'}) : packageError();
  };
  const response = await request(configUrl, { cache: 'no-store' });
  if (response.status === 409) throw await configurationConflict(response);
  if (!response.ok) throw new Error('Local presentation configuration unavailable');
  const config = await response.json();
  let upcoming = [], queueVersion, ahead = null;
  const owned = row => [row.dealer, row.dealerId, row.classification?.dealerId].includes(dealerId);
  const sameStep = (item, event) => item?.type === event.type && (event.type === 'speak' ? item.line === event.line : item.shoeDraw === event.shoeDraw);
  // The lookahead moves past this step, and past earlier steps that were left before their answer arrived.
  const advance = (event, requestVersion) => {
    const index = queueVersion === requestVersion ? upcoming.findIndex(item => sameStep(item, event)) : -1;
    upcoming = index < 0 ? [] : upcoming.slice(index + 1);
  };
  const stepKey = event => ['deal', 'reveal'].includes(event?.type) && Number.isSafeInteger(event.shoeDraw)
    ? [event.type, event.shoeDraw, event.to ?? '', event.box ?? ''].join(':') : null;
  const prepare = event => {
    if (!event || queueVersion !== version() || closed) return;
    // A planned filmed step names its exact take (shared-room-presentation.mjs timeline): that file is prepared in
    // the hidden element before its time (K public/shared-table.js:310, app.js:118-125), not the family's standard.
    const exact = event.filmedTake?.sha256 ? config.inventory.videos.find(row => row.sha256 === event.filmedTake.sha256 && row.available && owned(row)) : null;
    const family = exact ? null : config.inventory.families?.find(row => row.dealerId === dealerId && (
      event.type === 'speak' ? row.eventId.startsWith('speak.') && row.situation === event.line :
      event.type === 'reveal' ? row.eventId === 'reveal.dealer' :
      event.to === 'dealer' ? row.eventId === 'deal.dealer' && row.situation === (event.faceDown ? 'dealer-hole' : 'dealer-up') :
      row.eventId.startsWith('deal.player.') && row.situation === `box${event.box}`));
    const video = exact ?? config.inventory.videos.find(row => family?.standardIds.includes(row.id) && row.available);
    if (video) player.prepareLocalClip?.({ media: { src: mediaUrl(video), sha256: video.sha256 } });
  };
  // A published room follows the composition's saved per-phase clip modes from
  // Admin (idle, deal, reveal, speak). Only Studio rehearsal keeps a local
  // mode control; the player never widens or narrows the saved selection.
  const SELECTION_MODES = ['off', 'rules', 'random', 'shadow', 'active'];
  // Without saved modes a published room plays standard clips only ('off').
  const roomModes = context ? (config.openclaw && typeof config.openclaw === 'object' && !Array.isArray(config.openclaw) ? config.openclaw : {}) : null;
  const phaseOf = type => type === 'speak' ? 'speak' : type === 'reveal' ? 'reveal' : type === 'deal' ? 'deal' : 'idle';
  const roomMode = type => { const value = roomModes?.[phaseOf(type)]; return SELECTION_MODES.includes(value) ? value : 'off'; };
  let action = false, speech = false, ready = false, closed = false, active = null, serial = 0, mode = roomModes ? roomMode('idle') : !preview && config.defaultMode === 'active' ? 'active' : 'off', presentationKind = null, packageChanged = false;
  const selectionMode = type => roomModes ? roomMode(type) : mode;
  const configurationSource = config.configurationSource || 'lab/project.json';
  receipt({ event: 'configuration', state: 'selected', mode, projectRevision: config.projectRevision || config.revision, configurationSource, ...(roomModes ? { modeSource: 'composition' } : {}) });
  const status = document.createElement('div'); status.className = 'local-presentation-status'; status.setAttribute('role', 'status'); host.append(status);
  let failureUntil = 0;
  const showFailure = text => { status.textContent = text; failureUntil = Date.now() + FAILURE_NOTICE_MS; };
  const control = document.createElement('select'); control.setAttribute('aria-label', 'Klippval');
  for (const [value, text] of [['off','Standard'],['rules','Regler'],['random','Slump'],['active','OpenClaw'],['shadow','OpenClaw · skugga']]) {
    if(preview&&['active','shadow'].includes(value))continue;
    const option = document.createElement('option'); option.value = value; option.textContent = text; control.append(option);
  }
  control.value = mode;
  control.className = 'local-presentation-mode'; if (!roomModes) host.append(control);
  const hasOwnIdlePolicy = config.idlePolicy?.familyId === `${dealerId}/idle.ready/ready`;
  const readIdlePhase = () => { try { return idlePhase() === 'decide' ? 'decide' : 'bets'; } catch { return 'bets'; } };
  const idle = !hasOwnIdlePolicy ? null : createLiveIdleController({ policy: config.idlePolicy, inventory: config.idleInventory ?? config.inventory, dealerId, seed: crypto.getRandomValues(new Uint32Array(1))[0],
    initialScene: { active: true, visible: !document.hidden, identity: dealerId, revision: String(version()) } });
  const still = document.createElement('canvas'); still.className = 'local-presentation-film local-presentation-still'; host.append(still);
  const hold = video => { if (composition) { composition.hold(video); return; } if (!video.videoWidth) return; still.width = video.videoWidth; still.height = video.videoHeight; still.getContext('2d').drawImage(video, 0, 0); };
  let idleRun = 0, idleError = null, idleDuringAction = false, pendingRule = null, idleRetryTimer = null, idleRetries = 0, idleFailed = false;
  // Chrome rejects play() for video-only media in a hidden tab with "paused to
  // save power". That interrupts a healthy clip; it is not a broken file. On
  // 19 October 2026 it blacklisted the only base loop, so the dealer had no
  // idle and the speech gate stayed shut ("väntar på ledigt bord") until a
  // reload. Retry the same clip shortly, and again when the tab is visible.
  const transientPlayback = error => /paused to save power|play\(\) request was interrupted/i.test(error?.message ?? '');
  let idleTransientRetries = 0;
  const retryIdleSoon = () => { clearTimeout(idleRetryTimer); idleRetryTimer = setTimeout(() => { idleRetryTimer = null; if (closed || document.hidden) return; idleRun = 0; resumeIdle(); }, 700); };
  // The retry budget belongs to this configuration's exact idle, not a UI epoch.
  // Visibility/action changes must not turn a broken loop into endless retries.
  let gestureOwner = null;
  const releaseGestureWait = owner => {
    if (!owner || gestureOwner !== owner) return;
    gestureOwner = null; onGestureWait(false);
  };
  const stop = () => { clearTimeout(idleRetryTimer); idleRetryTimer = null; releaseGestureWait(active); active?.abort(); active = null; };
  // Browsers refuse unmuted speech before the player's first interaction. Show
  // one sound control instead of the browser's text. A real click resumes the
  // waiting line inside the gesture while it is still current; otherwise it
  // only unlocks. The session remembers that the player allowed sound.
  let soundButton = null, soundRetry = null, soundUnlocked = false;
  const removeSoundButton = () => { soundButton?.remove(); soundButton = null; };
  const offerSound = (own, retry) => {
    if (closed || packageChanged) return;
    soundRetry = { own, retry };
    if (soundButton) return;
    const button = soundButton = document.createElement('button');
    button.type = 'button'; button.className = 'local-presentation-recovery local-presentation-sound'; button.textContent = 'Slå på ljud';
    button.onclick = event => {
      if (event?.isTrusted === false || soundButton !== button) return;
      soundUnlocked = true; removeSoundButton();
      const pending = soundRetry; soundRetry = null; pending?.retry();
    };
    host.append(button);
  };
  const channel = crypto.randomUUID();
  let adviceController = null, chatSequence = 0;
  let behaviourRequest = 0, lastBehaviour = '', settlementContinuation = null;
  const behaviourVersion = (value,type) => type==='settle' && settlementContinuation?.from===value ? settlementContinuation.to : value;
  async function observeEvents(events, {command,previousVersion,signal} = {}) {
    if(signal?.aborted)return;
    // Successful collection completes the same settled round. Carry only its
    // verified result across that one version change, including a late response.
    if(command==='collect') {
      settlementContinuation={from:previousVersion,to:version()};
      if(pendingRule?.sourceType==='settle'&&pendingRule.version===previousVersion)Object.assign(pendingRule,{version:version(),collected:true});
    }
    if (!idle || mode !== 'rules' || packageChanged || closed || document.hidden || !Array.isArray(events)
      || !config.idlePolicy?.variants.some(item=>item.use==='rules')) return;
    const event = events?.findLast(item => ['turn','settle'].includes(item.type));
    if (!event) return;
    const requestVersion=version(), key=JSON.stringify([requestVersion,event.type,event.box,event.handIndex]);
    if (key===lastBehaviour) return;
    lastBehaviour=key;
    const own=++behaviourRequest;
    try {
      const response=await request('/api/presentation/select',{method:'POST',cache:'no-store',signal,headers:{'Content-Type':'application/json'},
        body:JSON.stringify({dealerId,version:requestVersion,mode:'rules',event:{type:event.type,
          ...(event.type==='turn'?{box:event.box,handIndex:event.handIndex}:{})},...(context?{presentationContext:context}:{})})});
      if (signal?.aborted || !response.ok || own!==behaviourRequest || closed || document.hidden || mode!=='rules' || behaviourVersion(requestVersion,event.type)!==version()) return;
      const result=await response.json();
      if (signal?.aborted || own!==behaviourRequest || closed || document.hidden || packageChanged || mode!=='rules' || behaviourVersion(requestVersion,event.type)!==version()) return;
      retainRule(result,requestVersion,event.type);offerPendingRule();
    } catch { /* Optional behaviour never blocks cards, speech or the player's turn. */ }
  }
  async function observeChat(text) {
    adviceController?.abort();
    if (preview || !idle || !['active', 'shadow'].includes(mode)) return;
    const controller = new AbortController(); adviceController = controller;
    const at = new Date().toISOString(), requestId = crypto.randomUUID(), revision = version();
    const startedMode = mode;
    try {
      const response = await request('/api/presentation/idle-advice', { method: 'POST', signal: controller.signal, cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, dealerId, mode,
          sourceRef: { kind: 'renderer-idle', channel, revision, messageId: `native:${channel}:${++chatSequence}`, at },
          observedChat: { source: 'native-observation', before: at, messages: [{ role: 'user', text: text.slice(0, 600), at }] },
          ...(context ? {presentationContext:context} : {}) }) });
      if (controller.signal.aborted || closed || mode !== startedMode || version() !== revision) return;
      if (response.status === 409 && context) {
        const failure = await response.json().catch(() => null);
        if (failure?.code === 'studio_presentation_idle_package_changed') { requireReload(packageError()); return; }
      }
      if (!response.ok) return;
      const result = await response.json();
      if (controller.signal.aborted || closed || mode !== startedMode || version() !== revision) return;
      receipt({ event: 'idle-advice', state: 'selected', result, projectRevision: result.projectRevision, configurationSource });
      if (mode === 'active' && result.videoId) idle.offerVariant({ videoId: result.videoId, requestId, expiresAt: performance.now() + Math.max(0, Math.min(30000, Date.parse(at) + 30000 - Date.now())) });
    } catch { /* Advice is optional; automatic idle and gameplay continue. */ }
    finally { if (adviceController === controller) adviceController = null; }
  }
  // The server's selection for one committed instruction. It reads no card and starts no film.
  async function selection(event, requestVersion, signal) {
    const eventMode = selectionMode(event.type);
    const selected = await request('/api/presentation/select', { method: 'POST', cache: 'no-store', signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealerId, mode: eventMode, version: requestVersion, event, shoeTransitions: true, ...(context ? {presentationContext:context} : {}) }) });
    if (selected.status === 409 && context) {
      const failure = await selected.json().catch(() => null);
      if (failure?.code === 'studio_presentation_idle_package_changed') throw packageError();
    }
    if (!selected.ok) throw new Error('Inget verifierat klipp för instruktionen');
    return { eventMode, result: await selected.json() };
  }
  // K04 F5 (staging 28 Oct 2026): a filmed step that asked for its answer only when its time began was left
  // as late, because the answer outlasted the step. A shared plan is committed and published as a whole: the
  // planned filmed steps (each named by its exact take) are asked for in order, SELECT_AHEAD at a time, when
  // the plan begins. An answer is kept as data only. No receipt, card, frame or film follows from it until
  // present() plays that same step at its own time; the native table keeps asking at the step.
  function selectAhead(events, requestVersion) {
    const controller = new AbortController(), steps = new Map();
    for (const event of events) {
      const key = stepKey(event);
      if (!key || !event.filmedTake || steps.has(key)) continue;
      const { filmedTake, ...committed } = event;
      const step = { signal: controller.signal, promise: null,
        start: () => { if (!step.promise) { step.promise = selection(committed, requestVersion, controller.signal); step.promise.catch(() => {}); } return step.promise; } };
      steps.set(key, step);
    }
    if (!steps.size) return;
    ahead = { version: requestVersion, controller, steps };
    const order = [...steps.values()];
    const next = async () => { for (const step of order) { if (controller.signal.aborted) return; if (!step.promise) await step.start().catch(() => {}); } };
    for (let i = 0; i < SELECT_AHEAD; i++) void next();
  }
  function dropAhead() { ahead?.controller.abort(); ahead = null; }
  // A step plays the answer asked for it when its plan began, or asks now. Leaving the step ends the wait.
  // K04 R1: an early answer that failed for any reason but a package change (network, 5xx, 409, the request's
  // 10 s limit, or a dropped lookahead) is asked for once more within this step's own time, as before F5. Only
  // that answer can fail the step; if the step's time runs out first it is left as late, without text.
  async function answerFor(event, requestVersion, signal) {
    const planned = ahead?.version === requestVersion ? ahead.steps.get(stepKey(event)) : undefined;
    if (planned) {
      try { return await untilAborted(planned.start(), signal); }
      catch (error) { if (signal?.aborted || error?.code === 'studio_presentation_idle_package_changed') throw error; }
    }
    return selection(event, requestVersion, signal);
  }
  // timing: Kevin's per-step playback options for the exact take (startOffset, handoverAt, playbackRate, clockTime),
  // passed through to playLocalFilm; the shared ports derive them from the published plan and the profile.
  // selected: this clip came from /api/presentation/select for the current version in the same step. That call
  // already checked the frozen package (published rooms resolve the context after selecting; a shared room checks
  // its committed receipt and context), so the film does not read the configuration a second time. Idle films and
  // Studio rehearsal keep their own per-play read.
  async function film(video, { signal, kind, details = {}, onPrepared, onFrame, onMediaFrame, onEvent, onProgress, timing = {}, selected = false } = {}) {
    const own = new AbortController(); active = own;
    const ownSerial = serial, ownVersion = version();
    const stillCurrent = () => active === own && !closed && !own.signal.aborted && serial === ownSerial && version() === ownVersion;
    const abort = () => own.abort(); signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) own.abort();
    host.dataset.presentationMedia = video.id; host.dataset.presentationFile = video.fileName; host.dataset.presentationKind = kind;
    host.dataset.presentationSha256 = video.sha256;
    host.dataset.presentationRevision = String(config.projectRevision || config.revision || '');
    host.dataset.presentationPackageRevision = String(context?.packageRevision ?? '');
    try {
      onProgress?.({phase:'prepare'});
      if (preview || (context && !selected)) {
        const current = await request(configUrl, { signal: own.signal, cache: 'no-store' });
        if (current.status === 409) throw await configurationConflict(current);
        if (!current.ok) throw new Error('Dealerns film är inte längre tillgänglig');
      }
      if(composition)await composition.prepareClip(video.compositing ?? video.classification?.compositing,video.framing ?? video.classification?.framing,{kind});
      if(own.signal.aborted)throw new DOMException('Presentation cancelled','AbortError');
      onPrepared?.();
      onProgress?.({phase:'play'});
      const audible = kind === 'speech' && !muted();
      await player.playLocalClip({ media: { src: mediaUrl(video), sha256: video.sha256 } }, {
        signal: own.signal, muted: !audible, hold, ...timing,
        // Arriving bytes are progress: a slow download is never cut by a whole-file limit.
        ...(onProgress ? { onDownloadProgress: value => onProgress({ phase: 'download', received: value?.received }) } : {}),
        ...(audible ? { onSoundBlocked: resume => offerSound(own, () => stillCurrent() && resume()) } : {}),
        onGestureWait: waiting => {
          if (!stillCurrent()) return;
          if (waiting && gestureOwner !== own) { gestureOwner = own; onGestureWait(true); }
          else if (!waiting) releaseGestureWait(own);
        },
        onFrame: onMediaFrame || onProgress ? time => { onProgress?.({phase:'frame',time}); onMediaFrame?.(time); } : undefined,
        renderFrame: composition ? source => composition.renderFrame(source) : undefined,
        onReceipt: event => { host.dataset.presentationState = event.state;
          if (audible && event.state === 'start') { soundUnlocked = true; removeSoundButton(); }
          receipt({ event: kind, ...details, ...event, mediaId: video.id, mediaSha256: video.sha256, fileName: video.fileName, packageRevision: context?.packageRevision, renderer: 'performance-local' });
          if (event.state === 'presented') onFrame?.(); onEvent?.(event); },
      });
      onProgress?.({phase:'complete'});
    } finally { signal?.removeEventListener('abort', abort); releaseGestureWait(own); if (active === own) active = null; if (soundRetry?.own === own) soundRetry = null; }
  }
  function retainRule(result, requestVersion, sourceType) {
    const rule = result.idleRule;
    if (!idle || mode !== 'rules' || rule?.mode !== mode || rule.version !== requestVersion || rule.requestId !== result.decision.requestId
      || JSON.stringify(rule.presentationContext) !== JSON.stringify(context)) return;
    const remaining = Math.max(0, Math.min(30000, Date.parse(rule.expiresAt) - Date.now()));
    if (!Number.isFinite(remaining) || !remaining) return;
    pendingRule = {videoId:rule.videoId,requestId:rule.requestId,expiresAt:performance.now()+remaining,version:behaviourVersion(requestVersion,sourceType),sourceType,collected:sourceType==='settle'&&settlementContinuation?.from===requestVersion};
  }
  function offerPendingRule() {
    if (!pendingRule || action || speech || ready || document.hidden || pendingRule.sourceType==='settle'&&!pendingRule.collected) return;
    const rule = pendingRule; pendingRule = null;
    if (mode === 'rules' && rule.version === version() && rule.expiresAt > performance.now())
      idle?.offerVariant({videoId:rule.videoId,requestId:rule.requestId,expiresAt:rule.expiresAt},{use:'rules'});
  }
  function requireReload(error) {
    if (error.code !== 'studio_presentation_idle_package_changed' && !(preview && error.code?.startsWith('studio_preview_'))) return false;
    pendingRule = null; packageChanged = true; ++serial; stop(); idle?.close(); control.disabled = true; soundRetry = null; removeSoundButton(); status.textContent = error.message + ' ';
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Ladda om';
    button.onclick = () => globalThis.location?.reload(); status.append(button);
    return true;
  }
  function resumeOwnIdle() {
    if (packageChanged || closed || (action && !idleDuringAction) || speech || document.hidden || idleRun || idleFailed) return;
    const video = config.dealerIdle?.[dealerId];
    if (!video) { const error = new Error('Dealern saknar en publicerad grundloop'); status.textContent = error.message; onError(error); return; }
    presentationKind = 'idle'; onBusy();
    const epoch = ++serial; idleRun = epoch;
    void film(video, { kind: 'idle', details: { idleKind: 'standard', standardBase: true,
      reason: 'saved_exact_baseline', projectRevision: config.projectRevision || config.revision, configurationSource },
      onFrame: () => { if (epoch !== serial || closed) return;
        idleTransientRetries = 0;
        if (idleError !== null && status.textContent === idleError) { status.textContent = ''; idleError = null; }
        onIdle(); },
    }).then(() => { if (epoch !== serial || closed) return; idleRetries = 0; idleRun = 0; resumeOwnIdle(); })
      .catch(error => { if (epoch !== serial || closed) return;
        if (error.code === 'shared_room_presentation_stale') { idleRun = 0; return; }
        if (requireReload(error)) return;
        onBusy();
        idleError = `Idle: ${error.message}`; status.textContent = idleError; onError(error);
        if (transientPlayback(error) && idleTransientRetries++ < 20) { idleRun = 0; retryIdleSoon(); return; }
        if (!['local_film_no_presented_frame', 'local_film_stalled'].includes(error.code)) return;
        if (idleRetries >= 1) { idleFailed = true; return; }
        // Retry the same frozen idle once. Neither a timer nor 'playing' opens
        // the speech gate or clears the warning; only this owner's frame does.
        idleRetries++;
        idleRetryTimer = setTimeout(() => {
          idleRetryTimer = null;
          if (epoch !== serial || closed) return;
          idleRun = 0; resumeOwnIdle();
        }, 500);
      });
  }
  function resumeIdle() {
    if (!idle) { resumeOwnIdle(); return; }
    if (!idle || packageChanged || closed || (action && !idleDuringAction) || speech || document.hidden) return;
    const clip = idle.snapshot().clip;
    if (!clip || clip.playId === idleRun) return;
    presentationKind = 'idle'; onBusy();
    idleRun = clip.playId; const epoch = ++serial;
    const video = config.inventory.videos.find(item => item.id === clip.videoId && item.dealer === dealerId);
    if (!video) { status.textContent = 'Ingen lokal idlefilm · 2D-reserv'; return; }
    void film(video, { kind: 'idle', details: { idleKind: clip.kind, standardBase: clip.standardBase, reason: clip.reason, projectRevision: config.projectRevision || config.revision, configurationSource },
      timing: idle.mode === 'rotation' ? { startOffset: clip.startOffset } : {},
      onMediaFrame: idle.mode === 'rotation' ? seconds => { if (epoch === serial && !closed) idle.progress(clip.playId, seconds); } : undefined,
      onFrame: () => { if (epoch !== serial || closed) return;
        idleTransientRetries = 0;
        if (idleError !== null && status.textContent === idleError) { status.textContent = ''; idleError = null; }
        idle.presented(clip.playId); if (clip.standardBase) onIdle(); },
      onEvent: event => { if (epoch === serial && event.state === 'start') idle.started(clip.playId); },
    }).then(() => { if (epoch !== serial) return; if (idle.mode === 'rotation') idle.updateScene({phase:readIdlePhase()}); idle.completed(clip.playId); if (clip.repeat) idleRun = 0; resumeIdle(); })
      .catch(error => { if (epoch !== serial || closed) return;
        if (error.code === 'shared_room_presentation_stale') { idleRun = 0; return; }
        if (requireReload(error)) return; idleError = `Idle: ${error.message}`; status.textContent = idleError; onError(error);
        if (transientPlayback(error) && idleTransientRetries++ < 20) { retryIdleSoon(); return; }
        idle.failed(clip.playId); resumeIdle(); });
  }
  function state(patch) {
    if (!document.hidden) idleTransientRetries = 0;
    // A finished presentation, a disconnect or a hidden tab keeps no early answers.
    if (Object.hasOwn(patch, 'action') && (!patch.action || patch.command)) dropAhead();
    if (Object.hasOwn(patch, 'action')) {
      if(patch.action && patch.command && patch.command!=='collect') {
        pendingRule=null;settlementContinuation=null;++behaviourRequest;
      } else if(patch.action && !action && patch.command!=='collect' && pendingRule?.sourceType!=='settle') pendingRule=null;
      action=patch.action;idleDuringAction=false;
    }
    if (Object.hasOwn(patch, 'speech')) speech = patch.speech;
    if (Object.hasOwn(patch, 'ready')) ready = patch.ready;
    control.disabled = packageChanged || action || speech;
    // Chat can finish generating, or finish cancelling, during a deal. Neither
    // may revoke the current card's owner. Apply those flags on action release.
    if (action && ['deal', 'reveal'].includes(presentationKind) && !Object.hasOwn(patch, 'action') && !document.hidden) return;
    if (action || speech || document.hidden) adviceController?.abort();
    if (idle?.mode === 'rotation' && Object.hasOwn(patch, 'ready') && !Object.hasOwn(patch, 'action')
      && !Object.hasOwn(patch, 'speech') && !document.hidden) {
      idle.updateScene({speechReady:ready,phase:readIdlePhase(),revision:`${version()}:${mode}`});
      return; // Finish the current pose and its exit before presenting the speech-ready base.
    }
    if (document.hidden) { pendingRule = null; ++behaviourRequest; upcoming = []; dropAhead(); player.cancelLocalPreparation?.(); }
    ++serial; stop(); idleRun = 0;
    idle?.updateScene({ actionBusy: action, speechPlaying: speech, speechReady: ready, visible: !document.hidden, revision: `${version()}:${mode}`, phase:readIdlePhase() });
    offerPendingRule();
    if (action || speech) onBusy(); else resumeIdle();
  }
  // onUnavailable(): this step's exact media is missing or declared unavailable
  // (not a retryable playback failure); the shared table ends its film at once.
  async function present(event, { signal, onPresented, onSelected, onFrame, onProgress, onUnavailable, startOffset, handoverAt, playbackRate, clockTime } = {}) {
    if (packageChanged) return false;
    const kind = event.type === 'speak' ? 'speech' : event.type;
    presentationKind = kind;
    const requestVersion = version();
    ++serial; stop(); onBusy();
    if (Date.now() >= failureUntil) status.textContent = '';
    const token = serial;
    let progressClip = 0;
    const progress = () => {
      if (typeof onProgress !== 'function') return undefined;
      const clip = ++progressClip;
      return value => {
        if (clip === progressClip && token === serial && requestVersion === version() && !signal?.aborted)
          onProgress({clip,...value});
      };
    };
    let result, passed = false;
    const pass = () => { if (!passed) { passed = true; advance(event, requestVersion); } };
    // The shared table left this step because its time on the table clock (or
    // the server's turn) was over before its film showed a frame: a late step,
    // skipped without a fallback or error text, never a failed film. The next
    // step's file is prepared all the same, also when no answer arrived (K04 F5).
    const leftLate = () => {
      if (signal?.aborted && signal.reason?.late === true) {
        receipt({ event: kind, state: 'skipped', late: true, sourceEvent: event, reason: 'step_time_over', renderer: kind === 'speech' ? 'none' : '2d',
          requestId: result?.decision?.requestId, familyId: result?.decision?.media?.familyId, projectRevision: result?.projectRevision, configurationSource });
        if (!closed && token === serial) { pass(); prepare(upcoming[0]); }
      }
      return false;
    };
    try {
      const answer = await answerFor(event, requestVersion, signal);
      const eventMode = answer.eventMode;
      result = answer.result;
      if (signal?.aborted) return leftLate();
      if (token !== serial || requestVersion !== version()) return false;
      receipt({ event: kind, state: 'selected', ...result.decision, sourceEvent: result.decision.sourceEvent, renderer: 'performance-local', provider: result.provider, mode: eventMode, projectRevision: result.projectRevision, configurationSource });
      pass();
      if (!result.video && kind === 'speech') {
        const reason = result.decision.media?.reason;
        if ([undefined, null, 'no_exact_video_2d', 'frozen_clip_missing'].includes(reason)) {
          receipt({ event: kind, state: 'skipped', sourceEvent: result.decision.sourceEvent, reason: reason ?? 'speech_clip_missing', renderer: 'none',
            requestId: result.decision.requestId, projectRevision: result.projectRevision, configurationSource });
          retainRule(result, requestVersion);
          return false;
        }
        if (reason === 'recorded_speech_unavailable') throw new Error('Talfilmens granskning eller identitet stämmer inte');
      }
      if (!result.video && ((kind === 'deal' && result.decision.media?.reason === 'position_clip_missing') || result.decision.media?.reason === 'frozen_clip_missing')) {
        receipt({ event: kind, state: 'skipped', sourceEvent: result.decision.sourceEvent, reason: result.decision.media.reason, renderer: '2d',
          requestId: result.decision.requestId, familyId: result.decision.media.familyId, situation: result.decision.media.situation,
          projectRevision: result.projectRevision, configurationSource });
        retainRule(result, requestVersion);
        if (kind === 'deal' && config.dealerIdle?.[dealerId]) {
          idleDuringAction = true; idleRun = 0;
          idle?.updateScene({actionBusy:false});
          resumeIdle();
        }
        return false;
      }
      if (!result.video) throw new Error('Exakt film saknas');
      let attempt = 0;
      const owns = current => current === attempt && token === serial && requestVersion === version() && !signal?.aborted;
      const play = async (video, timing = {}) => {
        const speech = video.recordedSpeech ?? video.classification?.recordedSpeech;
        if (speech !== undefined && (kind !== 'speech' || !recordedSpeechForVideo(video, {
          dealerId, lineId: event.line, language: speech?.language, takeId: speech?.takeId, requireApproved: !preview,
        }))) throw new Error('Talfilmens granskning eller identitet stämmer inte');
        const current = ++attempt;
        try {
          await film(video, { kind, signal, selected: true, onProgress:progress(), timing, onPrepared:()=>{if(owns(current))onSelected?.(video,result.decision.sourceEvent);}, details: { line: event.line, to: event.to, box: event.box, shoeDraw: event.shoeDraw, familyId: result.decision.media?.familyId, requestId: result.decision.requestId, projectRevision: result.projectRevision, configurationSource },
            onFrame: () => { if (owns(current)) { idle?.interruptPose?.(); onPresented?.(); } },
            onMediaFrame: onFrame ? time => { if (owns(current)) onFrame(time); } : undefined,
            // A late take never starts; the next step's file is prepared all the same.
            onEvent: event => { if (owns(current) && (event.state === 'start' || event.late === true)) prepare(upcoming[0]); } });
        } finally { if (current === attempt) ++attempt; }
      };
      const transition = async (video, direction) => {
        if (!video) return;
        if (token !== serial || requestVersion !== version() || signal?.aborted) throw new DOMException('Presentation cancelled', 'AbortError');
        await film(video, { kind: 'transition', signal, selected: true, onProgress:progress(), onFrame:()=>idle?.interruptPose?.(), details: { direction, shoeDraw: event.shoeDraw,
          requestId: result.decision.requestId, projectRevision: result.projectRevision, configurationSource } });
        if (token !== serial || requestVersion !== version() || signal?.aborted) throw new DOMException('Presentation cancelled', 'AbortError');
      };
      // Kevin's clock applies to the exact take only (K app.js:214-246): a separate shoe clip before it plays whole,
      // so the seek and the clock stay off then; the fallback standard has its own length and is not timed.
      const timing = Object.fromEntries(Object.entries({ handoverAt, playbackRate, ...(result.transitions?.before ? {} : { startOffset, clockTime }) })
        .filter(([, value]) => value !== undefined && value !== null));
      await transition(result.transitions?.before, 'to-shoe');
      try { await play(result.video, timing); }
      catch (error) { if (['local_film_stalled', 'local_film_sound_blocked', 'local_film_download_stalled'].includes(error.code) || unavailableMedia(error) || signal?.aborted || token !== serial || !result.standard || result.standard.id === result.video.id || result.video.recordedSpeech || result.video.classification?.recordedSpeech) throw error;
        receipt({ event: kind, state: 'fallback', sourceEvent: event, reason: error.message, renderer: 'performance-local', requestId: result.decision.requestId, mediaId: result.standard.id, projectRevision: result.projectRevision, configurationSource });
        await play(result.standard); }
      await transition(result.transitions?.after, 'from-shoe');
      const current = token === serial && requestVersion === version() && !signal?.aborted;
      if (current) { idle?.resetPose?.(); retainRule(result, requestVersion); }
      return current;
    } catch (error) {
      if (signal?.aborted) return leftLate();
      if (token !== serial) return false;
      if (requireReload(error)) return false;
      // A line refused by the sound policy already shows the sound control.
      const soundBlocked = kind === 'speech' && error.code === 'local_film_sound_blocked';
      if (!soundBlocked) showFailure(kind === 'speech' ? SPEECH_FAILED : FILM_FAILED);
      const missing = unavailableMedia(error);
      receipt({ event: kind, state: kind === 'speech' ? 'failed' : 'fallback', sourceEvent: event, reason: error.message,
        ...(error.code ? { code: error.code } : {}), ...(Number.isInteger(error.status) ? { status: error.status } : {}), ...(error.serverCode ? { serverCode: error.serverCode } : {}),
        ...(missing ? { unavailable: true } : {}), ...(soundBlocked ? { soundUnlocked } : {}), renderer: kind === 'speech' ? 'none' : '2d', requestId: result?.decision?.requestId, familyId: result?.decision?.media?.familyId,
        projectRevision: result?.projectRevision, configurationSource });
      if (missing) { try { onUnavailable?.(); } catch {} }
      return false;
    }
  }
  control.onchange = () => { pendingRule = null; ++behaviourRequest; settlementContinuation=null; idle?.clearOffers(); adviceController?.abort(); mode = preview&& !['off','rules','random'].includes(control.value)?'off':control.value; control.value=mode; state({}); receipt({ event: 'configuration', state: 'selected', mode, projectRevision: config.projectRevision || config.revision, configurationSource }); };
  const visibility = () => state({}); document.addEventListener('visibilitychange', visibility);
  return { present, state, observeChat, observeEvents, start: resumeIdle,
    get filmedMaterial() { return config.filmedMaterial?structuredClone(config.filmedMaterial):null; },
    prepareSequence(events, { selectAhead: early = false } = {}) {
      dropAhead(); queueVersion = version(); upcoming = events; prepare(upcoming[0]);
      if (early && !closed && !packageChanged) selectAhead(events, queueVersion);
    },
    get idleBackground() { return !closed && !action && !speech && presentationKind === 'idle'; },
    close() { pendingRule = null; closed = true; upcoming = []; dropAhead(); player.cancelLocalPreparation?.(); adviceController?.abort(); ++serial; stop(); idle?.close(); document.removeEventListener('visibilitychange', visibility); status.remove(); control.remove(); still.remove(); soundRetry = null; removeSoundButton(); } };
}
