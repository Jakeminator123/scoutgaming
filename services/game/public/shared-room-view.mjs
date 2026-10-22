// Existing table DOM; all visible money, seats and controls come from a server snapshot.
const money = value => new Intl.NumberFormat('sv-SE',{maximumFractionDigits:2}).format(value);
const $ = (document,id) => document.getElementById(id);
function button(document,text,action) {
  const node=document.createElement('button'); node.type='button'; node.textContent=text;
  node.addEventListener('click',action); return node;
}
export function createSharedRoomView({ document, onLayout = () => {} }) {
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
    const fields=Object.fromEntries([['pp','Par'],['main','Insats'],['tp','21+3']].map(([field,label])=>{
      const control=button(document,label,()=>actions?.dispatch('bet',{seat:index,field}));control.className='seat-shared-bet';bets.append(control);return[field,control];
    }));
    return {root,join,bets,fields};
  });
  seatsHost.replaceChildren(...slots.map(slot=>slot.root));
  let chipKey='';
  return Object.freeze({
    bind(value){actions=value;},
    render(value){
      model=value;const s=value.snapshot,can=value.can;
      notice.textContent=value.notice;retry.hidden=!value.retry;retry.disabled=value.busy;
      leave.disabled=!can.leave;next.hidden=s?.phase!=='settled';next.disabled=!can.next;
      for(const [id,[,op]] of Object.entries(labels))if($(document,id))$(document,id).disabled=!can[op];
      for(const node of document.querySelectorAll('[data-act]'))node.disabled=!can.act.includes(node.dataset.act);
      for(const id of ['actions','actions-top'])if($(document,id))$(document,id).hidden=!can.act.length;
      $(document,'insurance').hidden=!s?.me?.insuranceDue;
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
      if(key!==chipKey){chipKey=key;chipHost.replaceChildren(...s.settings.chips.map(amount=>{const node=button(document,money(amount),()=>actions?.selectChip(amount));node.className='chip';node.dataset.value=String(amount);return node;}));}
      for(const node of chipHost.children){node.disabled=value.busy||!value.connected||value.retry;node.classList.toggle('sel',Number(node.dataset.value)===value.chip);node.setAttribute('aria-pressed',String(Number(node.dataset.value)===value.chip));}
      for(const [i,slot] of slots.entries()){
        const own=s.owners[i]===s.me.id,occupied=s.owners[i]!==null;
        slot.root.classList.toggle('active',own);slot.root.classList.toggle('occupied',occupied);
        slot.join.textContent=own?`Lämna ${i+1}`:occupied?`Plats ${i+1} upptagen`:`Välj plats ${i+1}`;
        slot.join.disabled=!can.join||(occupied&&!own);slot.join.setAttribute('aria-pressed',String(own));
        slot.bets.hidden=!own;slot.bets.style.display=own?'':'none';
        for(const [field,node] of Object.entries(slot.fields)){node.disabled=!can.bet||!own;node.textContent=({main:'Insats',pp:'Par',tp:'21+3'})[field]+' '+money(s.bets[i][field]);node.setAttribute('aria-label',`Plats ${i+1}, ${field==='main'?'huvudinsats':field==='pp'?'par':'21 plus 3'}, ${money(s.bets[i][field])}`);}
      }
      onLayout({snapshot:s,focusSeat:value.focusSeat,seats:slots.map(slot=>slot.root)});
    },
    get snapshot(){return model?.snapshot;},
    close(){if(closed)return;closed=true;cleanups.forEach(fn=>fn());actions=null;},
  });
}
