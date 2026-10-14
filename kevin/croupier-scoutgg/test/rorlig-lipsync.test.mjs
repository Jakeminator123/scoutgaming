import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSharedTable} from '../server/shared-table.mjs';
import {mp4Duration,dealerLine,takeOf,kartaFor,scheduleTalks,LJUD_FORE} from '../server/rorlig-lipsync.mjs';
import {splitAccessUnits} from '../public/lip-layer.js';

// Emil 12 Oct: a ready dealer says his lines while he deals; the mouth is a patch per frame, tagged with take and frame.

test('an mp4 tells its length from its movie header', () => {
  const b=Buffer.alloc(40);b.write('mvhd',4);b[8]=0;b.writeUInt32BE(1000,20);b.writeUInt32BE(3413,24);
  assert.equal(mp4Duration(b),3.413);
  const v1=Buffer.alloc(48);v1.write('mvhd',4);v1[8]=1;v1.writeUInt32BE(24000,28);v1.writeBigUInt64BE(81920n,32);
  assert.equal(mp4Duration(v1),81920/24000);
  assert.equal(mp4Duration(Buffer.from('no header')),null);
});

test("a manifest line maps to the dealer's own take in the table language, English when he has none in it", () => {
  const dir={linesDir:'/media/dealers/paow/repliker/',langs:['sv','en']};
  assert.deepEqual(dealerLine('/media/repliker/goodluck_2.mp4','sv',dir),{id:'goodluck_2',lang:'sv',url:'/media/dealers/paow/repliker/sv/goodluck_2.mp4'});
  assert.equal(dealerLine('/media/repliker-es/bust_1_es.mp4','es',dir).url,'/media/dealers/paow/repliker/en/bust_1.mp4');
  assert.equal(dealerLine('/media/deal/pos4.mp4','sv',dir),null);
});

test('a step names the take file the dealer plays, variant included', () => {
  assert.equal(takeOf({clip:{url:'/media/deal/pos4.mp4'},variant:'iv'}),'pos4-iv');
  assert.equal(takeOf({clip:{url:'/media/deal/hole.mp4'},variant:''}),'hole');
  assert.equal(takeOf({clip:{url:'/media/repliker/bust_1.mp4'}}),null);
});

test('the frame map follows the takes, holds the last frame in a gap and rests after a take that ends at rest', () => {
  const ms=f=>f*1000/24;
  const steps=[
    {kind:'deal',clip:{url:'/media/deal/pos6.mp4'},variant:'i',startAt:1000,endAt:1000+ms(60)},
    {kind:'deal',clip:{url:'/media/deal/pos4.mp4'},variant:'',startAt:1000+ms(60),endAt:1000+ms(99)},
    {kind:'deal',clip:{url:'/media/deal/pos2.mp4'},variant:'u',startAt:1000+ms(99)+80,endAt:1000+ms(159)+80},
  ];
  const k=kartaFor(steps,1000+ms(50),130);
  assert.deepEqual(k[0],['pos6-i',50,10]);
  assert.deepEqual(k[1],['pos4',0,39]);
  // the 80 ms gap: pos4's last frame stays on screen (two frames of 41.7 ms)
  assert.deepEqual(k.slice(2,4).map(x=>x.join()),['pos4,38,1','pos4,38,1']);
  assert.equal(k[4][0],'pos2-u');
  assert.deepEqual(k.at(-1)[0],'vila','after a take that ends at rest he rests');
  assert.equal(k.reduce((n,x)=>n+x[2],0),130);
  assert.deepEqual(kartaFor(steps,0,5),[['vila',0,5]],'before the plan he rests');
});

test('lines are timed over the cards: before the first card while he reaches, after a card once it landed, never overlapping', () => {
  const steps=[{clip:{},startAt:1000,endAt:3000},{clip:{},startAt:3000,endAt:4000}];
  const [a,b,c]=scheduleTalks([{after:0,dur:3},{after:1,dur:2},{after:2,dur:1}],steps,{free:0,end:4000});
  assert.equal(a.startAt,1600);assert.equal(a.endAt,4600);assert.equal(a.kartaStart,1600-LJUD_FORE*1000);
  assert.equal(b.startAt,4850,'the bust line waits for the line before it');
  assert.equal(c.startAt,b.endAt+250);
  assert.equal(scheduleTalks([{after:0,dur:1}],steps,{free:9000})[0].startAt,9000,'a line never starts before the table is free');
});

