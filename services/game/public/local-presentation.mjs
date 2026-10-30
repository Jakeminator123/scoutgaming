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
// K04 F5b: how many of those answered clip files are downloaded and verified ahead at a time, on a fast link.
// K04 F7: one at a time when the link is slow or unknown (no Network Information, or below FAST_LINK_MBPS).
const WARM_AHEAD = 2, FAST_LINK_MBPS = 5;
// Spoken lines warmed after the dealer's first frame: at most this many bytes (a quarter of the verified buffer's
// 96 MB budget), the lines of every hand first.
const SPEECH_WARM_BYTES = 24 * 1024 * 1024;
const SPEECH_WARM_ORDER = ['placebets', 'goodluck', 'lose', 'win', 'push', 'insurance', 'double', 'dealerbust', 'blackjack', 'dealerblackjack'];
// A shared room's window moved while a read or download ran (K04 F4/F4b). The verified
// buffer reports a download's server code in serverCode. Not a failure of the dealer.
const STALE_ROOM = 'shared_room_presentation_stale';
const staleRoom = error => error?.code === STALE_ROOM || error?.serverCode === STALE_ROOM;
// Waits for work that this step does not own; leaving the step does not cancel it.
const untilAborted = (work, signal) => !signal ? work : new Promise((resolve, reject) => {
  if (signal.aborted) { reject(signal.reason); return; }
  const abort = () => reject(signal.reason); signal.addEventListener('abort', abort, { once: true });
  work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
});

