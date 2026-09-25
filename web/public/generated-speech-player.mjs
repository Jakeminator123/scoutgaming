import { validateSpeechPackage } from './speech-package.mjs';

const mediaPath = /^\/api\/generated-speech\/[a-f0-9-]{32,64}\/(audio|video)$/;
const abortError = () => new DOMException('Speech cancelled', 'AbortError');
const sha256 = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');

export async function loadGeneratedSpeech(value, { exactText, dealerId, signal, fetchImpl = fetch, media: suppliedMedia } = {}) {
  const speech = validateSpeechPackage(value, { requireApproved: false });
  if (speech.schemaVersion !== 2 || speech.source.kind !== 'generatedText' || speech.video.presentation !== 'lipsync'
    || speech.reviewStatus !== 'pending' || speech.exactText !== exactText || speech.dealerId !== dealerId || speech.audioDelayMs !== 0
    || speech.audio.durationMs > 25000 || !mediaPath.test(speech.audio.url) || !mediaPath.test(speech.video.url)) throw new Error('Generated speech does not match this lab reply');
  if (await sha256(new TextEncoder().encode(exactText)) !== speech.generation.textSha256) throw new Error('Generated speech text hash mismatch');
  if (suppliedMedia) {
    if (!(suppliedMedia.audio instanceof ArrayBuffer) || !(suppliedMedia.video instanceof ArrayBuffer)
      || suppliedMedia.audio.byteLength > 2 * 1024 * 1024 || suppliedMedia.video.byteLength > 30 * 1024 * 1024) throw new Error('Invalid transferred speech media');
    // The explicit native/lab bridge supplies bytes, never credentials or a new
    // network URL. The normal same-artifact, MIME, size and hash checks still run.
    fetchImpl = async url => new Response(url === speech.audio.url ? suppliedMedia.audio : suppliedMedia.video,
      { headers: { 'content-type': url === speech.audio.url ? 'audio/wav' : 'video/mp4' } });
  }
  async function read(media, maximum, mime) {
    const response = await fetchImpl(media.url, { signal, credentials: 'same-origin', redirect: 'error', cache: 'no-store' });
    if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== mime || Number(response.headers.get('content-length')) > maximum) {
      await response.body?.cancel(); throw new Error('Generated speech media is unavailable');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Generated speech media is empty');
    const chunks = []; let size = 0;
    try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length;
      if (size > maximum) { await reader.cancel(); throw new Error('Generated speech media is too large'); }
      chunks.push(part.value);
    } } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    if (!size || await sha256(bytes) !== media.sha256) throw new Error('Generated speech media hash mismatch');
    return new Blob([bytes], { type: mime });
  }
  const [audio, video] = await Promise.all([read(speech.audio, 2 * 1024 * 1024, 'audio/wav'), read(speech.video, 30 * 1024 * 1024, 'video/mp4')]);
  if (signal?.aborted) throw abortError();
  return { speech, audio, video };
}

/** The caller owns the pose gate and single speech queue. This owns one exact,
 * hash-checked audio/video pair, never a substitute recorded sentence. */