const talkManifest={deal:[1,2,3,4,5,6,7,'dealer'].map(i=>({id:`deal_pos${i}`,url:`/media/deal/pos${i}.mp4`,dur:.1})).concat(['hole','flip'].map(i=>({id:`deal_${i}`,url:`/media/deal/${i}.mp4`,dur:.1}))),
  repliker:['goodluck','bust','win','lose','push','blackjack','dealerblackjack','dealerbust','insurance','sidebet','double'].map(e=>({id:`${e}_1`,event:e,url:`/media/repliker/${e}_1.mp4`,dur:3,text:e})),idle:[]};
function talkTable(opts={}){
  const take={'-':39,'-i':60,'-u':60,'-iu':81,'-v':39,'-iv':60},frames=Object.fromEntries(['1','2','3','4','5','6','7','dealer'].map(k=>[k,take]));
  frames.hole={'-':39,'-i':60,'-u':39,'-iu':60};frames.flip={'-':56,'-i':56,'-u':56,'-iu':56};
  const ready={frames,restEnd:['hole','flip'],restStart:['flip']};
  const dir=mkdtempSync(join(tmpdir(),'talk-')),box={warm:true,planned:[],time:100000};
  const s=createSharedTable(join(dir,'t.sqlite'),{manifest:talkManifest,now:()=>box.time,readyFor:()=>ready,
    talk:()=>box.warm?{line:clip=>({url:clip.url.replace('/media/repliker/','/media/dealers/paow/repliker/sv/'),lang:'sv',dur:3.2})}:null,
    onPlan:(room,plan,r,extra)=>box.planned.push({plan,...extra}),...opts});
  const st=room=>s.run('kevin',{session:room,op:'state'});
  const send=(room,op,extra={})=>s.run('kevin',{session:room,op,version:st(room).version,requestId:crypto.randomUUID(),...extra});
  const deal=room=>{send(room,'join',{name:'Kevin',seats:[3]});send(room,'bet',{seat:3,field:'main',chip:5});send(room,'ready');return st(room);};
  return{s,box,st,send,deal,close(){s.close();rmSync(dir,{recursive:true,force:true});}};
}

test("a ready dealer who can speak over his clips gets his lines on the talk track, not as steps; without a worker they stay steps", () => {
  const t=talkTable();
  try{
    const view=t.deal('paow'),plan=view.plan;
    assert.ok(!plan.steps.some(x=>x.kind==='speech'),'no line takes a slot of its own');
    const luck=view.talk.find(x=>x.event==='goodluck'),first=plan.steps.find(x=>x.kind==='deal');
    assert.ok(luck,'good luck is on the talk track');
    assert.equal(luck.startAt,first.startAt+600,'said while he reaches for the shoe');
    assert.equal(first.variant,'i','the first card follows straight on, no waiting for the line');
    assert.equal(luck.line,'/media/dealers/paow/repliker/sv/goodluck_1.mp4');
    assert.equal(t.box.planned.at(-1).plan.id,plan.id,'the plan goes to the lip-sync worker');
    assert.deepEqual(t.box.planned.at(-1).nya.map(x=>x.id),view.talk.map(x=>x.id));
    for(let i=1;i<view.talk.length;i++)assert.ok(view.talk[i].startAt>=view.talk[i-1].endAt,'lines never overlap');
    t.box.warm=false;
    const classic=t.deal('cold');
    assert.ok(classic.plan.steps.some(x=>x.kind==='speech'&&x.clip.id==='goodluck_1'),'without a warm worker the line is a step as before');
    assert.deepEqual(classic.talk,[]);
  }finally{t.close();}
});

