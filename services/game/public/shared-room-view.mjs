// Existing table DOM; all visible money, seats and controls come from a server snapshot.
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
  const scene=$(document,'scene'),seatsHost=$(document,'seats'),chipHost=$(document,'chips');
  const status=document.createElement('p');status.id='shared-room-status';status.className='local-presentation-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');scene.append(status);
  const notice=document.createElement('span');status.append(notice);
  // The status box is pointer-transparent (it overlays the table), so the retry
  // control lives in the clickable control bar instead of inside the message.
  const extra=document.createElement('div');extra.id='shared-room-controls';extra.style.cssText='position:absolute;right:12px;top:95px;z-index:30;display:flex;gap:8px;flex-wrap:wrap;max-width:90%';scene.append(extra);
  const retry=button(document,'Försök igen',()=>actions?.retry());retry.id='shared-room-retry';retry.hidden=true;retry.style.cssText='min-height:44px';extra.append(retry);
  // A lost connection is resumed here, not by reloading the page; the last server state stays on screen meanwhile.
  const again=button(document,'Återanslut',()=>actions?.reconnect?.());again.id='shared-room-reconnect';again.hidden=true;again.style.cssText='min-height:44px';extra.append(again);
  // K04 F8: an expired session links to the player's sign-in, which returns to this table (blackjack-entry.mjs).
  const signIn=document.createElement('a');signIn.id='shared-room-sign-in';signIn.className='shared-room-sign-in';signIn.href=signInHref;signIn.textContent='Logga in';signIn.hidden=true;extra.append(signIn);
  const leave=button(document,'Lämna platser',()=>actions?.dispatch('leave')),next=button(document,'Nästa runda',()=>actions?.dispatch('next'));
  const picker=document.createElement('select');picker.setAttribute('aria-label','Välj eller lämna plats');
  picker.style.cssText='min-height:44px;max-width:160px';
  const choose=()=>{const selected=Number(picker.value);if(picker.value!==''&&Number.isInteger(selected))actions?.dispatch('join',{seat:selected});picker.value='';};
  picker.addEventListener('change',choose);cleanups.push(()=>picker.removeEventListener('change',choose));
  const focus=document.createElement('select');focus.setAttribute('aria-label','Visa plats på bordet');
  for(let i=0;i<7;i++){const option=document.createElement('option');option.value=String(i);option.textContent=`Visa plats ${i+1}`;focus.append(option);}
  const show=()=>actions?.focusSeat(Number(focus.value));focus.addEventListener('change',show);cleanups.push(()=>focus.removeEventListener('change',show));
  extra.append(picker,focus,leave,next);
  // Legacy single-player surfaces. `hidden` alone loses to stylesheet display
  // rules (for example `#chat { display:flex }`), so the display is forced too.
  for(const id of ['chat','table-pick','cashier','gate','autobet','sign-out']){const node=$(document,id);if(node){node.hidden=true;node.inert=true;node.style.display='none';}}
  const labels={ 'undo-btn':['Ångra','undo'], 'clear-btn':['Rensa','clear'], 'double-btn':['Dubbla','doubleBets'],
    'max-btn':['Upprepa','repeat'], 'all-sides':['Alla platser','allSeats'], 'add-funds':['Fyll på demosaldo','refill'],
    'pitboss':['Spelpaus 24 timmar','pause'], 'deal-now':['Redo','ready'] };
  for(const [id,[label,op]] of Object.entries(labels)){const node=$(document,id);if(!node)continue;node.textContent=label;node.setAttribute('aria-label',label);listen(node,()=>actions?.dispatch(op));}
  for(const node of document.querySelectorAll('[data-act]'))listen(node,()=>actions?.dispatch('act',{action:node.dataset.act}));
  listen($(document,'ins-yes'),()=>actions?.dispatch('insurance',{take:true}));listen($(document,'ins-no'),()=>actions?.dispatch('insurance',{take:false}));
  $(document,'ins-yes').textContent='Ja';$(document,'ins-no').textContent='Nej';
  const slots=Array.from({length:7},(_,index)=>{
    // Admin table geometry positions the seat root; the controls keep 44 px touch
    // targets at any scale, and bet buttons only exist on the player's own seat.
    const root=document.createElement('div');root.className='seat seat-shared';root.dataset.seat=String(index);root.style.setProperty('--seat-i',String(index));
    const inside=document.createElement('div');inside.className='seat-inner seat-shared-inner';root.append(inside);
    const join=button(document,`Plats ${index+1}`,()=>actions?.dispatch('join',{seat:index}));join.className='spot seat-shared-join';inside.append(join);
    const bets=document.createElement('div');bets.className='seat-shared-bets';bets.hidden=true;bets.style.display='none';inside.append(bets);
    // The main bet is the seat's betting spot, the side bets sit beside it as smaller targets.
    const fields=Object.fromEntries([['pp','Par'],['main','Insats'],['tp','21+3']].map(([field,label])=>{
      const control=button(document,label,()=>actions?.dispatch('bet',{seat:index,field}));
      control.className='seat-shared-bet '+(field==='main'?'seat-shared-bet-main':'seat-shared-bet-side');bets.append(control);return[field,control];
    }));
    // Leaving is a small control of its own; the seat circle only says the seat is yours.
    const leaveSeat=button(document,'Lämna',()=>actions?.dispatch('join',{seat:index}));leaveSeat.className='seat-shared-leave';leaveSeat.hidden=true;leaveSeat.style.display='none';inside.append(leaveSeat);
    return {root,join,bets,fields,leaveSeat};
  });
  seatsHost.replaceChildren(...slots.map(slot=>slot.root));
  // A seat at the edge of a phone's table would cut off a side bet: its bet row moves inside the scene,
  // after every render and after the presentation lays the seats out again on resize.
  function onScreen(){
    if(closed||typeof scene.getBoundingClientRect!=='function')return;
    const edge=scene.getBoundingClientRect();
    for(const slot of slots){
      slot.bets.style.transform='';if(slot.bets.hidden||slot.root.hidden)continue;
      const row=slot.bets.getBoundingClientRect(),shift=Math.round(Math.max(0,edge.left+8-row.left)-Math.max(0,row.right-(edge.right-8)));
      if(shift)slot.bets.style.transform=`translateX(${shift}px)`;
    }
  }
  const view=document.defaultView,resized=()=>view?.requestAnimationFrame?.(onScreen);
  if(typeof view?.addEventListener==='function'){view.addEventListener('resize',resized);cleanups.push(()=>view.removeEventListener('resize',resized));}
  let chipKey='';
  return Object.freeze({
    bind(value){actions=value;},
    render(value){
      model=value;const s=value.snapshot,can=value.can,hints=value.hints??{};
      // An empty status box stays away: it overlays the table beside the first seat.
      notice.textContent=value.notice;status.hidden=!value.notice;retry.hidden=!value.retry;retry.disabled=value.busy;again.hidden=!value.offline;signIn.hidden=!value.signIn;
      leave.disabled=!can.leave;next.hidden=s?.phase!=='settled';next.disabled=!can.next;
      for(const [id,[,op]] of Object.entries(labels)){const node=$(document,id);if(!node)continue;node.disabled=!can[op];
        // Redo waits for a main bet and Upprepa for a previous round; the tooltip names the reason.
        if(op==='ready'||op==='repeat')node.title=hints[op]??'';}
      for(const node of document.querySelectorAll('[data-act]'))node.disabled=!can.act.includes(node.dataset.act);
      for(const id of ['actions','actions-top'])if($(document,id))$(document,id).hidden=!can.act.length;
      // The insurance question shows from turnAt, when every card of its plan shows (K04 review of #481). At the
      // start of the plan it would tell the player of the dealer's ace before the up card was dealt on screen.
      $(document,'insurance').hidden=!(s?.me?.insuranceDue&&s.phase==='round'&&s.round?.phase==='insurance'&&(value.serverNow??s.serverNow)>=(s.plan?.turnAt??0));
      $(document,'ins-yes').disabled=!can.insurance||Boolean(s&&s.me.pausedUntil>(value.serverNow??s.serverNow));$(document,'ins-no').disabled=!can.insurance;
      const limits=$(document,'limits');
      if(!s){$(document,'banner').textContent='Ansluter…';$(document,'balance').textContent='–';$(document,'total-bet').textContent='–';if(limits)limits.textContent='–';return;}
      $(document,'balance').textContent=money(s.me.available)+' demo';
      if(limits)limits.textContent=`${money(s.settings.limits.min)} – ${money(s.settings.limits.max)} kr · demo`;
      $(document,'total-bet').textContent=money(s.me.seats.reduce((sum,i)=>sum+s.bets[i].main+s.bets[i].pp+s.bets[i].tp,0));
      $(document,'last-win').textContent=s.me.lastSettlement?money(s.me.lastSettlement.returned):'–';
      $(document,'banner').textContent=value.notice||(s.me.pausedUntil>(value.serverNow??s.serverNow)?'Spelpaus aktiv':s.phase==='bets'?'Välj plats och lägg insatser':s.phase==='settled'?'Rundan är avslutad':can.act.length?'Din tur':'Rundan pågår');
      picker.replaceChildren(...['Välj plats',...s.owners.map((owner,i)=>`${owner===s.me.id?'Lämna':owner===null?'Välj':'Upptagen'} ${i+1}`)].map((text,i)=>{const option=document.createElement('option');option.textContent=text;option.value=i===0?'':String(i-1);option.disabled=i>0&&s.owners[i-1]!==null&&s.owners[i-1]!==s.me.id;return option;}));
      picker.value='';picker.disabled=!can.join;focus.value=String(value.focusSeat??s.me.seats[0]??3);
      const key=JSON.stringify(s.settings.chips);
      // K6: a viewer without a seat at a full table waits for one (shared-room-waiting.mjs renews the wait).
      if(!value.notice&&!s.me.seats.length&&s.owners.every(owner=>owner!==null)&&!(s.me.pausedUntil>(value.serverNow??s.serverNow)))$(document,'banner').textContent='Väntar på plats';
      if(key!==chipKey){chipKey=key;chipHost.replaceChildren(...s.settings.chips.map(amount=>{const node=button(document,money(amount),()=>actions?.selectChip(amount));node.className='chip';node.dataset.value=String(amount);return node;}));}
      for(const node of chipHost.children){node.disabled=value.busy||!value.connected||value.retry;node.classList.toggle('sel',Number(node.dataset.value)===value.chip);node.setAttribute('aria-pressed',String(Number(node.dataset.value)===value.chip));}
      for(const [i,slot] of slots.entries()){
        const own=s.owners[i]===s.me.id,occupied=s.owners[i]!==null;
        slot.root.classList.toggle('active',own);slot.root.classList.toggle('occupied',occupied);
        // Short visible label so 44 px pills fit the seat spacing; the full text stays in aria-label.
        // The own seat's circle reads "Du" and takes no click; "Lämna" beside the bets leaves it.
        slot.join.textContent=own?'Du':String(i+1);slot.join.setAttribute('aria-label',own?`Plats ${i+1}, din plats`:occupied?`Plats ${i+1} upptagen`:`Välj plats ${i+1}`);
        slot.join.disabled=own||!can.join||occupied;slot.join.setAttribute('aria-pressed',String(own));
        slot.leaveSeat.hidden=!own;slot.leaveSeat.style.display=own?'':'none';slot.leaveSeat.disabled=!can.join;slot.leaveSeat.setAttribute('aria-label',`Lämna plats ${i+1}`);
        slot.bets.hidden=!own;slot.bets.style.display=own?'':'none';
        for(const [field,node] of Object.entries(slot.fields)){
          // A side bet opens once its box has a main bet; until then the tooltip says why.
          const closedSide=field!=='main'&&!(s.bets[i].main>0);
          node.disabled=!can.bet||!own||closedSide;node.title=closedSide?hints.side??'':'';
          node.classList.toggle('staked',s.bets[i][field]>0);
          node.textContent=({main:'Insats',pp:'Par',tp:'21+3'})[field]+' '+money(s.bets[i][field]);node.setAttribute('aria-label',`Plats ${i+1}, ${field==='main'?'huvudinsats':field==='pp'?'par':'21 plus 3'}, ${money(s.bets[i][field])}`);}
      }
      onLayout({snapshot:s,focusSeat:value.focusSeat,seats:slots.map(slot=>slot.root)});
      onScreen();
    },
    get snapshot(){return model?.snapshot;},
    close(){if(closed)return;closed=true;cleanups.forEach(fn=>fn());actions=null;},
  });
}
