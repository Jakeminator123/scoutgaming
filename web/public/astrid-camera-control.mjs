import { createAstridCameraSession } from './astrid-camera-session.mjs';
import { createAstridAudioRecorder } from './astrid-camera-audio.mjs';

const MAX_IMAGE_BYTES = 64 * 1024;

function sameIdentity(left, right) {
  return left?.playerId === right?.playerId && left?.dealerId === right?.dealerId
    && left?.sessionRevision === right?.sessionRevision && left?.roundRevision === right?.roundRevision;
}

function captureJpeg(video) {
  if (!video.videoWidth || !video.videoHeight) return null;
  const scale = Math.min(1, 384 / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  canvas.getContext('2d', { alpha: false }).drawImage(video, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.72, 0.55, 0.4, 0.25]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.startsWith('data:image/jpeg;base64,') && Math.floor((url.length - 23) * 3 / 4) <= MAX_IMAGE_BYTES) return url;
  }
  throw new Error('Bilden är för stor. Prova bättre ljus eller en annan kamera.');
}

export function createAstridCameraControl({ container, identity, send, fetchImpl = fetch,
  mediaDevices = navigator.mediaDevices, AudioWorkletNodeClass = window.AudioWorkletNode,
  AudioContextClass = window.AudioContext || window.webkitAudioContext,
  createRecorder = createAstridAudioRecorder,
  canStart = () => true, onActivity = () => {} } = {}) {
  const root = document.createElement('details'); root.id = 'astrid-camera';
  const title = document.createElement('summary'); title.textContent = 'Bild och ljud · Av';
  title.setAttribute('aria-label', 'Kamera och mikrofon · Av');
  const panel = document.createElement('div'); panel.className = 'astrid-camera-panel';
  const note = document.createElement('p'); note.textContent = 'Starta spelar in högst 30 sekunder. Vid tystnad eller Stoppa skickas ljudet till Cartesia för transkription. Appen sparar inte råljudet. Granska sedan text och bilder innan Skicka till Astrid.';
  const privacy = document.createElement('p'); privacy.textContent = 'När du skickar behandlas bilder och text av OpenClaw och modellleverantören. De kan sparas i OpenClaws samtalshistorik. Kassera tar bort oskickat material från den här fliken.';
  const start = document.createElement('button'); start.type = 'button'; start.textContent = 'Starta kamera och mikrofon';
  const languageLabel = document.createElement('label'); languageLabel.textContent = 'Talets språk ';
  const language = document.createElement('select'); language.setAttribute('aria-label', 'Talets språk');
  for (const [code, name] of [['sv-SE', 'Svenska'], ['en-US', 'English']]) {
    const option = document.createElement('option'); option.value = code; option.textContent = name; language.append(option);
  }
  language.value = 'sv-SE'; languageLabel.append(language);
  const stop = document.createElement('button'); stop.type = 'button'; stop.textContent = 'Stoppa'; stop.hidden = true;
  const video = document.createElement('video'); video.autoplay = true; video.muted = true; video.playsInline = true; video.hidden = true;
  const meter = document.createElement('meter'); meter.min = 0; meter.max = 1; meter.value = 0; meter.hidden = true; meter.setAttribute('aria-label', 'Mikrofonnivå');
  const status = document.createElement('p'); status.setAttribute('role', 'status'); status.textContent = 'Av';
  const review = document.createElement('div'); review.hidden = true; review.className = 'astrid-camera-review';
  const transcript = document.createElement('textarea'); transcript.maxLength = 1000; transcript.rows = 3; transcript.setAttribute('aria-label', 'Granska transkription');
  const pictures = document.createElement('div'); pictures.className = 'astrid-camera-pictures';
  const submit = document.createElement('button'); submit.type = 'button'; submit.textContent = 'Skicka till Astrid';
  const discard = document.createElement('button'); discard.type = 'button'; discard.textContent = 'Kassera';
  review.append(transcript, pictures, submit, discard); panel.append(note, privacy, languageLabel, start, stop, video, meter, status, review); root.append(title, panel); container.append(root);

  let enabled = false, pending = false, sending = false, transcribing = false, profileRevision = null, epoch = 0, stream = null, recorder = null;
  let timeout = null, session = null, owner = null, images = [], heardAudio = false, recordingAbort = null, transcriptionAbort = null;
  function release() {
    pending = false;
    clearTimeout(timeout); timeout = null;
    recorder?.stop(true); recorder = null; recordingAbort?.abort(); recordingAbort = null;
    for (const track of stream?.getTracks() ?? []) track.stop(); stream = null;
    video.pause(); video.srcObject = null; video.hidden = true; meter.hidden = true; meter.value = 0;
    stop.hidden = true; start.hidden = false; title.textContent = 'Bild och ljud · Av';
    title.setAttribute('aria-label', 'Kamera och mikrofon · Av');
    language.disabled = false;
  }
  function reset(reason = 'Av') {
    epoch++; session = null; owner = null; images = []; heardAudio = false;
    transcriptionAbort?.abort(); transcriptionAbort = null; transcribing = false;
    review.hidden = true; pictures.replaceChildren(); transcript.value = ''; release(); status.textContent = reason;
    submit.disabled = false; start.disabled = !enabled || sending;
  }
  async function finish(reason) {
    if (!session) { reset(reason); return; }
    let result;
    try { result = session.stop(reason); }
    catch { reset('Bilden kunde inte tas. Materialet kasserades.'); return; }
    session = null; const token = ++epoch;
    const bytes = recorder?.stop(); recorder = null;
    images = result.images;
    release();
    if (!sameIdentity(owner, identity())) { reset('Profilen eller bordet ändrades. Inspelningen kasserades.'); return; }
    transcript.value = '';
    pictures.replaceChildren(...images.map((url, index) => {
      const img = document.createElement('img'); img.src = url; img.alt = `Granskningsbild ${index + 1}`; return img;
    }));
    review.hidden = false;
    if (!bytes || !heardAudio) {
      bytes?.fill(0); status.textContent = `${reason} · inget tal upptäcktes. Skriv text eller prova igen.`; return;
    }
    transcribing = true; submit.disabled = true; start.disabled = true;
    title.textContent = 'Bild och ljud · Bearbetar';
    status.textContent = 'Mikrofonen är av · transkriberar ljudet…';
    const controller = new AbortController(); transcriptionAbort = controller;
    const deadline = setTimeout(() => controller.abort(), 35000);
    try {
      const response = await fetchImpl('/api/astrid/transcription', { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'audio/wav', 'X-Astrid-Dealer': 'astrid', 'X-Astrid-Language': language.value === 'sv-SE' ? 'sv' : 'en',
          'X-Astrid-Request-Id': crypto.randomUUID(), 'X-Astrid-Profile-Revision': profileRevision,
          'X-Astrid-Session-Revision': owner.sessionRevision, 'X-Astrid-Round-Revision': owner.roundRevision }, body: bytes });
      if (token !== epoch) return;
      if (document.hidden || !sameIdentity(owner, identity())) { reset('Profilen eller bordet ändrades. Materialet kasserades.'); return; }
      if (!response.ok) {
        if (response.status === 401 || response.status === 409) { reset('Profilen eller bordet ändrades. Spela in igen.'); return; }
        throw new Error('transcription_failed');
      }
      const data = await response.json();
      if (token !== epoch) return;
      if (document.hidden || !sameIdentity(owner, identity())) { reset('Profilen eller bordet ändrades. Materialet kasserades.'); return; }
      if (typeof data.text !== 'string' || data.text.length > 1000) throw new Error('transcription_failed');
      transcript.value = data.text.trim();
      if (!transcript.value) { images = []; pictures.replaceChildren(); }
      status.textContent = transcript.value ? `${images.length} bild${images.length === 1 ? '' : 'er'} · granska text och bilder och välj Skicka till Astrid`
        : 'Inga ord kunde urskiljas. Skriv text eller prova igen.';
    } catch {
      if (token === epoch) status.textContent = 'Ljudet kunde inte transkriberas. Skriv text till bilderna eller kassera och spela in igen.';
    } finally {
      clearTimeout(deadline); bytes.fill(0);
      if (token === epoch) {
        transcribing = false; transcriptionAbort = null; submit.disabled = false; start.disabled = !enabled;
        title.textContent = 'Bild och ljud · Granska';
      }
    }
  }
  async function begin() {
    if (!enabled || pending || sending || transcribing || stream || session) return;
    if (!canStart()) { status.textContent = 'Vänta tills Astrid talat klart och bordet är lugnt.'; return; }
    if (!mediaDevices?.getUserMedia || !AudioContextClass) { status.textContent = 'Kamera eller mikrofon saknas i denna enhet.'; return; }
    reset('Kontrollerar aktuell profil…'); const token = ++epoch; owner = identity();
    pending = true; start.hidden = true; stop.hidden = false;
    language.disabled = true; onActivity();
    timeout = setTimeout(() => finish('Tidsgräns 30 sekunder'), 30000);
    try {
      const config = await readConfig();
      if (token !== epoch) return;
      if (document.hidden || !sameIdentity(owner, identity())) { reset('Fliken eller profilen ändrades.'); return; }
      if (!config.enabled || !config.transcription?.enabled) { enabled = false; start.disabled = true; reset('Av · serverns transkription är inte tillgänglig'); return; }
      if (owner?.dealerId !== 'astrid') { reset('Bild och ljud är endast tillgängligt för Astrid.'); return; }
      profileRevision = config.profileRevision;
      status.textContent = 'Begär tillstånd…';
      const acquired = await mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: { echoCancellation: true, noiseSuppression: true } });
      if (token !== epoch || document.hidden || !sameIdentity(owner, identity())) {
        acquired.getTracks().forEach(track => track.stop());
        if (token === epoch) reset('Fliken eller profilen ändrades.');
        return;
      }
      stream = acquired; video.srcObject = stream; video.hidden = false; await video.play();
      if (token !== epoch) return;
      if (document.hidden || !sameIdentity(owner, identity())) { reset('Fliken eller profilen ändrades.'); return; }
      for (const track of stream.getTracks()) track.addEventListener('ended', () => { if (token === epoch) reset('Enheten kopplades bort · Av'); }, { once: true });
      session = createAstridCameraSession({ capture: () => captureJpeg(video), onEnd: result => { if (result.reason === 'speech_end') void finish('Talet avslutades'); } });
      recordingAbort = new AbortController();
      const acquiredRecorder = await createRecorder({ stream, AudioContextClass, AudioWorkletNodeClass, signal: recordingAbort.signal,
        onSample: ({ rms, speaking, at }) => {
          if (token !== epoch) return;
          if (document.hidden || !sameIdentity(owner, identity())) { reset('Fliken eller profilen ändrades.'); return; }
          meter.value = Math.min(1, rms * 8);
          if (speaking) heardAudio = true;
          try { session?.sample(speaking, at); }
          catch { reset('Bilden kunde inte tas. Materialet kasserades.'); }
        },
        onLimit: () => { if (token === epoch) void finish('Tidsgräns 30 sekunder'); },
        onError: () => { if (token === epoch) reset('Ljudinspelningen avbröts. Prova igen.'); } });
      if (token !== epoch) { acquiredRecorder.stop(true); return; }
      recorder = acquiredRecorder;
      clearTimeout(timeout); timeout = setTimeout(() => finish('Tidsgräns 30 sekunder'), 30000);
      pending = false;
      start.hidden = true; stop.hidden = false; meter.hidden = false;
      title.textContent = 'Bild och ljud · På'; title.setAttribute('aria-label', 'Kamera och mikrofon · På');
      status.textContent = 'På · lyssnar efter tal'; review.hidden = true;
    } catch (error) {
      if (token !== epoch) return;
      reset(error?.name === 'NotAllowedError' ? 'Tillstånd nekades. Vanlig textchatt fungerar.' : 'Kamera, mikrofon eller transkription kunde inte startas.');
    }
  }
  start.onclick = () => void begin(); stop.onclick = () => finish('Stoppad');
  discard.onclick = () => reset('Kasserat · Av');
  submit.onclick = async () => {
    if (sending || transcribing) return;
    if (!sameIdentity(owner, identity())) { reset('Profilen eller bordet ändrades. Materialet kasserades.'); return; }
    const message = transcript.value.trim();
    if (!message) { status.textContent = 'Transkription saknas. Skriv text eller kassera.'; return; }
    sending = true; submit.disabled = true; start.disabled = true;
    const token = epoch;
    try {
      if (await send({ message, images: [...images], profileRevision }) !== true) throw new Error('chat_failed');
      if (token === epoch) reset('Skickat · Av');
    }
    catch { if (token === epoch) status.textContent = 'Kunde inte skicka. Granska och försök igen.'; }
    finally { sending = false; submit.disabled = false; start.disabled = !enabled; }
  };
  root.addEventListener('toggle', () => { if (!root.open) reset('Panelen stängd · Av'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset('Fliken dold · Av'); });
  window.addEventListener('pagehide', () => reset('Sidan stängd · Av'));
  async function readConfig() {
    const response = await fetchImpl('/api/astrid/observation', { cache: 'no-store' });
    if (response.ok === false) throw new Error('camera_unavailable');
    const config = await response.json();
    if (config.enabled && !/^[a-f0-9]{64}$/.test(config.profileRevision)) throw new Error('camera_unavailable');
    return config;
  }
  start.disabled = true;
  void readConfig().then(config => {
    enabled = config.enabled === true && config.transcription?.enabled === true;
    profileRevision = config.profileRevision ?? null;
    start.disabled = !enabled;
    status.textContent = enabled ? 'Av · inget tillstånd begärt' : 'Av · bild och ljud väntar på serverns transkription och bildstöd';
  }).catch(() => { start.disabled = true; status.textContent = 'Av · bildfunktionen är inte tillgänglig'; });
  return { stop: reset, get active() { return Boolean(pending || stream || session); },
    get busy() { return Boolean(pending || stream || session || transcribing || sending || !review.hidden); } };
}