test('an answer is said at once on the table clock, before recorded lines still to come; a late good luck is dropped', () => {
  const t=talkTable();
  try{
    t.send('paow','join',{name:'Kevin',seats:[3]});
    const between=t.s.addTalk('paow',{text:'Hej!',lang:'sv',dur:2});
    assert.equal(between.talk.flex,false,'also between rounds it runs on the table clock');
    assert.equal(between.talk.startAt,t.box.time+1600);
    assert.equal(between.talk.ljud,`/api/lip/${between.talk.id}/ljud`);
    assert.equal(t.st('paow').talk.at(-1).id,between.talk.id,'every viewer sees it on the talk track');
    t.send('paow','bet',{seat:3,field:'main',chip:5});t.send('paow','ready');
    let view=t.st('paow');const luck=view.talk.find(x=>x.event==='goodluck');
    assert.ok(luck.startAt>=between.talk.endAt,'the round\'s first line waits for the answer already speaking');
    assert.ok(t.box.planned.at(-1).omplanera.map(x=>x.id).includes(between.talk.id),'the answer still speaking when the cards come gets a new map');
    assert.ok(t.box.planned.at(-1).steg.length>=view.plan.steps.length);
    // a second question mid-deal: only the answer already speaking goes first, the good luck still to come is dropped
    const mid=t.s.addTalk('paow',{text:'Lycka till själv!',lang:'sv',dur:1.5});
    assert.equal(mid.talk.startAt,between.talk.endAt+250,'right after the answer speaking now, not after every line of the deal');
    view=t.st('paow');
    assert.ok(!view.talk.some(x=>x.event==='goodluck'),'a good luck that would come after the answers is dropped');
    for(const x of mid.moved)assert.ok(x.startAt>=mid.talk.endAt,'a moved line comes after the answer');
    assert.ok(mid.steg.some(x=>x.kind==='deal'),'its map can run over the round\'s takes');
    const sorted=[...view.talk].sort((a,b)=>a.startAt-b.startAt);
    for(let i=1;i<sorted.length;i++)assert.ok(sorted[i].startAt>=sorted[i-1].endAt,'nothing on the talk track overlaps');
  }finally{t.close();}
});

test('a piece splits into one access unit per frame at its delimiters, the first one a key frame', () => {
  const nal=(type,...rest)=>[0,0,0,1,type,...rest];
  const buf=Uint8Array.from([...nal(9,0xf0),...nal(7,1,2),...nal(8,3),...nal(5,4,4),...nal(9,0xf0),...nal(1,5),...nal(9,0xf0),0,0,1,1,6]);
  const units=splitAccessUnits(buf);
  assert.equal(units.length,3);
  assert.deepEqual(units.map(u=>u.key),[true,false,false]);
  assert.equal(units[0].data[4],9);assert.equal(units[0].data.length,6+7+6+7);
  assert.deepEqual([...units[2].data.slice(-2)],[1,6]);
});

test('the worker makes what is needed on screen soonest first: a new map for now, then the next line, then a later answer', async () => {
  const {RorligLipsync}=await import('../server/rorlig-lipsync.mjs');
  const r=new RorligLipsync({endpointId:'x',apiKey:'x',publicBase:()=>'https://x',publicDir:'.',log:()=>{},horizonMs:60_000});
  clearInterval(r.timer);
  const order=[],s=r.s.get('paow');
  r.addWorker('paow',{readyState:1,off(){},send(m){const j=JSON.parse(m);if(j.t==='start')order.push(j.id);},
    on(ev,f){if(ev==='message')setTimeout(()=>f(JSON.stringify({t:'done',id:order.at(-1)}),false),5);}},{rutor_per_s:60});   // one lane: the line's own id
  const now=Date.now(),done=[];
  done.push(r.speak('paow','rum',{id:'first',kartaStart:now+9000,line:'/a.mp4'},[]));   // the worker is free: it starts at once
  done.push(r.speak('paow','rum',{id:'answer-later',kartaStart:now+5000,line:'/a.mp4'},[]));
  done.push(r.speak('paow','rum',{id:'line-soon',kartaStart:now+1000,line:'/a.mp4'},[]));
  done.push(r.speak('paow','rum',{id:'remap-now',kartaStart:now-3000,line:'/a.mp4'},[],{fran:10}));
  await Promise.all(done);
  assert.deepEqual(order,['first','remap-now','line-soon','answer-later']);
});

test('a line is made only shortly before it is needed, and only its last version', async () => {
  const {RorligLipsync}=await import('../server/rorlig-lipsync.mjs');
  const r=new RorligLipsync({endpointId:'x',apiKey:'x',publicBase:()=>'https://x',publicDir:'.',log:()=>{},horizonMs:3000});
  clearInterval(r.timer);
  const made=[],s=r.s.get('paow');
  r.addWorker('paow',{readyState:1,off(){},send(m){const j=JSON.parse(m);if(j.t==='start')made.push([j.id,Date.now()]);},
    on(ev,f){if(ev==='message')setTimeout(()=>f(JSON.stringify({t:'done',id:made.at(-1)[0]})),5);}},{rutor_per_s:60});
  const now=Date.now(),talk={id:'insurance',kartaStart:now+3200,line:'/a.mp4'};
  const v1=r.speak('paow','rum',talk,[]);
  const v2=r.speak('paow','rum',talk,[]);   // the plan changed before the line was made
  await Promise.all([v1,v2]);
  assert.equal(made.length,1,'one version made');
  assert.ok(made[0][1]-now>=150,'not before its horizon');
  assert.equal(r.index('insurance').ver,2);
});

