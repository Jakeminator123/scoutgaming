import { createAstridCameraSession } from './astrid-camera-session.mjs';
import { createAstridAudioRecorder } from './astrid-camera-audio.mjs';
import { createAstridWakeWord } from './astrid-wake-word.mjs';
import { isDealerId } from '../../packages/presentation/contracts/dealer-identity.mjs';

const MAX_IMAGE_BYTES = 64 * 1024;
const sameIdentity = (a, b) => a?.playerId === b?.playerId && a?.dealerId === b?.dealerId
  && a?.sessionRevision === b?.sessionRevision && a?.roundRevision === b?.roundRevision;
function captureJpeg(video) {
  if (!video.videoWidth || !video.videoHeight) return null;
  const scale = Math.min(1, 384 / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale)); canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  canvas.getContext('2d', { alpha: false }).drawImage(video, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.72, 0.55, 0.4, 0.25]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.startsWith('data:image/jpeg;base64,') && Math.floor((url.length - 23) * 3 / 4) <= MAX_IMAGE_BYTES) return url;
  }
  throw new Error('image_too_large');
}

export function createAstridCameraControl({ container, identity, send, fetchImpl = fetch,
  mediaDevices = navigator.mediaDevices, AudioWorkletNodeClass = window.AudioWorkletNode,
  AudioContextClass = window.AudioContext || window.webkitAudioContext,
  RecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition,
  createRecorder = createAstridAudioRecorder, createWakeWord = createAstridWakeWord,
  canStart = () => true, onActivity = () => {}, onPlaybackToggle = () => {}, onPlaybackEnable = () => {}, getPlaybackEnabled = () => false,
  onLogToggle = () => {}, dealerName = 'Astrid', wakeNames = [dealerName], language = 'en-US', presentationContext = () => null } = {}) {
  const element = (tag, text, className) => {
    const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
  };
  const root = element('div', '', 'astrid-voice-controls'); root.id = 'astrid-camera';
  const stylesheet = element('link'); stylesheet.rel = 'stylesheet'; stylesheet.href = '/astrid-voice-control.css';
  const playback = element('button', '▶', 'astrid-voice-button'); playback.type = 'button';
  const record = element('button', '●', 'astrid-voice-button'); record.type = 'button';
  const camera = element('button', '▣', 'astrid-voice-button'); camera.type = 'button';
  let cameraOptIn = false;
  const status = element('span', '', 'astrid-voice-error'); status.setAttribute('role', 'status'); status.hidden = true;
  const video = element('video'); video.autoplay = true; video.muted = true; video.playsInline = true; video.hidden = true;
  const consent = element('dialog', '', 'astrid-voice-dialog'); consent.hidden = true; consent.setAttribute('aria-label', 'Enable voice and optional camera');
  const consentHeading = element('h2', 'Enable voice and optional camera?');
  const consentText = element('p', 'In wake-word mode, this browser listens locally for the selected dealer name and keeps a short audio buffer in memory. Nothing is uploaded before the wake word. After detection, that buffer, including the moments just before the word, and the following speech (up to 30 seconds total) are automatically sent to OpenAI for speech translation into English. The English text is automatically sent to OpenClaw and its model provider after you pause. Camera is off by default. Only when you switch the camera button on, up to two snapshots are included if the model supports images. There is no preview or Send step.');
  const consentPrivacy = element('p', 'Enabling voice also turns on dealer playback so you can hear her replies. Muting playback stops voice listening. Providers process the audio, text and images. Text and images may be retained in conversation history. Croupier does not save your raw microphone audio. Generated dealer replies may be stored in the private reply library. Press Record again to stop. Voice is always off when this page loads.');
  const manualText = element('p', 'Record one message starts the microphone immediately after your click, without a wake word. After you pause, up to 30 seconds of audio are sent to OpenAI for English translation; that text and up to two optional camera snapshots are sent to the selected dealer. Recording then switches off. Press Record again during capture to cancel without sending.');
  const accept = element('button', 'Enable voice'); accept.type = 'button';
  const manual = element('button', 'Record one message'); manual.type = 'button';
  const decline = element('button', 'Keep off'); decline.type = 'button';
  consent.append(consentHeading, consentText, consentPrivacy, manualText, accept, manual, decline);
  const debug = element('section', '', 'astrid-voice-debug'); debug.hidden = true; debug.setAttribute('aria-label', 'Voice log');
  const logHeading = element('h2', 'Voice log');
  const logNote = element('p', 'Temporary log for this page only. No images or raw audio are stored here.');
  const closeLog = element('button', 'Close log'); closeLog.type = 'button';
  const log = element('pre', '', 'astrid-voice-events');
  const debugContainer = element('div', '', 'astrid-voice-chat-debug');
  debug.append(logHeading, logNote, closeLog, log, debugContainer);
  root.append(stylesheet, playback, record, camera, status, video, consent, debug); container.append(root);

  let enabled = false, visionEnabled = false, profileRevision = null, blockedReason = '', visionReason = '';
  let consentGranted = false, recordingMode = 'wake', mode = false, modeStarting = false, modeOwner = null, wake = null;
  let epoch = 0, captureRevision = 0, configRevision = 0, pending = false, stream = null, recorder = null, session = null;
  let wakeStream = null, cameraStream = null, armedReady = false, turnConfig = null;
  let transcribing = false, sending = false, heardAudio = false, recordingAbort = null, transcriptionAbort = null;
  let captureTimeout = null, identityTimer = null, lastStatus = 'Voice off.', statusIsError = false;
  const entries = [], cancelPresses = [];
  const busy = () => Boolean(pending || stream || session || transcribing || sending);
  const current = token => token === epoch && mode && !document.hidden && sameIdentity(modeOwner, identity());
  function appendLog(message) {
    entries.push(String(message).slice(0, 1000)); if (entries.length > 40) entries.shift();
    if (!debug.hidden) log.textContent = entries.join('\n');
  }
  function render() {
    const playing = getPlaybackEnabled() === true;
    playback.textContent = playing ? '❚❚' : '▶';
    playback.setAttribute('aria-label', playing ? 'Mute ' + dealerName + ' playback' : 'Enable ' + dealerName + ' playback');
    playback.setAttribute('aria-pressed', String(playing)); playback.title = `${playing ? 'Mute' : 'Enable'} ${dealerName} playback. Hold 5 seconds for the log.`;
    record.textContent = mode || modeStarting || busy() ? '■' : '●';
    record.setAttribute('aria-label', mode || modeStarting || busy() ? 'Stop voice listening'
      : recordingMode === 'manual' ? 'Record one message' : 'Enable voice listening');
    record.setAttribute('aria-pressed', String(mode || modeStarting || busy()));
    record.title = `${blockedReason || lastStatus}${visionReason ? ` ${visionReason}` : ''} Hold 5 seconds for the log.`;
    record.setAttribute('data-error', String(Boolean(blockedReason || statusIsError)));
    camera.setAttribute('aria-label', cameraOptIn ? 'Turn camera off' : 'Include optional camera images');
    camera.setAttribute('aria-pressed', String(cameraOptIn));
    camera.title = cameraOptIn ? 'Camera images enabled for the next recording' : 'Camera off; click to include images';
    status.textContent = blockedReason || lastStatus; status.hidden = false;
    status.setAttribute('data-error', String(Boolean(blockedReason || statusIsError)));
    root.setAttribute('data-panel-open', String(!debug.hidden || !consent.hidden));
  }
  function report(message, error = false) { lastStatus = message; statusIsError = error; appendLog(message); render(); }
  function applyConfig(config) {
    const translationReady = config.transcription?.outputLanguage === 'en' && config.transcription?.acceptsAutoLanguage === true;
    enabled = config.enabled === true && config.transcription?.enabled === true && translationReady;
    visionEnabled = config.enabled === true && (config.vision === undefined ? true : config.vision?.enabled === true);
    profileRevision = config.profileRevision ?? null;
    const reasons = {
      feature_disabled: 'Voice and camera are disabled on this server.',
      transcription_unavailable: 'OpenAI speech translation is unavailable. Check the OpenAI configuration.',
      translation_unavailable: 'English speech translation is not configured on this server.',
      model_not_verified: 'Images are enabled only for GPT-5.6 Terra and GPT-6 Luna in this setup.',
    };
    blockedReason = enabled ? '' : (config.enabled && config.transcription?.enabled && !translationReady ? reasons.translation_unavailable : '')
      || (Object.hasOwn(reasons, config.reason) ? reasons[config.reason] : '')
      || (config.enabled ? reasons.transcription_unavailable : reasons.feature_disabled);
    visionReason = !visionEnabled && config.enabled ? 'Camera is off. Select GPT-5.6 Terra or GPT-6 Luna for images; voice can use the selected model.' : '';
    render();
  }
  async function readConfig(signal) {
    const fail = text => { throw Object.assign(new Error('configuration_failed'), { configurationReason: text }); };
    let response, config;
    try { response = await fetchImpl('/api/dealer/observation?' + new URLSearchParams({ dealer: identity()?.dealerId ?? '', ...(presentationContext() ? { presentationContext: JSON.stringify(presentationContext()) } : {}) }), { cache: 'no-store', ...(signal ? { signal } : {}) }); }
    catch { fail('Cannot reach the server. Check the connection and try Record again.'); }
    if (response.ok === false) fail(response.status === 401 ? 'Your session has expired. Sign in or select your profile again.'
      : `Cannot read server settings${Number.isInteger(response.status) ? ` (HTTP ${response.status})` : ''}. Try Record again.`);
    try { config = await response.json(); } catch { fail('The server returned invalid settings. Try Record again.'); }
    if (!config || typeof config.enabled !== 'boolean' || (config.enabled && !/^[a-f0-9]{64}$/.test(config.profileRevision))) fail('The server returned invalid settings. Try Record again.');
    return config;
  }
  async function refreshConfig() {
    if (busy() || mode || modeStarting) return;
    const revision = ++configRevision, token = epoch;
    try {
      const config = await readConfig();
      if (revision !== configRevision || token !== epoch || busy() || mode || modeStarting) return;
      applyConfig(config); report(blockedReason || `Voice off.${visionReason ? ` ${visionReason}` : ''}`, Boolean(blockedReason));
    } catch (error) {
      if (revision !== configRevision || token !== epoch || busy() || mode || modeStarting) return;
      enabled = false; blockedReason = error.configurationReason || 'Cannot read server settings.'; report(blockedReason, true);
    }
  }
  function closeConsent() { consent.close?.(); consent.open = false; consent.hidden = true; render(); }
  function showLog(open = debug.hidden) {
    debug.hidden = !open; if (open) { log.textContent = entries.join('\n'); void refreshConfig(); }
    onLogToggle(open); render();
  }
  function releaseCapture() {
    captureRevision++; pending = false; clearTimeout(captureTimeout); captureTimeout = null;
    turnConfig?.controller.abort(); turnConfig = null;
    recorder?.stop(true); recorder = null; recordingAbort?.abort(); recordingAbort = null;
    for (const track of stream?.getTracks() ?? []) track.stop(); stream = null;
    for (const track of wakeStream?.getTracks() ?? []) track.stop(); wakeStream = null;
    for (const track of cameraStream?.getTracks() ?? []) track.stop(); cameraStream = null; armedReady = false;
    video.pause(); video.srcObject = null; session = null;
  }
  function stop(reason = 'Voice off.', error = false) {
    const changedProfile = modeOwner && !sameIdentity(modeOwner, identity());
    epoch++; mode = false; modeStarting = false;
    const oldWake = wake; wake = null; oldWake?.stop();
    clearInterval(identityTimer); identityTimer = null;
    transcriptionAbort?.abort(); transcriptionAbort = null; transcribing = false; sending = false;
    releaseCapture(); heardAudio = false; modeOwner = null;
    cancelPresses.forEach(cancel => cancel()); closeConsent();
    if (changedProfile) { entries.length = 0; log.textContent = ''; showLog(false); }
    // Host callers may use internal/non-English reasons; keep the user log English.
    const message = typeof reason === 'string' && /^[A-Z][\x20-\x7e]*$/.test(reason) ? reason : 'Voice off.';
    report(blockedReason || message, Boolean(blockedReason) || error);
  }
  function wakeFailure(error) {
    const code = String(error?.code || '');
    return /network/i.test(code) ? 'Local wake-word recognition failed. Voice is off; try Record again.'
      : /permission|not.allowed/i.test(code) ? 'Microphone permission was denied. Voice is off.'
        : 'Local wake-word recognition is unavailable. Voice is off; no cloud fallback is used.';
  }
  function offerManualRecording(error) {
    stop(wakeFailure(error), true);
    consentGranted = false;
    // A wake failure never starts an upload or a different listening service.
    // The user must explicitly choose and consent to one manual recording.
    consent.hidden = false; consent.showModal?.(); consent.open = true; render();
  }
  async function startWake(token) {
    if (!current(token) || busy()) return;
    const oldWake = wake; wake = null; oldWake?.stop();
    let instance;
    try {
      instance = createWakeWord({ RecognitionClass, language, wakeNames,
        canWake: () => current(token) && armedReady && !busy() && canStart(),
        onWake: () => {
          if (wake !== instance || !current(token) || !armedReady || busy()) return;
          wake = null; instance.stop(); void beginCapture(token);
        },
        onStatus: event => {
          if (wake !== instance || !current(token)) return;
          const messages = { checking: 'Checking local wake-word support.', installing: 'Installing local speech support.',
            starting: 'Starting local listening.', listening: `Listening locally for ${dealerName}.`, rearming: 'Resuming local listening.' };
          if (Object.hasOwn(messages, event?.state) && (event.state !== 'listening' || armedReady)) report(messages[event.state]);
        },
        onError: error => { if (wake === instance && current(token)) offerManualRecording(error); },
      });
      wake = instance;
      const started = await instance.start();
      if (wake !== instance || !current(token)) { instance.stop(); return; }
      if (started !== true) { offerManualRecording(); return; }
      await prepareAudio(token, instance);
    } catch (error) { if (current(token)) offerManualRecording(error); }
  }
  async function prepareAudio(token, expectedWake = null) {
    try {
      if (!mediaDevices?.getUserMedia || !AudioContextClass) { stop('Microphone recording is unavailable on this device.', true); return; }
      if (recordingMode === 'manual') pending = true;
      report('Preparing the local audio buffer.');
      captureTimeout = setTimeout(() => { if (current(token)) stop('Microphone permission timed out. Voice off.', true); }, 30000);
      const acquired = await mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (!current(token) || wake !== expectedWake) { acquired.getTracks().forEach(track => track.stop()); return; }
      wakeStream = acquired;
      const turn = ++captureRevision, captureCurrent = () => current(token) && turn === captureRevision;
      for (const track of wakeStream.getTracks()) track.addEventListener('ended', () => { if (captureCurrent()) stop('A microphone disconnected. Voice off.', true); }, { once: true });
      recordingAbort = new AbortController();
      const acquiredRecorder = await createRecorder({ stream: wakeStream, AudioContextClass, AudioWorkletNodeClass,
        signal: recordingAbort.signal, armed: true, preRollMs: recordingMode === 'manual' ? 0 : 3000,
        onSample: ({ speaking, at, preRollSpeech }) => {
          if (!captureCurrent() || !session) return;
          if (speaking || preRollSpeech === true) heardAudio = true;
          try {
            // One buffered-speech marker anchors a short utterance at wake.
            // Historical pauses are never replayed into the current turn.
            if (preRollSpeech === true) session.sample(true, 0);
            else if (preRollSpeech !== false) session.sample(speaking, at);
          } catch { stop('A camera image could not be captured. Voice off.', true); }
        },
        onLimit: () => { if (captureCurrent() && session) void finishCapture(token); },
        onError: () => { if (captureCurrent()) stop('Audio recording failed. Voice off.', true); },
      });
      if (!captureCurrent() || wake !== expectedWake) { acquiredRecorder.stop(true); return; }
      recorder = acquiredRecorder; armedReady = true; clearTimeout(captureTimeout); captureTimeout = null;
      if (recordingMode === 'manual') { pending = false; await beginCapture(token); }
      else report(`Listening locally for ${dealerName}.`);
    } catch (error) { if (current(token)) stop(error?.name === 'NotAllowedError' ? 'Microphone permission was denied. Voice off.' : 'Microphone recording could not start. Voice off.', true); }
  }
  async function enableVoice() {
    if (!consentGranted || mode || modeStarting || busy() || document.hidden) return;
    const token = ++epoch, requestedOwner = identity(); modeStarting = true; render();
    try {
      if (!enabled) {
        const config = await readConfig();
        if (token !== epoch) return;
        applyConfig(config);
        // Wake recognition needs a fresh browser gesture after an async wait.
        // The explicitly consented manual turn can continue through the same
        // current-context checks below once the server configuration is ready.
        if (!enabled || recordingMode !== 'manual') {
          modeStarting = false;
          report(blockedReason || 'Voice is ready. Press Record again to enable local listening.', Boolean(blockedReason));
          return;
        }
      }
      if (document.hidden || !sameIdentity(requestedOwner, identity())) { stop('Context changed. Voice off.'); return; }
      if (!isDealerId(requestedOwner?.dealerId)) { stop('Select a dealer before recording.', true); return; }
      if (recordingMode === 'manual' && !canStart()) { stop('Wait until the dealer has finished speaking, then press Record again.'); return; }
      // Only an explicit Record/Enable voice action opts into audible replies.
      // Automatic wake rearming and autosend must never undo a later mute.
      if (!getPlaybackEnabled()) {
        // Keep this synchronous so local wake recognition retains the click's
        // browser gesture; the host sets its mute state synchronously.
        try { onPlaybackEnable(); }
        catch { if (token === epoch) stop('Dealer playback could not be enabled. Voice off.', true); return; }
        if (token !== epoch) return;
        if (document.hidden || !sameIdentity(requestedOwner, identity())) { stop('Context changed. Voice off.'); return; }
        if (!getPlaybackEnabled()) { stop('Enable dealer playback before recording. Voice off.', true); return; }
        report('Dealer playback enabled for voice replies.');
      }
      mode = true; modeStarting = false; modeOwner = requestedOwner;
      let paused = false;
      identityTimer = setInterval(() => {
        if (mode && !current(token)) { stop('Context changed. Voice off.'); return; }
        if (!mode || busy() || !armedReady) return;
        const waiting = !canStart();
        if (waiting !== paused) { paused = waiting; report(waiting ? 'Listening paused while the dealer replies.' : 'Listening locally for ' + dealerName + '.'); }
      }, 250);
      if (recordingMode === 'manual') await prepareAudio(token);
      else await startWake(token);
    } catch (error) {
      if (token !== epoch) return;
      enabled = false; blockedReason = error.configurationReason || 'Cannot read server settings.'; stop(blockedReason, true);
    }
  }
  async function beginCapture(token) {
    if (!current(token) || busy() || !armedReady || !recorder || !wakeStream) return;
    if (!canStart()) { stop('Wait until the dealer has finished speaking, then enable Record again.'); return; }
    const turn = captureRevision, captureCurrent = () => current(token) && turn === captureRevision;
    stream = wakeStream; wakeStream = null; armedReady = false;
    pending = true; heardAudio = false; onActivity(); report(recordingMode === 'manual' ? 'Recording one message.' : `${dealerName} heard. Starting the microphone.`);
    session = createAstridCameraSession({ endSilenceMs: 1150, capture: () => cameraStream ? captureJpeg(video) : null,
      onEnd: result => { if (result.reason === 'speech_end') void finishCapture(token); } });
    const configCheck = { controller: new AbortController() };
    // Keep a settled promise so cancellation before the response cannot leak an
    // unhandled rejection. A short buffered turn may finish before this GET.
    configCheck.ready = readConfig(configCheck.controller.signal).then(config => ({ config }), error => ({ error }));
    turnConfig = configCheck;
    try {
      if (recorder.activate() !== true) throw new Error('audio_activation_failed');
    } catch { stop('The local audio buffer could not start. Voice off.', true); return; }
    captureTimeout = setTimeout(() => { if (captureCurrent()) { if (session) void finishCapture(token); else stop('Device permission timed out. Voice off.', true); } }, 30000);
    try {
      const checked = await configCheck.ready;
      if (!captureCurrent()) return;
      if (checked.error) throw checked.error;
      applyConfig(checked.config); if (!enabled) { stop(); return; }
      // Use the current saved model, including a Terra/Luna selection made
      // after this tab opened. Consent already covers optional camera images.
      const withVideo = visionEnabled && cameraOptIn;
      if (withVideo) {
        try {
          const acquired = await mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 640 }, height: { ideal: 480 } } });
          if (!captureCurrent()) { acquired.getTracks().forEach(track => track.stop()); return; }
          cameraStream = acquired; video.srcObject = cameraStream; await video.play();
        } catch {
          if (!captureCurrent()) return;
          for (const track of cameraStream?.getTracks() ?? []) track.stop(); cameraStream = null; video.srcObject = null;
          report('Camera unavailable. Continuing with voice only.');
        }
      }
      if (!captureCurrent()) return;
      for (const track of cameraStream?.getTracks() ?? []) track.addEventListener('ended', () => { if (captureCurrent()) stop('A camera disconnected. Voice off.', true); }, { once: true });
      pending = false;
      clearTimeout(captureTimeout); captureTimeout = setTimeout(() => { if (captureCurrent()) void finishCapture(token); }, 30000);
      report(cameraStream ? 'Recording audio and up to two camera images.' : 'Recording audio. Camera off.');
    } catch (error) {
      if (!captureCurrent()) return;
      if (error.configurationReason) { enabled = false; blockedReason = error.configurationReason; }
      stop(error?.name === 'NotAllowedError' ? 'Device permission was denied. Voice off.' : 'Devices or recording could not start. Voice off.', true);
    }
  }
  async function finishCapture(token) {
    if (!current(token) || !session) return;
    let images, bytes;
    try { images = session.stop('pause').images; bytes = recorder?.stop(); recorder = null; }
    catch { stop('Recording could not be completed. Voice off.', true); return; }
    const configCheck = turnConfig; turnConfig = null;
    releaseCapture();
    if (!current(token)) { configCheck?.controller.abort(); bytes?.fill(0); images.length = 0; stop('Context changed. Recording discarded.'); return; }
    if (!bytes || !heardAudio) {
      configCheck?.controller.abort(); bytes?.fill(0); images.length = 0;
      if (recordingMode === 'manual') stop('No speech detected. Press Record to try again.');
      else { report('No speech detected.'); void startWake(token); }
      return;
    }
    const controller = configCheck?.controller ?? new AbortController(); transcriptionAbort = controller; transcribing = true;
    const deadline = setTimeout(() => controller.abort(), 35000);
    let resume = false;
    report('Microphone off. Checking the voice turn settings.');
    try {
      const checked = await configCheck?.ready;
      if (!current(token)) return;
      if (!checked || checked.error) throw checked?.error || new Error('configuration_failed');
      applyConfig(checked.config);
      if (!enabled) { stop(); return; }
      report('Translating speech into English.');
      const response = await fetchImpl('/api/dealer/transcription', { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'audio/wav', 'X-Astrid-Dealer': modeOwner.dealerId, 'X-Astrid-Language': 'auto',
          'X-Astrid-Request-Id': crypto.randomUUID(),
          ...(presentationContext() ? { 'X-Dealer-Presentation-Context': JSON.stringify(presentationContext()) } : {}), 'X-Astrid-Profile-Revision': profileRevision,
          'X-Astrid-Session-Revision': modeOwner.sessionRevision, 'X-Astrid-Round-Revision': modeOwner.roundRevision }, body: bytes });
      if (!current(token)) return;
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        throw new Error(failure?.error === 'transcription_authentication_failed'
          ? 'transcription_authentication_failed' : 'transcription_failed');
      }
      const data = await response.json(); if (!current(token)) return;
      if (typeof data.text !== 'string' || data.text.length > 1000 || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(data.text)) throw new Error('transcription_failed');
      const message = data.text.trim();
      if (!message) { report('No words recognized. Nothing sent.'); resume = true; return; }
      appendLog(`You: ${message}`); transcribing = false; sending = true; onActivity(); report(`Sending the voice turn to ${dealerName} automatically.`);
      if (await send({ message, images: [...images], profileRevision, voice: true }) !== true) throw new Error('voice_send_failed');
      if (!current(token)) return;
      report('Voice turn completed.'); resume = true;
    } catch (error) {
      if (token === epoch) {
        if (error.configurationReason) { enabled = false; blockedReason = error.configurationReason; }
        stop(error?.message === 'voice_send_failed'
          ? 'The voice turn could not be completed. Voice off; no automatic retry.'
          : error?.message === 'transcription_authentication_failed'
            ? 'OpenAI authentication failed. Check the server translation key. Voice off; no automatic retry.'
            : 'Speech translation failed. Nothing sent. Voice off; no automatic retry.', true);
      }
    } finally {
      clearTimeout(deadline); bytes.fill(0); images.length = 0;
      if (token === epoch) {
        transcriptionAbort = null; transcribing = false; sending = false; render();
        if (resume && current(token)) {
          if (recordingMode === 'manual') stop('Recording complete. Press Record for another message.');
          else void startWake(token);
        }
        else if (mode && !current(token)) stop('Context changed. Voice off.');
      }
    }
  }
  function recordClick() {
    if (mode || modeStarting || busy()) { stop(); return; }
    if (!consentGranted) {
      consent.hidden = false; consent.showModal?.(); consent.open = true; render(); void refreshConfig(); return;
    }
    void enableVoice();
  }
  accept.onclick = () => { if (consent.hidden) return; recordingMode = 'wake'; consentGranted = true; closeConsent(); void enableVoice(); };
  manual.onclick = () => { if (consent.hidden) return; recordingMode = 'manual'; consentGranted = true; closeConsent(); void enableVoice(); };
  decline.onclick = () => { closeConsent(); report('Voice stays off.'); };
  consent.addEventListener('cancel', event => { event.preventDefault(); closeConsent(); report('Voice stays off.'); });
  closeLog.onclick = () => showLog(false);
  function longPress(button, action) {
    let timer = null, held = false, source = null, suppressClick = false;
    const cancel = () => { clearTimeout(timer); timer = null; source = null; };
    const begin = kind => {
      cancel(); held = false; suppressClick = false; source = kind;
      timer = setTimeout(() => { timer = null; held = true; suppressClick = true; showLog(); }, 5000);
    };
    cancelPresses.push(cancel);
    button.addEventListener('pointerdown', event => { if (event.button === undefined || event.button === 0) begin('pointer'); });
    button.addEventListener('pointerup', () => { if (source === 'pointer') cancel(); });
    button.addEventListener('pointercancel', cancel); button.addEventListener('pointerleave', cancel);
    button.addEventListener('keydown', event => {
      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault(); if (!event.repeat) begin('keyboard');
    });
    button.addEventListener('keyup', event => {
      if (!['Enter', ' '].includes(event.key) || source !== 'keyboard') return;
      event.preventDefault(); const short = !held; cancel(); suppressClick = true;
      if (short) action();
    });
    button.addEventListener('blur', cancel);
    button.onclick = event => {
      event?.preventDefault?.();
      if (suppressClick) { suppressClick = false; return; }
      cancel(); action();
    };
  }
  camera.onclick = () => { cameraOptIn = !cameraOptIn; if (!cameraOptIn) { for (const track of cameraStream?.getTracks() ?? []) track.stop(); cameraStream = null; video.srcObject = null; } render(); };
  longPress(record, recordClick);
  longPress(playback, () => { Promise.resolve().then(() => onPlaybackToggle()).then(render).catch(() => report('Playback audio could not be changed.', true)); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', () => stop());
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !debug.hidden) { event.preventDefault(); showLog(false); } });
  report('Voice off.'); void refreshConfig();
  return { stop, debugContainer, refreshPlayback() {
    if ((mode || modeStarting || busy()) && !getPlaybackEnabled()) stop('Dealer playback muted. Voice off.');
    else render();
  },
    get active() { return Boolean(mode || modeStarting || busy()); }, get busy() { return busy(); } };
}
