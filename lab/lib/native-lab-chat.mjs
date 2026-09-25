import { createLabSpeechBridge } from '../../web/public/lab-speech-bridge.mjs';
import { createSpeechPoseGate } from '../../web/public/speech-pose-gate.mjs';

// One linked chat delivery, independent from game instructions. The existing
// pose gate owns promotion; the renderer owns every presented-idle proof.
export function createNativeLabChat({ binding, initialScene, playGenerated, onMessage = () => {}, onStatus = () => {},
  onReceipt = () => {}, onSettled = () => {}, bridgeFactory = createLabSpeechBridge,
  schedule = setTimeout, clear = clearTimeout, makeId = () => crypto.randomUUID() }) {
  let scene = { ...initialScene }, current = null, attached = false, closed = false, retry = null, attempts = 0;
  const usable = () => !closed && attached && scene.connected && scene.active && scene.visible
    && Number.isSafeInteger(scene.roundVersion) && scene.roundVersion >= 0;
  const unchanged = job => job.dealerId === scene.dealerId && job.roundVersion === scene.roundVersion && job.boundary === scene.boundary;
  const status = (state, detail) => onStatus({ state, ...(detail ? { detail } : {}), pending: Boolean(current) });
  function settle(job, outcome, detail) {
    if (current !== job) return;
    current = null; job.signal?.removeEventListener('abort', job.abort);
    if (outcome === 'completed') bridge.complete(job.requestId); else { job.gate?.cancelAll(detail ?? outcome); bridge.cancel(job.requestId); }
    status(outcome, detail); onSettled();
  }
  function updateGate(job) {
    if (!job?.gate || current !== job) return;
    const identity = { dealerId: job.decision.dealerId, sessionRevision: job.decision.sessionRevision, roundRevision: job.decision.roundRevision };
    job.gate.updateRendererState({ ...identity, dealerPose: scene.idleReady ? 'standard-idle' : 'unknown',
      actionOwner: scene.actionBusy ? 'game' : 'none', speechOwner: 'none', visible: scene.visible && scene.active && scene.connected,
      muted: false, idlePresented: scene.idleReady && !scene.actionBusy ? { ...identity, presentationId: `lab-idle.${job.requestId}` } : null });
  }
  const bridge = bridgeFactory({ ...binding,
    onStatus(entry) {
      if (entry.state === 'attached') { attached = true; if (retry !== null) clear(retry); retry = null; status('attached'); }
      else if (['failed', 'cancelled', 'timeout', 'closed'].includes(entry.state)) {
        if (entry.state === 'closed') attached = false;
        if (current && (!entry.requestId || entry.requestId === current.requestId)) settle(current, entry.state, 'Anropet avbröts utan automatisk omkörning.');
        else if (!current && entry.state === 'closed') status('closed');
      }
    },
    onReady({ decision, media, signal }) {
      const job = current;
      if (!job || job.phase !== 'request' || decision.requestId !== job.requestId) return;
      if (!usable() || !unchanged(job) || signal.aborted || decision.dealerId !== job.dealerId || decision.roundRevision !== String(job.roundVersion)) {
        settle(job, 'cancelled', 'Bordet ändrades innan svaret blev klart.'); return;
      }
      // Silence has no visible/audible delivery to gate. Release the bridge slot
      // without claiming the scene, invalidating idle proof or replacing a clip.
      if (decision.kind === 'silence') {
        settle(job, 'completed', 'OpenClaw valde att inte svara. Pågående idleuppspelning fortsätter.'); return;
      }
      job.decision = decision; job.media = media; job.signal = signal; job.phase = 'held';
      job.abort = () => settle(job, 'cancelled', 'Originalfliken avbröt svaret.');
      signal.addEventListener('abort', job.abort, { once: true });
      job.gate = createSpeechPoseGate({
        initialState: { dealerId: decision.dealerId, sessionRevision: decision.sessionRevision, roundRevision: decision.roundRevision,
          dealerPose: 'unknown', actionOwner: 'none', speechOwner: 'none', visible: true, muted: false, idlePresented: null },
        // There can be only one bridge job. This slot never blocks the game's
        // action queue; losing pose cancels it instead of waiting inside it.
        enqueue: task => Promise.resolve().then(() => task(signal)),
        onDisplay() {
          if (current !== job || signal.aborted) throw Error('Stale linked reply');
          job.phase = 'presenting';
          if (decision.kind !== 'silence') onMessage({ role: 'assistant', text: decision.exactText, requestId: job.requestId });
        },
        async onSpeech(_response, { signal: playbackSignal }) {
          if (current !== job || signal.aborted || playbackSignal.aborted) throw Error('Stale linked reply');
          if (decision.kind === 'generatedText' && decision.speechPackage) {
            if (!media) throw Error('Talpaketets ljud och video saknas.');
            status('playing', 'Genererad läppsynk · labbprov · ej visuellt godkänt.');
            await playGenerated(decision, { media, signal: playbackSignal, onReceipt: receipt => onReceipt({ ...receipt, requestId: job.requestId }) });
          } else if (decision.kind === 'recordedLine') {
            // Native family IDs and lab folder IDs are different namespaces.
            // Without exact text + media evidence, never borrow a lookalike take.
            job.note = 'Exakt inspelad replik saknas i labbets verifierade talmaterial. Endast text visades.';
          } else if (decision.kind === 'generatedText') job.note = 'Svaret visades som text. Inget genererat talpaket följde med.';
          else job.note = 'OpenClaw valde att inte svara.';
        },
      });
      const pending = job.gate.receive({ jobId: job.requestId, dealerId: decision.dealerId,
        sessionRevision: decision.sessionRevision, roundRevision: decision.roundRevision });
      // Readiness before this reply arrived may belong to a weighted base or a
      // now-interrupted idle clip. The parent restores standard base; only its
      // new rendered frame may release this response.
      scene = { ...scene, idleReady: false };
      status('held', 'Svaret väntar på labbets renderade standardposition.');
      updateGate(job);
      job.gate.responseReady(job.requestId, { kind: decision.kind, requestId: decision.requestId });
      void pending.completion.then(result => {
        if (current !== job) return;
        settle(job, result.status === 'completed' ? 'completed' : result.status === 'failed' ? 'failed' : 'cancelled',
          result.status === 'failed' ? 'Taluppspelningen misslyckades. Inget ersättningsklipp spelades.' : job.note);
      });
    },
  });
  function attach() {
    if (closed || attached) return;
    if (++attempts > 20) { retry = null; status('unavailable', 'Spelflikens chattbrygga svarar inte. Kontrollera att båda sidor kör aktuell labbversion.'); return; }
    bridge.attach();
    if (!attached) retry = schedule(attach, 500);
  }
  attach();
  return Object.freeze({
    accept: event => bridge.accept(event),
    submit(text) {
      if (!usable() || current || typeof text !== 'string' || !text.trim() || text.trim().length > 500) return false;
      const job = { requestId: makeId(), dealerId: scene.dealerId, roundVersion: scene.roundVersion,
        boundary: scene.boundary, phase: 'request', gate: null };
      current = job;
      if (!bridge.submit({ requestId: job.requestId, text: text.trim() })) { current = null; status('failed', 'Chatten kunde inte ta emot anropet.'); return false; }
      onMessage({ role: 'user', text: text.trim(), requestId: job.requestId });
      status('preparing', 'OpenClaw förbereder svaret med originalspelets offentliga serverdata.'); return true;
    },
    updateScene(next) {
      scene = { ...scene, ...next };
      const job = current;
      if (!job) return;
      if (!usable() || !unchanged(job)) settle(job, 'cancelled', 'Svaret avbröts när bord, dealer, anslutning eller vy ändrades.');
      else if (job.phase === 'presenting' && scene.actionBusy) settle(job, 'cancelled', 'En spelhandling tog över scenen.');
      else updateGate(job);
    },
    cancel() { if (current) settle(current, 'cancelled', 'Du stoppade svaret.'); },
    close() { if (closed) return; if (current) settle(current, 'cancelled', 'Chattvyn stängdes.'); closed = true; if (retry !== null) clear(retry); retry = null; bridge.close(); },
  });
}