test('a two-lane worker takes an urgent remap at once beside a long line, and stops the version it replaces', async () => {
  const {RorligLipsync}=await import('../server/rorlig-lipsync.mjs');
  const r=new RorligLipsync({endpointId:'x',apiKey:'x',publicBase:()=>'https://x',publicDir:'.',log:()=>{},maxLanes:2});
  clearInterval(r.timer);
  const sent=[],h=[],s=r.s.get('paow');
  r.addWorker('paow',{readyState:1,off(ev,f){const i=h.indexOf(f);if(i>=0)h.splice(i,1);},send(m){if(typeof m==='string')sent.push(JSON.parse(m));},on(ev,f){if(ev==='message')h.push(f);}},{rutor_per_s:60,spar:2});
  const msg=m=>[...h].forEach(f=>f(JSON.stringify(m),false));
  const now=Date.now();
  const line=r.speak('paow','rum',{id:'insurance',kartaStart:now+1500,line:'/a.mp4'},[]);
  const answer={id:'answer',kartaStart:now+1000};
  const v1=r.speak('paow','rum',answer,[],{pcm:Buffer.alloc(4800)});
  assert.deepEqual(sent.filter(m=>m.t==='start').map(m=>m.id),['insurance#1','answer#1'],'the answer takes the second lane');
  const v2=r.speak('paow','rum',answer,[],{fran:30});   // a hit: new cards under the answer
  assert.ok(sent.some(m=>m.t==='avbryt'&&m.id==='answer#1'),'the old version is stopped');
  msg({t:'error',id:'answer#1',reason:'avbruten'});
  await v1;await new Promise(r=>setImmediate(r));   // the lane is freed right after
  const st=sent.filter(m=>m.t==='start').at(-1);
  assert.equal(st.id,'answer#2');
  assert.equal(st.ljud_id,'answer');
  assert.equal(st.samma_ljud,true,'the voice is not sent again');
  msg({t:'done',id:'answer#2'});msg({t:'done',id:'insurance#1'});
  await Promise.all([v2,line]);
  assert.equal(r.index('answer').fel,null);
});

test('a worker that goes away mid-line ends that line at once, so the lines behind it do not wait', async () => {
  const {RorligLipsync}=await import('../server/rorlig-lipsync.mjs');
  const r=new RorligLipsync({endpointId:'x',apiKey:'x',publicBase:()=>'https://x',publicDir:'.',log:()=>{}});
  clearInterval(r.timer);
  const s=r.s.get('paow'),h={};
  r.addWorker('paow',{readyState:1,send(){},off(){},on(ev,f){h[ev]=f;}},{rutor_per_s:60});
  const t0=Date.now(),done=r.speak('paow','rum',{id:'gone',kartaStart:t0+2000,line:'/a.mp4'},[]);
  setTimeout(()=>h.close(),20);
  await done;
  assert.ok(Date.now()-t0<1000);
  assert.equal(r.index('gone').fel,'worker gone');
});

test('a worker too slow to keep ahead of the picture is sent away and never replaces the one speaking', async () => {
  const {RorligLipsync}=await import('../server/rorlig-lipsync.mjs');
  const r=new RorligLipsync({endpointId:'x',apiKey:'x',publicBase:()=>null,publicDir:'.',log:()=>{}});
  clearInterval(r.timer);
  const s=r.s.get('paow'),dial=pong=>{const sent=[],h={};const ws={readyState:1,sent,send(m){sent.push(JSON.parse(m).t);},once(ev,f){h[ev]=f;},on(){},close(){}};
    r.adoptWorker(ws,new URL(`https://x/lipsync-rorlig?token=${r.token}&avatar=paow`));h.message(JSON.stringify({t:'pong',gpu:'4090',...pong}));return ws;};
  const good=dial({rutor_per_s:56});
  assert.deepEqual(r.workers('paow').map(w=>w.ws),[good]);
  const slow=dial({rutor_per_s:14.5});
  assert.deepEqual(r.workers('paow').map(w=>w.ws),[good]);
  assert.deepEqual(slow.sent,['bye']);
  assert.ok(Date.now()-s.askedAt>200_000);   // a new order may go out at once
});

