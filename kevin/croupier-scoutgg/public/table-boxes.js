import { boxLabel } from './box-label.js';
// All positions share the original video's 1080 × 1920 frame.
export const NS = 'http://www.w3.org/2000/svg';
export function svgNode(tag, attributes = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text != null) node.textContent = text;
  return node;
}

let CHIP_VALUES = [500,100,50,25,10,5];   // the table's rack, largest first (setChipValues)
let stackId = 0;
function chipBreakdown(amount) {
  const chips = [];
  for (const value of CHIP_VALUES) {
    while (amount >= value) { chips.push(value); amount -= value; }
  }
  if (amount > 0) chips.push(amount);
  return chips;
}

// Keep each added chip, so two clicks with $5 remain two discs, not one $10.
// A restored wager is rebuilt from its amount using the current chip rack.
export function payoutStack(stake,returned,maxLayers=12) {
  if(!Number.isFinite(stake)||!Number.isFinite(returned)||stake<=0||returned<=stake)return null;
  const unit=Math.min(...chipBreakdown(stake));
  const count=Math.ceil(returned/unit);
  return {count,unit,layers:Array.from({length:Math.min(count,maxLayers)},(_,i)=>i===Math.min(count,maxLayers)-1&&returned%unit?returned%unit:unit)};
}
function createWagerStack(className, rx, ry, step, maxLayers) {
  const node = svgNode('g', {class:className, visibility:'hidden'});
  ++stackId;
  let total = 0, chips = [], modeKey='';
  return { node, set(amount = 0, payout=null) {
    const key=payout?.key??'';
    if (amount === total&&key===modeKey) return;
    const previousLayers=Math.min(chips.length,maxLayers),animate=payout?.animate&&modeKey!==key&&total>0;
    modeKey=key;
    if (amount > total) chips.push(...chipBreakdown(amount-total));
    else {
      let remove = total-amount;
      while (remove > 0 && chips.length) {
        const last = chips.pop();
        if (last > remove) { chips.push(...chipBreakdown(last-remove)); break; }
        remove -= last;
      }
    }
    total = amount;
    node.setAttribute('visibility',amount ? 'visible' : 'hidden');
    node.setAttribute('data-chip-count',chips.length);
    node.setAttribute('data-amount',amount);
    node.replaceChildren();
    if (!amount) return;
    // Cap visible height to keep the stack inside its betting area. The top
    // always shows the full wager, including chips hidden in a taller stack.
    const stock=payout?payoutStack(payout.stake,amount):null;
    const visible = stock?.layers??chips.slice(-maxLayers);
    if(stock)node.setAttribute('data-chip-count',stock.count);
    node.setAttribute('data-visible-layers',visible.length);
    node.append(svgNode('ellipse',{class:'chip-contact-shadow',cx:1,cy:4,rx:rx+2,ry:ry+1}));
    visible.forEach((value,i)=> {
      const layer = svgNode('g',{class:'chip-stack-layer','data-denomination':value,transform:`translate(0 ${-i*step})`});
      layer.append(svgNode('ellipse',{class:'chip-edge',cy:step*.8,rx,ry}),
        svgNode('ellipse',{class:'chip-body',rx,ry}),
        svgNode('ellipse',{class:'chip-stitch',rx:rx-3,ry:ry-2}),
        svgNode('ellipse',{class:'chip-inner-ring',rx:rx-7,ry:ry-5}));
      if(animate&&i>=previousLayers){const drop=svgNode('g',{class:'chip-profit-drop',style:`--drop-delay:${(i-previousLayers)*65}ms`});while(layer.firstChild)drop.append(layer.firstChild);layer.append(drop);}
      node.append(layer);
    });
    node.style.setProperty('--stack-ink',`var(--chip-${visible.at(-1)}-ink,var(--design-text))`);
    node.append(svgNode('text',{class:'chip-value','text-anchor':'middle',y:-(visible.length-1)*step+(rx>30 ? 7 : 5)},amount));
  } };
}
export function createTableBoxes(svg, manifest, onSelect) {
  const targets = new Map(), stacks = new Map();
  let awards=new Map(),mains=new Map(),lastBets=[],lastActive=-1;
  svg.replaceChildren();
  for (const deal of manifest.deal) {
    const number = deal.id.match(/^deal_pos([1-7])$/)?.[1];
    if (!number || !deal.kort) continue;
    const label = boxLabel(Number(number) - 1);   // shown number (first base = box 1)
    const { cx, cy } = deal.kort;
    const group = svgNode('g', { class: 'table-box', transform: `translate(${cx} ${cy + 108})`,
      role: 'group', 'aria-label': `Box ${label}`, 'data-deal-id': deal.id });
    group.append(svgNode('ellipse', { class: 'table-box-hit', rx: 50, ry: 33 }));
    group.append(svgNode('ellipse', { class: 'bet-ring', rx: 48, ry: 30 }));
    const person = svgNode('g', { class: 'seat-person' });
    person.append(svgNode('ellipse', { cx: -5, cy: -7, rx: 7, ry: 6 }),
      svgNode('path', { d: 'M -19 12 C -19 -2 9 -2 9 12 M 14 -4 H 26 M 20 -10 V 2' }));
    const mainStack = createWagerStack('wager-chip',41,25,4.5,6);
    const seatStacks = {main:mainStack}; stacks.set(deal.id,seatStacks);
    group.append(person, svgNode('path',{class:'seat-check',d:'M -15 0 L -4 10 L 17 -12'}), mainStack.node, svgNode('text', { class: 'seat-number', 'text-anchor': 'middle', y: 55 }, label));
    const main=svgNode('g',{role:'button',tabindex:'0','aria-label':`Bet on box ${label}`,class:'main-bet'});
    while(group.firstChild)main.append(group.firstChild);
    group.append(main);
    group.append(svgNode('text',{class:'seat-owner','text-anchor':'middle',y:77}));
    const select = () => { if (group.getAttribute('aria-disabled') !== 'true') onSelect(deal.id, 'main'); };
    main.addEventListener('click', select);
    main.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
    for(const [field,label,x] of [['pp','PP',-40],['tp','21+3',40]]) {
      const side=svgNode('g',{class:'side-bet',role:'button',tabindex:'0','aria-label':`${field==='pp'?'Perfect Pairs':label} on box ${label}`,'data-field':field,transform:`translate(${x} -38)`});
      // Separate felt circles above-left and above-right; each owns its hit area.
      side.append(svgNode('ellipse',{class:'side-hit',rx:30,ry:22}),
        svgNode('ellipse',{class:'side-outline',rx:27,ry:18}),
        svgNode('text',{class:'side-label','text-anchor':'middle',y:6},label));
      const wager=createWagerStack('side-chip',23,15,3.5,8);
      const profit=svgNode('g',{class:'side-profit',display:'none',transform:`translate(${field==='pp'?-12:12} 155)`});
      profit.append(svgNode('rect',{x:-47,y:-18,width:94,height:29,rx:8}),svgNode('text',{'text-anchor':'middle',y:3}));
      side.append(profit);
      seatStacks[field]=wager;side.append(wager.node);
      const selectSide=()=>{if(side.getAttribute('aria-disabled')!=='true')onSelect(deal.id,field);};
      side.addEventListener('click',selectSide);side.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectSide();}});group.append(side);
    }
    svg.append(group); targets.set(deal.id, group);
  }
  return {
    setChipValues(values) { CHIP_VALUES=[...values].sort((a,b)=>b-a); },
    setSelection(choosing,selected) {
      svg.dataset.selecting=String(choosing);
      for(const [id,group] of targets) {
        const seat=Number(id.slice(-1))-1,main=group.querySelector('.main-bet');
        group.classList.toggle('is-selected',choosing&&selected.has(seat));
        main.setAttribute('aria-label',`${choosing?'Select':'Bet on'} box ${boxLabel(seat)}`);
        if(choosing)main.setAttribute('aria-pressed',String(selected.has(seat)));else main.removeAttribute('aria-pressed');
        const hit=group.querySelector('.table-box-hit');hit.setAttribute('rx',choosing?60:50);hit.setAttribute('ry',choosing?45:33);
        if(choosing)for(const side of group.querySelectorAll('.side-bet'))side.setAttribute('aria-disabled','true');
      }
    },
    setPlayers(players,myId) {
      for(const [id,group] of targets) {
        const seat=Number(id.slice(-1))-1,owner=players.find(p=>p.seats.includes(seat));
        group.querySelector('.seat-owner').textContent=owner?.name??'';
        group.dataset.mine=String(owner?.id===myId);group.dataset.occupied=String(!!owner);
        // CH: a seated player opens a free box by betting on it, so its main spot stays live;
        // its side bets wait until it holds a main bet.
        const seated=players.some(p=>p.id===myId&&p.seats.length);
        if(owner && owner.id!==myId || !owner && svg.dataset.selecting!=='true' && !seated) {
          group.setAttribute('aria-disabled','true');
          for(const button of group.querySelectorAll('[role="button"]'))button.setAttribute('aria-disabled','true');
        } else if(!owner && svg.dataset.selecting!=='true') {
          for(const side of group.querySelectorAll('.side-bet'))side.setAttribute('aria-disabled','true');
        }
      }
    },
    setActive(id) {
      svg.dataset.activeDeal = targets.has(id) ? id : '';
      for (const [key, group] of targets) group.classList.toggle('is-active', key === id);
    },
    setEnabled(enabled) { for (const group of targets.values()) {
      group.setAttribute('aria-disabled', String(!enabled));group.querySelector('.main-bet').setAttribute('aria-disabled',String(!enabled));
      for(const side of group.querySelectorAll('.side-bet'))side.setAttribute('aria-disabled',String(!enabled || svg.dataset.preview==='true'));
    } },
    setPreview(preview) {
      svg.dataset.preview=String(preview);
      for (const [id, group] of targets) group.querySelector('.main-bet').setAttribute('aria-label', `${preview ? 'Deal to' : 'Bet on'} box ${id.slice(-1)}`);
    },
    setSideAwards(wins) {
      const next=new Map(wins.map(w=>[`${w.box}:${w.field}`,w]));
      if(JSON.stringify([...next])===JSON.stringify([...awards]))return;
      awards=next;this.setBets(lastBets,lastActive);
    },
    // Main-bet verdicts once every card is on the felt (#10): a win drops its payout on the stack,
    // a loss is collected towards the dealer, a push stays.
    setMainResults(results) {
      const next=new Map(results.map(r=>[r.box,r]));
      if(JSON.stringify([...next])===JSON.stringify([...mains]))return;
      mains=next;this.setBets(lastBets,lastActive);
    },
    setBets(bets, activeSeat = -1) {
      lastBets=bets;lastActive=activeSeat;
      for (const [id, group] of targets) {
        const index = Number(id.slice(-1)) - 1, bet = bets[index] ?? {};
        group.classList.toggle('is-turn', index === activeSeat);
        group.querySelector('.seat-person').setAttribute('visibility', bet.main ? 'hidden' : 'visible');
        const verdict=mains.get(index),mainWon=verdict?.returned>verdict?.stake,mainLost=verdict?.returned===0;
        group.classList.toggle('main-win',mainWon);group.classList.toggle('main-loss',mainLost);
        group.classList.toggle('no-chip-motion',verdict?.animate===false);
        stacks.get(id).main.set(mainWon?verdict.returned:bet.main||0,mainWon?verdict:null);
        for(const side of group.querySelectorAll('.side-bet')) {
          const award=awards.get(`${index}:${side.dataset.field}`),won=award?.profit>0,lost=award?.returned===0,value=won?award.returned:bet[side.dataset.field]??0;
          side.classList.toggle('side-win',won);side.classList.toggle('side-loss',lost);
          side.dataset.outcome=won?'won':lost?'lost':'pending';
          side.classList.toggle('no-chip-motion',award?.animate===false);
          const label=side.querySelector('.side-profit');label.setAttribute('display',won?'inline':'none');
          if(won){label.querySelector('text').textContent='+$'+Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(award.profit);label.setAttribute('aria-label',`${award.label}: $${award.profit} profit; $${award.returned} total return`);}
          side.querySelector('.side-label').setAttribute('visibility',value&&!lost?'hidden':'visible');stacks.get(id)[side.dataset.field].set(value,won?award:null);
        }
      }
    },
  };
}
