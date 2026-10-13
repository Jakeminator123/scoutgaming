import { BETS, BET_BY_ID, LIMITS, pocketColor } from '/roulette-rules.mjs';
import {TABLE_ARTWORK,tableArtwork,tableBetGeometry,polygonButtonStyle,chipBreakdown} from './table-layout.mjs';

const $ = id => document.getElementById(id);
const context = Object.fromEntries(new URL(location.href).searchParams);
const colourNames = { red:'Röd', black:'Svart', green:'Grön' };
let state, pending, pendingKey, busy = true, chip = 5;
let displayedRound;
let roomScene=null,tableDesignId=null,tablePlacement={width:.8,x:0,y:.2};
let roomSceneReady=Promise.resolve(null);
let draft = new Map(), undo = [];
const betButtons = new Map();
const money = (value, currency = state?.currency ?? 'USD') => new Intl.NumberFormat('sv-SE', { style:'currency', currency }).format(value);
const sum = () => [...draft.values()].reduce((a,b)=>a+b,0);
function syncStatusVisibility() {
  document.querySelector('.status-row').classList.toggle('quiet',!busy&&!pending&&!$('status').classList.contains('error')&&$('retry').hidden&&$('login').hidden);
}
const message = (text, error = false) => { $('status').textContent = text; $('status').classList.toggle('error',error); syncStatusVisibility(); };
const node = (tag, text, className) => { const el = document.createElement(tag); if(text !== undefined) el.textContent=text; if(className) el.className=className; return el; };

function addBet(id) {
  if (busy || pending || !state) return;
  const amount = (draft.get(id) ?? 0) + chip*100;
  if (amount > LIMITS.maxPerBet*100 || sum()+chip*100 > LIMITS.maxTotal*100) return message('Satsningen skulle överskrida bordets gräns.',true);
  if (sum()+chip*100 > Math.round(state.balance*100)) return message('Demosaldot räcker inte till den satsningen.',true);
  undo.push(new Map(draft)); draft.set(id,amount); renderDraft(); message('Satsningarna är redo. Snurra när du vill.');
}

function boardButton(def) {
  const {polygon}=tableBetGeometry(def,tableDesignId);
  if(!polygon)return;
  const id=def.id, button = node('button',undefined,'table-bet');
  button.type='button'; button.dataset.bet=id;
  const rect=polygonButtonStyle(polygon,tableDesignId);
  Object.assign(button.style,{left:rect.left+'%',top:rect.top+'%',width:rect.width+'%',height:rect.height+'%',clipPath:`polygon(${rect.clip})`});
  button.title=def.label;
  button.addEventListener('click',event=>{
    if(event.detail>0&&matchMedia('(max-width:760px)').matches&&!$('table-zoom').open) {openTable(id);return;}
    addBet(id);
  });
  betButtons.set(id,button); $('board').append(button);
}
function configureTable({designId=null,placement={width:.8,x:0,y:.2}}={}) {
  tableDesignId=designId;tablePlacement=placement;
  const artwork=tableArtwork(designId);
  for(const id of ['board','table-markers']) {
    const layer=$(id);layer.hidden=!artwork;
    if(artwork)Object.assign(layer.style,{left:100*((1-placement.width)/2+placement.x)+'%',top:placement.y*100+'%',width:placement.width*100+'%',aspectRatio:artwork.width+'/'+artwork.height});
  }
  $('board').replaceChildren();betButtons.clear();
  if(artwork)BETS.forEach(boardButton);
  renderDraft();showResult(displayedRound);
}
function buildBoard() {
  BETS.forEach(boardButton);
  for(const value of [1,5,25,100]) {
    const button=node('button',String(value),'chip c'+value); button.type='button'; button.dataset.value=value;
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

function openTable(id='straight-2') {
  if($('more').open)$('more').close();
  if($('table-zoom').open){$('zoom-viewport').focus();return;}
  $('table-zoom').showModal();
  $('zoom-viewport').append($('dealer-scene'));
  $('zoom-controls').append(document.querySelector('.controls'));
  const {anchor}=tableBetGeometry(BET_BY_ID[id],tableArtwork(tableDesignId)?tableDesignId:null);
  const visual=$('dealer-scene'),viewport=$('zoom-viewport');
  const width=visual.clientWidth,height=visual.clientHeight;
  const artwork=tableArtwork(tableDesignId)??TABLE_ARTWORK;
  viewport.scrollLeft=width*((1-tablePlacement.width)/2+tablePlacement.x+tablePlacement.width*anchor[0]/artwork.width)-viewport.clientWidth/2;
  viewport.scrollTop=height*tablePlacement.y+width*tablePlacement.width*anchor[1]/artwork.width-60;
}
$('show-table').addEventListener('click',()=>openTable());
$('table-zoom').addEventListener('close',()=>{
  $('scene-home').append($('dealer-scene'));
  $('controls-home').append(document.querySelector('.controls'));
  $('show-more').focus();
});
$('show-more').addEventListener('click',()=>$('more').showModal());
if(document.fullscreenEnabled){
  $('fullscreen').hidden=false;
  $('fullscreen').addEventListener('click',async()=>{
    $('more').close();
    try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
    catch{message('Helskärm kunde inte öppnas i den här webbläsaren.',true);}
  });
  document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'Lämna helskärm':'Helskärm';});
}
$('more').addEventListener('close',()=>{
  if(!document.querySelector('#rules[open],#inside[open],#table-zoom[open]'))$('show-more').focus();
});
for(const id of ['rules','inside']) $(id).addEventListener('close',()=>$('show-more').focus());

