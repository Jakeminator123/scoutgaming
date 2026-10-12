import { BETS, BET_BY_ID, WHEEL, LIMITS, pocketColor } from '/roulette-rules.mjs';

const $ = id => document.getElementById(id);
const context = Object.fromEntries(new URL(location.href).searchParams);
const colourNames = { red:'Röd', black:'Svart', green:'Grön' };
let state, pending, pendingKey, busy = true, chip = 5, rotation = 0;
let draft = new Map(), undo = [];
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let finishMotion = () => {};
let restoreSpinFocus = false;
const betButtons = new Map();
const money = (value, currency = state?.currency ?? 'USD') => new Intl.NumberFormat('sv-SE', { style:'currency', currency }).format(value);
const sum = () => [...draft.values()].reduce((a,b)=>a+b,0);
const message = (text, error = false) => { $('status').textContent = text; $('status').classList.toggle('error',error); };
const node = (tag, text, className) => { const el = document.createElement(tag); if(text !== undefined) el.textContent=text; if(className) el.className=className; return el; };

function drawWheel() {
  const ns = 'http://www.w3.org/2000/svg', step = 360/37;
  const point = (angle,r) => [200+r*Math.sin(angle*Math.PI/180),200-r*Math.cos(angle*Math.PI/180)];
  WHEEL.forEach((number,index)=>{
    const start = point(index*step-step/2,196), end = point(index*step+step/2,196);
    const path = document.createElementNS(ns,'path');
    path.setAttribute('d',`M200 200 L${start.join(' ')} A196 196 0 0 1 ${end.join(' ')} Z`);
    path.setAttribute('fill',{green:'#28754b',red:'#87333e',black:'#18221c'}[pocketColor(number)]);
    path.setAttribute('stroke','#c4b681'); path.setAttribute('stroke-width','.6');
    const text = document.createElementNS(ns,'text'), p = point(index*step,171);
    text.setAttribute('x',p[0]); text.setAttribute('y',p[1]); text.setAttribute('fill','#f3f0dd');
    text.setAttribute('text-anchor','middle'); text.setAttribute('dominant-baseline','middle');
    text.setAttribute('font-size','13'); text.setAttribute('transform',`rotate(${index*step} ${p.join(' ')})`);
    text.textContent=number; $('wheel').append(path,text);
  });
}

function addBet(id) {
  if (busy || pending || !state) return;
  const amount = (draft.get(id) ?? 0) + chip*100;
  if (amount > LIMITS.maxPerBet*100 || sum()+chip*100 > LIMITS.maxTotal*100) return message('Satsningen skulle överskrida bordets gräns.',true);
  if (sum()+chip*100 > Math.round(state.balance*100)) return message('Demosaldot räcker inte till den satsningen.',true);
  undo.push(new Map(draft)); draft.set(id,amount); renderDraft(); message('Satsningarna är redo. Snurra när du vill.');
}

function boardButton(id,row,column,label) {
  const def = BET_BY_ID[id], button = node('button',label ?? def.label,'bet');
  button.type='button'; button.dataset.bet=id;
  button.style.gridRow=row; button.style.gridColumn=column;
  button.style.setProperty('--desktop-row',row); button.style.setProperty('--desktop-column',column);
  let mobileRow, mobileColumn;
  if(def.type==='straight') {
    const n=def.numbers[0]; mobileRow=n ? String(2+Math.floor((n-1)/3)) : '1'; mobileColumn=n ? String(1+(n-1)%3) : '1 / 4';
  } else if(def.type==='column') {mobileRow='14';mobileColumn=id.slice(-1);}
  else if(def.type==='dozen') {mobileRow=`${2+(Number(id.slice(-1))-1)*4} / span 4`;mobileColumn='4';}
  else {mobileRow=`${2+['low','even','red','black','odd','high'].indexOf(id)*2} / span 2`;mobileColumn='5';}
  button.style.setProperty('--mobile-row',mobileRow); button.style.setProperty('--mobile-column',mobileColumn);
  if(def.type==='straight') button.classList.add(pocketColor(def.numbers[0]));
  if(id==='red'||id==='black') button.classList.add(id);
  button.addEventListener('click',()=>addBet(id));
  betButtons.set(id,button); $('board').append(button);
}
function buildBoard() {
  boardButton('straight-0','1 / 4','1');
  for(let n=1;n<=36;n++) boardButton(`straight-${n}`,String(3-(n-1)%3),String(2+Math.floor((n-1)/3)));
  for(let n=1;n<=3;n++) { boardButton(`column-${n}`,String(4-n),'14','2:1'); boardButton(`dozen-${n}`,'4',`${2+(n-1)*4} / span 4`); }
  ['low','even','red','black','odd','high'].forEach((id,i)=>boardButton(id,'5',`${2+i*2} / span 2`));
  for(const value of [1,5,25,100]) {
    const button=node('button',String(value),'chip'); button.type='button'; button.dataset.value=value;
    button.setAttribute('aria-label',`Marker ${value}`);
    button.addEventListener('click',()=>{chip=value;renderDraft();}); $('chips').append(button);
  }
  const selectInside = () => {
    $('inside-bet').replaceChildren(...BETS.filter(bet=>bet.type===$('inside-type').value).map(bet=>{
      const option=node('option',bet.label); option.value=bet.id; return option;
    }));
  };
  $('inside-type').addEventListener('change',selectInside); selectInside();
  $('add-inside').addEventListener('click',()=>{addBet($('inside-bet').value);$('inside').close();});
}

