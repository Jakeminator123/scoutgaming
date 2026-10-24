import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {placeActions,placeDealControl} from '../services/game/public/action-placement.mjs';
const box=(left,top,width,height)=>({left,top,right:left+width,bottom:top+height});
const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
test('controls stay clear of a seven-seat fan, totals and wallet at each active seat',()=>{
  const obstacles=[box(18,725,396,56),box(935,725,180,56)];
  const seats=[224,320,434,558,682,795,895];
  seats.forEach((x,i)=>{const y=620-Math.abs(i-3)*20;obstacles.push(box(x-45,y-85,95,58),box(x+25,y-10,44,27));});
  for(const x of seats){
    const p=placeActions({width:196,height:54,viewport:{width:1117,top:292,bottom:793},anchor:{x,bottom:640},obstacles});
    assert.ok(p);assert.ok(p.x>=12&&p.x+196<=1105&&p.y+54<=781);
    assert.ok(obstacles.every(o=>!overlaps(box(p.x,p.y,196,54),o)));
  }
});
test('portrait split hand keeps both totals and the dealer count above a usable panel',()=>{
  const obstacles=[box(12,330,44,57),box(140,360,42,58),box(205,360,43,58),box(333,330,44,57),
    box(62,419,39,27),box(141,392,39,27),box(205,392,39,27),box(289,419,39,27),box(181,316,53,27),box(12,723,268,61)];
  const p=placeActions({width:268,height:74,viewport:{width:390,top:295,bottom:797},anchor:{x:195,bottom:450},obstacles});
  assert.ok(p);assert.ok(p.x>=12&&p.x+268<=378&&p.y+74<=785);
  assert.ok(obstacles.every(o=>!overlaps(box(p.x,p.y,268,74),o)));
});
test('actions stay below totals when clear space exists beside the wallet',()=>{
  const anchor={x:1060,bottom:548};
  const obstacles=[box(1030,520,60,28),box(960,455,135,75),box(18,612,300,52),box(820,612,330,52)];
  const p=placeActions({width:196,height:54,viewport:{width:1280,top:250,bottom:678},anchor,obstacles,belowAnchor:true});
  assert.ok(p);assert.ok(p.y>=anchor.bottom+12);
  assert.ok(obstacles.every(o=>!overlaps(box(p.x,p.y,196,54),o)));
});

test('deal control clears all seven chip targets in the reported 1280x720 layout',()=>{
  const targets=[405,475,553,640,727,805,875].map((x,i)=>box(x-31,[438,453,473,478,473,453,438][i]-28,62,56));
  const obstacles=[box(18,612,268,52),box(930,612,330,52),box(450,610,380,60),box(490,540,300,60)];
  assert.ok(targets.some(target=>overlaps(box(544,720*.635,192,46),target)),'the former fixed button covered a betting target');
  const p=placeDealControl({width:192,height:46,viewport:{width:1280,top:0,bottom:684},targets,obstacles});
  assert.ok(p);assert.ok(p.y>=Math.max(...targets.map(r=>r.bottom))+12);
  assert.ok([...targets,...obstacles].every(o=>!overlaps(box(p.x,p.y,192,46),o)));
});
test('deal control clears the three full touch targets and HUD on a phone',()=>{
  const targets=[65,195,325].map(x=>box(x-49,480,98,90));
  const obstacles=[box(12,720,280,55),box(75,645,240,62),box(0,0,390,75)];
  const p=placeDealControl({width:190,height:46,viewport:{width:390,top:0,bottom:796},targets,obstacles});
  assert.ok(p);assert.ok(p.x>=12&&p.x+190<=378&&p.y+46<=784);
  assert.ok([...targets,...obstacles].every(o=>!overlaps(box(p.x,p.y,190,46),o)));
});
test('an impossible deal-control fit has no overlapping fixed-position fallback',()=>{
  assert.equal(placeDealControl({width:192,height:46,viewport:{width:190,top:0,bottom:300},targets:[box(0,0,190,300)]}),null);
  assert.equal(placeDealControl({width:192,height:46,viewport:{width:390,top:0,bottom:300},targets:[box(0,0,390,300)]}),null);
});

test('action panels too large for the available viewport have no out-of-bounds placement',()=>{
  for(const dimensions of [{width:268,height:74,viewport:{width:240,top:0,bottom:568}},{width:196,height:74,viewport:{width:320,top:200,bottom:250}}]){
    assert.equal(placeActions({...dimensions,anchor:{x:160,bottom:290}}),null);
  }
});