function renderDraft() {
  const locked = busy || Boolean(pending) || !state;
  for(const [id,button] of betButtons) {
    const value=draft.get(id);
    button.disabled=locked;
    const def=BET_BY_ID[id];
    button.setAttribute('aria-label',`${def.label}${def.type==='straight'?', '+colourNames[pocketColor(def.numbers[0])] : ''}, vinst ${def.payout}:1${value?', satsat '+money(value/100):''}`);
  }
  $('table-markers').replaceChildren(...(tableArtwork(tableDesignId)?[...draft]:[]).map(([id,amount])=>{
    const {anchor}=tableBetGeometry(BET_BY_ID[id],tableDesignId), marker=node('span',undefined,'table-marker');
    const artwork=tableArtwork(tableDesignId)??TABLE_ARTWORK;
    marker.style.left=100*anchor[0]/artwork.width+'%';marker.style.top=100*anchor[1]/artwork.height+'%';
    const chips=chipBreakdown(amount/100);
    chips.forEach((value,index)=>{const disc=node('i',undefined,'c'+value);disc.style.setProperty('--n',index);marker.append(disc);});
    marker.append(node('b',String(amount/100)));return marker;
  }));
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
  syncStatusVisibility();
  $('board').setAttribute('aria-busy',String(busy));
  roomScene?.setRoundActive(Boolean(busy||pending));
}
function showResult(round) {
  if(!round) return;
  const {number,color}=round.event.outcome;
  $('result-number').textContent=number; $('result-number').className='result-number '+color;
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
  displayedRound=state.rounds[0];showResult(displayedRound);renderDraft();
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
async function submit() {
  if(busy||!pending) return;
  if($('more').open)$('more').close();
  if($('table-zoom').open)$('table-zoom').close();
  busy=true;$('retry').hidden=true;renderDraft();message('Satsningarna är låsta. Rundan avgörs…');
  try {
    const result=await command(pending);
    if(result.player.id!==pending.playerId||result.requestId!==pending.requestId||!result.round) throw Error('invalid_receipt');
    state=result;clearPending();draft=new Map();undo=[];
    message('Hjulet snurrar. Vänta tills kulan har stannat…');
    // The receipt is already committed. A visual failure must never retry a debit.
    try {const scene=await roomSceneReady;await scene?.playRound(result.round.event.outcome.number,result.round.id);} catch { /* Show the confirmed result below. */ }
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
  } finally {busy=false;renderDraft();}
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
    if(state.room.operator) roomSceneReady=import('./scene.mjs').then(({mountRoomScene})=>mountRoomScene(state.room,{onTable:configureTable})).then(scene=>{
      roomScene=scene;roomScene?.setRoundActive(Boolean(busy||pending));
      if(!busy&&state.rounds[0])roomScene?.showOutcome(state.rounds[0].event.outcome.number,state.rounds[0].id);
      return scene;
    }).catch(()=>{
      $('scene-status').textContent='Rummets media är inte tillgängliga just nu. Du kan spela vid bordet ändå.';
    });
  } catch(error) {
    message(errorText[error.message] ?? 'Rummet kunde inte öppnas. Ladda om sidan och försök igen.',true);
    if(error.status===401) $('login').hidden=false;
  }
}
$('login').href='/player-login?returnTo='+encodeURIComponent(location.pathname+location.search);
function openOption(id){$('more').close();$(id).showModal();}
$('show-rules').addEventListener('click',()=>openOption('rules'));
$('show-inside').addEventListener('click',()=>openOption('inside'));
$('undo').addEventListener('click',()=>{draft=undo.pop()??new Map();renderDraft();});
$('clear').addEventListener('click',()=>{undo.push(new Map(draft));draft=new Map();$('more').close();message('Satsningarna är rensade.');renderDraft();});
$('rebet').addEventListener('click',()=>{
  $('more').close();
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
buildBoard();renderDraft();void init();
