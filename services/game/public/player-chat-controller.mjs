import {requestPlayerChat} from './chat-requests.mjs';
import {STUDIO_PREVIEW_NOTICE} from './studio-preview-client.mjs';
import {CHAT_STAGES,chatFailureMessage,chatFailureCode} from '../../../packages/presentation/contracts/chat-response.mjs';

// Live state is supplied by the game document; this controller never owns game outcomes.
export function createPlayerChatController({state, studioPreview, $, DEALER, clientSessionRevision, entrySelection, compactChat, setChatStatus, localPresentationEnabled, nativeObservation, chatPlaybackDiagnostic, poseIdentity, chatLog, pendingChatReplies, apiFetch, performance=globalThis.performance, crypto=globalThis.crypto, setInterval=globalThis.setInterval, clearInterval=globalThis.clearInterval}) {
  function refreshNextDealChat(){
    if(!state.nextDealControls)return;
    state.nextDealControls.querySelector('button').hidden=!state.nextDealChat&&!state.activeDealSpeech;
  }
  function setMovingSpeechAvailable(available){
    state.movingSpeechAvailable=available===true;
    if(state.nextDealControls)state.nextDealControls.hidden=!state.movingSpeechAvailable;
    if(!state.movingSpeechAvailable){
      const toggle=$('#chat-next-deal');if(toggle)toggle.checked=false;
      cancelNextDealChat();
    }
  }
  function cancelNextDealChat(){
    state.nextDealChat=null;
    if(state.activeDealSpeech?.jobId)state.speechPoseGate?.cancel(state.activeDealSpeech.jobId,'explicit-interrupt');
    refreshNextDealChat();
  }
  async function sendChat({ message: reviewedMessage, images = [], profileRevision = null, dealSpeech=null } = {}) {
    if(studioPreview){setChatStatus(STUDIO_PREVIEW_NOTICE);return false;}
    const input = $('#chat-input');
    const message = (reviewedMessage ?? input.value).trim();
    if (!message || state.chatBusy) return false;
    if(!dealSpeech&&reviewedMessage===undefined&&$('#chat-next-deal')?.checked&&state.movingSpeechAvailable){
      if(state.busy){setChatStatus('Vänta tills den pågående utdelningen är klar.');return false;}
      state.nextDealChat={message,dealerId:DEALER.key,sessionRevision:clientSessionRevision};refreshNextDealChat();
      setChatStatus('Frågan sparad för nästa utdelning. Du kan avbryta.');return true;
    }
    state.probeClient?.activity();
    if (reviewedMessage === undefined) input.value = '';
    state.chatBusy = true;
    $('#chat-send').disabled = true;
    if (compactChat()) input.blur();
    const requestedAt = performance.now();
    setChatStatus('Förbereder svar…');
    if (state.chatStatus) { state.chatStatus.dataset.stages = '[]'; delete state.chatStatus.dataset.playbackMs; delete state.chatStatus.dataset.firstFrameMs;
      delete state.chatStatus.dataset.failureCode; delete state.chatStatus.dataset.providerMetrics; state.chatStatus.title = ''; }
    const waitTimer = localPresentationEnabled ? setInterval(() => { state.chatElapsed.textContent = ` ${Math.floor((performance.now() - requestedAt) / 1000)} s`; }, 1000) : null;
    const chatCorrelation=nativeObservation.context();
    const history = state.chatHistory.slice(-30).map(({ role, text }) => ({ role, text }));
    const requestId = crypto.randomUUID();
    chatPlaybackDiagnostic.begin(requestId);
    const identity = poseIdentity();
    nativeObservation.emit('chat',{role:'user',text:message,source:'openclaw-chat',contextMessages:history},chatCorrelation);
    state.localPresentation?.observeChat(message);
    chatLog('user', message);
    state.chatHistory.push({ role: 'user', text: message });
    const received = state.speechPoseGate.receive({ jobId: requestId, ...identity, requestFingerprint: requestId });
    const controller = new AbortController();
    pendingChatReplies.set(requestId, { correlation: chatCorrelation, message, controller, requestedAt,dealSpeech });
    const stages = [];
    let previewRow = null;
    try {
      if (received.record.status === 'cancelled') throw new Error(received.record.reason);
      if(dealSpeech){dealSpeech.jobId=requestId;state.speechPoseGate.reserveDeal(requestId,dealSpeech.version);refreshNextDealChat();}
      const decision = await requestPlayerChat({ request: apiFetch, requestId, message, history, dealer: DEALER.key, entrySelection, identity,
        signal: controller.signal, progressEvents: localPresentationEnabled, presentationVersion: dealSpeech?.version, images, profileRevision,
        onProgress: progress => {
        stages.push({ stage: progress.stage, elapsedMs: progress.elapsedMs, ...(progress.metrics ? { metrics: progress.metrics } : {}) });
        if (state.chatStatus) {
          state.chatStatus.dataset.stages = JSON.stringify(stages);
          if (progress.metrics) state.chatStatus.dataset.providerMetrics = JSON.stringify(progress.metrics);
          state.chatStatus.title = stages.map(item => `${CHAT_STAGES[item.stage]} ${(item.elapsedMs / 1000).toFixed(1)} s`).join('\n');
          if (state.chatStatus.dataset.providerMetrics) {
            const { runpodDelayMs, runpodExecutionMs } = JSON.parse(state.chatStatus.dataset.providerMetrics);
            if (runpodDelayMs !== undefined) state.chatStatus.title += `\nRunPod-kö ${(runpodDelayMs / 1000).toFixed(1)} s`;
            if (runpodExecutionMs !== undefined) state.chatStatus.title += `\nRunPod-körning ${(runpodExecutionMs / 1000).toFixed(1)} s`;
          }
        }
        setChatStatus(CHAT_STAGES[progress.stage]);
        nativeObservation.emit('status', { state: 'chat-progress', requestId, stage: progress.stage, elapsedMs: progress.elapsedMs,
          ...(progress.metrics ? { metrics: progress.metrics } : {}) }, chatCorrelation);
      }, onPreview: exactText => {
        previewRow = chatLog('vera', exactText, true);
        previewRow.title = 'Svarstext klar · förbereder röst och läppsynk';
        const pending = pendingChatReplies.get(requestId);
        if (pending) { pending.previewRow = previewRow; pending.previewText = exactText; }
      } });
      clearInterval(waitTimer);
      setChatStatus(decision.kind === 'silence' ? '' : 'Svar klart · väntar på ledigt bord');
      if (decision.kind !== 'silence'&&!dealSpeech) state.localPresentation?.state({ ready: true });
      state.speechPoseGate.responseReady(requestId, decision);
      const receipt = await received.completion;
      if (receipt.status === 'failed') throw new Error(receipt.reason || 'Speech failed');
      if (receipt.status === 'cancelled') {
        chatPlaybackDiagnostic.finish(requestId, 'cancelled', receipt.reason);
        if (state.chatStatus) state.chatStatus.dataset.failureCode = chatFailureCode(receipt.reason);
        setChatStatus(chatFailureMessage(receipt.reason));
      }
      else {
        if(dealSpeech&&input.value.trim()===message)input.value='';
        chatPlaybackDiagnostic.finish(requestId, decision.kind === 'silence' ? 'silent' : 'unverified');
        setChatStatus(decision.kind === 'silence' ? `${DEALER.name} valde att inte svara på det meddelandet.`
          : pendingChatReplies.get(requestId)?.voiceUnavailable ? `Genererat tal är inte aktiverat för ${DEALER.name} just nu. Svaret visas som text.` : '');
      }
      return receipt.status==='completed';
    } catch (error) {
      if (previewRow?.classList.contains('pending')) previewRow.remove();
      const reason = state.speechPoseGate.get(requestId)?.reason || error.message || 'chat-failed';
      if (state.chatStatus) state.chatStatus.dataset.failureCode = chatFailureCode(reason);
      state.speechPoseGate.cancel(requestId, reason);
      chatPlaybackDiagnostic.finish(requestId, 'failed', reason);
      setChatStatus(reason === 'speech_autoplay_blocked'
        ? 'Webbläsaren blockerade ljudet. Tillåt ljud för sidan och skicka frågan igen.' : chatFailureMessage(reason));
      nativeObservation.emit('status', { state: 'chat-failed', requestId, reason }, chatCorrelation);
      return false;
    } finally {
      pendingChatReplies.delete(requestId);
      state.chatBusy = false;
      clearInterval(waitTimer);
      $('#chat-send').disabled = false;
    }
  }
  return {sendChat, refreshNextDealChat, setMovingSpeechAvailable, cancelNextDealChat};
}