function renderDraft() {
  const locked = busy || Boolean(pending) || !state;
  for(const [id,button] of betButtons) {
    button.querySelector('.marker')?.remove();
    const value=draft.get(id);
    if(value) button.append(node('span',String(value/100),'marker'));
    button.disabled=locked;
    const def=BET_BY_ID[id];
    button.setAttribute('aria-label',`${def.label}${def.type==='straight'?', '+colourNames[pocketColor(def.numbers[0])] : ''}, vinst ${def.payout}:1${value?', satsat '+money(value/100):''}`);
  }
  for(const button of $('chips').children) { button.disabled=locked;button.setAttribute('aria-pressed',String(Number(button.dataset.value)===chip)); }
  $('stake').textContent=money(sum()/100);
  $('bet-count').textContent=String(draft.size);
  $('bet-list').replaceChildren(...[...draft].map(([id,amount])=>{
    const row=node('li',`${BET_BY_ID[id].label} · ${money(amount/100)}`), remove=node('button','×');
    remove.setAttribute('aria-label','Ta bort '+BET_BY_ID[id].label); remove.disabled=locked;
    remove.addEventListener('click',()=>{undo.push(new Map(draft));draft.delete(id);renderDraft();});row.append(remove);return row;
  }));
  $('undo').disabled=locked||!undo.length; $('clear').disabled=locked||!draft.size;
  $('rebet').disabled=locked||!state?.rounds.length;
  $('spin').disabled=locked||!draft.size||sum()>Math.round(state.balance*100);
  $('show-inside').disabled=locked; $('add-inside').disabled=locked;
  $('inside-chip').textContent='Lägg en marker på '+money(chip)+'.';
  $('phase').textContent=busy?(state?'RUNDAN PÅGÅR':'ANSLUTER'):pending?'INVÄNTAR KVITTO':state?'SATSNINGAR ÖPPNA':'EJ ANSLUTEN';
  $('board').setAttribute('aria-busy',String(busy));
}
function showResult(round) {
  if(!round) return;
  const {number,color}=round.event.outcome;
  rotation=(360-WHEEL.indexOf(number)*360/37)%360;
  $('wheel-disk').style.transform=`rotate(${rotation}deg)`;
  $('result-number').textContent=number; $('result-number').className='result-number '+color;
  $('wheel').setAttribute('aria-label',`Europeiskt roulettehjul. Senaste utfall: ${number}, ${colourNames[color]}.`);
  $('result-color').textContent=colourNames[color]+(number ? number%2===0?' · Jämnt':' · Udda':' · Nolla');
  $('round-return').textContent=round.returned ? 'Tillbaka '+money(round.returned,round.currency)+' · netto '+money(round.net,round.currency) : 'Ingen vinst denna runda';
  for(const [id,button] of betButtons) button.classList.toggle('winner',id===`straight-${number}`);
}
function renderState() {
  $('player-name').textContent=state.player.name;
  $('balance').textContent=money(state.balance);
  $('room-name').textContent=state.room.name;
  document.title=state.room.name+' · '+(state.room.operatorName ?? 'Scoutgaming');
  $('history').replaceChildren(...state.rounds.map(round=>{
    const el=node('li',String(round.event.outcome.number),round.event.outcome.color);
    el.title=`${round.event.outcome.number}, ${colourNames[round.event.outcome.color]} · ${new Date(round.event.occurredAt).toLocaleString('sv-SE')} · insats ${money(round.wagered,round.currency)} · tillbaka ${money(round.returned,round.currency)}`;
    el.setAttribute('aria-label',el.title);return el;
  }));
  showResult(state.rounds[0]); renderDraft();
}
const errorText = {
  currency_changed:'Kontots valuta har ändrats. Saldot har uppdaterats; kontrollera dina satsningar igen.',
  insufficient_balance:'Demosaldot räcker inte. Saldot har hämtats på nytt.', room_changed:'En annan flik har spelat en runda. Kontrollera dina satsningar igen.',
  request_id_reused:'Rundan kan inte återanvändas med ändrade satsningar.', roulette_room_changed:'Rummets publicering har ändrats. Öppna rummet på nytt från lobbyn.',
  roulette_room_not_found:'Rummet är inte längre tillgängligt. Välj ett publicerat rum i lobbyn.',
  roulette_not_ready:'Roulette förbereds på servern. Försök igen om en stund.', roulette_room_unavailable:'Rummet kunde inte hämtas just nu.',
  roulette_native_account_required:'Det här rouletterummet använder Scoutgamings demosaldo. Externa spelkonton stöds inte ännu.',
  session_changed:'Spelkontot har ändrats. Öppna rummet på nytt med rätt konto.',
};
async function command(request) {
  const response=await fetch('/api/roulette/table',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
    headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({...request,context}),signal:AbortSignal.timeout(20000)});
  const data=await response.json();
  if(!response.ok||data.error) throw Object.assign(Error(data.error ?? 'server_error'),{status:response.status});
  if(data.schemaVersion!==1||!Number.isSafeInteger(data.version)||!data.player?.id||!Array.isArray(data.rounds)||!Number.isFinite(data.balance)) throw Error('invalid_response');
  return data;
}
function clearPending() { sessionStorage.removeItem(pendingKey);pending=null;$('retry').hidden=true; }
async function animate(number) {
  const duration=motion.matches||document.hidden?0:3200;
  const destination=(360-WHEEL.indexOf(number)*360/37)%360;
  const next=rotation+360*4+(destination-rotation%360+360)%360;
  const timing={duration,easing:'cubic-bezier(.18,.65,.22,1)',fill:'forwards'};
  const animations=[
    $('wheel-disk').animate([{transform:`rotate(${rotation}deg)`},{transform:`rotate(${next}deg)`}],timing),
    $('ball-orbit').animate([{transform:'rotate(0deg)'},{transform:'rotate(-1800deg)'}],timing),
    $('ball').animate([{top:'2%'},{top:'2%',offset:.65},{top:'16%'}],{duration,fill:'forwards'}),
  ];
  $('ball-orbit').classList.add('visible');$('skip-motion').hidden=!duration;
  finishMotion=()=>animations.forEach(animation=>animation.finish());
  try { await Promise.all(animations.map(animation=>animation.finished)); } catch { /* The saved result remains authoritative. */ }
  rotation=next;$('wheel-disk').style.transform=`rotate(${rotation}deg)`;
  $('ball').style.top='16%';animations.forEach(animation=>animation.cancel());
  finishMotion=()=>{};restoreSpinFocus=document.activeElement===$('skip-motion');$('skip-motion').hidden=true;
}
async function submit() {
  if(busy||!pending) return;
  busy=true;$('retry').hidden=true;renderDraft();message('Satsningarna är låsta. Rundan avgörs…');
  try {
    const result=await command(pending);
    if(result.player.id!==pending.playerId||result.requestId!==pending.requestId||!result.round) throw Error('invalid_receipt');
    message('Rundan är bekräftad. Kulan stannar strax…');
    await animate(result.round.event.outcome.number);
    state=result;clearPending();draft=new Map();undo=[];
    renderState();showResult(result.round);
    message(`${result.replayed?'Den sparade rundan hämtades. ':''}${result.round.event.outcome.number} · ${colourNames[result.round.event.outcome.color]}. ${result.round.returned?'Tillbaka '+money(result.round.returned,result.round.currency)+'.':'Ingen vinst.'} Lägg nya satsningar när du vill.`);
  } catch(error) {
    if(error.status===400) {
      // Explicit validation failures commit no new round. Refresh before unlocking.
      try {state=await command({op:'state'});clearPending();renderState();} catch { /* Keep the exact command available for recovery. */ }
    }
    if(error.status===401) $('login').hidden=false;
    message(errorText[error.message] ?? 'Svaret kunde inte bekräftas. Kontrollera samma runda igen innan du spelar vidare.',true);
    $('retry').hidden=!pending;
  } finally {busy=false;renderDraft();if(restoreSpinFocus){$('rebet').focus();restoreSpinFocus=false;}}
}
async function init() {
  try {
    state=await command({op:'state'});
    pendingKey=`roulette.pending.v1:${state.player.id}:${state.room.operatorId}:${state.room.id}`;
    const saved=sessionStorage.getItem(pendingKey);
    if(saved) {
      const parsed=JSON.parse(saved);
      if(parsed.playerId!==state.player.id||parsed.op!=='spin'||!Array.isArray(parsed.bets)) throw Error('invalid_saved_command');
      pending=parsed;draft=new Map(parsed.bets.map(bet=>[bet.id,Math.round(bet.amount*100)]));
    }
    renderState();busy=false;renderDraft();
    if(pending) { $('retry').hidden=false;message('En tidigare runda inväntar bekräftelse. Kontrollera den igen.',true); }
    else message('Välj marker och klicka på bordet. Ditt saldo är gemensamt med blackjack.');
    if(state.room.operator) void import('./scene.mjs').then(({mountRoomScene})=>mountRoomScene(state.room)).catch(()=>{
      $('dealer-scene').className='published-scene';
      $('dealer-scene').replaceChildren(node('p','Dealerscenen är inte tillgänglig just nu. Spelet fungerar fortfarande.'));
    });
  } catch(error) {
    message(errorText[error.message] ?? 'Rummet kunde inte öppnas. Ladda om sidan och försök igen.',true);
    if(error.status===401) $('login').hidden=false;
  }
}
$('login').href='/player-login?returnTo='+encodeURIComponent(location.pathname+location.search);
$('show-rules').addEventListener('click',()=>$('rules').showModal());
$('show-inside').addEventListener('click',()=>$('inside').showModal());
$('undo').addEventListener('click',()=>{draft=undo.pop()??new Map();renderDraft();});
$('clear').addEventListener('click',()=>{undo.push(new Map(draft));draft=new Map();renderDraft();});
$('rebet').addEventListener('click',()=>{
  const bets=state.rounds[0]?.bets;if(!bets) return;
  if(bets.reduce((n,bet)=>n+Math.round(bet.amount*100),0)>Math.round(state.balance*100)) return message('Demosaldot räcker inte för att upprepa satsningarna.',true);
  undo.push(new Map(draft));draft=new Map(bets.map(bet=>[bet.id,Math.round(bet.amount*100)]));renderDraft();message('Föregående satsningar är utlagda. Snurra när du vill.');
});
$('spin').addEventListener('click',()=>{
  if(busy||pending||!state||!draft.size) return;
  const request={op:'spin',playerId:state.player.id,currency:state.currency,requestId:crypto.randomUUID(),version:state.version,bets:[...draft].map(([id,amount])=>({id,amount:amount/100}))};
  try {sessionStorage.setItem(pendingKey,JSON.stringify(request));} catch {return message('Webbläsaren kan inte spara rundans kvitto. Tillåt sessionslagring och försök igen.',true);}
  pending=request;void submit();
});
$('retry').addEventListener('click',()=>void submit());
$('skip-motion').addEventListener('click',()=>finishMotion());
motion.addEventListener('change',()=>{if(motion.matches)finishMotion();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)finishMotion();});
document.querySelector('.table-tools').append($('show-rules'));
drawWheel();buildBoard();renderDraft();void init();