export async function playGeneratedSpeech(value, { exactText, dealerId, mount, signal, media, onStart = () => {}, onReceipt = () => {} } = {}) {
  if (!mount || signal?.aborted) throw abortError();
  const controller = new AbortController();
  const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), 45000);
  let audio, video, surface, frame, audioUrl, videoUrl;
  let started = false, completed = false;
  try {
    const loaded = await loadGeneratedSpeech(value, { exactText, dealerId, signal: controller.signal, media });
    audioUrl = URL.createObjectURL(loaded.audio); videoUrl = URL.createObjectURL(loaded.video);
    audio = new Audio(audioUrl); audio.preload = 'auto';
    surface = document.createElement('div'); surface.className = 'generated-speech-surface';
    surface.style.cssText = 'position:absolute;inset:0;z-index:25;background:#101618;overflow:hidden;';
    video = document.createElement('video'); video.src = videoUrl; video.muted = true; video.playsInline = true; video.preload = 'auto';
    video.setAttribute('aria-label', 'Astrid · genererad läppsynk, labbprov');
    // Match the local film's scene bounds. An in-flow grid video can retain
    // its intrinsic portrait height and overflow before object-fit is applied.
    video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;';
    const label = document.createElement('span'); label.textContent = 'Genererad läppsynk · labbprov · ej visuellt godkänt';
    label.style.cssText = 'position:absolute;top:8px;left:8px;padding:5px 8px;background:#101618dd;color:#eee;font:11px sans-serif;';
    surface.append(video, label); mount.append(surface);
    async function ready(media) {
      if (media.readyState >= 3) return;
      await new Promise((resolve, reject) => {
        const clean = () => { media.removeEventListener('canplay', done); media.removeEventListener('error', fail); controller.signal.removeEventListener('abort', fail); };
        const done = () => { clean(); resolve(); }, fail = () => { clean(); reject(new Error('Generated speech decoding failed or was cancelled')); };
        media.addEventListener('canplay', done, { once: true }); media.addEventListener('error', fail, { once: true }); controller.signal.addEventListener('abort', fail, { once: true });
        if (controller.signal.aborted) fail(); else media.load();
      });
    }
    await Promise.all([ready(audio), ready(video)]);
    if (controller.signal.aborted) throw abortError();
    if (!Number.isFinite(audio.duration) || audio.duration > 25.05 || Math.abs(audio.duration * 1000 - loaded.speech.audio.durationMs) > 150
      || !Number.isFinite(video.duration) || Math.abs(video.duration - audio.duration) > 1) throw new Error('Generated speech duration mismatch');
    const finished = new Promise((resolve, reject) => {
      const clean = () => { audio.removeEventListener('ended', end); audio.removeEventListener('error', fail); video.removeEventListener('error', fail); controller.signal.removeEventListener('abort', fail); };
      const end = () => { clean(); completed = true; resolve(); }, fail = () => { clean(); reject(new Error('Generated speech interrupted')); };
      audio.addEventListener('ended', end, { once: true }); audio.addEventListener('error', fail, { once: true }); video.addEventListener('error', fail, { once: true }); controller.signal.addEventListener('abort', fail, { once: true });
    });
    // Attach a rejection handler before play() so an abort during autoplay
    // cannot leave an unhandled media-completion promise.
    void finished.catch(() => {});
    audio.currentTime = 0; video.currentTime = 0;
    await new Promise((resolve, reject) => {
      const cancel = () => reject(abortError());
      controller.signal.addEventListener('abort', cancel, { once: true });
      Promise.all([video.play(), audio.play()]).then(resolve, reject).finally(() => controller.signal.removeEventListener('abort', cancel));
      if (controller.signal.aborted) cancel();
    });
    if (controller.signal.aborted) throw abortError();
    started = true; onStart(exactText); onReceipt({ state: 'start', packageId: loaded.speech.packageId, evidence: 'media-playing', reviewStatus: 'pending' });
    const sync = () => {
      if (controller.signal.aborted || audio.ended) return;
      const delta = video.currentTime - audio.currentTime;
      if (Math.abs(delta) > .2) video.currentTime = audio.currentTime;
      video.playbackRate = delta > .04 ? .97 : delta < -.04 ? 1.03 : 1;
      frame = requestAnimationFrame(sync);
    };
    frame = requestAnimationFrame(sync);
    await finished;
  } finally {
    clearTimeout(timer); controller.abort(); signal?.removeEventListener('abort', abort);
    if (frame != null) cancelAnimationFrame(frame);
    audio?.pause(); video?.pause(); surface?.remove();
    if (audioUrl) URL.revokeObjectURL(audioUrl); if (videoUrl) URL.revokeObjectURL(videoUrl);
    onReceipt({ state: completed ? 'end' : 'interrupted', packageId: value?.packageId, evidence: 'media-lifecycle', started, reviewStatus: 'pending' });
  }
}
