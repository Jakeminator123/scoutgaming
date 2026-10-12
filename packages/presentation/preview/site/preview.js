import {StudioPlayer} from './player.js';
const $ = id => document.getElementById(id);
let catalog, scene, busy = false;
let layout = innerWidth < 720 ? 'mobile' : 'desktop';
const player = new StudioPlayer($('stage'), {
  mediaURL: path => new URL(path, new URL('/test/', location.origin)).href,
  onError: message => { $('error').textContent = message; },
  onStatus: status => { $('status').textContent = `${status.state}${status.clip ? ' · klipp spelas' : ' · stillbild'} · ${status.dropped} tappade dealerrutor`; }
});
function controls(disabled) {
  for (const element of document.querySelectorAll('select,button')) element.disabled = disabled;
  if (!disabled && catalog) {
    const dealer = catalog.lanes[Number($('dealer').value)].dealer;
    for (const button of $('actions').children) button.disabled = !dealer.clips['deal_pos' + button.dataset.target];
  }
}
async function guard(action) {
  if (busy) return;
  busy = true; controls(true); $('error').textContent = '';
  try { await action(); } catch (error) { $('error').textContent = error.message; }
  finally { busy = false; controls(false); }
}
function setLayout(value) {
  layout = value;
  document.body.classList.toggle('desktop', layout === 'desktop');
  $('mobile').setAttribute('aria-pressed', String(layout === 'mobile'));
  $('desktop').setAttribute('aria-pressed', String(layout === 'desktop'));
  if (scene) { scene.layout = layout; player.setScene(scene); }
}
async function loadLane() {
  const lane = catalog.lanes[Number($('dealer').value)];
  const background = $('background').value;
  scene = structuredClone(lane.scene); scene.background = background;
  setLayout(layout);
  await player.setDealer(lane.dealer, scene.variant);
  await player.setAssets(catalog.assets);
  $('background-status').textContent = catalog.assets.find(a => a.id === background).kind === 'video'
    ? 'Videobakgrund · ljudlös loop' : 'Bakgrundsbild';
}
async function init() {
  const response = await fetch('/test/catalog.json');
  if (!response.ok) throw Error('Previewns material kunde inte laddas.');
  catalog = await response.json();
  for (const [i, lane] of catalog.lanes.entries()) $('dealer').add(new Option(lane.name, String(i)));
  for (const asset of catalog.assets.filter(a => a.role === 'background')) $('background').add(new Option(asset.label, asset.id));
  $('background').value = catalog.lanes[0].scene.background;
  for (const target of ['1','2','3','4','5','6','7','dealer','hole']) {
    const button = document.createElement('button'); button.dataset.target = target;
    button.textContent = target === 'dealer' ? 'Dealer' : target === 'hole' ? 'Hålkort' : target;
    button.onclick = () => guard(() => player.enqueueDeal(target, {r:'A',s:'S',demo:true}, true));
    $('actions').append(button);
  }
  $('dealer').onchange = $('background').onchange = () => guard(loadLane);
  $('mobile').onclick = () => setLayout('mobile'); $('desktop').onclick = () => setLayout('desktop');
  $('all').onclick = () => guard(() => {for (const target of ['1','2','3','4','5','6','7','dealer']) player.enqueueDeal(target,{r:'A',s:'S',demo:true},true);});
  $('ready').onclick = () => guard(() => player.enqueueState('ready'));
  $('idle').onclick = () => guard(() => player.enqueueState('idle'));
  $('stop').onclick = () => {player.stop(); player.clearCards();};
  await guard(loadLane);
}
init().catch(error => { $('error').textContent = error.message; });
