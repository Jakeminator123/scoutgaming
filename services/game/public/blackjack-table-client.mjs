import {chatPresentationContext} from './chat-presentation-context.mjs';

// Live state is supplied by the game document; this controller never owns game outcomes.
export function createBlackjackTableClient({state, apiFetch, loadPlayer, DEALER, entrySelection, clientSessionRevision, cancelNextDealChat, setMovingSpeechAvailable, updatePoseState, nativeObservation, document, setBanner, setChatStatus, renderBets, crypto=globalThis.crypto}) {
  async function api(path, payload) {
    const r = await apiFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if(r.status===401) { state.player=null; throw new Error('Sign in required'); }
    const out = await r.json().catch(() => ({}));
    if (!r.ok || out.error) throw Object.assign(new Error(out.error ?? `api ${r.status}`), { status: r.status });
    return out;
  }
  async function tableCommand(op, extra = {}) {
    if(op!=='state'&&op!=='start')cancelNextDealChat();
    if (op !== 'state') state.probeClient?.activity();
    if (!state.player) await loadPlayer();
    if (!state.player) throw new Error('Cannot connect to the game server');
    if (op !== 'state') state.localPresentation?.state({ action: true, command: op });
    if (op !== 'state') updatePoseState({ dealerPose: 'action', actionOwner: `table-${op}`, idlePresented: null }, 'table-command-started');
    const payload = { id: state.player.id, op, version: state.tableVersion, requestId: crypto.randomUUID(), dealer: DEALER.key, ...extra,
      ...(op==='start'&&state.nextDealChat&&state.movingSpeechAvailable?{movingSpeech:{context:chatPresentationContext(entrySelection,DEALER.key),sessionRevision:clientSessionRevision}}:{}) };
    let out;
    for (let attempt=0; attempt<2; attempt++) {
      try { out = await api('/api/table', payload); break; }
      catch (e) {
        if (op === 'start' && payload.movingSpeech && e.status === 409 && e.message === 'moving_deal_speech_unavailable') {
          setMovingSpeechAvailable(false);
          // A previous network failure may have hidden a committed start. Only
          // an unambiguous first response can unlock the unchanged betting draft.
          e.dealSpeechUnavailable = attempt === 0;
        }
        if (attempt || !/fetch|network|load failed/i.test(e.message)) {
          if (op !== 'state') updatePoseState({ dealerPose: 'unknown', actionOwner: 'none', idlePresented: null }, 'table-command-failed');
          throw e;
        }
      }
    }
    const previousVersion = state.tableVersion;
    state.tableVersion = out.version;
    if (op !== 'state') void state.localPresentation?.observeEvents?.(out.presentation,{command:op,previousVersion});
    setMovingSpeechAvailable(out.movingSpeechAvailable===true);
    updatePoseState({ roundRevision: String(state.tableVersion),
      ...(op === 'state' ? { actionOwner: 'none' } : {}) }, 'table-version-committed');
    if (op === 'state') state.localPresentation?.state({ action: false });
    nativeObservation.command(payload, out, state.observedTableView, DEALER.key);
    state.observedTableView = out;
    return out;
  }
  function tableError(e) {
    if (e.dealSpeechUnavailable === true && !state.round) {
      state.busy = false;
      state.localPresentation?.state({ action: false });
      setBanner('Tal under utdelning är avstängt. Ingen insats drogs. Tryck DEAL igen för att spela utan tal.');
      setChatStatus('Det planerade svaret avbröts. Texten finns kvar.');
      renderBets();
      return;
    }
    state.busy = true; document.querySelectorAll('#actions button,#actions-top button').forEach(b=>b.disabled=true); setBanner(e.message + ' · Reload to resume'); renderBets();
  }
  return {api, tableCommand, tableError};
}
