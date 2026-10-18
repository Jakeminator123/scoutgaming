import { playGeneratedSpeech } from '/generated-speech-player.mjs';

const $ = id => document.getElementById(id);
const endpoint = '/api/bo/speech-qa';
let state = null, active = null, cancelling = null;
const results = [], recordings = [];
function render() {
  const ready = state?.enabled && state.attempts < state.maxAttempts && !state.pending
    && !state.relay?.pending && !state.relay?.busy && !active && !cancelling;
  $('first').disabled = !ready;
  $('second').disabled = !ready;
  $('refresh').disabled = !!active || !!cancelling;
  $('cancel').disabled = !active;
}
async function status() {
  const response = await fetch(endpoint, { credentials:'same-origin', cache:'no-store' });
  state = await response.json();
  if (!response.ok) {
    state = null;
    $('summary').textContent = response.status === 404 ? 'Provet är avstängt.' : 'Administratörsinloggning krävs eller provet är otillgängligt.';
  } else {
    $('summary').textContent = `${state.enabled ? 'Aktiverat' : 'Avstängt'} · ${state.attempts}/${state.maxAttempts} försök`;
    $('result').textContent = JSON.stringify({ status:state, results }, null, 2);
  }
  render();
}
function capture(video, result) {
  if (!video.captureStream || !globalThis.MediaRecorder) { result.recording = 'unsupported'; return () => {}; }
  let stream;
  try {
    stream = video.captureStream();
    const mimeType = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) { stream.getTracks().forEach(track => track.stop()); return () => {}; }
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      if (!chunks.length) return;
      const url = URL.createObjectURL(new Blob(chunks, { type:mimeType })); recordings.push(url);
      const figure = document.createElement('figure');
      const label = document.createElement('figcaption'); label.textContent = `Svar ${result.turn} · granskningsinspelning`;
      const review = document.createElement('video'); review.src = url; review.controls = true; review.playsInline = true;
      const link = document.createElement('a'); link.href = url; link.download = `astrid-qa-turn-${result.turn}.webm`; link.textContent = 'Spara granskning';
      figure.append(label, review, document.createElement('br'), link); $('reviews').append(figure);
      result.recording = 'available';
      $('result').textContent = JSON.stringify({ status:state, results }, null, 2);
    };
    recorder.start(250);
    return () => { if (recorder.state !== 'inactive') recorder.stop(); };
  } catch { stream?.getTracks().forEach(track => track.stop()); result.recording = 'unavailable'; return () => {}; }
}
async function play(turn) {
  if (active || cancelling) return;
  const controller = new AbortController(); active = controller; render();
  const began = performance.now();
  const result = { turn, startedAt:new Date().toISOString(), receipts:[], error:null };
  results.push(result);
  let stopRecording = () => {};
  $('summary').textContent = 'Astrid tänker och förbereder rösten…';
  try {
    const response = await fetch(endpoint, { method:'POST', credentials:'same-origin', signal:controller.signal,
      headers:{'Content-Type':'application/json'}, body:JSON.stringify({ turn }) });
    const value = await response.json();
    result.attempt = value.attempt;
    if (!response.ok) throw new Error(value.error || 'qa_preparation_failed');
    result.timings = value.timings;
    const { decision } = value;
    result.text = decision.exactText;
    result.preparedMs = Math.round(performance.now() - began);
    $('summary').textContent = decision.exactText;
    if (!decision.speechStream) throw new Error('qa_stream_missing');
    await playGeneratedSpeech(decision.speechStream, {
      exactText:decision.exactText, dealerId:'astrid', requestId:decision.requestId,
      mount:$('scene'), signal:controller.signal,
      onFirstFrame() {
        result.firstFrameMs = Math.round(performance.now() - began);
        const video = $('scene').querySelector('video');
        if (video) { result.audible = !video.muted && video.volume > 0; stopRecording = capture(video, result);
          video.addEventListener('ended', stopRecording, { once:true }); }
      },
      onReceipt({ state:receiptState, evidence, started, timings }) {
        result.receipts.push({ state:receiptState, evidence, started, timings });
        $('result').textContent = JSON.stringify({ status:state, results }, null, 2);
      },
    });
    result.completedMs = Math.round(performance.now() - began);
    result.returnedToIdle = !$('scene').querySelector('video');
  } catch (error) { result.error = error.name === 'AbortError' ? 'qa_cancelled' : error.message; }
  finally {
    stopRecording();
    if (cancelling) await cancelling;
    active = null;
    await status().catch(() => { state = null; render(); });
    $('result').textContent = JSON.stringify({ status:state, results }, null, 2);
    if (result.error) $('summary').textContent = `Provet avbröts: ${result.error}. Inget automatiskt nytt försök.`;
  }
}
$('first').onclick = () => { void play(1); };
$('second').onclick = () => { void play(2); };
$('refresh').onclick = () => { void status(); };
$('cancel').onclick = () => {
  if (cancelling) return;
  cancelling = fetch(endpoint, { method:'DELETE', credentials:'same-origin' }).catch(() => {}).finally(() => { cancelling = null; });
  active?.abort();
  render();
};
window.addEventListener('pagehide', () => { active?.abort(); recordings.forEach(url => URL.revokeObjectURL(url)); });
void status().catch(() => { $('summary').textContent = 'Status kunde inte hämtas.'; render(); });
