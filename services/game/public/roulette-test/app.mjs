import { WHEEL, pocketColor } from '/roulette-rules.mjs';

const get = id => document.getElementById(id);
const spin = get('spin'), status = get('status'), ring = get('result-ring');
const history = get('history'), clear = get('clear'), copy = get('copy');
const red = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const colorFor = number => number === 0 ? 'green' : red.has(number) ? 'red' : 'black';
const colorLabel = { green: 'Grön nolla', red: 'Röd', black: 'Svart' };
let count = 0, currentJson = '', busy = false;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let rotation=0, finishMotion=()=>{};

for (let number = 0; number <= 36; number++) {
  const pocket = document.createElement('span');
  pocket.className = `pocket ${colorFor(number)}`; pocket.id = `pocket-${number}`;
  pocket.textContent = String(number); pocket.setAttribute('aria-label', `${number}, ${colorLabel[colorFor(number)]}`);
  get('number-board').append(pocket);
}

function message(text, error = false) { status.textContent = text; status.dataset.error = String(error); }

spin.addEventListener('click', async () => {
  if (busy) return;
  busy = true; spin.disabled = true; clear.disabled = true; copy.disabled = true; ring.classList.add('pending');
  get('gesture-spin').disabled=true;
  message('Väntar på spelserverns utfall…');
  const started = performance.now();
  try {
    const response = await fetch('/api/roulette-test/spin', {
      method: 'POST', headers: { 'X-Roulette-Preview': '1' }, credentials: 'omit',
      cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(response.status === 429 ? 'Vänta en sekund och prova igen.' : 'Servern kunde inte lämna ett utfall.');
    const payload = await response.json(), event = payload.event, outcome = event?.outcome;
    if (payload.demo !== true || event?.type !== 'roulette.spin.resolved' || event.schemaVersion !== 1
        || event.game !== 'roulette' || event.variant !== 'european-single-zero'
        || !Number.isInteger(outcome?.number) || outcome.number < 0 || outcome.number > 36
        || outcome.color !== colorFor(outcome.number)) throw new Error('Serverns svar kunde inte verifieras.');
    get('latency').textContent = `${Math.round(performance.now() - started)} ms`;
    await animateWheel(outcome.number);
    get('result-number').textContent = String(outcome.number); get('result-color').textContent = colorLabel[outcome.color];
    ring.dataset.color = outcome.color;
    document.querySelector('.pocket.selected')?.classList.remove('selected');
    get(`pocket-${outcome.number}`).classList.add('selected');
    const item = document.createElement('li'); item.textContent = String(outcome.number); item.className = outcome.color;
    item.setAttribute('aria-label', `${outcome.number}, ${colorLabel[outcome.color]}`); history.prepend(item);
    if (history.children.length > 20) history.lastElementChild.remove();
    get('empty-history').hidden = true; get('spin-count').textContent = String(++count);
    currentJson = JSON.stringify(event, null, 2); get('event-json').textContent = currentJson;
    message(`Serverutfall: ${outcome.number}, ${colorLabel[outcome.color].toLowerCase()}. Ny demorunda skapad.`);
  } catch (error) {
    const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    message(timeout ? 'Svaret dröjde. Inget automatiskt återförsök görs; nästa klick skapar en ny runda.'
      : error instanceof TypeError ? 'Kunde inte nå servern. Kontrollera anslutningen och prova igen.' : error.message, true);
  } finally {
    busy = false; spin.disabled = false; clear.disabled = count === 0; copy.disabled = !currentJson; ring.classList.remove('pending');
    get('gesture-spin').disabled=false;
    get('motion-status').textContent=status.textContent;
  }
});

// This lab only calls the existing stateless, wallet-free preview endpoint.
// A gesture never sends force, direction, a seed or a requested number.
const stage=get('experiment-stage'), wheel=get('gesture-wheel');
const ns='http://www.w3.org/2000/svg', step=360/37;
const point=(angle,r)=>[200+r*Math.sin(angle*Math.PI/180),200-r*Math.cos(angle*Math.PI/180)];
for(const [index,number] of WHEEL.entries()) {
  const path=document.createElementNS(ns,'path'),start=point(index*step-step/2,194),end=point(index*step+step/2,194);
  path.setAttribute('d',`M200 200 L${start.join(' ')} A194 194 0 0 1 ${end.join(' ')} Z`);
  path.setAttribute('fill',{red:'#842d3f',black:'#15271e',green:'#23744c'}[pocketColor(number)]);
  path.setAttribute('stroke','#c6aa78');path.setAttribute('stroke-width','1');
  const text=document.createElementNS(ns,'text'),p=point(index*step,170);
  text.setAttribute('x',p[0]);text.setAttribute('y',p[1]);text.setAttribute('fill','#fff5df');text.setAttribute('font-size','13');
  text.setAttribute('text-anchor','middle');text.setAttribute('dominant-baseline','middle');text.setAttribute('transform',`rotate(${index*step} ${p.join(' ')})`);text.textContent=number;
  get('lab-wheel').append(path,text);
}
async function animateWheel(number) {
  const destination=(360-WHEEL.indexOf(number)*360/37)%360;
  const next=rotation+1440+(destination-rotation%360+360)%360;
  const duration=reduced.matches||document.hidden?0:2800;
  const animation=get('lab-wheel').animate([{transform:`rotate(${rotation}deg)`},{transform:`rotate(${next}deg)`}],{duration,easing:'cubic-bezier(.18,.65,.22,1)',fill:'forwards'});
  const ball=get('lab-ball').animate([{transform:'rotate(0deg)'},{transform:'rotate(-1800deg)'}],{duration,easing:'cubic-bezier(.18,.65,.22,1)'});
  finishMotion=()=>{animation.finish();ball.finish();};
  try {await Promise.all([animation.finished,ball.finished]);}catch {/* Display the confirmed result even after cancellation. */}
  rotation=next;get('lab-wheel').style.transform=`rotate(${next}deg)`;animation.cancel();ball.cancel();finishMotion=()=>{};
  get('lab-wheel').setAttribute('aria-label',`Serverutfall ${number}, ${colorLabel[pocketColor(number)]}`);
}
get('gesture-spin').addEventListener('click',()=>spin.click());
get('framing').addEventListener('change',()=>{stage.dataset.framing=get('framing').value;resetView();});
get('depth').addEventListener('input',()=>{get('depth-value').value=get('depth').value;});
function resetView(){stage.style.setProperty('--look-x','0px');stage.style.setProperty('--look-y','0px');}
function syncMotion(){
  get('parallax').disabled=reduced.matches;
  if(reduced.matches){get('parallax').checked=false;finishMotion();}
  resetView();get('motion-status').textContent=reduced.matches?'Reducerad rörelse: parallax och snurranimation är av.':get('parallax').checked?'Parallax är på. Rör musen över rummet eller dra över bakgrunden.':'Parallax är av. Ingen kamera används.';
}
get('parallax').addEventListener('change',syncMotion);reduced.addEventListener('change',syncMotion);syncMotion();
let looking=null;
stage.addEventListener('pointerdown',event=>{if(!event.target.closest('#gesture-wheel')&&get('parallax').checked){looking=event.pointerId;stage.setPointerCapture(event.pointerId);}});
stage.addEventListener('pointermove',event=>{
  if(!get('parallax').checked||reduced.matches||event.target.closest('#gesture-wheel')||event.pointerType!=='mouse'&&looking!==event.pointerId)return;
  const rect=stage.getBoundingClientRect(),depth=Number(get('depth').value);
  const x=Math.max(-1,Math.min(1,(event.clientX-rect.left)/rect.width*2-1)),y=Math.max(-1,Math.min(1,(event.clientY-rect.top)/rect.height*2-1));
  stage.style.setProperty('--look-x',`${x*depth}px`);stage.style.setProperty('--look-y',`${y*depth}px`);
});
for(const name of ['pointerup','pointercancel','pointerleave'])stage.addEventListener(name,()=>{looking=null;resetView();});
let gesture=null;
const angle=event=>{const rect=wheel.getBoundingClientRect();return Math.atan2(event.clientY-rect.top-rect.height/2,event.clientX-rect.left-rect.width/2);};
wheel.addEventListener('pointerdown',event=>{
  if(busy||!event.isPrimary||event.button!==0)return;
  gesture={id:event.pointerId,last:angle(event),distance:0};wheel.setPointerCapture(event.pointerId);
});
wheel.addEventListener('pointermove',event=>{
  if(!gesture||gesture.id!==event.pointerId)return;
  const next=angle(event),delta=Math.atan2(Math.sin(next-gesture.last),Math.cos(next-gesture.last));
  gesture.distance+=delta;gesture.last=next;
  get('motion-status').textContent=Math.abs(gesture.distance)>=Math.PI/4?'Släpp för att starta en demorunda.':'Fortsätt dra runt hjulet…';
});
wheel.addEventListener('pointerup',event=>{
  if(!gesture||gesture.id!==event.pointerId)return;
  const ready=Math.abs(gesture.distance)>=Math.PI/4;gesture=null;
  if(ready&&!busy)spin.click();else get('motion-status').textContent='Gesten avbröts. Dra lite längre, eller använd knappen.';
});
for(const name of ['pointercancel','lostpointercapture'])wheel.addEventListener(name,()=>{gesture=null;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){gesture=null;looking=null;resetView();finishMotion();}});

clear.addEventListener('click', () => {
  history.replaceChildren(); count = 0; currentJson = ''; get('spin-count').textContent = '0'; get('latency').textContent = '—';
  get('empty-history').hidden = false; get('result-number').textContent = '—'; get('result-color').textContent = 'Redo att snurra';
  delete ring.dataset.color; document.querySelector('.pocket.selected')?.classList.remove('selected');
  get('event-json').textContent = '// Snurra för att se det verkliga svaret från servern.';
  clear.disabled = true; copy.disabled = true; message('Flikens historik är rensad. Ingen serverdata har ändrats.');
});

copy.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(currentJson); message('Eventet har kopierats som JSON.'); }
  catch { message('Kunde inte kopiera automatiskt. Markera och kopiera JSON-texten manuellt.', true); }
});