test('the next decision opens once the last card has landed; a card asked for then starts after the take, never cutting it', async () => {
  const {DatabaseSync}=await import('node:sqlite');
  const manifest={deal:[1,2,3,4,5,6,7,'dealer'].map(i=>({id:`deal_pos${i}`,url:`/media/deal/pos${i}.mp4`,dur:.1})).concat(['hole','flip'].map(i=>({id:`deal_${i}`,url:`/media/deal/${i}.mp4`,dur:.1}))),repliker:[],idle:[]};
  const take={'-':39,'-i':60,'-u':60,'-iu':81,'-v':39,'-iv':60},frames=Object.fromEntries(['1','2','3','4','5','6','7','dealer'].map(k=>[k,take]));
  frames.hole={'-':39,'-i':60,'-u':39,'-iu':60};frames.flip={'-':56,'-i':56,'-u':56,'-iu':56};
  const dir=mkdtempSync(join(tmpdir(),'turn-'));let time=100000;
  const s=createSharedTable(join(dir,'t.sqlite'),{manifest,now:()=>time,readyFor:()=>({frames,restEnd:['hole','flip'],restStart:['flip']})});
  try{
    const st=()=>s.run('kevin',{session:'v',op:'state'});const send=(op,extra={})=>s.run('kevin',{session:'v',op,version:st().version,requestId:crypto.randomUUID(),...extra});
    send('join',{name:'Kevin',seats:[3]});
    // fixed shoe (as in table-limits.test.mjs): 5 and 7 against a 6, then small cards, so the hand keeps deciding
    {const db=new DatabaseSync(join(dir,'t.sqlite')),row=JSON.parse(db.prepare('SELECT state FROM shared_rooms WHERE id=?').get('v').state);
     const ranks=['5','6','7','10','2','2','2','2'];row.game.shoe.cards.splice(-ranks.length,ranks.length,...ranks.map((r,i)=>({r,s:['♠','♦','♥','♣'][i%4]})).reverse());
     db.prepare('UPDATE shared_rooms SET state=? WHERE id=?').run(JSON.stringify(row),'v');db.close();}
    send('bet',{seat:3,field:'main',chip:5});send('ready');
    time=st().plan.endAt+10;assert.equal(st().round.phase,'decisions');
    send('act',{action:'hit'});
    const hit=st().plan,card=hit.steps.find(x=>x.kind==='deal');
    assert.ok(hit.turnAt<hit.endAt,'the turn opens before the take has returned to rest');
    assert.equal(hit.turnAt,Math.round(card.startAt+.62*(card.endAt-card.startAt)),'once the card has landed');
    time=hit.turnAt+10;assert.equal(st().round.phase,'decisions');
    send('act',{action:'hit'});
    const next=st().plan.steps.find(x=>x.kind==='deal');
    assert.ok(next.startAt>=hit.endAt,'the next card starts after the previous take has ended');
  }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});

test('with one lane a hit during an answer stops the answer in hand, so its remap starts at once', async () => {
  const {RorligLipsync}=await import('../server/rorlig-lipsync.mjs');
  const r=new RorligLipsync({endpointId:'x',apiKey:'x',publicBase:()=>'https://x',publicDir:'.',log:()=>{}});
  clearInterval(r.timer);
  const sent=[],h=[],s=r.s.get('paow');
  r.addWorker('paow',{readyState:1,off(ev,f){const i=h.indexOf(f);if(i>=0)h.splice(i,1);},send(m){if(typeof m==='string')sent.push(JSON.parse(m));},on(ev,f){if(ev==='message')h.push(f);}},{rutor_per_s:60,spar:2});
  const msg=m=>[...h].forEach(f=>f(JSON.stringify(m),false));
  const answer={id:'answer',kartaStart:Date.now()+1000};
  const v1=r.speak('paow','rum',answer,[],{pcm:Buffer.alloc(4800)});
  const v2=r.speak('paow','rum',answer,[],{fran:30});
  assert.ok(sent.some(m=>m.t==='avbryt'&&m.id==='answer#1'));
  msg({t:'error',id:'answer#1',reason:'avbruten'});
  await v1;await new Promise(r=>setImmediate(r));
  assert.equal(sent.filter(m=>m.t==='start').at(-1).id,'answer#2');
  msg({t:'done',id:'answer#2'});
  await v2;
});

