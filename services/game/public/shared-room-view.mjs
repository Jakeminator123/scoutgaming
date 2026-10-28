// Existing table DOM; all visible money, seats and controls come from a server snapshot.
import { BLACKJACK_COMPACT_QUERY } from '../../../packages/presentation/runtime/game-overlay-layout.mjs';
import { SEAT_COUNT, WINDOW_SIZE, crowding, primarySeat, seatWindow, tableProfileName, windowLabel } from './shared-room-layout.mjs';
import { installDecisionShortcuts } from './shared-room-shortcuts.mjs';
const money = value => new Intl.NumberFormat('sv-SE',{maximumFractionDigits:2}).format(value);
const $ = (document,id) => document.getElementById(id);
function button(document,text,action) {
  const node=document.createElement('button'); node.type='button'; node.textContent=text;
  node.addEventListener('click',action); return node;
}
export function createSharedRoomView({ document, onLayout = () => {}, signInHref = '/player-login' }) {
  const required=['scene','seats','chips','balance','total-bet','last-win','banner','deal-now','insurance','ins-yes','ins-no'];
  if(required.some(id=>!$(document,id)))throw new Error('shared_room_dom_unavailable');
  let actions,model,closed=false;
  const cleanups=[],listen=(node,handler)=>{if(!node)return;node.addEventListener('click',handler);cleanups.push(()=>node.removeEventListener('click',handler));};
  const scene=$(document,'scene'),seatsHost=$(document,'seats'),chipHost=$(document,'chips'),hud=$(document,'hud-bottom');
  const view=document.defaultView,compact=()=>Boolean(view?.matchMedia?.(BLACKJACK_COMPACT_QUERY).matches);
  const status=document.createElement('p');status.id='shared-room-status';status.className='local-presentation-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');scene.append(status);
  const notice=document.createElement('span');status.append(notice);
  // The status box is pointer-transparent (it overlays the table), so the retry
  // control lives in the clickable control bar instead of inside the message.
  // The seat controls share the top bar with the sound button, beside the title on a wide screen and below it on a phone.
  const extra=document.createElement('div');extra.id='shared-room-controls';extra.className='shared-room-controls';
  const topRight=$(document,'top-right');if(topRight)topRight.prepend(extra);else scene.append(extra);
  const retry=button(document,'Försök igen',()=>actions?.retry());retry.id='shared-room-retry';retry.className='shared-room-button';retry.hidden=true;extra.append(retry);
  // A lost connection shows a sign over the table. The last server state stays on screen meanwhile, and the
  // player resumes from the sign instead of reloading the page.
  const sign=document.createElement('div');sign.id='shared-room-connection';sign.className='shared-room-connection';sign.setAttribute('role','alert');sign.hidden=true;
  const signText=document.createElement('strong');signText.textContent='Anslutningen till bordet bröts.';sign.append(signText);scene.append(sign);
  const again=button(document,'Återanslut',()=>actions?.reconnect?.());again.id='shared-room-reconnect';again.className='shared-room-button shared-room-primary';again.hidden=true;sign.append(again);
  // K04 F8: an expired session links to the player's sign-in, which returns to this table (blackjack-entry.mjs).
  const signIn=document.createElement('a');signIn.id='shared-room-sign-in';signIn.className='shared-room-sign-in';signIn.href=signInHref;signIn.textContent='Logga in';signIn.hidden=true;extra.append(signIn);
  const leave=button(document,'Lämna platser',()=>actions?.dispatch('leave'));leave.className='shared-room-button';
  const next=button(document,'Nästa runda',()=>actions?.dispatch('next'));next.id='shared-room-next';next.className='shared-room-next';next.hidden=true;
  const picker=document.createElement('select');picker.setAttribute('aria-label','Välj eller lämna plats');picker.className='shared-room-select';
  const choose=()=>{const selected=Number(picker.value);if(picker.value!==''&&Number.isInteger(selected))actions?.dispatch('join',{seat:selected});picker.value='';};
  picker.addEventListener('change',choose);cleanups.push(()=>picker.removeEventListener('change',choose));
  // A phone shows three boxes at a time; this chooses which three. A wide screen shows all seven and no chooser (styles.css).
  const focus=document.createElement('select');focus.id='shared-room-window';focus.className='shared-room-select';focus.setAttribute('aria-label','Visa platser på bordet');
  for(let start=0;start<=SEAT_COUNT-WINDOW_SIZE;start++){const option=document.createElement('option');option.value=String(start);option.textContent=windowLabel(start);focus.append(option);}
  const show=()=>{const start=Number(focus.value);if(Number.isInteger(start))actions?.focusSeat(start+1);};focus.addEventListener('change',show);cleanups.push(()=>focus.removeEventListener('change',show));
  extra.append(picker,focus,leave);
  // The way back to the lobby joins the seat controls; the dealer rail below has no choice at a shared table,
  // whose dealer is the room's, so the bottom controls take its place (styles.css).
  const lobby=document.querySelector('#dealer-picker .casino-return');if(lobby){lobby.classList.add('shared-room-lobby');extra.prepend(lobby);}
  // The sound button wraps with them, so a phone's two rows stay whole (styles.css orders them).
  const sound=$(document,'sound-btn');if(sound&&topRight)extra.append(sound);
  // K04 F15: the native table's small decision bar (#actions) is placed beside the hand by app.mjs, which never runs
  // here. Unplaced, it showed at the top left beside the main panel. Only #actions-top decides at a shared table.
  // `hidden` alone loses to stylesheet display rules (for example `#chat { display:flex }`), so the display is forced too.
  for(const id of ['chat','table-pick','cashier','gate','autobet','sign-out','actions']){const node=$(document,id);if(node){node.hidden=true;node.inert=true;node.style.display='none';}}
  // One action zone above the wallet and chips: status line, Redo, Nästa runda, insurance and the decision panel.
  // It is part of the bottom grid, so neither the wallet nor the chips can cover it, and it never covers a card.
  // On a phone the chosen own seat's bets dock above it (#shared-room-dock).
  const zone=document.createElement('div');zone.id='shared-room-actions';zone.className='shared-room-actions';
  const dock=document.createElement('div');dock.id='shared-room-dock';dock.className='shared-room-dock';dock.hidden=true;
  if(hud){hud.prepend(dock,zone);zone.append(...['banner','deal-now'].map(id=>$(document,id)),next,...['insurance','actions-top'].map(id=>$(document,id)).filter(Boolean));}
  else scene.append(next);
  // K06 O1: until the first snapshot names the room's stake profile, the heading names no profile at all.
  const profile=$(document,'table-profile');if(profile)profile.textContent='Blackjack';
  const labels={ 'undo-btn':['Ångra','undo'], 'clear-btn':['Rensa','clear'], 'double-btn':['Dubbla','doubleBets'],
    'max-btn':['Upprepa','repeat'], 'all-sides':['Alla platser','allSeats'], 'add-funds':['Fyll på demosaldo','refill'],
    'pitboss':['Ta paus i 24 timmar','pause'], 'deal-now':['Redo','ready'] };
  // The 24-hour pause asks first (confirmPause); every other control acts at once.
  for(const [id,[label,op]] of Object.entries(labels)){const node=$(document,id);if(!node)continue;node.textContent=label;node.setAttribute('aria-label',label);listen(node,()=>op==='pause'?confirmPause():actions?.dispatch(op));}
  // The 24-hour pause is responsible gaming and the server takes it in every phase, also mid-round: it sits with the
  // seat controls, outside the betting-window buttons that a round hides. A phone shows "Ta paus"; its name keeps 24 h.
  // Not "Spelpaus": that is the national self-exclusion register (spelpaus.se), which this pause must not be mistaken for.
  const pause=$(document,'pitboss');
  if(pause&&topRight){pause.classList?.add('shared-room-button','shared-room-pause');pause.textContent='Ta paus';
    const hours=document.createElement('span');hours.className='shared-room-long';hours.textContent='i 24 timmar';pause.append(hours);extra.insertBefore?.(pause,sound??null);}
  // The pause is confirmed in a modal dialog: keyboard and screen reader reach it, Escape and Avbryt cancel, and
  // focus starts on Avbryt and returns to the pause button.
  const ask=document.createElement('dialog');ask.id='shared-room-pause';ask.className='shared-room-dialog';
  ask.setAttribute('aria-labelledby','shared-room-pause-title');ask.setAttribute('aria-describedby','shared-room-pause-text');
  const askTitle=document.createElement('h2');askTitle.id='shared-room-pause-title';askTitle.textContent='Pausa spelet i 24 timmar?';
  const askText=document.createElement('p');askText.id='shared-room-pause-text';askText.textContent='Du kan inte spela vid bordet förrän pausen gått ut.';
  const askRow=document.createElement('div');askRow.className='shared-room-dialog-actions';
  const cancelPause=button(document,'Avbryt',()=>closeAsk());cancelPause.className='shared-room-button';cancelPause.autofocus=true;
  const acceptPause=button(document,'Ja, pausa',()=>{closeAsk();actions?.dispatch('pause');});acceptPause.className='shared-room-button shared-room-primary';
  askRow.append(cancelPause,acceptPause);ask.append(askTitle,askText,askRow);ask.hidden=typeof ask.showModal!=='function';(document.body??scene).append(ask);
  function closeAsk(){if(typeof ask.close==='function'){if(ask.open)ask.close();}else ask.hidden=true;}
  function confirmPause(){
    if(closed||pause?.disabled)return;
    if(typeof ask.showModal==='function'){if(!ask.open)ask.showModal();cancelPause.focus?.();}else ask.hidden=false;
  }
  const decisions=[...document.querySelectorAll('[data-act]')].filter(node=>!node.closest?.('#actions'));
  for(const node of decisions)listen(node,()=>actions?.dispatch('act',{action:node.dataset.act}));
  // H/S/D/P while a decision button has focus (shared-room-shortcuts.mjs); a key clicks the same button.
  cleanups.push(installDecisionShortcuts($(document,'actions-top'),decisions));
  listen($(document,'ins-yes'),()=>actions?.dispatch('insurance',{take:true}));listen($(document,'ins-no'),()=>actions?.dispatch('insurance',{take:false}));
  $(document,'ins-yes').textContent='Ja';$(document,'ins-no').textContent='Nej';
  const owns=index=>Boolean(model?.snapshot&&model.snapshot.owners[index]===model.snapshot.me.id);
  const slots=Array.from({length:7},(_,index)=>{
    // Admin table geometry positions the seat root; the controls keep 44 px touch
    // targets at any scale, and bet buttons only exist on the player's own seat.
    const root=document.createElement('div');root.className='seat seat-shared';root.dataset.seat=String(index);root.style.setProperty('--seat-i',String(index));
    const inside=document.createElement('div');inside.className='seat-inner seat-shared-inner';root.append(inside);
    // A free seat's circle joins it; an own seat's circle chooses it as the one whose bets show in full.
    const join=button(document,`Plats ${index+1}`,()=>owns(index)?actions?.focusSeat(index):actions?.dispatch('join',{seat:index}));join.className='spot seat-shared-join';inside.append(join);
    const bets=document.createElement('div');bets.className='seat-shared-bets';bets.hidden=true;bets.style.display='none';inside.append(bets);
    // The main bet is the seat's betting spot, the side bets sit beside it as smaller targets.
    const fields=Object.fromEntries([['pp','Par'],['main','Insats'],['tp','21+3']].map(([field,label])=>{
      const control=button(document,label,()=>actions?.dispatch('bet',{seat:index,field}));
      control.className='seat-shared-bet '+(field==='main'?'seat-shared-bet-main':'seat-shared-bet-side seat-shared-bet-'+field);bets.append(control);return[field,control];
    }));
    // Leaving is a small control of its own; the seat circle only says the seat is yours.
    const leaveSeat=button(document,'Lämna',()=>actions?.dispatch('join',{seat:index}));leaveSeat.className='seat-shared-leave';leaveSeat.hidden=true;leaveSeat.style.display='none';inside.append(leaveSeat);
    return {root,inside,join,bets,fields,leaveSeat};
  });
  seatsHost.replaceChildren(...slots.map(slot=>slot.root));
  let docked=null;
  // A phone docks the chosen own seat's bets and Lämna above the action zone: its three boxes are narrower than one bet row.
  // The same buttons move, so a seat never has two sets of controls.
  function dockSeat(index){
    if(docked===index)return;
    const previous=docked===null?null:slots[docked];
    if(previous){previous.inside.append(previous.bets,previous.leaveSeat);previous.leaveSeat.textContent='Lämna';}
    docked=index;dock.hidden=index===null;
    if(index!==null){const slot=slots[index];dock.append(slot.bets,slot.leaveSeat);slot.leaveSeat.textContent=`Lämna plats ${index+1}`;}
  }
  // Keyboard focus survives the table's own changes. A restore disables every control for a moment (the binding is
  // checked again), a round hides the bets and a phone's dock moves its buttons: Chrome then drops focus to the page.
  // The control that had it gets it back once usable; one that left the screen hands it to the same control of the
  // docked seat, else to its seat's circle, else to the action zone. A pointer press elsewhere is the player's own move.
  let lastFocus=null,moved=false;
  const focused=event=>{if(scene.contains?.(event.target)){lastFocus=event.target;moved=false;}};
  const pressed=()=>{moved=true;};
  for(const [type,handler] of [['focusin',focused],['pointerdown',pressed]]){document.addEventListener?.(type,handler,true);cleanups.push(()=>document.removeEventListener?.(type,handler,true));}
  const usable=node=>Boolean(node&&!node.disabled&&node.isConnected!==false&&(node.checkVisibility?.()??true));
  function substitute(node){
    const slot=slots.find(item=>item.leaveSeat===node||Object.values(item.fields).includes(node)||item.join===node);
    const field=slot&&Object.entries(slot.fields).find(([,control])=>control===node)?.[0];
    const current=docked===null?null:slots[docked];
    return [current&&field?current.fields[field]:null,current&&slot?.leaveSeat===node?current.leaveSeat:null,slot?.join,
      ...(zone.querySelectorAll?.('button')??[])].find(usable)??null;
  }
  function keepFocus(){
    if(closed||!lastFocus||moved)return;
    const active=document.activeElement,shown=lastFocus.isConnected!==false&&(lastFocus.checkVisibility?.()??true);
    // Focus elsewhere is the player's; the control that still holds it on screen needs nothing.
    if(active&&active!==document.body&&(active!==lastFocus||shown))return;
    // A control that is only closed for a moment keeps its claim; one that left the screen hands it on.
    const target=shown?lastFocus:substitute(lastFocus);
    if(usable(target)&&target!==active)target.focus?.({preventScroll:true});
  }
  // Chrome moves focus off a closed control at its next frame, so the check runs again then.
  const keepFocusSoon=()=>{keepFocus();view?.requestAnimationFrame?.(keepFocus);};
  const rect=node=>typeof node?.getBoundingClientRect==='function'?node.getBoundingClientRect():null;
  // Layout after every render and after the presentation lays the seats out again on resize. Own seats closer than a
  // full bet row share its space (K04 F14); a row at a phone's edge moves inside the scene; a seat whose controls would
  // reach the wallet, chips or action zone lifts above them (K04 F12, F13).
  // The dock is settled before the presentation measures the bottom controls for its seat layout.
  function arrange(){
    const s=model.snapshot,phone=compact(),visible=phone?seatWindow(s,model.focusSeat).boxes:slots.map((_,i)=>i);
    const primary=primarySeat(s,model.focusSeat,visible);
    dockSeat(phone&&s.phase==='bets'&&primary!==null?primary:null);
    seatsHost.classList?.toggle('seats-docked',phone);
    return {s,phone,visible,primary};
  }
  function onScreen(){
    if(closed||!model?.snapshot)return;
    const {s,phone,visible,primary}=arrange(),own=s.me.seats.filter(i=>visible.includes(i));
    const points=own.map(i=>[i,rect(slots[i].root)?.left]).filter(([,x])=>Number.isFinite(x));
    const crowd=crowding(points);
    for(const [i,slot] of slots.entries()){
      const mine=s.owners[i]===s.me.id,state=crowd.get(i);
      slot.root.classList.toggle('primary',mine&&i===primary);slot.root.classList.toggle('crowded',Boolean(mine&&!phone&&state?.crowded));
      if(state?.crowded)slot.root.style.setProperty('--seat-bet-w',state.betWidth+'px');else slot.root.style.removeProperty('--seat-bet-w');
      slot.root.style.removeProperty('--seat-shift-x');slot.root.style.removeProperty('--seat-lift');
    }
    const edge=rect(scene),floor=rect(hud);if(!edge)return;
    const bottom=Math.min(edge.bottom,floor&&floor.height?floor.top:Infinity)-6;
    // Crowded own seats line their bets up on the lowest of their arc, so the chosen seat's second line is below them all.
    const line=Math.max(...points.filter(([i])=>crowd.get(i)?.crowded).map(([i])=>rect(slots[i].root).top));
    let lift=0;
    for(const [i,slot] of slots.entries()){
      if(slot.root.hidden)continue;
      const anchor=rect(slot.root);if(!anchor)continue;
      if(crowd.get(i)?.crowded&&!phone)slot.root.style.setProperty('--seat-row-y',Math.round(line-anchor.top)+'px');else slot.root.style.removeProperty('--seat-row-y');
      const row=slot.bets.parentNode===dock?[]:[...slot.bets.children,slot.leaveSeat].map(rect).filter(r=>r&&r.width>0);
      // The bet row stays inside the scene; the seat's circle stays on its box.
      if(row.length){const left=Math.min(...row.map(r=>r.left)),right=Math.max(...row.map(r=>r.right));
        const shift=Math.round(Math.max(0,edge.left+8-left)-Math.max(0,right-(edge.right-8)));
        if(shift)slot.root.style.setProperty('--seat-shift-x',shift+'px');}
      // The rows are measured with their own offset; the seat box itself never includes it.
      lift=Math.max(lift,Math.ceil(Math.max(...[rect(slot.inside),...row].filter(Boolean).map(r=>r.bottom))-bottom));
    }
    // Every seat lifts by the same amount, so the arc keeps its shape and no row meets a neighbour's circle.
    if(lift>0)for(const slot of slots)if(!slot.root.hidden)slot.root.style.setProperty('--seat-lift',-lift+'px');
  }
  const resized=()=>view?.requestAnimationFrame?.(onScreen);
  if(typeof view?.addEventListener==='function'){view.addEventListener('resize',resized);cleanups.push(()=>view.removeEventListener('resize',resized));}
  let chipKey='';
  return Object.freeze({
    bind(value){actions=value;},
    render(value){
      model=value;const s=value.snapshot,can=value.can,hints=value.hints??{};
      // An empty status box stays away: it overlays the table beside the first seat.
      notice.textContent=value.notice;status.hidden=!value.notice;retry.hidden=!value.retry;retry.disabled=value.busy;signIn.hidden=!value.signIn;
      // The sign shows while the table is lost: offline with Återanslut, or reconnecting by itself.
      sign.hidden=!(value.offline||value.reconnecting)||value.stopped===true;again.hidden=!value.offline;
      signText.textContent=value.offline?'Anslutningen till bordet bröts. Bordet visar senaste läget.':'Återansluter till bordet…';
      sign.dataset.state=value.offline?'offline':'reconnecting';
      leave.disabled=!can.leave;leave.hidden=!s?.me.seats.length;next.hidden=s?.phase!=='settled';next.disabled=!can.next;
      for(const [id,[,op]] of Object.entries(labels)){const node=$(document,id);if(!node)continue;node.disabled=!can[op];
        // Redo waits for a main bet and Upprepa for a previous round; the tooltip names the reason.
        if(op==='ready'||op==='repeat')node.title=hints[op]??'';}
      // Redo belongs to a seated player's betting window; outside it the action zone shows the next step instead.
      $(document,'deal-now').hidden=!(s?.phase==='bets'&&s.me.seats.length);
      for(const node of decisions)node.disabled=!can.act.includes(node.dataset.act);
      if($(document,'actions-top'))$(document,'actions-top').hidden=!can.act.length;
      // The insurance question shows from turnAt, when every card of its plan shows (K04 review of #481). At the
      // start of the plan it would tell the player of the dealer's ace before the up card was dealt on screen.
      $(document,'insurance').hidden=!(s?.me?.insuranceDue&&s.phase==='round'&&s.round?.phase==='insurance'&&(value.serverNow??s.serverNow)>=(s.plan?.turnAt??0));
      $(document,'ins-yes').disabled=!can.insurance||Boolean(s&&s.me.pausedUntil>(value.serverNow??s.serverNow));$(document,'ins-no').disabled=!can.insurance;
      const limits=$(document,'limits');
      if(!s){$(document,'banner').textContent='Ansluter…';$(document,'balance').textContent='–';$(document,'total-bet').textContent='–';if(limits)limits.textContent='–';dockSeat(null);keepFocusSoon();return;}
      $(document,'balance').textContent=money(s.me.available)+' demo';
      if(limits)limits.textContent=`${money(s.settings.limits.min)} – ${money(s.settings.limits.max)} kr · demo`;
      // K06 O1: the heading names the room's stake profile instead of a fixed "Privé".
      if(profile)profile.textContent=tableProfileName(s.settings);
      $(document,'total-bet').textContent=money(s.me.seats.reduce((sum,i)=>sum+s.bets[i].main+s.bets[i].pp+s.bets[i].tp,0));
      $(document,'last-win').textContent=s.me.lastSettlement?money(s.me.lastSettlement.returned):'–';
      $(document,'banner').textContent=value.notice||(s.me.pausedUntil>(value.serverNow??s.serverNow)?'Pausen är aktiv':s.phase==='bets'?'Välj plats och lägg insatser':s.phase==='settled'?'Rundan är avslutad':can.act.length?'Din tur':'Rundan pågår');
      // A narrow phone clamps the status line to two lines (styles.css); its full text stays in the title.
      $(document,'banner').title=$(document,'banner').textContent;
      picker.replaceChildren(...['Välj plats',...s.owners.map((owner,i)=>`${owner===s.me.id?'Lämna':owner===null?'Välj':'Upptagen'} ${i+1}`)].map((text,i)=>{const option=document.createElement('option');option.textContent=text;option.value=i===0?'':String(i-1);option.disabled=i>0&&s.owners[i-1]!==null&&s.owners[i-1]!==s.me.id;return option;}));
      picker.value='';picker.disabled=!can.join;focus.value=String(seatWindow(s,value.focusSeat).start);
      const key=JSON.stringify(s.settings.chips);
      // K6: a viewer without a seat at a full table waits for one (shared-room-waiting.mjs renews the wait). The
      // status line's title follows its final text.
      const banner=$(document,'banner');
      if(!value.notice&&!s.me.seats.length&&s.owners.every(owner=>owner!==null)&&!(s.me.pausedUntil>(value.serverNow??s.serverNow)))banner.textContent='Väntar på plats';
      banner.title=banner.textContent;
      if(key!==chipKey){chipKey=key;chipHost.replaceChildren(...s.settings.chips.map(amount=>{const node=button(document,money(amount),()=>actions?.selectChip(amount));node.className='chip';node.dataset.value=String(amount);return node;}));}
      for(const node of chipHost.children){node.disabled=value.busy||!value.connected||value.retry;node.classList.toggle('sel',Number(node.dataset.value)===value.chip);node.setAttribute('aria-pressed',String(Number(node.dataset.value)===value.chip));}
      const several=s.me.seats.length>1,chosen=primarySeat(s,value.focusSeat);
      // Side bets and Lämna act only in the betting window; during a round the seat keeps its circle and main stake,
      // so its controls stay clear of the cards that are dealt above them.
      const betting=s.phase==='bets';
      // The chips and table buttons belong to the betting window, as on the native table (body.in-round).
      scene.dataset.sharedPhase=s.phase;
      for(const [i,slot] of slots.entries()){
        const own=s.owners[i]===s.me.id,occupied=s.owners[i]!==null;
        slot.root.classList.toggle('active',own);slot.root.classList.toggle('occupied',occupied);
        // Short visible label so 44 px pills fit the seat spacing; the full text stays in aria-label.
        // The own seat's circle reads "Du"; with several own seats it chooses whose bets show in full, else it takes no click.
        slot.join.textContent=own?'Du':String(i+1);slot.join.setAttribute('aria-label',own?`Plats ${i+1}, din plats`:occupied?`Plats ${i+1} upptagen`:`Välj plats ${i+1}`);
        // The chosen one of several own circles stays focusable (aria-disabled), so choosing it never drops focus to the page.
        slot.join.disabled=own?!several:!can.join||occupied;slot.join.setAttribute('aria-disabled',String(own&&several&&i===chosen));
        slot.join.setAttribute('aria-pressed',String(own&&(!several||i===chosen)));
        slot.leaveSeat.hidden=!own||!betting;slot.leaveSeat.style.display=own&&betting?'':'none';slot.leaveSeat.disabled=!can.join;slot.leaveSeat.setAttribute('aria-label',`Lämna plats ${i+1}`);
        slot.bets.hidden=!own;slot.bets.style.display=own?'':'none';
        for(const [field,node] of Object.entries(slot.fields)){
          node.hidden=field!=='main'&&!betting;
          // A side bet opens once its box has a main bet; until then the tooltip says why.
          const closedSide=field!=='main'&&!(s.bets[i].main>0);
          node.disabled=!can.bet||!own||closedSide;node.title=closedSide?hints.side??'':'';
          node.classList.toggle('staked',s.bets[i][field]>0);
          node.textContent=({main:'Insats',pp:'Par',tp:'21+3'})[field]+' '+money(s.bets[i][field]);node.setAttribute('aria-label',`Plats ${i+1}, ${field==='main'?'huvudinsats':field==='pp'?'par':'21 plus 3'}, ${money(s.bets[i][field])}`);}
      }
      arrange();
      onLayout({snapshot:s,focusSeat:value.focusSeat,seats:slots.map(slot=>slot.root)});
      onScreen();keepFocusSoon();
    },
    get snapshot(){return model?.snapshot;},
    close(){if(closed)return;closeAsk();closed=true;cleanups.forEach(fn=>fn());actions=null;},
  });
}
