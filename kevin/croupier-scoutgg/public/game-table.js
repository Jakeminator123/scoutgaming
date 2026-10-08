import { DEAL_CONTACT } from './card-table-layout.js';
import { createRoundClock } from './round-clock.js';
import { firstFaceTime } from './card-face-projection.js';
import { cardsIn, total, planDraws, outcomeSpeech } from './game-events.js';
import { createGameCards } from './game-cards.js';
import { boxLabel } from './box-label.js';

const $ = s => document.querySelector(s);
const money = n => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const emptyBets = () => Array.from({ length: 7 }, () => ({ main: 0, pp: 0, tp: 0 }));
const messages = { 'Insufficient balance': 'Demosaldot räcker inte.', 'Table changed; reload to resume': 'Bordet ändrades i en annan flik. Läget har hämtats igen.' };

export function createGameTable({ manifest, boxes, play, onBusy, unlock, audio, isReady = () => true }) {
  const cards = createGameCards($('#gameCards'), manifest);
  let state = null, round = null, draft = emptyBets(), visible = new Set(), revealed = false;
  let busy = false, paid = false, chip = 5, focusHand = null, notice = '', preview = false;
  const lastLine = new Map();
  const betHistory = [];
  let lastReturn = null, lastTick = null;
  const clock = createRoundClock({ seconds:20, onExpire: () => {
    if (!$('#autoTimeout').checked || round || preview || paid || busy || !isReady()) return;
    const button=$('#dealNow'); if(!button.disabled && !button.closest('[hidden]'))button.click();
  }});
  function updateTimer() {
    const betting = !!state && !round && !busy && !preview && !paid;
    const ready = betting && isReady() && !document.hidden;
    clock.set(betting && stake() ? 'bets' : null);
    clock.pause(!ready);
    const value=clock.tick(),el=$('#roundTimer');
    // Expiry can start a deal synchronously; read the current state after tick.
    el.hidden=!state || !!round || busy || preview || paid;
    el.style.setProperty('--progress',String(value?.fraction ?? 1));
    el.dataset.urgent=String(!!value && value.seconds<=5 && !value.paused);
    el.dataset.waiting=String(!value || value.paused);
    $('#timerValue').textContent=value ? value.seconds : '20';
    $('#timerLabel').textContent=!ready ? 'Paus under klipp' : !value ? 'Lägg din första insats' : value.expired ? 'Redo för utdelning' : !$('#autoTimeout').checked ? 'Tid kvar · du väljer själv' : 'Till utdelning';
    const tick=!el.hidden && value && !value.paused && value.seconds>0 && value.seconds<=5 ? `${value.key}:${value.seconds}` : null;
    if(tick && tick!==lastTick) audio?.play('timer');
    lastTick=tick;
  }
  setInterval(updateTimer,100);
  const stake = () => draft.reduce((s,b) => s+b.main+b.pp+b.tp, 0);
  const active = () => round?.phase === 'decisions' ? round.hands[round.active] : null;
  async function request(op, extra = {}) {
    const payload = { op, ...extra, ...(op === 'state' ? {} : { version: state.version, requestId: crypto.randomUUID() }) };
    let response;
    // Retry a lost response using the SAME key: never debit or draw twice.
    for (let attempt = 0; attempt < 2; attempt++) {
      try { response = await fetch('/api/table', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); break; }
      catch (e) { if (attempt) throw e; }
    }
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? 'Bordet kunde inte nås.');
    state = body;
    return body;
  }
  function refresh() {
    updateTimer();
    const live = active();
    const siblings = live ? round.hands.filter(h=>h.box===live.box) : [];
    const handLabel = siblings.length > 1 ? ` · hand ${siblings.indexOf(live)+1} av ${siblings.length}` : '';
    boxes.setPreview(preview);
    boxes.setEnabled(Boolean(state) && !busy && (preview || !round));
    boxes.setBets(round ? Array.from({length:7}, (_,i) => {
      const hands = round.hands.filter(h => h.box === i);
      return { main: hands.reduce((s,h) => s+h.stake, 0), pp: hands[0]?.pp ?? 0, tp: hands[0]?.tp ?? 0 };
    }) : draft, live?.box);
    $('#demoBalance').textContent = state ? money(state.balance) : '…';
    $('#refillDemo').disabled = !state || busy;
    $('#totalStake').textContent = money(round ? round.hands.reduce((s,h)=>s+h.stake+h.pp+h.tp+(h.insured||0),0) : stake());
    $('#lastReturn').textContent = lastReturn == null ? '—' : money(lastReturn);
    $('#shoeCount').textContent = state?.shoe ? `${state.shoe.remaining} kort i skon` : '8 kortlekar';
    $('#gameStatus').textContent = notice || (preview ? 'Klippgranskning · välj en plats' : !state ? 'Ansluter till spelbordet…' : !round ? 'Välj en marker och satsa på duken' : busy ? 'Astrid delar ut…' : paid ? 'Rundan är klar' : live ? `Plats ${boxLabel(live.box)}${handLabel} · ${total(live.cards)} poäng` : round.phase === 'insurance' ? 'Vill du ta försäkring?' : 'Rundan avslutas');
    $('#gameControls').dataset.phase = preview ? 'preview' : !round ? 'bets' : paid ? 'settled' : round.phase;
    $('#betControls').hidden = !!round || preview;
    $('#betActions').hidden = !!round || preview;
    $('#actionControls').hidden = !live || preview || busy;
    $('#insuranceControls').hidden = round?.phase !== 'insurance' || preview || busy;
    $('#nextRound').hidden = !paid || preview;
    $('#dealNow').disabled = busy || !state || !stake();
    $('#clearBets').disabled = busy || !stake();
    $('#allSeats').disabled = busy || !state || !!round;
    $('#undoBet').disabled=busy || !betHistory.length || !!round;
    $('#doubleBets').disabled=busy || !stake() || !!round;
    for(const b of document.querySelectorAll('[data-chip]'))b.disabled=busy || !!round;
    $('#nextRound').disabled = busy;
    $('#previewMode').disabled = busy || Boolean(round && !paid);
    for (const b of document.querySelectorAll('[data-action]')) {
      const extra = ['double','split'].includes(b.dataset.action) ? live?.stake ?? 0 : 0;
      b.disabled = busy || !round?.legalActions.includes(b.dataset.action) || extra > state.balance;
    }
    const insuranceCost=round?.hands.reduce((s,h)=>s+h.stake/2,0) ?? 0;
    $('#insuranceCost').textContent=money(insuranceCost);
    $('#insuranceHint').textContent=insuranceCost>(state?.balance??0) ? 'Demosaldot räcker inte för försäkring.' : 'Halva huvudinsatsen · gäller dina platser';
    for (const b of document.querySelectorAll('[data-insurance]')) b.disabled = busy || (b.dataset.insurance === 'yes' && (round?.hands.reduce((s,h)=>s+h.stake/2,0) ?? Infinity) > (state?.balance ?? 0));
    $('#handList').replaceChildren();
    if (round && !busy) round.hands.forEach((h,i) => {
      const el = document.createElement('button');
      const same = round.hands.filter(x=>x.box===h.box);
      el.textContent = `Plats ${boxLabel(h.box)}${same.length>1 ? ` · hand ${same.indexOf(h)+1}` : ''}: ${h.cards.map(c=>c.r+c.s).join(' ')} · ${total(h.cards)}${h.result != null ? ` · tillbaka ${money(h.result+h.sideReturn)}` : ''}`;
      el.className = 'hand-summary' + (i === round.active && live ? ' current' : '');
      el.addEventListener('click',()=>{focusHand=i;cards.render(round,visible,revealed,focusHand);});
      $('#handList').append(el);
    });
    cards.render(preview ? null : round, visible, revealed, focusHand);
  }
  async function speech(event) {
    const variants = manifest.repliker.filter(c => c.event === event);
    const pool = variants.filter(c=>c.id!==lastLine.get(event));
    const clip = (pool.length ? pool : variants)[Math.floor(Math.random()*(pool.length || variants.length))];
    if (!clip) return;
    lastLine.set(event,clip.id);
    await play({ ...clip, sound: true, kind: 'game' });
  }
  async function steps(before, opening = false) {
    for (const step of planDraws(before, round, opening)) {
      if (step.kind === 'speech') { await speech(step.event); continue; }
      if (step.kind === 'reveal') {
        const flip=manifest.deal.find(c=>c.id==='deal_flip');
        if(flip)try{await play({...flip,kind:'game',sound:false,onStart:()=>cards.beginDeal('dealer',round.holeDraw,'flip'),onFrame:time=>{cards.advanceDeal(time);if(time>=firstFaceTime('flip')){revealed=true;refresh();}}});}finally{cards.endDeal();}
        revealed=true; refresh(); continue;
      }
      const clip = manifest.deal.find(c=>c.id===step.clipId);
      focusHand = round.hands.findIndex(h=>h.cards.some(c=>c.shoeDraw===step.shoeDraw));
      let landedSound=false;
      const land = () => { if (!visible.has(step.shoeDraw)) { visible.add(step.shoeDraw); refresh(); } };
      notice = step.seat === 'dealer' ? 'Astrids kort' : `Kort till plats ${step.seat}`;
      refresh();
      try {
        await play({ ...clip, kind: 'game', sound: false,
          onStart: () => cards.beginDeal(step.seat, step.shoeDraw, step.track??step.seat),
          onFrame: time => {
            cards.advanceDeal(time);
            if (time + 1e-6 >= firstFaceTime(step.track??step.seat)) land();
            if(!landedSound && time + 1e-6 >= DEAL_CONTACT[step.track??step.seat].contact){landedSound=true;audio?.play('land');}
          } });
        land();
      } finally { cards.endDeal(); }
    }
    focusHand = null; notice = ''; refresh();
  }
  async function settle() {
    if (round.phase !== 'settled') return;
    const returned = round.hands.reduce((s,h)=>s+h.result+h.sideReturn,0);
    await speech(outcomeSpeech(round));
    await request('collect'); paid = true; lastReturn=returned;
    if(returned>0)audio?.play(returned>round.hands.reduce((s,h)=>s+h.stake+h.pp+h.tp+(h.insured||0),0) ? 'bigwin' : 'win');
    notice = `Rundan klar · tillbaka ${money(returned)}`;
  }
  async function perform(job) {
    if (busy) return;
    unlock(); busy = true; notice = ''; onBusy(true); refresh();
    try { await job(); }
    catch (error) {
      notice = messages[error.message] ?? error.message; audio?.play('error');
      // After a lost/stale response, recover truth from the server, never a local guess.
      try { await request('state'); round=state.round; paid=false; visible=new Set(cardsIn(round).map(x=>x.card.shoeDraw)); if(round?.holeDraw)visible.add(round.holeDraw); revealed=round?.dealer.length>1; }
      catch { notice='Ingen kontakt med spelmotorn. Försök ansluta igen.'; $('#reconnectTable').hidden=false; }
    } finally { busy=false; onBusy(false); refresh(); }
  }
  function changeBets(change) {
    if(busy || !state || round || preview)return;
    const next=draft.map(b=>({...b})); change(next);
    if(next.some(b=>Object.values(b).some(v=>v>2000)))notice='Max $2,000 per insats.';
    else if(next.reduce((s,b)=>s+b.main+b.pp+b.tp,0)>state.balance)notice='Demosaldot räcker inte.';
    else {betHistory.push(draft);draft=next;notice='';unlock();audio?.play('chip');}
    refresh();
  }
  function select(id, field = 'main') {
    if (busy || !state || round || preview) return;
    const index = Number(id.slice(-1))-1;
    if(!draft[index] || !['main','pp','tp'].includes(field))return;
    if (field !== 'main' && !draft[index].main) { notice='Lägg en huvudinsats först.'; refresh(); return; }
    changeBets(next=>{next[index][field]+=chip;});
  }
  $('#dealNow').addEventListener('click',()=>perform(async()=>{
    await request('start',{bets:draft}); round=state.round; paid=false;visible.clear();revealed=false;
    refresh(); await speech('goodluck'); await steps(null,true);
    if (round.hands.some(h=>h.sideReturn>0)) await speech('sidebet');
    if (round.phase==='insurance') await speech('insurance');
    await settle();
  }));
  for(const b of document.querySelectorAll('[data-action]')) b.addEventListener('click',()=>perform(async()=>{
    const before=round;
    await request('act',{action:b.dataset.action});round=state.round;audio?.play(b.dataset.action==='stand'?'stand':b.dataset.action==='hit'?'click':'chip');refresh();
    if(b.dataset.action==='double') await speech('double');
    await steps(before); await settle();
  }));
  for(const b of document.querySelectorAll('[data-insurance]')) b.addEventListener('click',()=>perform(async()=>{
    const before=round;await request('insurance',{take:b.dataset.insurance==='yes'});round=state.round;await steps(before);await settle();
  }));
  for(const b of document.querySelectorAll('[data-chip]')) b.addEventListener('click',()=>{
    unlock();audio?.play('click');chip=Number(b.dataset.chip);for(const other of document.querySelectorAll('[data-chip]'))other.setAttribute('aria-pressed',String(other===b));
  });
  $('#undoBet').addEventListener('click',()=>{if(busy||round||!betHistory.length)return;draft=betHistory.pop();notice='';audio?.play('click');refresh();});
  $('#clearBets').addEventListener('click',()=>changeBets(next=>next.forEach(b=>{b.main=b.pp=b.tp=0;})));
  $('#doubleBets').addEventListener('click',()=>changeBets(next=>next.forEach(b=>{for(const key of ['main','pp','tp'])b[key]*=2;})));
  $('#allSeats').addEventListener('click',()=>changeBets(next=>next.forEach(b=>{b.main+=chip;})));
  $('#nextRound').addEventListener('click',()=>perform(async()=>{
    round=null;paid=false;draft=emptyBets();betHistory.length=0;audio?.play('gather');visible.clear();revealed=false;refresh();await speech('placebets');
  }));
  $('#previewMode').addEventListener('change',e=>{preview=e.target.checked;refresh();});
  $('#refillDemo').addEventListener('click',()=>perform(async()=>{
    await request('refill'); notice='Demosaldot påfyllt med $1 000'; audio?.play('chip');
  }));
  async function init() {
    await perform(async()=>{
      await request('state'); round=state.round;visible=new Set(cardsIn(round).map(x=>x.card.shoeDraw));
      if(round?.holeDraw)visible.add(round.holeDraw);revealed=round?.dealer.length>1;
      $('#reconnectTable').hidden=true;
      if(round?.phase==='settled')await settle();
    });
  }
  $('#reconnectTable').addEventListener('click',init);
  // Initial state loading does not count as a user audio-unlock gesture.
  request('state').then(()=>{
    round=state.round;visible=new Set(cardsIn(round).map(x=>x.card.shoeDraw));
    if(round?.holeDraw)visible.add(round.holeDraw);revealed=round?.dealer.length>1;
    refresh();
    if(round?.phase==='settled') perform(settle);
  }).catch(()=>{notice='Ingen kontakt med spelmotorn.';$('#reconnectTable').hidden=false;refresh();});
  refresh();
  return { select, sourceStarted: id => cards.sourceStarted(id), get preview(){return preview;}, get busy(){return busy;}, get playing(){return Boolean(round&&!paid);}, speech };
}
