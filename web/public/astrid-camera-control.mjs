import { createAstridCameraSession } from './astrid-camera-session.mjs';

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
  mediaDevices = navigator.mediaDevices, Recognition = window.SpeechRecognition || window.webkitSpeechRecognition,
  AudioContextClass = window.AudioContext || window.webkitAudioContext,
  canStart = () => true, onActivity = () => {} } = {}) {
  const root = document.createElement('details'); root.id = 'astrid-camera';
  const title = document.createElement('summary'); title.textContent = 'Kamera · Av';
  title.setAttribute('aria-label', 'Kamera och mikrofon · Av');
  const panel = document.createElement('div'); panel.className = 'astrid-camera-panel';
  const note = document.createElement('p'); note.textContent = 'Valfritt. Webbläsarens taligenkänning kan behandla ljud hos dess leverantör. Bilder och text skickas till Astrid först när du granskat och valt Skicka.';
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

  let enabled = false, pending = false, sending = false, profileRevision = null, epoch = 0, stream = null, audio = null, recognition = null;
  let frameTimer = null, timeout = null, session = null, owner = null, images = [], finalText = '', interimText = '';
  function release() {
    pending = false;
    clearInterval(frameTimer); clearTimeout(timeout); frameTimer = null; timeout = null;
    if (recognition) { recognition.onresult = recognition.onerror = recognition.onend = recognition.onspeechstart = recognition.onspeechend = null; try { recognition.abort(); } catch {} recognition = null; }
    for (const track of stream?.getTracks() ?? []) track.stop(); stream = null;
    void audio?.close().catch(() => {}); audio = null;
    video.pause(); video.srcObject = null; video.hidden = true; meter.hidden = true; meter.value = 0;
    stop.hidden = true; start.hidden = false; title.textContent = 'Kamera · Av';
    title.setAttribute('aria-label', 'Kamera och mikrofon · Av');
    language.disabled = false;
  }
  function reset(reason = 'Av') {
    epoch++; session = null; owner = null; images = []; finalText = ''; interimText = '';
    review.hidden = true; pictures.replaceChildren(); transcript.value = ''; release(); status.textContent = reason;
  }
  function finish(reason) {
    if (!session) { reset(reason); return; }
    let result;
    try { result = session.stop(reason); }
    catch { reset('Bilden kunde inte tas. Materialet kasserades.'); return; }
    session = null; epoch++;
    images = result.images;
    release();
    if (!sameIdentity(owner, identity())) { reset('Profilen eller bordet ändrades. Inspelningen kasserades.'); return; }
    transcript.value = (finalText + interimText).trim();
    pictures.replaceChildren(...images.map((url, index) => {
      const img = document.createElement('img'); img.src = url; img.alt = `Granskningsbild ${index + 1}`; return img;
    }));
    review.hidden = false;
    status.textContent = images.length ? `${reason} · ${images.length} bild${images.length === 1 ? '' : 'er'} · granska text och bilder` : `${reason} · inget tal upptäcktes, inga bilder togs`;
  }
  async function begin() {
    if (!enabled || pending || sending || stream || session) return;
    if (!canStart()) { status.textContent = 'Vänta tills Astrid talat klart och bordet är lugnt.'; return; }
    if (!mediaDevices?.getUserMedia || !AudioContextClass) { status.textContent = 'Kamera eller mikrofon saknas i denna enhet.'; return; }
    if (!Recognition) { status.textContent = 'Transkription saknas i denna webbläsare. Använd vanlig textchatt.'; return; }
    reset('Kontrollerar aktuell profil…'); const token = ++epoch; owner = identity();
    pending = true; start.hidden = true; stop.hidden = false;
    language.disabled = true; onActivity();
    timeout = setTimeout(() => finish('Tidsgräns 30 sekunder'), 30000);
    try {
      const config = await readConfig();
      if (token !== epoch) return;
      if (document.hidden || !sameIdentity(owner, identity())) { reset('Fliken eller profilen ändrades.'); return; }
      if (!config.enabled) { enabled = false; start.disabled = true; reset('Av · bildfunktionen är inte tillgänglig'); return; }
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
      audio = new AudioContextClass();
      const analyser = audio.createAnalyser(); analyser.fftSize = 1024;
      audio.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      recognition = new Recognition(); recognition.lang = language.value; recognition.continuous = true; recognition.interimResults = true;
      let vadSpeaking = false;
      recognition.onspeechstart = () => { if (token === epoch) vadSpeaking = true; };
      recognition.onspeechend = () => { if (token === epoch) vadSpeaking = false; };
      recognition.onresult = event => {
        if (token !== epoch || !sameIdentity(owner, identity())) return;
        finalText = ''; interimText = '';
        for (const item of event.results) {
          if (item.isFinal) finalText += `${item[0].transcript} `;
          else interimText += `${item[0].transcript} `;
        }
        status.textContent = `Talaktivitet · ${Math.round(session?.speechMs ?? 0)} ms · ${finalText}${interimText}`;
      };
      recognition.onerror = event => { if (token === epoch) finish(event?.error === 'network'
        ? 'Taligenkänningens nätanslutning misslyckades' : 'Transkription misslyckades'); };
      recognition.onend = () => { if (token === epoch && session) finish('Transkription avslutades'); };
      recognition.start(stream.getAudioTracks()[0]);
      session = createAstridCameraSession({ capture: () => captureJpeg(video), onEnd: result => { if (result.reason === 'speech_end') finish('Talet avslutades'); } });
      frameTimer = setInterval(() => {
        if (token !== epoch) return;
        if (document.hidden || !sameIdentity(owner, identity())) { reset('Fliken eller profilen ändrades.'); return; }
        analyser.getFloatTimeDomainData(samples);
        let power = 0; for (const sample of samples) power += sample * sample;
        const rms = Math.sqrt(power / samples.length);
        meter.value = Math.min(1, rms * 8);
        try { session?.sample(vadSpeaking); }
        catch { reset('Bilden kunde inte tas. Materialet kasserades.'); }
      }, 100);
      clearTimeout(timeout); timeout = setTimeout(() => finish('Tidsgräns 30 sekunder'), 30000);
      pending = false;
      start.hidden = true; stop.hidden = false; meter.hidden = false;
      title.textContent = 'Kamera · På'; title.setAttribute('aria-label', 'Kamera och mikrofon · På');
      status.textContent = 'På · lyssnar efter tal'; review.hidden = true;
    } catch (error) {
      if (token !== epoch) return;
      reset(error?.name === 'NotAllowedError' ? 'Tillstånd nekades. Vanlig textchatt fungerar.' : 'Kamera, mikrofon eller transkription kunde inte startas.');
    }
  }
  start.onclick = () => void begin(); stop.onclick = () => finish('Stoppad');
  discard.onclick = () => reset('Kasserat · Av');
  submit.onclick = async () => {
    if (sending) return;
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
    enabled = config.enabled === true;
    profileRevision = config.profileRevision ?? null;
    start.disabled = !enabled;
    status.textContent = enabled ? 'Av · inget tillstånd begärt' : 'Av · bildfunktionen väntar på driftverifiering';
  }).catch(() => { start.disabled = true; status.textContent = 'Av · bildfunktionen är inte tillgänglig'; });
  return { stop: reset, get active() { return Boolean(pending || stream || session); },
    get busy() { return Boolean(pending || stream || session || sending || !review.hidden); } };
}
