import {presentationState,themeChips,chipLabel} from './game-presentation.js';
import { boxResults,createWinTracker,currentReceipt,mainResults,mainWin,showWinToast,visibleSideResults } from './win-feedback.js';
import { createGameCards } from './game-cards.js';
import { cardsIn,total } from './game-events.js';
import { remarkForAction,createWinStreak,tableTalkFor } from './dealer-remarks.js';
import { firstFaceTime } from './card-face-projection.js';
import { DEAL_CONTACT } from './card-table-layout.js';
import { dealer,dealerRoom,readyVariant,variantOffset } from './dealers.js';
import { boxLabel } from './box-label.js';
const $=s=>document.querySelector(s);
const money=n=>`$${Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export const tableSession=new URLSearchParams(location.search).get('session')||dealerRoom(dealer.id);

export function createSharedGameTable({manifest,boxes,playNow,unlock,audio,onEnter,onBusy,prepareMedia=async()=>{},warmPlan=()=>{},preloadNext=()=>{},remark=()=>{},speak=()=>false,lips=null,atRest=()=>true,hold=()=>{}}) {
  const streak=createWinStreak();let quietTimer=null;
  const cards=createGameCards($('#gameCards'),manifest);
  let state=null,offset=0,sending=false,polling=false,notice='',chip=5,entered=false,entryStep=1,autoEntered=false;
  let studioLanguage=new URLSearchParams(location.search).get('lang');
  let soundedSettlement=null, stateRenderKey='', clockKey='', clockProgress=-1, renderedBusy=false;
  let sideSoundPending=false;
  const trackWins=createWinTracker(win=>{showWinToast(win.title,win.profit,win.profit>=win.stake*10);sideSoundPending=true;});
  let preparing=false,mediaNotice='',mediaPromise=null,mediaKey='';
  const mediaSeats=()=>[...new Set([...selected,...own(),...(state?.owners??[]).flatMap((p,i)=>p?[i]:[])])].sort((a,b)=>a-b);
  async function ensureMedia() {
    const seats=mediaSeats(),language=state?.language??'en',key=`${language}:${seats.join(',')}`;
    if(mediaPromise&&key===mediaKey)return mediaPromise;
    mediaKey=key;preparing=true;
    mediaPromise=prepareMedia(seats,(done,total)=>{if(key!==mediaKey)return;mediaNotice=done===total?'':`Preparing full-quality video · ${done}/${total}`;render();},language).then(()=>{if(key===mediaKey){preparing=false;mediaNotice='';render();}return true;},()=>{if(key===mediaKey){preparing=false;mediaPromise=null;mediaNotice='Video download interrupted. Tap again to retry.';render();}return false;});
    return mediaPromise;
  }
  let selected=new Set(),stepKey=null,currentDeal=null,lastTick=null,sourceFrame=0,renderKey='';
  const time=()=>Date.now()+offset;
  // the table waits for the deal until its last card has landed (plan.turnAt): the next player decides while the dealer
  // finishes the move, and a card he asks for starts after it (server/shared-table.mjs)
  const busy=()=>Boolean(state?.plan&&time()<(state.plan.turnAt??state.plan.endAt));
  // Whose turn the table shows: while the dealer is still dealing a card (a hit that busts, say), the hand that
  // drew it stays highlighted; the next box lights up only once that card is on the felt (Kevin's play test).
  const shownTurn=round=>busy()&&state.plan.before?.hands?state.plan.before:round;
  const own=()=>state?.me?.seats??[];
  const mine=()=>state?.players.find(p=>p.id===state?.me?.id);
  const ownStake=()=>own().reduce((n,i)=>n+Object.values(state.bets[i]).reduce((a,b)=>a+b,0),0);
  const playerName=id=>state?.players.find(p=>p.id===id)?.name||'Player';
  const ownerOfHand=()=>state?.round?.hands[state.round.active]&&state.owners[state.round.hands[state.round.active].box];
  // The table's limits come from the server (Table Studio presets): chip rack, header, refill and stacks follow them.
  let limitsKey='',chipPicked=false;
  const whole=n=>`$${Number(n).toLocaleString('en-US')}`;
  function applyLimits(L) {
    if(!L)return;const key=JSON.stringify(L);if(key===limitsKey)return;limitsKey=key;
    const rack=document.querySelector('.chip-picker');
    if(rack&&[...rack.querySelectorAll('[data-chip]')].map(b=>Number(b.dataset.chip)).join()!==L.chips.join())
      rack.replaceChildren(...L.chips.map(v=>{const b=document.createElement('button');b.type='button';b.dataset.chip=v;b.setAttribute('aria-label',`Chip ${v} dollars`);b.textContent=chipLabel(v);return b;}));
    if(!chipPicked||!L.chips.includes(chip))chip=L.chips[0];   // a table starts on its smallest chip
    for(const b of document.querySelectorAll('.chip-picker [data-chip]'))b.setAttribute('aria-pressed',String(Number(b.dataset.chip)===chip));
    themeChips();boxes.setChipValues?.(L.chips);
    $('#refillDemo').textContent=`+ ${whole(L.refill)} demo`;
    const line=document.querySelector('.brand-lockup p');if(line)line.textContent=`${L.tableName??`${L.name} Blackjack`} · ${whole(L.min)} – ${whole(L.max)} · ${dealer.name}`;
    const kicker=document.querySelector('.gate-kicker');if(kicker)kicker.textContent=`SCOUT / GAMING · ${L.name.toUpperCase()}`;
  }
  function accept(next,sentAt=Date.now()) {
    if(state&&(next.version<state.version||(next.version===state.version&&next.serverNow<state.serverNow)))return;
    const previous=state;
    offset=next.serverNow-(sentAt+Date.now())/2;state=next;presentationState(next);applyLimits(next.limits);
    if(entered&&previous?.me?.seats.length&&!next.me?.seats.length){
      entered=false;selected.clear();entryStep=1;notice='You left the table. Your seats are available.';
      $('#gate').classList.remove('off');document.querySelector('.app').classList.remove('seated');
    }
    if(next.plan?.id!==previous?.plan?.id)warmPlan(next.plan);
    if(entered&&next.language!==previous?.language)ensureMedia();
    // A Table Studio link (/t/<slug>) sets the table's language once, the first time it is free to change.
    if(entered&&studioLanguage&&!sending&&next.phase==='bets'&&next.language!==studioLanguage&&(next.availableLanguages??[]).includes(studioLanguage)&&!next.bets.some(b=>Object.values(b).some(v=>v>0))){
      const language=studioLanguage;studioLanguage=null;setTimeout(()=>request('language',{language}));
    }
    const receipt=state.me?.lastSettlement;
    if(receipt&&receipt.roundId!==soundedSettlement){
      soundedSettlement=receipt.roundId;
      // A refreshed page must not celebrate an old round or another player's win.
      const win=mainWin(receipt);
      if(entered&&previous?.phase==='round'&&state.phase==='settled'&&win){
        showWinToast(win.title,win.profit,win.big);audio?.play(win.big?'bigwin':'win');
      }
      if(entered&&previous?.phase==='round'&&state.phase==='settled')remark(streak(Boolean(win)));
      // Serhiy: two boxes with different results get their own box-by-box line from the dealer
      // after the table's clip (the server decides whether the results are mixed).
      if(entered&&previous?.phase==='round'&&state.phase==='settled'&&(receipt.hands?.length??0)>1)window.dispatchEvent(new CustomEvent('dealer:round-result',{detail:{roundId:receipt.roundId}}));
    }
    // Table talk between the game's own lines (only the alternative dealer has these takes).
    if(entered&&previous){
      const pick=e=>`${e}_${1+Math.floor(Math.random()*3)}`;
      const myTurn=x=>x?.phase==='round'&&x.round?.phase==='decisions'&&x.owners[x.round.hands[x.round.active]?.box]===x.me?.id;
      if(previous.phase!=='bets'&&state.phase==='bets'){
        remark(tableTalkFor(state.players?.length??0)??pick('placebets'));   // with company at the table, sometimes his table talk instead
        clearTimeout(quietTimer);quietTimer=setTimeout(()=>{if(state?.phase==='bets'&&!ownStake())remark(pick('chatter1'));},18000);
      }
      if(myTurn(state)&&(!myTurn(previous)||previous.round.active!==state.round.active)&&Math.random()<.35)remark(pick('chatter2'));
    }
    if(!entered&&entryStep===1&&!selected.size&&state.me?.seats.length)selected=new Set(state.me.seats);
    // Feedback #1: a player who still holds boxes (e.g. after switching dealer, or a reload) goes
    // straight back to the table instead of through the join gate again. No greeting; sound
    // unlocks on their next tap as usual.
    if(!entered&&!autoEntered&&state.me?.seats.length&&!state.me.leaving){
      autoEntered=true;entered=true;$('#gate').classList.add('off');document.querySelector('.app').classList.add('seated');
      void ensureMedia();queueMicrotask(()=>{render();syncPlayback();});
    }
    // John, 9 Oct: no door at all. A new visitor is seated at once (free box, saved or guest name), the same as
    // pressing Play; once per page load, so someone who left the table is not pulled back. A full table or a taken
    // name leaves the gate up as before.
    // The gate starts hidden (index.html), so it never flashes before this first state; it shows only when a
    // visitor isn't simply seated (the public room, a full table, someone who already has a name here, a failed join).
    else if(!entered&&!autoEntered){
      autoEntered=true;
      // Also someone known here without a box (left, or timed out since): John opening his table again still saw the door.
      // Only a studio table (?table=, the link John shares): on the public room every idle tab would take a box,
      // so there the Play step stays and spectators can watch.
      if(studioTableLink&&!state.me?.seats.length&&!state.me?.leaving&&entryStep===1&&!sending&&seatsToJoin().length)queueMicrotask(joinTable);
      else $('#gate').classList.remove('off');
    }
    const nextRenderKey=JSON.stringify({...next,serverNow:0,notice});
    if(nextRenderKey!==stateRenderKey){stateRenderKey=nextRenderKey;render();}
  }
  async function fetchState(){
    if(document.hidden||polling||sending)return;polling=true;
    try{const sentAt=Date.now();const r=await fetch('/api/table',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:tableSession,op:'state'})});const b=await r.json();if(!r.ok)throw new Error(b.error);if(notice.startsWith('Connection lost.'))notice='';accept(b,sentAt);$('#reconnectTable').hidden=true;}
    catch{notice='Connection lost. Reconnecting to your table.';$('#reconnectTable').hidden=false;render();}
    finally{polling=false;}
  }
  async function request(op,extra={}) {
    if(sending||!state)return false;sending=true;notice='';render();
    const payload={session:tableSession,op,version:state.version,requestId:crypto.randomUUID(),...extra};
    try {
      let response,sentAt;
      for(let attempt=0;attempt<2;attempt++){try{sentAt=Date.now();response=await fetch('/api/table',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});break;}catch(e){if(attempt)throw e;}}
      const body=await response.json();if(!response.ok)throw new Error(body.error||'Unable to reach the table');
      accept(body,sentAt);return true;
    } catch(e){notice=e.message||'Unable to reach the table';audio?.play('error');return false;}
    finally{sending=false;render();}
  }
  // Nickname is asked once and remembered in this browser (feedback #2).
  const NICK='croupier-nickname';
  const savedNick=()=>{try{return localStorage.getItem(NICK)?.trim()||'';}catch{return '';}};
  // One click to play (John, 9 Oct: "minimise the steps"): no box picked means the first free one from the middle,
  // no saved nickname means a guest name. Picking boxes and a nickname stay possible, just not required.
  const freeSeat=()=>{const i=[3,2,4,1,5,0,6].find(i=>state&&!state.owners[i]);return i==null?[]:[i];};
  const seatsToJoin=()=>selected.size?[...selected].sort():freeSeat();
  const guestName=()=>`Guest ${100+Math.floor(Math.random()*900)}`;
  const studioTableLink=new URLSearchParams(location.search).has('table');
  function renderSeats() {
    for(const i of selected)if(state?.owners[i]&&state.owners[i]!==state?.me?.id)selected.delete(i);
    $('#gate').dataset.step=entryStep===1?'boxes':'name';
    const seats=seatsToJoin();
    $('#selectedBoxes').textContent=selected.size?`Your boxes: ${[...selected].map(boxLabel).sort((a,b)=>a-b).join(', ')}`:seats.length?`You sit at box ${boxLabel(seats[0])}`:'The table is full';
    $('#entryBoxes').hidden=entryStep!==1;$('#entryName').hidden=entryStep!==2;
    $('#entryBack').hidden=entryStep!==2;$('#changeName').hidden=entryStep!==1;$('#changeName').textContent=savedNick()?'Change nickname':'Choose nickname';
    $('#enter').textContent=sending?'Joining...':entryStep===1?(savedNick()?`Play as ${savedNick()}`:'Play'):'Join table';
    $('#enter').disabled=sending||!state||!seats.length;
    // the one click is taken: show it working while the video loads, and don't take a second one
    if(preparing){$('#enter').textContent='Preparing video…';$('#enter').disabled=true;}
    $('#entryError').textContent=mediaNotice||notice||(state?.pausedUntil>time()?'Your 24-hour demo break is active.':'');
  }
  function renderRoster() {
    const list=$('#playersAtTable');list.replaceChildren();
    for(const p of state?.players??[]) {
      const tag=document.createElement('span');tag.className='player-tag';tag.dataset.online=String(p.online);tag.dataset.mine=String(p.id===state.me?.id);
      tag.textContent=`${p.name}${p.id===state.me?.id?' (you)':''} · ${p.seats.map(boxLabel).sort((a,b)=>a-b).join(', ')}${p.online?'':' · reconnecting'}`;list.append(tag);
    }
    if(!list.children.length){const text=document.createElement('span');text.textContent='Be the first to join';list.append(text);}
    $('#here').textContent=(state?.players.filter(p=>p.online).map(p=>p.name).join(' · ')||'No players yet');
    boxes.setPlayers?.(state?.players??[],state?.me?.id);
  }
  function drawCards() {
    if(!state)return;
    const plan=state.plan,now=time();
    const round=state.round;
    let visible=new Set(cardsIn(plan&&now<plan.endAt?plan.before:round).map(x=>x.card.shoeDraw));
    let revealed=Boolean((plan&&now<plan.endAt?plan.before:round)?.dealer.length>1);
    if((plan&&now<plan.endAt?plan.before:round)?.holeDraw)visible.add((plan&&now<plan.endAt?plan.before:round).holeDraw);
    if(plan)for(const s of plan.steps){
      if(s.kind==='reveal'&&now>=s.startAt){const elapsed=currentDeal?.shoeDraw===s.shoeDraw&&currentDeal?.kind===s.kind?sourceFrame:(now-s.startAt)/1000-variantOffset(readyVariant(plan,s),s.track);if(!s.clip||elapsed>=firstFaceTime(s.track??'flip'))revealed=true;}
      if(s.kind==='deal') {
        // Not adopted yet (a plan that arrived late): count from the deal take too, past a ready dealer's in-transition.
        const elapsed=currentDeal?.shoeDraw===s.shoeDraw&&currentDeal?.kind===s.kind?sourceFrame:(now-s.startAt)/1000-variantOffset(readyVariant(plan,s),s.track);
        if(elapsed>=firstFaceTime(s.track??s.seat))visible.add(s.shoeDraw);
      }
    }
    trackWins(state,visible,entered);boxes.setSideAwards?.(visibleSideResults(state,visible).map(r=>({...r,animate:entered})));
    boxes.setMainResults?.(round?.phase==='settled'&&!(plan&&now<plan.endAt)?mainResults(round,state.roundId).map(r=>({...r,animate:entered})):[]);
    if(sideSoundPending){sideSoundPending=false;audio?.play('bigwin');}
    // The old text row is hidden; win toasts and the chip piles carry feedback.
    const focus=currentDeal?round?.hands.findIndex(h=>h.cards.some(c=>c.shoeDraw===currentDeal.shoeDraw)):null;
    const shown=shownTurn(round),key=`${state.version}:${[...visible].join(',')}:${revealed}:${focus}:${shown!==round}`;
    if(key!==renderKey){cards.render(shown===round?round:{...round,active:shown.active,phase:shown.phase},visible,revealed,focus);renderKey=key;}
  }
  function render() {
    renderSeats();renderRoster();if(!state)return;
    const b=busy(),me=state.me,round=state.round,ready=mine()?.ready,paused=state.pausedUntil>time();
    renderedBusy=b;
    $('#leaveTable').hidden=!entered;$('#leaveTable').disabled=sending||Boolean(me?.leaving);
    $('#leaveTable').textContent=me?.leaving?'Leaving after hand…':'Leave table';
    $('#pauseDemo').disabled=sending||paused;
    $('#pauseDemo').textContent=paused?'Break active':'Take a break';
    const turn=!me?.leaving&&round?.phase==='decisions'&&ownerOfHand()===me?.id&&state.phase==='round';
    const betting=entered&&state.phase==='bets'&&!paused;
    const language=$('#dealerLanguage');
    language.value=state.language??'en';
    // Emil 11 Oct: only the languages this dealer speaks are offered: his recorded lines (Dragge, Paow), Astrid's
    // recorded languages (no Swedish), English only for a dealer without a voice yet (Mårten).
    const spoken=dealer.lines===undefined?(state.availableLanguages??['en']).filter(l=>l!=='sv'&&l!=='pt'&&l!=='ko'):dealer.lines??['en'];
    for(const option of language.options){const ok=(state.availableLanguages??['en']).includes(option.value)&&spoken.includes(option.value);option.disabled=!ok;option.hidden=!ok;}
    language.disabled=!entered||sending||preparing||paused||state.phase!=='bets'||state.bets.some(b=>Object.values(b).some(v=>v>0));
    $('#dealerLanguageHint').textContent=!entered?`Join the table to choose ${dealer.name}’s language.`:state.phase!=='bets'||state.deadline?'Available before placing bets in the next round.':'Shared by everyone at this table. Choose before placing bets.';
    const choosing=!$('#gate').classList.contains('off')&&entryStep===1;
    boxes.setPreview(false);boxes.setEnabled(choosing||betting&&!sending&&!ready);   // bets need no video: only "Deal now" waits for it
    boxes.setSelection(choosing,selected);boxes.setPlayers(state.players,me?.id);
    $('#gameControls').hidden=!entered||!$('#gate').classList.contains('off');
    boxes.setBets(round?Array.from({length:7},(_,i)=>{const h=round.hands.filter(h=>h.box===i);return{main:h.reduce((n,x)=>n+x.stake,0),pp:h[0]?.pp??0,tp:h[0]?.tp??0};}):state.bets,(t=>t?.phase==='decisions'?t.hands[t.active]?.box:-1)(shownTurn(round)));
    $('#demoBalance').textContent=me?money(me.balance):'0.00';$('#refillDemo').disabled=!me||sending||paused;
    // feedback #8: at a balance below the smallest chip, say so and make the refill the obvious next step
    const smallest=state.limits?.chips[0]??5,broke=!!me&&state.phase==='bets'&&me.balance<smallest&&!ownStake();
    document.querySelector('.table-wallet')?.classList.toggle('out-of-chips',broke);$('#refillDemo').classList.toggle('needed',broke);
    const stake=round?round.hands.filter(h=>own().includes(h.box)).reduce((n,h)=>n+h.stake+h.pp+h.tp+(h.insured||0),0):ownStake();
    $('#totalStake').textContent=money(stake);$('#lastReturn').textContent=me?.lastReturn==null?'-':money(me.lastReturn);$('#shoeCount').textContent=`${state.shoe.remaining} cards in the shoe`;
    $('#lastReturnLabel').textContent=state.phase==='round'?'Previous return':'Last return';
    $('#gameControls').dataset.phase=state.phase==='bets'?'bets':state.phase==='settled'?'settled':round?.phase;
    $('#gameStatus').textContent=(me?.boxesAfterRound&&state.phase!=='bets'&&!notice)?`Your new boxes (${me.boxesAfterRound.map(boxLabel).sort((a,b)=>a-b).join(', ')}) apply from the next round`:(broke&&!paused&&!notice)?`Out of chips. Tap + ${whole(state.limits?.refill??1000)} demo to keep playing.`:(paused?`Demo break until ${new Date(state.pausedUntil).toLocaleString()}. Existing hands can stand or time out.`:mediaNotice||notice)||(me?.leaving?'Finishing your hand automatically, then freeing your seats':b?`${dealer.name} is dealing`:state.phase==='settled'?'Round complete':state.phase==='bets'?ready?'Ready. Waiting for the table':'Choose a chip and place your bets':round?.phase==='insurance'?state.insuranceDue?'Would you like insurance?':'Waiting for insurance decisions':turn?`Your turn · box ${boxLabel(round.hands[round.active].box)} · ${total(round.hands[round.active].cards)}`:`${playerName(ownerOfHand())} is playing`);
    $('#betControls').hidden=!betting;$('#betActions').hidden=!betting;
    $('#actionControls').hidden=!turn||b||!entered;
    for(const btn of document.querySelectorAll('[data-action]'))btn.disabled=sending||b||(paused&&btn.dataset.action!=='stand')||!turn||!round.legalActions.includes(btn.dataset.action)||(['double','split'].includes(btn.dataset.action)&&round.hands[round.active].stake>me.balance);
    $('#insuranceControls').hidden=!state.insuranceDue||b||!entered||Boolean(me?.leaving);
    const cost=round?.hands.filter(h=>own().includes(h.box)).reduce((n,h)=>n+h.stake/2,0)??0;
    $('#insuranceCost').textContent=money(cost);$('#insuranceHint').textContent=cost>(me?.balance??0)?'Insufficient demo balance':'Half your main bets. Covers your boxes only.';
    for(const btn of document.querySelectorAll('[data-insurance]'))btn.disabled=sending||(btn.dataset.insurance==='yes'&&(paused||cost>(me?.balance??0)));
    $('#nextRound').hidden=state.phase!=='settled'||b||!entered;$('#nextRound').disabled=sending;
    $('#dealNow').textContent=ready?'Ready ✓':preparing?'Loading…':'Deal';$('#dealNow').disabled=sending||ready||preparing||!ownStake();
    // John 12 Oct: only the buttons that apply show (Undo/Clear/2x with a bet down, Repeat with a previous bet and none down).
    for(const id of ['clearBets','doubleBets','undoBet']){$('#'+id).hidden=!ownStake();$('#'+id).disabled=sending||ready;}
    $('#repeatBet').hidden=ownStake()>0||!me?.repeatable||state.phase!=='bets';$('#repeatBet').disabled=sending||ready;
    $('#allSeats').disabled=sending||ready||!own().length;
    for(const btn of document.querySelectorAll('[data-chip]'))btn.disabled=sending||ready;
    $('#changeSeats').disabled=sending;   // mid-round changes are queued for the next round (feedback #7)
    const list=$('#handList');list.replaceChildren();
    if(round&&!b)round.hands.forEach((h,i)=>{const row=document.createElement('div');row.className='hand-summary'+(i===round.active?' current':'');row.textContent=`${playerName(state.owners[h.box])} · box ${boxLabel(h.box)} · ${h.cards.map(c=>c.r+c.s).join(' ')}${state.phase==='settled'?` · main/insurance returned ${money(h.result)} · side returned ${money(h.sideReturn)}`:''}${h.pp||h.tp?` · PP ${money(h.pp)} / 21+3 ${money(h.tp)}: ${h.sideLabels.join(', ')||'lost'}${state.phase!=='settled'?` · side return ${money(h.sideReturn)} (paid at round end)`:''}`:''}`;list.append(row);});
    const receipt=currentReceipt(state);
    $('#roundResult').hidden=state.phase!=='settled'||!receipt||b;
    if(receipt){$('#roundResult').dataset.win=String(receipt.net>0);$('#roundNet').textContent=(receipt.net>0?'+':'')+money(receipt.net);$('#roundReturn').textContent=`Returned ${money(receipt.returned)} · staked ${money(receipt.staked)}`;
      const word={win:'Win',push:'Push',bust:'Bust',lose:'Lose'};
      $('#roundBoxes').replaceChildren(...boxResults(receipt).map(r=>{const li=document.createElement('li');li.dataset.outcome=r.outcome;
        li.textContent=`Box ${boxLabel(r.box)} · ${word[r.outcome]} · ${r.outcome==='push'?'stake back':(r.net>0?'+':'−')+money(Math.abs(r.net))}`;return li;}));}

    {const last=me?.lastSettlement;$('#lastReturn').title=last?`Last completed round: staked ${money(last.staked)}, returned ${money(last.returned)} including stakes, net ${money(last.net)}`:'Last completed round, including returned stakes';}
    if(receipt&&state.phase==='settled'){
      const row=document.createElement('div');row.className='hand-summary';row.textContent=`Your round: staked ${money(receipt.staked)} · returned ${money(receipt.returned)} · net ${money(receipt.net)}`;list.append(row);
    }
    drawCards();updateClock();onBusy?.(b||sending);
  }
  function updateClock() {
    const el=$('#roundTimer');
    const deciding=state?.phase==='round'&&!busy()&&['decisions','insurance'].includes(state.round?.phase);
    const hidden=!entered||!(state?.phase==='bets'||deciding);
    if(el.hidden!==hidden)el.hidden=hidden;
    if(hidden)return;
    const deadline=deciding?state.actionDeadline:state?.deadline;
    const duration=deciding?(state.actionMs??15000):20000;
    const remaining=deadline?Math.max(0,deadline-time()):duration;
    const seconds=Math.ceil(remaining/1000),progress=Math.round(Math.min(1,remaining/duration)*200)/200;
    if(progress!==clockProgress){clockProgress=progress;el.style.setProperty('--progress',String(progress));}
    const nextClockKey=`${seconds}:${deadline}:${deciding}:${ownerOfHand()}:${state?.round?.phase}`;
    if(nextClockKey===clockKey)return;clockKey=nextClockKey;
    el.dataset.urgent=String(!!deadline&&seconds<=5);el.dataset.waiting=String(!deadline);
    $('#timerValue').textContent=seconds;$('#timerLabel').textContent=deciding?'Decision':'Closes in';
    el.setAttribute('aria-label',deciding?'Time remaining to decide':'Time until dealing');
    const key=deadline&&seconds<=5&&seconds>0?`${deadline}:${seconds}`:null;if(key&&key!==lastTick&&entered)audio?.play('timer');lastTick=key;
  }
  // The table's talk track (state.talk, server/rorlig-lipsync.mjs): lines and answers spoken over the clips. Each starts on
  // the server clock and its mouth patches come from the lip-sync worker; speak() returns whether this viewer hears the
  // language the mouth was synced to. A flexible answer (said between rounds) starts here once the dealer rests: his idle
  // clips are this viewer's own, so it waits for the one playing to end, at most 6 s, and runs shifted by that wait.
  const spoken=new Map();
  const talking=()=>{const n=time();return (state?.talk??[]).some(t=>n<t.endAt+(t.flex?6300:300));};
  function syncTalk(now){
    for(const t of state?.talk??[]) {
      // every tick, not once: each clip of the plan clears the idle hold (playNow), and no idle may start under a line
      const shift=spoken.get(t.id)??0;
      if(!t.flex&&now<t.endAt)hold(t.endAt-now+300);
      else if(t.flex&&spoken.has(t.id)&&now-shift<t.endAt)hold(t.endAt-(now-shift)+300);
      if(spoken.has(t.id))continue;
      if(t.flex){
        if(now>=t.endAt+6000)continue;
        lips?.talk(t,false);
        if(now>=t.startAt-1500)hold(t.endAt-t.startAt+7000);
        if(now>=t.startAt&&(atRest()||now>=t.startAt+6000)){const shift=now-t.startAt;spoken.set(t.id,shift);lips?.talk(t,speak(t,0,t.endAt-t.startAt)!==false,shift);}
        continue;
      }
      if(now>=t.endAt)continue;
      lips?.talk(t,true);
      if(now>=t.startAt-40){spoken.set(t.id,0);lips?.talk(t,speak(t,Math.max(0,now-t.startAt),t.endAt-now)!==false);}
    }
    lips?.prune();
  }
  lips?.setClock(()=>time());
  function syncPlayback() {
    if(document.hidden)return;updateClock();if(!state||!entered)return;
    const now=time(),plan=state.plan;
    syncTalk(now);
    const step=plan?.steps.find(s=>s.clip&&now>=s.startAt&&now<s.endAt);
    const upcoming=plan?.steps.find(s=>s.clip&&s.startAt>now);
    if(upcoming&&upcoming.startAt-now<1200)preloadNext({...upcoming.clip,variant:readyVariant(plan,upcoming)});
    const key=step?`${plan.id}:${step.startAt}`:null;
    if(key!==stepKey) {
      stepKey=key;if(currentDeal){cards.endDeal();currentDeal=null;renderKey='';}
      if(step) {
        // A ready dealer's run variant may start with his in-transition: card timing counts from the deal take itself.
        const variant=readyVariant(plan,step),lead=variantOffset(variant,step.track);
        currentDeal=step.kind==='deal'||(step.kind==='reveal'&&step.clip)?step:null;sourceFrame=Math.max(0,(now-step.startAt)/1000)-lead;let landed=false;
        
        // fit: a ready dealer's take is shorter than the slot (timed on Astrid's): the player stretches it to the slot.
        playNow({...step.clip,variant,kind:'shared-game',fit:dealer.ready&&currentDeal?(step.endAt-step.startAt)/1000:null,startOffset:Math.max(0,(now-step.startAt)/1000), timelineTime:()=>Math.max(0,(time()-step.startAt)/1000),
          onStart:()=>{if(stepKey!==key)return;if(currentDeal)cards.beginDeal(step.seat,step.shoeDraw,step.track??step.seat);},
          onFrame:frame=>{if(stepKey!==key)return;frame-=lead;sourceFrame=frame;if(currentDeal){drawCards();cards.advanceDeal(frame);if(!landed&&frame>=DEAL_CONTACT[step.track??step.seat].contact){landed=true;audio?.play('land');}}},
        });
      }
      render();
    }else if(busy()!==renderedBusy)render();
    drawCards();
  }
  const joinTable=async(retry)=>{
    const quick=retry??(entryStep===1&&(savedNick()||guestName()));
    const name=quick||$('#playerName').value.trim();
    // Sit down at once (John: no waiting at the door). The clips load while the player bets;
    // "Deal now" waits for them, so the first deal never stalls.
    if(await request('join',{name,seats:seatsToJoin()})) {void ensureMedia();
      try{localStorage.setItem(NICK,state.me?.name??name);}catch{}
      entered=true;unlock();$('#gate').classList.add('off');document.querySelector('.app').classList.add('seated');
      onEnter?.(state.me.name);render();syncPlayback();
    // On a studio table a taken nickname never brings the door back: sit down once more under a guest name.
    }else if(quick&&!retry&&studioTableLink&&/name|already/i.test(notice))return joinTable(guestName());
    else if(quick&&/name|already/i.test(notice)){entryStep=2;$('#gate').classList.remove('off');$('#playerName').value=quick;render();$('#playerName').focus();}
    else $('#gate').classList.remove('off');
  };
  $('#enter').addEventListener('click',()=>joinTable());
  $('#playerName').addEventListener('keydown',e=>{if(e.key==='Enter')$('#enter').click();});
  $('#dealerLanguage').addEventListener('change',async e=>{unlock();if(await request('language',{language:e.target.value}))await ensureMedia();});
  $('#entryBack').addEventListener('click',()=>{entryStep=1;render();});
  $('#changeName').addEventListener('click',()=>{entryStep=2;$('#playerName').value=savedNick();render();ensureMedia();$('#playerName').focus();});
  $('#changeSeats').addEventListener('click',()=>{entryStep=1;selected=new Set(own());$('#playerName').value=state.me?.name??'';$('#gate').classList.remove('off');render();});
  // Emil (10): "Invite a friend" did nothing a seated player could see: its feedback went to the join gate, which is
  // hidden at the table. The button now shares (phone share sheet) or copies, and says so on itself.
  $('#copyTableLink').addEventListener('click',async()=>{const btn=$('#copyTableLink'),label=btn.dataset.label??=btn.textContent;
    const url=new URL(location.href);url.searchParams.set('session',tableSession);const link=url.href;
    const say=(text,ms=2200)=>{btn.textContent=text;clearTimeout(btn._t);btn._t=setTimeout(()=>{btn.textContent=label;},ms);};
    try{if(navigator.share&&matchMedia('(pointer:coarse)').matches){await navigator.share({title:document.title,text:'Join my blackjack table',url:link});say('Shared ✓');return;}}catch(e){if(e?.name==='AbortError')return;}
    try{await navigator.clipboard.writeText(link);say('Link copied ✓');}
    catch{try{const ta=Object.assign(document.createElement('textarea'),{value:link});ta.style.cssText='position:fixed;opacity:0';document.body.append(ta);ta.select();const ok=document.execCommand('copy');ta.remove();say(ok?'Link copied ✓':'Copy failed');if(!ok)window.prompt?.('Table link',link);}catch{say('Copy failed');}}});
  // One listener for the rack, so a rebuilt rack (other table limits) keeps working.
  document.querySelector('.chip-picker').addEventListener('click',e=>{const btn=e.target.closest('[data-chip]');if(!btn)return;chip=Number(btn.dataset.chip);chipPicked=true;unlock();audio?.play('click');for(const other of document.querySelectorAll('.chip-picker [data-chip]'))other.setAttribute('aria-pressed',String(other===btn));});
  for(const [id,op] of [['dealNow','ready'],['clearBets','clear'],['undoBet','undo'],['doubleBets','doubleBets'],['repeatBet','repeat'],['allSeats','allSeats'],['nextRound','next'],['refillDemo','refill']])$('#'+id).addEventListener('click',async()=>{unlock();if(await request(op,{chip})){audio?.play('chip');if(op==='refill'){notice=`Added ${whole(state?.limits?.refill??1000)} in demo funds`;render();}}});
  for(const btn of document.querySelectorAll('[data-action]'))btn.addEventListener('click',()=>{unlock();const r=state?.round,hand=r?.hands?.[r.active];request('act',{action:btn.dataset.action}).then(ok=>{if(ok)remark(remarkForAction(btn.dataset.action,hand?.cards));});});
  for(const btn of document.querySelectorAll('[data-insurance]'))btn.addEventListener('click',()=>{unlock();request('insurance',{take:btn.dataset.insurance==='yes'});});
  $('#leaveTable').addEventListener('click',()=>request('leave'));
  $('#pauseDemo').addEventListener('click',async()=>{if(confirm('Start a 24-hour demo break on this browser profile? New bets and refills will be blocked on every table. This break cannot be cancelled. Existing hands can stand or time out.'))await request('pause');});
  $('#reconnectTable').addEventListener('click',fetchState);
  $('#previewMode').disabled=true;$('#previewMode').closest('label').hidden=true;
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){stepKey=null;fetchState();syncPlayback();}});
  setInterval(fetchState,700);setInterval(syncPlayback,50);fetchState();
  return {select:async(id,field='main')=>{
    const seat=Number(id.slice(-1))-1;
    if(!$('#gate').classList.contains('off')) {
      if(entryStep!==1||field!=='main'||(state.owners[seat]&&state.owners[seat]!==state.me?.id))return;
      selected.has(seat)?selected.delete(seat):selected.add(seat);render();return;
    }
    unlock();void ensureMedia();if(await request('bet',{seat,field,chip}))audio?.play('chip');
  },
  // Emil 11 Oct (#9): the chat's name box renames you. Seated, it is the gate's own join with the boxes you hold
  // (boxesAfterRound first, so a box change waiting for the round end survives), under the server's name rules.
  // Not seated yet, it becomes the nickname Play uses.
  rename:async name=>{
    if(!state?.me?.seats.length){try{localStorage.setItem(NICK,name);}catch{}render();return name;}
    if(!await request('join',{name,seats:state.me.boxesAfterRound??state.me.seats}))return null;
    try{localStorage.setItem(NICK,state.me.name);}catch{}
    return state.me.name;
  },sourceStarted:id=>cards.sourceStarted(id),get busy(){return busy()||sending;},get playing(){return state?.phase==='round';},
    // How long the table surely leaves the screen alone (ms): none while a plan runs or a round is on (anyone may act),
    // the betting countdown while it runs, otherwise open-ended. A chat answer starts only if it ends within this.
    get talking(){return talking();},get quietMs(){if(busy()||sending||state?.phase==='round'||talking())return 0;return state?.phase==='bets'&&state.deadline?Math.max(0,state.deadline-time()):Infinity;},get preview(){return false;}};
}
