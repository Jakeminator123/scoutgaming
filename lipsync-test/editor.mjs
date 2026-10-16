const $ = id => document.getElementById(id);
const original = $('original'), result = $('result');
let catalog, selected, resultUrl;
const status = text => { $('status').textContent = text; };
function pause() { original.pause(); result.pause(); }
function sound() { original.muted = $('sound').value !== 'original'; result.muted = $('sound').value !== 'result'; }
function controls() {
  for (const id of ['play', 'pause', 'back', 'forward']) $(id).disabled = !selected || original.readyState < 1;
}
function render() {
  const search = $('search').value.toLocaleLowerCase();
  const clips = catalog.clips.filter(c => c.path.startsWith($('group').value) && c.path.toLocaleLowerCase().includes(search));
  $('count').textContent = `${clips.length} av ${catalog.clips.length} filmer`;
  $('clips').replaceChildren(...clips.map(clip => {
    const button = document.createElement('button');
    const title = document.createElement('strong'), path = document.createElement('small');
    title.textContent = clip.path.split('/').at(-1); path.textContent = clip.path;
    button.append(title, path); button.className = clip.path === selected?.path ? 'active' : '';
    button.setAttribute('aria-pressed', String(clip.path === selected?.path));
    button.addEventListener('click', () => select(clip)); return button;
  }));
}
function select(clip) {
  pause(); selected = clip; original.src = `media/${clip.id}`;
  // A previous result is not evidence for the next original.
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null; result.removeAttribute('src'); result.load(); $('result-file').value = '';
  $('result-name').textContent = 'Välj ett resultat för just detta original.';
  $('selected').textContent = clip.path; $('dimensions').textContent = '—';
  status('Läser originalfilen…'); controls(); render();
}
$('search').addEventListener('input', render); $('group').addEventListener('change', render);
$('sound').addEventListener('change', sound);
$('pause').addEventListener('click', pause);
for (const [id, direction] of [['back', -1], ['forward', 1]]) $(id).addEventListener('click', () => {
  pause(); const time = Math.max(0, Math.min(original.duration, original.currentTime + direction / Number($('fps').value)));
  original.currentTime = time;
  if (result.readyState >= 1) result.currentTime = Math.min(time, result.duration);
});
$('play').addEventListener('click', async () => {
  pause(); original.currentTime = 0; if (result.readyState >= 1) result.currentTime = 0;
  sound();
  const attempts = [original.play()]; if (result.readyState >= 1) attempts.push(result.play());
  const answers = await Promise.allSettled(attempts);
  if (answers.some(r => r.status === 'rejected')) { pause(); status('Uppspelningen kunde inte starta. Kontrollera filformatet.'); }
});
$('result-file').addEventListener('change', () => {
  pause(); if (resultUrl) URL.revokeObjectURL(resultUrl);
  const file = $('result-file').files[0]; if (!file) return;
  resultUrl = URL.createObjectURL(file); result.src = resultUrl;
  $('result-name').textContent = `${file.name} · manuellt vald, ej verifierad koppling till originalet`;
});
original.addEventListener('loadedmetadata', () => {
  $('dimensions').textContent = `${original.videoWidth} × ${original.videoHeight} · ${original.duration.toFixed(2)} s`;
  status('Originalet är klart. Ett resultat kan väljas separat.'); controls();
});
for (const video of [original, result]) {
  video.addEventListener('error', () => { pause(); status('Filmen kunde inte läsas. Kontrollera formatet eller välj filmen igen.'); });
  video.addEventListener('ended', pause);
}
window.addEventListener('pagehide', () => { pause(); if (resultUrl) URL.revokeObjectURL(resultUrl); });
try {
  const response = await fetch('catalog'); if (!response.ok) throw Error(); catalog = await response.json();
  $('source').textContent = `Fryst origin/main: ${catalog.commit}. Original läses direkt ur Git; inga arbetsfiler ändras.`;
  render(); status(`${catalog.clips.length} filmer från main. Ingen läppsynkgenerering har körts.`);
} catch { status('Filmlistan kunde inte läsas. Starta om den lokala editorn.'); }