export async function createLocalPresentation({ player, host, dealerId, version, receipt, onIdle, onBusy, onError = () => {}, onGestureWait = () => {}, muted, composition = null, entry = null, transport = null, idlePhase = () => 'bets', idleConfigRead = true,
  connection = globalThis.navigator?.connection ?? null }) {
  if (!isActiveDealerId(dealerId)) throw new Error('Invalid presentation dealer');
  if (typeof idleConfigRead !== 'boolean') throw new TypeError('Invalid idle configuration policy');
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
  // K04 F5b (staging 28 Oct 2026): a room's shared configuration is bound to one dealer (config.dealer) and lists
  // only that dealer's verified media, without per-video dealer fields. Such a row belongs to the bound dealer; a
  // row that names an owner still needs this dealer, and an unbound configuration lends no unowned rows.
  const boundDealer = config.dealer?.id === dealerId;
  const owned = row => {
    const owners = [row.dealer, row.dealerId, row.classification?.dealerId].filter(owner => owner !== undefined && owner !== null);
    return owners.length ? owners.includes(dealerId) : boundDealer;
  };
  const sameStep = (item, event) => item?.type === event.type && (event.type === 'speak' ? item.line === event.line : item.shoeDraw === event.shoeDraw);
  // The lookahead moves past this step, and past earlier steps that were left before their answer arrived.
  const advance = (event, requestVersion) => {
    const index = queueVersion === requestVersion ? upcoming.findIndex(item => sameStep(item, event)) : -1;
    upcoming = index < 0 ? [] : upcoming.slice(index + 1);
  };
  const stepKey = event => ['deal', 'reveal'].includes(event?.type) && Number.isSafeInteger(event.shoeDraw)
    ? [event.type, event.shoeDraw, event.to ?? '', event.box ?? ''].join(':') : null;
  // A planned filmed step names its exact take (shared-room-presentation.mjs timeline) in this dealer's verified media.
  const plannedVideo = event => event?.filmedTake?.sha256 ? config.inventory.videos.find(row => row.sha256 === event.filmedTake.sha256 && row.available && owned(row)) ?? null : null;
  // Preview 28 Oct 2026 (48 lines in 17 hands): a shared room lists no families (config.inventory.families is []), so no
  // spoken line was ever prepared or warmed. Each one waited for select (0.9-4.3 s), then its GET (TTFB 0.5-4.4 s),
  // then its hash: 1.0-7.4 s from select to sound. A line's exact clip is the plan's speechTake (the engine attaches
  // the room's standard, shared-room-filmed-steps.mjs), else this dealer's one approved recorded take of the line in
  // the room's language (recordedSpeech.lineId). More than one candidate is no answer: select still chooses.
  let speechLanguage = ['en', 'sv'].includes(config.filmedMaterial?.language) ? config.filmedMaterial.language : null;
  const speechOf = row => row?.recordedSpeech ?? row?.classification?.recordedSpeech;
  const speechChecks = new Map();
  const speechFits = (row, line, language) => {
    const speech = speechOf(row), wanted = language ?? speech?.language;
    if (!speech || row.available !== true || !owned(row) || typeof row.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(row.sha256)) return false;
    const key = JSON.stringify([row.id, row.sha256, line, wanted]);
    if (!speechChecks.has(key)) speechChecks.set(key, recordedSpeechForVideo(row, { dealerId, lineId: line, language: wanted, takeId: speech.takeId, requireApproved: !preview }) !== null);
    return speechChecks.get(key);
  };
  const lineVideos = line => config.inventory.videos.filter(row => speechOf(row)?.lineId === line && speechFits(row, line, speechLanguage));
  const plannedSpeech = event => {
    if (event?.type !== 'speak' || typeof event.line !== 'string') return null;
    const ref = event.speechTake;
    if (typeof ref?.sha256 === 'string' && typeof ref.id === 'string')
      return config.inventory.videos.find(row => row.id === ref.id && row.sha256 === ref.sha256 && speechFits(row, event.line, null)) ?? null;
    const rows = lineVideos(event.line);
    return rows.length === 1 ? rows[0] : null;
  };
  // K04 F7 (rerun 4 on 6a158180, 400 kbit/s): lookahead files (two 1.1-1.6 MB takes at a time, more at every plan)
  // shared the link with the dealer's first idle film (912 kB), which never finished: the dealer was not shown in three
  // of four runs. Until the dealer has shown a frame, its idle file is downloaded first and kept pinned (an action that
  // stops the idle playback keeps its bytes), and no lookahead file or prepared step starts before it is verified or
  // has failed. A slow or unknown link then warms one file at a time.
  let dealerSeen = false, idleFirst = null, deferredPrepare = null;
  const lookaheadOpen = () => dealerSeen || !idleFirst;
  const warmLimit = () => connection && !connection.saveData && Number.isFinite(connection.downlink) && connection.downlink >= FAST_LINK_MBPS
    && !['slow-2g', '2g', '3g'].includes(connection.effectiveType) ? WARM_AHEAD : 1;
  const resumeLookahead = () => {
    if (closed || !lookaheadOpen()) return;
    const event = deferredPrepare; deferredPrepare = null; prepare(event); ahead?.load?.();
  };
  const seenDealer = () => { if (!dealerSeen) { dealerSeen = true; resumeLookahead(); warmSpeech(); } };
  // After the dealer's first frame, every spoken line of the room (about 7.7 MB for PAOW's ten Swedish slots) is
  // downloaded and verified into the player's buffer, one file at a time, so a line rarely waits for its bytes. The
  // buffer's own budget and LRU apply (verified-video-buffer.mjs); no lease is kept. It runs only between
  // presentations, never beside a plan's lookahead or a pending card, stops while the tab is hidden, and not at all
  // on a data saver or a 2G link. A file that fails is not asked for again by this warm.
  let speechWarm = null;
  const speechTried = new Set();
  const speechWarmRows = () => {
    const rows = [], seen = new Set();
    const lines = [...new Set(config.inventory.videos.map(row => speechOf(row)?.lineId).filter(line => typeof line === 'string'))]
      .sort((a, b) => (SPEECH_WARM_ORDER.indexOf(a) + 1 || 99) - (SPEECH_WARM_ORDER.indexOf(b) + 1 || 99));
    let bytes = 0;
    for (const line of lines) {
      const takes = lineVideos(line);
      // Without the room's language only an unambiguous line is warmed.
      if (!speechLanguage && takes.length !== 1) continue;
      for (const row of takes) {
        if (seen.has(row.sha256)) continue;
        bytes += Number.isSafeInteger(row.bytes) && row.bytes > 0 ? row.bytes : 0;
        if (bytes > SPEECH_WARM_BYTES) return rows;
        seen.add(row.sha256); rows.push(row);
      }
    }
    return rows;
  };
  function warmSpeech() {
    if (speechWarm || preview || closed || packageChanged || !dealerSeen || document.hidden || action || speech || ahead || idleFirst
      || typeof player.warmLocalClip !== 'function' || connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType)) return;
    const row = speechWarmRows().find(item => !speechTried.has(item.sha256));
    if (!row) return;
    const own = { controller: new AbortController() }; speechWarm = own;
    Promise.resolve().then(() => player.warmLocalClip({ media: { src: mediaUrl(row), sha256: row.sha256 } }, own.controller.signal))
      .then(() => { speechTried.add(row.sha256); }, () => { if (!own.controller.signal.aborted) speechTried.add(row.sha256); })
      .finally(() => { if (speechWarm === own) { speechWarm = null; warmSpeech(); } });
  }
  // A presentation, a hidden tab or a closed table takes the link back at once. The verified buffer keeps an
  // abandoned download for its grace, so the plan that needs the same line joins it.
  const pauseSpeechWarm = () => { const own = speechWarm; speechWarm = null; own?.controller.abort(); };
  const idleFirstFor = video => {
    if (dealerSeen || idleFirst || closed || typeof player.warmLocalClip !== 'function' || !/^[a-f0-9]{64}$/.test(video?.sha256 ?? '')) return;
    const first = { controller: new AbortController() }; idleFirst = first;
    Promise.resolve().then(() => player.warmLocalClip({ media: { src: mediaUrl(video), sha256: video.sha256 } }, first.controller.signal))
      .catch(() => {}).finally(() => { if (idleFirst === first) { idleFirst = null; resumeLookahead(); warmSpeech(); } });
  };
  const prepare = event => {
    if (!event || queueVersion !== version() || closed) return;
    if (!lookaheadOpen()) { deferredPrepare = event; return; }
    // A planned filmed step names its exact take (shared-room-presentation.mjs timeline): that file is prepared in
    // the hidden element before its time (K public/shared-table.js:310, app.js:118-125), not the family's standard.
    const exact = plannedVideo(event) ?? plannedSpeech(event);
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
  // The film that plays now ({ own, kind, video }): a sound toggle changes only its video.muted (sound() below).
  let playing = null;
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
  // OpenClaw's reaction to a game event is answered only for a shared table (idleConfigRead=false);
  // a single-player table in active/shadow sends no request.
  const behaviourUse = value => value === 'rules' ? 'rules' : !preview && !idleConfigRead && ['active','shadow'].includes(value) ? 'openclaw' : null;
  async function observeEvents(events, {command,previousVersion,signal} = {}) {
    if(signal?.aborted)return;
    // Successful collection completes the same settled round. Carry only its
    // verified result across that one version change, including a late response.
    if(command==='collect') {
      settlementContinuation={from:previousVersion,to:version()};
      if(pendingRule?.sourceType==='settle'&&pendingRule.version===previousVersion)Object.assign(pendingRule,{version:version(),collected:true});
    }
    // A turn or settlement asks for an idle reaction: a saved rule in the mode Regler, OpenClaw
    // in active/shadow (shadow is only recorded). Other modes make no request.
    const startedMode = mode, use = behaviourUse(startedMode);
    if (!idle || !use || packageChanged || closed || document.hidden || !Array.isArray(events)
      || !config.idlePolicy?.variants.some(item=>item.use===use)) return;
    const event = events?.findLast(item => ['turn','settle'].includes(item.type));
    if (!event) return;
    const requestVersion=version(), key=JSON.stringify([requestVersion,event.type,event.box,event.handIndex]);
    if (key===lastBehaviour) return;
    lastBehaviour=key;
    const own=++behaviourRequest;
    try {
      const response=await request('/api/presentation/select',{method:'POST',cache:'no-store',signal,headers:{'Content-Type':'application/json'},
        body:JSON.stringify({dealerId,version:requestVersion,mode:startedMode,event:{type:event.type,
          ...(event.type==='turn'?{box:event.box,handIndex:event.handIndex}:{})},...(context?{presentationContext:context}:{})})});
      if (signal?.aborted || !response.ok || own!==behaviourRequest || closed || document.hidden || mode!==startedMode || behaviourVersion(requestVersion,event.type)!==version()) return;
      const result=await response.json();
      if (signal?.aborted || own!==behaviourRequest || closed || document.hidden || packageChanged || mode!==startedMode || behaviourVersion(requestVersion,event.type)!==version()) return;
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
  // The committed instruction as the server published it, without a plan's choice fields.
  const committedEvent = ({ filmedTake, filmedTransitions, speechTake, ...event }) => event;
  // K04 F5c (#506): a native room's delivered plan carries each filmed step's server choice: filmedTake
  // { profileId, takeKey, id, sha256 } and filmedTransitions { before, after } ({ id, sha256 } | null), computed
  // as POST /api/presentation/select computes it (median 3.3 s in staging, longer than the first step of a plan
  // after the player's decision). The step plays that choice at once from this dealer's verified media of the
  // bound configuration, matched by sha256, in select's own answer shape; its card still waits for the step's
  // time. A choice missing or unknown here keeps select as the reserve.
  // A spoken line's plan carries the room's standard take as speechTake { id, sha256 }: the clip POST select chooses
  // in the 'off' mode (shared-room-filmed-steps.mjs). It plays at once, in select's answer shape, from this dealer's
  // verified media of the bound configuration, only while this room selects speech by its standard ('off') and its
  // idle follows no rules (a rule rides on select's answer). Another mode, an old engine without the field or a clip
  // unknown here keeps select.
  const speechAnswer = event => {
    if (selectionMode('speak') !== 'off' || mode === 'rules' || typeof event.speechTake?.sha256 !== 'string') return null;
    const video = plannedSpeech(event);
    if (!video) return null;
    const decision = { requestId: null, sourceEvent: committedEvent(event), mode: 'off', media: { videoId: video.id, sha256: video.sha256, reason: 'shared_exact_material' } };
    return { eventMode: 'off', result: { owner: 'web', projectRevision: config.projectRevision || config.revision, configurationSource,
      video, standard: video, provider: 'planned-speech', decision } };
  };
  const planAnswer = event => {
    if (event?.type === 'speak') return speechAnswer(event);
    const take = event?.filmedTake, moves = event?.filmedTransitions;
    if (!['deal', 'reveal'].includes(event?.type) || typeof take?.id !== 'string' || !moves || typeof moves !== 'object') return null;
    const row = ref => ref === null ? null : config.inventory.videos.find(item => typeof ref?.sha256 === 'string' && item.sha256 === ref.sha256 && item.available && owned(item));
    const video = row(take), before = row(moves.before), after = row(moves.after);
    if (!video || before === undefined || after === undefined) return null;
    const chosen = { ...video, filmedTake: { profileId: take.profileId, takeKey: take.takeKey } };
    return { eventMode: selectionMode(event.type), result: { owner: 'web', projectRevision: config.projectRevision || config.revision, configurationSource,
      video: chosen, standard: chosen, transitions: { before, after }, provider: 'filmed-deal-sequence',
      decision: { requestId: null, sourceEvent: committedEvent(event), media: { reason: 'filmed_deal_sequence', profileId: take.profileId, takeKey: take.takeKey } } } };
  };
  // The server's selection for one committed instruction. It reads no card and starts no film.
  async function selection(event, requestVersion, signal) {
    const eventMode = selectionMode(event.type);
    const selected = await request('/api/presentation/select', { method: 'POST', cache: 'no-store', signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealerId, mode: eventMode, version: requestVersion, event: committedEvent(event), shoeTransitions: true, ...(context ? {presentationContext:context} : {}) }) });
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
      // A step whose plan already carries the server's choice needs no answer (K04 F5c, #506).
      if (!key || !event.filmedTake || steps.has(key) || planAnswer(event)) continue;
      const committed = committedEvent(event);
      const step = { signal: controller.signal, promise: null,
        start: () => { if (!step.promise) { step.promise = selection(committed, requestVersion, controller.signal); step.promise.catch(() => {}); } return step.promise; } };
      steps.set(key, step);
    }
    // The plan's own files: a chosen step's entry clip, take and exit clip, a planned take, a spoken line's clip.
    const filesOf = event => { const answer = planAnswer(event)?.result;
      return answer ? [answer.transitions?.before, answer.video, answer.transitions?.after] : [plannedVideo(event) ?? plannedSpeech(event)]; };
    // A spoken line never goes ahead of the plan's first card: on a slow link (one file at a time) the opening
    // goodluck would hold the first deal's take behind it. That card's files go first, then the plan in order.
    const firstCard = events.findIndex(event => ['deal', 'reveal'].includes(event?.type));
    const planned = (firstCard < 0 ? events : [events[firstCard], ...events.filter((_, index) => index !== firstCard)]).flatMap(filesOf);
    if (!steps.size && !planned.some(Boolean)) return;
    ahead = { version: requestVersion, controller, steps };
    // K04 F5b: as each answer arrives, its exact files are downloaded and verified into the player's buffer,
    // WARM_AHEAD at a time and in the plan's order. Nothing is decoded or shown; the step that plays a file
    // later reads the same bytes. Dropping the answers cancels the files still loading.
    const queued = new Set(), files = [];
    let loading = 0;
    const load = () => {
      while (lookaheadOpen() && loading < warmLimit() && files.length && !controller.signal.aborted) {
        const video = files.shift(); loading++;
        Promise.resolve().then(() => player.warmLocalClip({ media: { src: mediaUrl(video), sha256: video.sha256 } }, controller.signal))
          .catch(() => {}).finally(() => { loading--; load(); });
      }
    };
    const queue = list => {
      if (typeof player.warmLocalClip !== 'function' || controller.signal.aborted) return;
      for (const file of list)
        if (typeof file?.sha256 === 'string' && /^[a-f0-9]{64}$/.test(file.sha256) && !queued.has(file.sha256)) { queued.add(file.sha256); files.push(file); }
      load();
    };
    const warm = answer => { const { video, transitions } = answer?.result ?? {}; queue([transitions?.before, video, transitions?.after]); };
    ahead.load = load;
    // K04 F5c (rerun 4): a plan after the player's decision starts with its filmed step, and its files were only
    // warmed once the server's answer came (median 3.3 s in staging). The planned takes are this plan's own exact
    // files: they download from the plan's start, in order. The answer still decides what plays, and when.
    // A step that carries the server's choice warms its entry clip, take and exit clip the same way, and a spoken
    // line its recorded clip.
    queue(planned);
    for (const step of steps.values()) {
      const start = step.start;
      step.start = () => { const first = !step.promise, promise = start(); if (first) promise.then(warm, () => {}); return promise; };
    }
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
    const chosen = planAnswer(event);
    if (chosen) return chosen;
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
  // Studio rehearsal keep their own per-play read, except on a shared table (idleConfigRead=false).
  async function film(video, { signal, kind, details = {}, onPrepared, onFrame, onMediaFrame, onEvent, onProgress, timing = {}, selected = false } = {}) {
    const own = new AbortController(); active = own;
    if (kind === 'idle') idleFirstFor(video);
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
      // idleConfigRead=false: a shared table, whose server-confirmed binding stands for its package (see its option).
      if (preview || (context && !selected && idleConfigRead)) {
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
        onVideo: element => { if (stillCurrent()) playing = { own, kind, video: element }; },
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
    } finally { signal?.removeEventListener('abort', abort); releaseGestureWait(own); if (active === own) active = null; if (playing?.own === own) playing = null; if (soundRetry?.own === own) soundRetry = null; }
  }
  // A rule (idleRule) or OpenClaw's reaction to the game event (idleAdvice), bound to this
  // request's mode, version and package. Shadow advice is recorded and never played.
  function retainRule(result, requestVersion, sourceType) {
    const use = behaviourUse(mode), rule = use === 'rules' ? result.idleRule : use === 'openclaw' ? result.idleAdvice : null;
    if (!idle || !use || rule?.mode !== mode || rule.version !== requestVersion || rule.requestId !== result.decision?.requestId
      || JSON.stringify(rule.presentationContext) !== JSON.stringify(context)) return;
    if (use === 'openclaw') receipt({ event: 'idle-advice', state: 'selected', source: 'game-event', result: rule, projectRevision: result.projectRevision, configurationSource });
    if (typeof rule.videoId !== 'string' || mode === 'shadow') return;
    const remaining = Math.max(0, Math.min(30000, Date.parse(rule.expiresAt) - Date.now()));
    if (!Number.isFinite(remaining) || !remaining) return;
    pendingRule = {videoId:rule.videoId,requestId:rule.requestId,expiresAt:performance.now()+remaining,version:behaviourVersion(requestVersion,sourceType),sourceType,
      mode,use,collected:sourceType==='settle'&&settlementContinuation?.from===requestVersion};
  }
  function offerPendingRule() {
    if (!pendingRule || action || speech || ready || document.hidden || pendingRule.sourceType==='settle'&&!pendingRule.collected) return;
    const rule = pendingRule; pendingRule = null;
    if (mode === rule.mode && rule.version === version() && rule.expiresAt > performance.now())
      idle?.offerVariant({videoId:rule.videoId,requestId:rule.requestId,expiresAt:rule.expiresAt},{use:rule.use});
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
        seenDealer(); onIdle(); },
    }).then(() => { if (epoch !== serial || closed) return; idleRetries = 0; idleRun = 0; resumeOwnIdle(); })
      .catch(error => { if (epoch !== serial || closed) return;
        if (staleRoom(error)) { idleRun = 0; return; }
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
        idle.presented(clip.playId); seenDealer(); if (clip.standardBase) onIdle(); },
      onEvent: event => { if (epoch === serial && event.state === 'start') idle.started(clip.playId); },
    }).then(() => { if (epoch !== serial) return; if (idle.mode === 'rotation') idle.updateScene({phase:readIdlePhase()}); idle.completed(clip.playId); if (clip.repeat) idleRun = 0; resumeIdle(); })
      .catch(error => { if (epoch !== serial || closed) return;
        if (staleRoom(error)) { idleRun = 0; return; }
        if (requireReload(error)) return; idleError = `Idle: ${error.message}`; status.textContent = idleError; onError(error);
        if (transientPlayback(error) && idleTransientRetries++ < 20) { retryIdleSoon(); return; }
        idle.failed(clip.playId); resumeIdle(); });
  }
  function state(patch) {
    if (!document.hidden) idleTransientRetries = 0;
    if (document.hidden || patch.action === true || patch.speech === true) pauseSpeechWarm();
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
    if (action || speech) onBusy(); else { resumeIdle(); warmSpeech(); }
  }
  // onUnavailable(): this step's exact media is missing or declared unavailable
  // (not a retryable playback failure); the shared table ends its film at once.
  // shown(): the caller's card for this step is already on the table (the shared table's card cursor).
  async function present(event, { signal, onPresented, onSelected, onFrame, onProgress, onUnavailable, shown, startOffset, handoverAt, playbackRate, clockTime } = {}) {
    if (packageChanged) return false;
    const kind = event.type === 'speak' ? 'speech' : event.type;
    presentationKind = kind;
    const requestVersion = version();
    pauseSpeechWarm();
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
      // K04 F9: a take that stalls after its card is already on the table ends its step without text;
      // the receipt still names the stall. Before the card shows, the failure line stays.
      let cardShown = false;
      if (error.code === 'local_film_stalled' && kind !== 'speech') { try { cardShown = shown?.() === true; } catch {} }
      if (!soundBlocked && !cardShown) showFailure(kind === 'speech' ? SPEECH_FAILED : FILM_FAILED);
      const missing = unavailableMedia(error);
      receipt({ event: kind, state: kind === 'speech' ? 'failed' : 'fallback', sourceEvent: event, reason: error.message,
        ...(error.code ? { code: error.code } : {}), ...(Number.isInteger(error.status) ? { status: error.status } : {}), ...(error.serverCode ? { serverCode: error.serverCode } : {}),
        ...(missing ? { unavailable: true } : {}), ...(soundBlocked ? { soundUnlocked } : {}), ...(cardShown ? { cardShown: true } : {}), renderer: kind === 'speech' ? 'none' : '2d', requestId: result?.decision?.requestId, familyId: result?.decision?.media?.familyId,
        projectRevision: result?.projectRevision, configurationSource });
      if (missing) { try { onUnavailable?.(); } catch {} }
      // The step's result is on the table: the shared table reports no media error for it.
      return cardShown;
    }
  }
  control.onchange = () => { pendingRule = null; ++behaviourRequest; settlementContinuation=null; idle?.clearOffers(); adviceController?.abort(); mode = preview&& !['off','rules','random'].includes(control.value)?'off':control.value; control.value=mode; state({}); receipt({ event: 'configuration', state: 'selected', mode, projectRevision: config.projectRevision || config.revision, configurationSource }); };
  const visibility = () => state({}); document.addEventListener('visibilitychange', visibility);
  return { present, state, observeChat, observeEvents, start: resumeIdle,
    get filmedMaterial() { return config.filmedMaterial?structuredClone(config.filmedMaterial):null; },
    // The package row's frozen landings (frozen-dealer-presentation.mjs configuration), when the dealer has its own.
    get filmedProfile() { return config.filmedProfile?structuredClone(config.filmedProfile):null; },
    // language: the plan's language (the room's), so a spoken line without the plan's speechTake finds its take.
    prepareSequence(events, { selectAhead: early = false, language } = {}) {
      if (['en', 'sv'].includes(language)) speechLanguage = language;
      pauseSpeechWarm(); dropAhead(); queueVersion = version(); upcoming = events; prepare(upcoming[0]);
      if (early && !closed && !packageChanged) selectAhead(events, queueVersion);
    },
    get idleBackground() { return !closed && !action && !speech && presentationKind === 'idle'; },
    // The owner's muted() changed (the table's sound button). The line that plays follows it at once: only its
    // video.muted changes, inside the player's click, so the line is never stopped, restarted or selected again.
    // Every other film is silent anyway, and the next line reads muted() when it starts.
    sound() { if (!closed && playing?.kind === 'speech' && playing.video && !playing.own.signal.aborted) playing.video.muted = muted(); },
    close() { pendingRule = null; closed = true; pauseSpeechWarm(); upcoming = []; dropAhead(); idleFirst?.controller.abort(); deferredPrepare = null; player.cancelLocalPreparation?.(); adviceController?.abort(); ++serial; stop(); idle?.close(); document.removeEventListener('visibilitychange', visibility); status.remove(); control.remove(); still.remove(); soundRetry = null; removeSoundButton(); } };
}
