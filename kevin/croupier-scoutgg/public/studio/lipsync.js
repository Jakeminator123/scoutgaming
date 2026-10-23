// Voice and lip-sync keys for a staging server (server.mjs, studio/lipsync-keys): shows which are set and saves new ones.
const state = document.querySelector('#state'), form = document.querySelector('#keys'), button = form.querySelector('button');
const yes = (on, text) => `<span class="${on ? 'ok' : 'bad'}">${on ? '✓' : '✗'} ${text}</span>`;
const NAMES = { paow: 'Paow', dragge: 'Dragan', astrid2: 'Astrid' };
function show(j) {
  const workers = Object.entries(j.lipsync ?? {}).map(([id, w]) => { const name = NAMES[id] ?? id;
    return yes(w.ready, w.ready ? `${name}: lip-sync worker ready (${w.info?.gpu ?? ''})` : `${name}: lip-sync worker starts when someone plays at a ${name} table`); });
  state.innerHTML = [yes(j.runpod, 'RunPod key'), yes(j.elevenlabs, 'ElevenLabs key'), ...(workers.length ? workers : [yes(false, 'Lip sync off')])].join('<br>');
}
async function load() {
  const r = await fetch('/api/studio/lipsync-keys');
  if (r.status === 401) { state.innerHTML = 'Sign in to <a href="/studio/">Table Studio</a> first.'; button.disabled = true; return; }
  if (!r.ok) { state.textContent = (await r.json().catch(() => ({}))).error ?? `Unavailable (${r.status})`; button.disabled = true; return; }
  show(await r.json());
}
form.addEventListener('submit', async e => {
  e.preventDefault();
  button.disabled = true; state.textContent = 'Saving…';
  const data = Object.fromEntries(new FormData(form));
  const r = await fetch('/api/studio/lipsync-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const j = await r.json().catch(() => ({}));
  button.disabled = false;
  if (!r.ok) { state.innerHTML = `<span class="bad">${j.error ?? 'Could not save'}</span>`; return; }
  form.reset(); show(j);
});
load();
setInterval(load, 10000);