test('actual action controls recover from a stale phone position using visible cards and a touch-sized compact row',()=>{
  const source=readFileSync(new URL('../services/game/public/app.mjs',import.meta.url),'utf8');
  const fragment=source.slice(source.indexOf('function showActions(seat)'),source.indexOf("$('#deal-now').onclick"));
  const classes=()=>{const values=new Set();return {contains:key=>values.has(key),add:key=>values.add(key),remove:key=>values.delete(key),toggle:(key,on)=>on?values.add(key):values.delete(key)};};
  const node=(selectors,rect,opacity='1')=>({selectors,rect,opacity,style:{},getClientRects(){return [this.rect];},getBoundingClientRect(){return {...this.rect,width:this.rect.right-this.rect.left,height:this.rect.bottom-this.rect.top};}});
  const panel=()=>({hidden:false,classList:classes(),style:{left:'60.99px',top:'560.98px',bottom:'auto',position:'fixed',setProperty(key,value){this[key]=value;}},
    buttons:['double','hit','stand','split'].map(act=>({dataset:{act},disabled:false})),querySelectorAll(){return this.buttons;},
    get offsetWidth(){return this.classList.contains('action-compact')?198:268;},get offsetHeight(){return this.classList.contains('action-compact')?50:74;}});
  const bar=panel(),top=panel(),nodes={'#actions':bar,'#actions-top':top},obstacles=[];
  // Measured 320 x 568 Dragan portrait bounds. Invisible legacy totals and
  // zero-area results must not obstruct the visible SVG representation.
  const hiddenTotal=node(['.hand-total'],box(141.16,363.9,37.68,25.91),'0');
  obstacles.push(hiddenTotal,node(['.card'],box(73.67,263.92,30.98,37.78),'0'),node(['.sideresult'],box(160,397.98,0,0)));
  const visibleCards=[node(['#local-card-overlay .playing-card'],box(127.12,225.37,43.5,28.67)),node(['#local-card-overlay .playing-card'],box(139.26,249.72,31.36,31.18))];
  const activeTotal=node(['#local-card-overlay .card-totals g[data-seat][data-hand]','#local-card-overlay .card-totals g[data-active="true"]'],box(147.86,275.57,24.28,14.84));
  obstacles.push(...visibleCards,activeTotal,
    node(['.seat .sidearcs'],box(14.05,271.47,95.08,74.45)),node(['.seat .sidearcs'],box(112.46,280.92,95.08,74.45)),node(['.seat .sidearcs'],box(210.86,271.47,95.08,74.45)),
    node(['#wallet'],box(10.99,446.34,213.76,58.86)),node(['#player-choices'],box(157.13,413.81,68.42,14.54)),node(['#bottom-right'],box(233.74,465.2,137.95,40)),node(['#hud-top'],box(0,0,320,60.88)));
  const activeSeat={getBoundingClientRect:()=>({x:160,y:319}),querySelectorAll:()=>[hiddenTotal]};
  let pickerTop=521.28;
  nodes['#table2d']={getBoundingClientRect:()=>({top:193.18})};nodes['#dealer-picker']={getBoundingClientRect:()=>({top:pickerTop})};
  nodes['#scene']={append:element=>{nodes['#'+element.id]=element;}};
  const context=vm.createContext({innerWidth:320,innerHeight:568,$:selector=>nodes[selector],balance:5,
    round:{active:0,legal:()=>['hit','stand','double'],live:()=>[{stake:10,box:3}]},seatOfLive:()=>activeSeat,placeActions,
    getComputedStyle:element=>({display:element===bar?'none':'block',visibility:'visible',opacity:element.opacity??'1'}),
    document:{querySelectorAll:query=>obstacles.filter(element=>query.split(',').some(selector=>element.selectors.includes(selector.trim()))),createElement:()=>({setAttribute(){},style:{}})}});
  vm.runInContext(fragment+';showActions()',context);
  const bounds=()=>box(parseFloat(top.style.left),parseFloat(top.style.top),top.offsetWidth,top.offsetHeight);
  assert.ok(bounds().bottom<=568&&bounds().right<=320,'resizing must replace stale offscreen coordinates');
  assert.equal(top.classList.contains('action-compact'),true,'the full panel does not fit in the measured gap');
  assert.notEqual(top.style.visibility,'hidden');assert.ok(top.offsetHeight>=44);
  assert.ok(obstacles.filter(element=>element.opacity!=='0'&&element.rect.right>element.rect.left&&element.rect.bottom>element.rect.top).every(element=>!overlaps(bounds(),element.rect)));
  assert.deepEqual(top.buttons.map(button=>button.disabled),[true,false,false,true],'layout cannot enable an illegal or unaffordable move');
  context.innerWidth=180;context.innerHeight=160;pickerTop=160;
  obstacles.push(node(['#wallet'],box(0,0,180,160)));vm.runInContext('showActions()',context);
  assert.equal(top.style.visibility,'hidden');assert.equal(top.style.left,'');assert.equal(top.style.top,'');
  assert.equal(nodes['#action-placement-warning'].hidden,false,'a genuinely impossible viewport is disclosed');
  obstacles.pop();context.innerWidth=390;context.innerHeight=844;pickerTop=797;
  vm.runInContext('showActions()',context);
  assert.notEqual(top.style.visibility,'hidden');assert.equal(top.classList.contains('action-compact'),false);
  assert.equal(nodes['#action-placement-warning'].hidden,true);assert.ok(bounds().bottom<=797&&bounds().right<=390);

  // A split fan can extend below the total. Both the SVG total as anchor and
  // the actual visible cards as obstacles must participate in placement.
  visibleCards[1].rect=box(10,480,360,180);activeTotal.rect=box(145,430,40,30);
  hiddenTotal.opacity='1';hiddenTotal.parentElement={opacity:'0'};hiddenTotal.rect=box(0,300,390,497);
  obstacles.splice(0,obstacles.length,...visibleCards,activeTotal,hiddenTotal);
  vm.runInContext('showActions()',context);
  assert.ok(bounds().top>=activeTotal.rect.bottom+12,'the active SVG total anchors the controls');
  assert.ok([...visibleCards,activeTotal].every(element=>!overlaps(bounds(),element.rect)),'visible SVG cards remain unobstructed');
  assert.notEqual(top.style.visibility,'hidden','an invisible ancestor cannot reserve a false obstacle');

  // If the table area is genuinely full, the compact row can use clear space
  // above it, while preserving the header and the overflowing chat panel.
  const hud=node(['#hud-top'],box(0,0,390,60.88)),chat=node(['#chat-log'],box(220,64,170,114));
  obstacles.splice(0,obstacles.length,hud,chat,node(['#wallet'],box(0,193.18,390,650.82)));
  vm.runInContext('showActions()',context);
  assert.equal(top.classList.contains('action-compact'),true);assert.notEqual(top.style.visibility,'hidden');
  assert.ok(bounds().bottom<193.18&&obstacles.every(element=>!overlaps(bounds(),element.rect)));
});

