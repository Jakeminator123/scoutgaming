import { isActiveDealerId } from '../../../packages/presentation/contracts/dealer-identity.mjs';
import { recordedSpeechForVideo } from '../../../packages/presentation/contracts/recorded-speech.mjs';
import { createLiveIdleController } from '../../../packages/presentation/runtime/live-idle.mjs';

export async function createLocalPresentation({ player, host, dealerId, version, receipt, onIdle, onBusy, onError = () => {}, muted, composition = null, entry = null, transport = null }) {
  if (!isActiveDealerId(dealerId)) throw new Error('Invalid presentation dealer');
  const preview=Boolean(transport?.context);
  const request=transport?.request??((...args)=>globalThis.fetch(...args));
  const mediaUrl=transport?.mediaUrl??(video=>video.src||`/api/presentation/videos/${video.id}`);
  const context = entry?.operator ? { operatorSlug: entry.operator, roomId: entry.roomId, packageRevision: entry.packageRevision, dealerId } : null;
  const configUrl = '/api/presentation/config' + (context ? '?' + new URLSearchParams(Object.entries(context).map(([key,value])=>[key,String(value)])) : '?dealerId=' + encodeURIComponent(dealerId));
  const packageError = () => Object.assign(new Error('Presentationspaketet har ändrats. Ladda om spelet.'), { code:'studio_presentation_idle_package_changed' });
  const response = await request(configUrl, { cache: 'no-store' });
  if (response.status === 409) throw packageError();
  if (!response.ok) throw new Error('Local presentation configuration unavailable');
  const config = await response.json();
  let upcoming = [], queueVersion;
  const prepare = event => {
    if (!event || queueVersion !== version() || closed) return;
    const family = config.inventory.families?.find(row => row.dealerId === dealerId && (
      event.type === 'speak' ? row.eventId.startsWith('speak.') && row.situation === event.line :
      event.type === 'reveal' ? row.eventId === 'reveal.dealer' :
      event.to === 'dealer' ? row.eventId === 'deal.dealer' && row.situation === (event.faceDown ? 'dealer-hole' : 'dealer-up') :
      row.eventId.startsWith('deal.player.') && row.situation === `box${event.box}`));
    const video = config.inventory.videos.find(row => family?.standardIds.includes(row.id) && row.available);
    if (video) player.prepareLocalClip?.({ media: { src: mediaUrl(video), sha256: video.sha256 } });
  };
  let action = false, speech = false, ready = false, closed = false, active = null, serial = 0, mode = !preview && config.defaultMode === 'active' ? 'active' : 'off', presentationKind = null, packageChanged = false;
  const configurationSource = config.configurationSource || 'lab/project.json';
  receipt({ event: 'configuration', state: 'selected', mode, projectRevision: config.projectRevision || config.revision, configurationSource });
  const status = document.createElement('div'); status.className = 'local-presentation-status'; status.setAttribute('role', 'status'); host.append(status);
  const control = document.createElement('select'); control.setAttribute('aria-label', 'Klippval');
  for (const [value, text] of [['off','Standard'],['rules','Regler'],['random','Slump'],['active','OpenClaw'],['shadow','OpenClaw · skugga']]) {
    if(preview&&['active','shadow'].includes(value))continue;
    const option = document.createElement('option'); option.value = value; option.textContent = text; control.append(option);
  }
  control.value = mode;
  control.className = 'local-presentation-mode'; host.append(control);
  const hasOwnIdlePolicy = config.idlePolicy?.familyId === `${dealerId}/idle.ready/ready`;
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
  const stop = () => { clearTimeout(idleRetryTimer); idleRetryTimer = null; active?.abort(); active = null; };
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
  async function film(video, { signal, kind, details = {}, onPrepared, onFrame, onMediaFrame, onEvent } = {}) {
    const own = new AbortController(); active = own;
    const abort = () => own.abort(); signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) own.abort();
    host.dataset.presentationMedia = video.id; host.dataset.presentationFile = video.fileName; host.dataset.presentationKind = kind;
    host.dataset.presentationSha256 = video.sha256;
    host.dataset.presentationRevision = String(config.projectRevision || config.revision || '');
    host.dataset.presentationPackageRevision = String(context?.packageRevision ?? '');
    try {
      if (context || preview) {
        const current = await request(configUrl, { signal: own.signal, cache: 'no-store' });
        if (current.status === 409) throw packageError();
        if (!current.ok) throw new Error('Dealerns film är inte längre tillgänglig');
      }
      if(composition)await composition.prepareClip(video.compositing ?? video.classification?.compositing,video.framing ?? video.classification?.framing,{kind});
      if(own.signal.aborted)throw new DOMException('Presentation cancelled','AbortError');
      onPrepared?.();
      await player.playLocalClip({ media: { src: mediaUrl(video), sha256: video.sha256 } }, {
        signal: own.signal, muted: kind !== 'speech' || muted(), hold, onFrame: onMediaFrame,
        renderFrame: composition ? source => composition.renderFrame(source) : undefined,
        onReceipt: event => { host.dataset.presentationState = event.state; receipt({ event: kind, ...details, ...event, mediaId: video.id, mediaSha256: video.sha256, fileName: video.fileName, packageRevision: context?.packageRevision, renderer: 'performance-local' });
          if (event.state === 'presented') onFrame?.(); onEvent?.(event); },
      });
    } finally { signal?.removeEventListener('abort', abort); if (active === own) active = null; }
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
    pendingRule = null; packageChanged = true; ++serial; stop(); idle?.close(); control.disabled = true; status.textContent = error.message + ' ';
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
      onFrame: () => { if (epoch !== serial || closed) return;
        idleTransientRetries = 0;
        if (idleError !== null && status.textContent === idleError) { status.textContent = ''; idleError = null; }
        idle.presented(clip.playId); if (clip.standardBase) onIdle(); },
      onEvent: event => { if (epoch === serial && event.state === 'start') idle.started(clip.playId); },
    }).then(() => { if (epoch !== serial) return; idle.completed(clip.playId); if (clip.repeat) idleRun = 0; resumeIdle(); })
      .catch(error => { if (epoch !== serial || closed) return; if (requireReload(error)) return; idleError = `Idle: ${error.message}`; status.textContent = idleError; onError(error);
        if (transientPlayback(error) && idleTransientRetries++ < 20) { retryIdleSoon(); return; }
        idle.failed(clip.playId); resumeIdle(); });
  }
  function state(patch) {
    if (!document.hidden) idleTransientRetries = 0;
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
    if (document.hidden) { pendingRule = null; ++behaviourRequest; upcoming = []; player.cancelLocalPreparation?.(); }
    ++serial; stop(); idleRun = 0;
    idle?.updateScene({ actionBusy: action, speechPlaying: speech, speechReady: ready, visible: !document.hidden, revision: `${version()}:${mode}` });
    offerPendingRule();
    if (action || speech) onBusy(); else resumeIdle();
  }
  async function present(event, { signal, onPresented, onSelected, onFrame } = {}) {
    if (packageChanged) return false;
    const kind = event.type === 'speak' ? 'speech' : event.type;
    presentationKind = kind;
    const requestVersion = version();
    ++serial; stop(); onBusy();
    status.textContent = '';
    const token = serial;
    let result;
    try {
      const selected = await request('/api/presentation/select', { method: 'POST', cache: 'no-store', signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealerId, mode, version: requestVersion, event, shoeTransitions: true, ...(context ? {presentationContext:context} : {}) }) });
      if (selected.status === 409 && context) {
        const failure = await selected.json().catch(() => null);
        if (failure?.code === 'studio_presentation_idle_package_changed') throw packageError();
      }
      if (!selected.ok) throw new Error('Inget verifierat klipp för instruktionen');
      result = await selected.json();
      if (token !== serial || requestVersion !== version() || signal?.aborted) return false;
      receipt({ event: kind, state: 'selected', ...result.decision, sourceEvent: result.decision.sourceEvent, renderer: 'performance-local', provider: result.provider, mode, projectRevision: result.projectRevision, configurationSource });
      if (queueVersion === requestVersion && upcoming[0]?.type === event.type
        && (event.type === 'speak' ? upcoming[0].line === event.line : upcoming[0].shoeDraw === event.shoeDraw)) upcoming.shift();
      else upcoming = [];
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
      const play = async video => {
        const speech = video.recordedSpeech ?? video.classification?.recordedSpeech;
        if (speech !== undefined && (kind !== 'speech' || !recordedSpeechForVideo(video, {
          dealerId, lineId: event.line, language: speech?.language, takeId: speech?.takeId, requireApproved: !preview,
        }))) throw new Error('Talfilmens granskning eller identitet stämmer inte');
        const current = ++attempt;
        try {
          await film(video, { kind, signal, onPrepared:()=>{if(owns(current))onSelected?.(video,result.decision.sourceEvent);}, details: { line: event.line, to: event.to, box: event.box, shoeDraw: event.shoeDraw, familyId: result.decision.media?.familyId, requestId: result.decision.requestId, projectRevision: result.projectRevision, configurationSource },
            onFrame: () => { if (owns(current)) onPresented?.(); },
            onMediaFrame: onFrame ? time => { if (owns(current)) onFrame(time); } : undefined,
            onEvent: event => { if (owns(current) && event.state === 'start') prepare(upcoming[0]); } });
        } finally { if (current === attempt) ++attempt; }
      };
      const transition = async (video, direction) => {
        if (!video) return;
        if (token !== serial || requestVersion !== version() || signal?.aborted) throw new DOMException('Presentation cancelled', 'AbortError');
        await film(video, { kind: 'transition', signal, details: { direction, shoeDraw: event.shoeDraw,
          requestId: result.decision.requestId, projectRevision: result.projectRevision, configurationSource } });
        if (token !== serial || requestVersion !== version() || signal?.aborted) throw new DOMException('Presentation cancelled', 'AbortError');
      };
      await transition(result.transitions?.before, 'to-shoe');
      try { await play(result.video); }
      catch (error) { if (error.code === 'local_film_stalled' || signal?.aborted || token !== serial || !result.standard || result.standard.id === result.video.id || result.video.recordedSpeech || result.video.classification?.recordedSpeech) throw error;
        receipt({ event: kind, state: 'fallback', sourceEvent: event, reason: error.message, renderer: 'performance-local', requestId: result.decision.requestId, mediaId: result.standard.id, projectRevision: result.projectRevision, configurationSource });
        await play(result.standard); }
      await transition(result.transitions?.after, 'from-shoe');
      const current = token === serial && requestVersion === version() && !signal?.aborted;
      if (current) retainRule(result, requestVersion);
      return current;
    } catch (error) {
      if (signal?.aborted || token !== serial) return false;
      if (requireReload(error)) return false;
      status.textContent = kind === 'speech' ? `Tal: ${error.message}` : `${error.message} · 2D-reserv`;
      receipt({ event: kind, state: kind === 'speech' ? 'failed' : 'fallback', sourceEvent: event, reason: error.message, renderer: kind === 'speech' ? 'none' : '2d', requestId: result?.decision?.requestId, familyId: result?.decision?.media?.familyId,
        projectRevision: result?.projectRevision, configurationSource }); return false;
    }
  }
  control.onchange = () => { pendingRule = null; ++behaviourRequest; settlementContinuation=null; idle?.clearOffers(); adviceController?.abort(); mode = preview&& !['off','rules','random'].includes(control.value)?'off':control.value; control.value=mode; state({}); receipt({ event: 'configuration', state: 'selected', mode, projectRevision: config.projectRevision || config.revision, configurationSource }); };
  const visibility = () => state({}); document.addEventListener('visibilitychange', visibility);
  return { present, state, observeChat, observeEvents, start: resumeIdle,
    prepareSequence(events) { queueVersion = version(); upcoming = events; prepare(upcoming[0]); },
    get idleBackground() { return !closed && !action && !speech && presentationKind === 'idle'; },
    close() { pendingRule = null; closed = true; upcoming = []; player.cancelLocalPreparation?.(); adviceController?.abort(); ++serial; stop(); idle?.close(); document.removeEventListener('visibilitychange', visibility); status.remove(); control.remove(); still.remove(); } };
}