test('two pods are two lanes: a hit during an answer has its remap made on the other pod at once', async () => {
  const {RorligLipsync}=await import('../server/rorlig-lipsync.mjs');
  const r=new RorligLipsync({endpointId:'x',apiKey:'x',publicBase:()=>'https://x',publicDir:'.',log:()=>{}});
  clearInterval(r.timer);
  const pod=name=>{const sent=[],h=[];return {name,sent,h,ws:{readyState:1,off(ev,f){const i=h.indexOf(f);if(i>=0)h.splice(i,1);},send(m){if(typeof m==='string')sent.push(JSON.parse(m));},on(ev,f){if(ev==='message')h.push(f);}}};};
  const a=pod('toucan'),b=pod('pod2');
  r.addWorker('paow',a.ws,{rutor_per_s:60,spar:2},'toucan');
  r.addWorker('paow',b.ws,{rutor_per_s:60,spar:2},'pod2');
  const starts=p=>p.sent.filter(m=>m.t==='start').map(m=>m.id);
  const answer={id:'answer',kartaStart:Date.now()+1000};
  const v1=r.speak('paow','rum',answer,[],{pcm:Buffer.alloc(4800)});
  assert.deepEqual(starts(a),['answer#1']);
  const v2=r.speak('paow','rum',answer,[],{fran:30});   // a hit: new cards under the answer
  assert.ok(a.sent.some(m=>m.t==='avbryt'&&m.id==='answer#1'),'the old version is stopped');
  assert.deepEqual(starts(b),['answer#2'],'the remap starts on the second pod without waiting for the first');
  assert.ok(!b.sent.find(m=>m.t==='start').samma_ljud,'the second pod gets the voice');
  [...a.h].forEach(f=>f(JSON.stringify({t:'error',id:'answer#1',reason:'avbruten'}),false));
  [...b.h].forEach(f=>f(JSON.stringify({t:'done',id:'answer#2'}),false));
  await Promise.all([v1,v2]);
  assert.equal(r.index('answer').fel,null);
  assert.deepEqual(r.status().paow.workers.map(w=>w.pod),['toucan','pod2']);
});

test('a pod dials with the pod token, stays when the table goes quiet, and no serverless session is ordered meanwhile', async () => {
  const {RorligLipsync}=await import('../server/rorlig-lipsync.mjs');
  const orders=[];
  const r=new RorligLipsync({endpointId:'x',apiKey:'k',publicBase:()=>'https://x',publicDir:'.',log:()=>{},inactivityMs:1,
    fetchImpl:async(u)=>{orders.push(u);return {json:async()=>({id:'j'})};}});
  clearInterval(r.timer);
  const dial=(token,pod)=>{const sent=[],h={};const ws={readyState:1,sent,closed:null,send(m){sent.push(JSON.parse(m).t);},once(ev,f){h[ev]=f;},on(){},close(c){ws.closed=c;}};
    r.adoptWorker(ws,new URL(`https://x/lipsync-rorlig?token=${token}&avatar=paow${pod?'&pod='+pod:''}`));h.message?.(JSON.stringify({t:'pong',gpu:'4090',rutor_per_s:60}));return ws;};
  assert.equal(dial('fel','toucan').closed,4403);
  assert.equal(dial(r.token+'x').closed,4403);
  assert.ok(r.podToken().length>=32);
  const p=dial(r.podToken(),'toucan');
  assert.equal(p.closed,null);
  assert.ok(r.ready('paow'));
  r.startedAt=0;r.activity('paow');
  await new Promise(res=>setTimeout(res,5));
  assert.equal(orders.length,0,'no serverless order while a pod is connected');
  await new Promise(res=>setTimeout(res,5));
  r.s.get('paow').active=Date.now()-10;   // the table went quiet
  await new Promise(res=>setTimeout(res,5));
  assert.ok(!p.sent.includes('bye'),'a pod is never sent away for a quiet table');
  assert.equal(r.workers('paow').length,1);
});