test('a deal button moved above the bets still clears the remove-stake control',()=>{
  const targets=[405,475,553,640,727,805,875].map((x,i)=>box(x-31,[438,453,473,478,473,453,438][i]-28,62,56));
  const clear=box(631,414,18,18),obstacles=[box(0,518,1280,166)];
  const p=placeDealControl({width:192,height:46,viewport:{width:1280,top:0,bottom:684},targets:[...targets,clear],obstacles});
  assert.ok(p);assert.ok([...targets,clear,...obstacles].every(o=>!overlaps(box(p.x,p.y,192,46),o)));
});

test('the actual deal control warns only for an enabled button and recovers after a no-fit layout',()=>{
  const source=readFileSync(new URL('../services/game/public/app.mjs',import.meta.url),'utf8');
  const fragment=source.slice(source.indexOf('function layoutDealControl()'),source.indexOf('// ---------- demo cashier'));
  const control={disabled:true,offsetWidth:171,offsetHeight:47,style:{}};
  const target={getClientRects:()=>[{}],getBoundingClientRect:()=>box(603,449,73,57)};
  const nodes={'#deal-now':control,'#dealer-picker':{getBoundingClientRect:()=>({top:682})}};
  nodes['#scene']={dataset:{betPlacement:'under-cards'},append:notice=>{nodes['#'+notice.id]=notice;}};
  let measurements=0;
  const context=vm.createContext({innerWidth:1280,$:selector=>nodes[selector],
    seatEls:[{classList:{contains:()=>false},querySelectorAll:()=>[target]}],
    getComputedStyle:()=>({display:'block',visibility:'visible'}),
    document:{querySelectorAll:()=>[],createElement:()=>({setAttribute(){}})},
    placeDealControl:input=>{measurements++;return placeDealControl(input);}});
  vm.runInContext(fragment+';layoutDealControl()',context);
  assert.equal(measurements,0,'an unavailable button cannot produce a placement warning');
  assert.equal(nodes['#deal-placement-warning'],undefined);
  control.disabled=false;context.innerWidth=190;
  vm.runInContext('layoutDealControl()',context);
  assert.equal(control.style.visibility,'hidden');
  assert.equal(nodes['#deal-placement-warning'].hidden,false,'a genuinely impossible active button still warns');
  control.disabled=true;
  vm.runInContext('layoutDealControl()',context);
  assert.equal(nodes['#deal-placement-warning'].hidden,true);
  control.disabled=false;context.innerWidth=1280;
  vm.runInContext('layoutDealControl()',context);
  assert.equal(control.style.visibility,'');
  assert.equal(control.style.position,'fixed');
  assert.equal(nodes['#deal-placement-warning'].hidden,true);
  assert.equal(measurements,2,'reenabling measures the current layout again');
});
