import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSharedTable} from '../server/shared-table.mjs';
import {mp4Duration,dealerLine,takeOf,kartaFor,scheduleTalks,LJUD_FORE,idleFrom,idleChain} from '../server/rorlig-lipsync.mjs';
import {splitAccessUnits} from '../public/lip-layer.js';
import {DatabaseSync} from 'node:sqlite';
import {waitClips} from '../public/idle-chain.js';

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
  const ready={frames,restEnd:['hole','flip'],restStart:['flip'],...(opts.idle?{idle:opts.idle}:{})};
  const dir=mkdtempSync(join(tmpdir(),'talk-')),box={warm:true,planned:[],time:100000};
  const s=createSharedTable(join(dir,'t.sqlite'),{manifest:talkManifest,now:()=>box.time,readyFor:()=>ready,
    talk:()=>box.warm?{line:clip=>({url:clip.url.replace('/media/repliker/','/media/dealers/paow/repliker/sv/'),lang:'sv',dur:3.2}),...(opts.workerIdle?{idle:opts.workerIdle}:{})}:null,   // workerIdle: the idle takes the connected worker announced
    onPlan:(room,plan,r,extra)=>box.planned.push({plan,...extra}),...opts});
  const st=room=>s.run('kevin',{session:room,op:'state'});
  const send=(room,op,extra={})=>s.run('kevin',{session:room,op,version:st(room).version,requestId:crypto.randomUUID(),...extra});
  const deal=room=>{send(room,'join',{name:'Kevin',seats:[3]});send(room,'bet',{seat:3,field:'main',chip:5});send(room,'ready');return st(room);};
  return{s,box,st,send,deal,file:join(dir,'t.sqlite'),close(){s.close();rmSync(dir,{recursive:true,force:true});}};
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

test('the fastest idle pod takes a line, and a pod that hung rests for a minute while the other one works', async () => {
  const {RorligLipsync}=await import('../server/rorlig-lipsync.mjs');
  const r=new RorligLipsync({endpointId:'x',apiKey:'x',publicBase:()=>'https://x',publicDir:'.',log:()=>{}});
  clearInterval(r.timer);
  const pod=()=>{const sent=[],h=[];return {sent,h,ws:{readyState:1,off(ev,f){const i=h.indexOf(f);if(i>=0)h.splice(i,1);},send(m){if(typeof m==='string')sent.push(JSON.parse(m));},on(ev,f){if(ev==='message')h.push(f);}}};};
  const slow=pod(),fast=pod();
  const ws=r.addWorker('paow',slow.ws,{rutor_per_s:58,spar:2},'pod2');
  r.addWorker('paow',fast.ws,{rutor_per_s:90,spar:2},'pod3');
  const starts=p=>p.sent.filter(m=>m.t==='start').map(m=>m.id);
  const a=r.speak('paow','rum',{id:'a',kartaStart:Date.now()+1000,line:'/a.mp4'},[]);
  assert.deepEqual(starts(fast),['a#1'],'the faster pod first');
  [...fast.h].forEach(f=>f(JSON.stringify({t:'done',id:'a#1'}),false));await a;
  fast.ws.readyState=3;ws.badUntil=Date.now()+60_000;   // the fast one is gone, the other one hung: it still takes lines
  const b=r.speak('paow','rum',{id:'b',kartaStart:Date.now()+1000,line:'/a.mp4'},[]);
  assert.deepEqual(starts(slow),['b#1'],'a resting pod still works when it is the only one');
  [...slow.h].forEach(f=>f(JSON.stringify({t:'done',id:'b#1'}),false));await b;
  fast.ws.readyState=1;
  const c=r.speak('paow','rum',{id:'c',kartaStart:Date.now()+1000,line:'/a.mp4'},[]);
  assert.deepEqual(starts(fast),['a#1','c#1']);
  [...fast.h].forEach(f=>f(JSON.stringify({t:'done',id:'c#1'}),false));await c;
  assert.equal(r.status().paow.workers.find(w=>w.pod==='pod2').resting>0,true);
});

// Kevin 20 Oct: a ready dealer keeps moving while he speaks at rest. His short idle takes (v2/idle1.mp4 …, VILA to VILA)
// chain under the talk; the map, every viewer and a remap lay the same chain, and only his start picture is returned to.

test('his idle takes chain from VILA to VILA under a talk at rest: the same chain for the same talk, never one take twice in a row, until the talk ends', () => {
  const idles=[{take:'idle1',frames:39},{take:'idle2',frames:39},{take:'idle3',frames:73}];
  const a=idleChain(idles,1000,5000,'talk-1');
  assert.deepEqual(idleChain(idles,1000,5000,'talk-1'),a,'deterministic from the talk id');
  assert.equal(a[0].startAt,1000);
  for(let i=1;i<a.length;i++){assert.equal(a[i].startAt,a[i-1].endAt,'back to back');assert.notEqual(a[i].take,a[i-1].take,'never the same gesture twice in a row');}
  assert.ok(a.at(-1).endAt>=5000,'covers the talk');
  for(const c of a)assert.ok(Math.abs(c.endAt-c.startAt-c.frames*1000/24)<.2,'each clip lasts its frames');
  const seeds=new Set(Array.from({length:12},(_,i)=>idleChain(idles,1000,5000,`talk-${i}`).map(c=>c.take).join()));
  assert.ok(seeds.size>1,'different talks get different chains');
  assert.deepEqual(idleChain([],1000,5000,'x'),[],'no idle takes: no chain');
  assert.deepEqual(idleChain([{take:'idle1',frames:39}],0,100,'x').map(c=>c.take),['idle1'],'one take repeats');
  assert.deepEqual(idleChain(idles,5000,1000,'x'),[]);
  const weighted=[{take:'andas',frames:73,vikt:20},{take:'huvud',frames:73,vikt:1}];
  const n=Array.from({length:40},(_,i)=>idleChain(weighted,0,100000,`t${i}`)).flat().filter(c=>c.take==='andas').length;
  assert.ok(n>40*33*.5,'the weights count: breathing far more often than the rare gesture');
});

test('the frame map runs over the idle chain where he would rest: under the takes, and never over a held pose', () => {
  const ms=f=>f*1000/24;
  const steps=[{kind:'deal',clip:{url:'/media/deal/pos4.mp4'},variant:'i',startAt:1000,endAt:1000+ms(60)},
    {kind:'deal',clip:{url:'/media/deal/pos2.mp4'},variant:'u',startAt:1000+ms(60)+80,endAt:1000+ms(120)+80}];
  const idle=[{take:'idle1',startAt:0,endAt:ms(39),frames:39},{take:'idle2',startAt:ms(39),endAt:ms(78),frames:39}];
  assert.deepEqual(kartaFor(steps,0,30,{idle}),[['idle1',0,24],['pos4-i',0,6]],'the idle until the take, then the take');
  assert.deepEqual(kartaFor([],ms(37),4,{idle}),[['idle1',37,2],['idle2',0,2]],'the chain joins at its boundary');
  const end=1000+ms(120)+80;
  assert.deepEqual(kartaFor(steps,end,3,{idle:[{take:'idle3',startAt:end,endAt:end+ms(39),frames:39}]}),[['idle3',0,3]],'after a take that ends at rest, the chain');
  assert.deepEqual(kartaFor(steps,end,3),[['vila',0,3]],'without a chain, his still as before');
  const redo=[{kind:'deal',clip:{url:'/media/deal/pos4.mp4'},variant:'',startAt:1000,endAt:1000+ms(39)}];
  assert.deepEqual(kartaFor(redo,1000+ms(39),2,{idle:[{take:'idle1',startAt:1000,endAt:1000+ms(78),frames:39}]}),[['pos4',38,1],['pos4',38,1]],'a take that ends in REDO holds its last frame, no idle under it');
});

test("a talk at rest gets its idle from its first frame; after a take under it that ends at rest, from that take's end; none while he holds a pose", () => {
  const ms=f=>f*1000/24,talk={kartaStart:2000,startAt:2220,endAt:5000};
  assert.equal(idleFrom([],talk),2000);
  const u={kind:'deal',clip:{url:'/media/deal/pos2.mp4'},variant:'u',startAt:1500,endAt:1500+ms(60)};
  assert.equal(idleFrom([u],talk),u.endAt,'from the end of the take he returns to rest with');
  assert.equal(idleFrom([{...u,variant:''}],talk),null,'a take that ends in REDO: he holds it');
  assert.equal(idleFrom([{...u,startAt:0,endAt:1500}],talk),2000,'a take long over: from the first frame');
  assert.equal(idleFrom([{...u,variant:'',startAt:0,endAt:1500}],talk),null,'still in REDO from before: no idle');
  const hole={kind:'reveal',clip:{url:'/media/deal/hole.mp4'},variant:'',track:'hole',startAt:1500,endAt:1500+ms(39)};
  assert.equal(idleFrom([hole],talk,{restEnd:['hole','flip']}),hole.endAt,'a take filmed back to rest counts as rest');
  assert.equal(idleFrom([{...u,startAt:5500,endAt:5500+ms(60)}],talk),2000,'a take after the talk does not matter');
  assert.equal(idleFrom([{...u,startAt:4000,endAt:5200}],talk),null,'a take that ends with the talk leaves no room');
  const hole2={...hole,startAt:4980-ms(39),endAt:4980},flip={kind:'reveal',clip:{url:'/media/deal/flip.mp4'},variant:'',track:'flip',startAt:5060,endAt:5060+ms(39)};
  assert.equal(idleFrom([hole2,flip],talk,{restEnd:['hole','flip']}),null,'the 80 ms before the next take is no room for an idle, also when that take starts after the talk');
});

test('between rounds an answer runs over his idle takes, the same chain for every viewer and the worker; mid-round over the wait chain', () => {
  const ms=f=>f*1000/24;
  const idle=[{take:'idle1',frames:39,calm:true},{take:'idle2',frames:39,calm:true}];
  const t=talkTable({idle,workerIdle:['idle1','idle2']});
  try{
    t.send('paow','join',{name:'Kevin',seats:[3]});
    const a=t.s.addTalk('paow',{text:'Hej!',lang:'sv',dur:2});
    assert.ok(a.talk.idle?.length>=2,'between rounds the answer carries his idle chain');
    assert.equal(a.talk.idle[0].startAt,a.talk.kartaStart,'from its first frame');
    assert.ok(a.talk.idle.at(-1).endAt>=a.talk.endAt+600,'past its end, where the last patches land');
    assert.equal(t.st('paow').talk.at(-1).idle.length,a.talk.idle.length,'every viewer sees the chain');
    const k=kartaFor(a.steg,a.talk.kartaStart,10,{restEnd:a.ready.restEnd,idle:a.talk.idle});
    assert.deepEqual(k,[[a.talk.idle[0].take,0,10]],"the worker's map starts on the chain's first take");
    t.box.time=a.talk.endAt+1000;
    t.send('paow','bet',{seat:3,field:'main',chip:5});t.send('paow','ready');
    const view=t.st('paow'),luck=view.talk.find(x=>x.event==='goodluck');
    assert.ok(luck&&!luck.idle,'a line over the cards mid-round has no idle chain');
    t.box.time=view.plan.endAt+10;
    const mid=t.s.addTalk('paow',{text:'Jaha',lang:'sv',dur:1});
    // Kevin 20 Oct: while the table waits for the player he no longer holds his pose: the answer runs over the wait's chain
    assert.ok(mid.talk.idle?.length,'mid-round, while the table waits for the player, the answer runs over the wait chain');
    assert.equal(mid.talk.idle[0].startAt,t.st('paow').waits[0].from+Math.floor((mid.talk.kartaStart-t.st('paow').waits[0].from)/ms(39))*ms(39),'the same clips every viewer shows');
  }finally{t.close();}
});

test('without idle takes nothing changes: no chain on any talk', () => {
  const t=talkTable();
  try{
    t.send('paow','join',{name:'Kevin',seats:[3]});
    assert.ok(!t.s.addTalk('paow',{text:'Hej!',lang:'sv',dur:2}).talk.idle);
  }finally{t.close();}
});

// Kevin 20 Oct, part (b): the chain at rest only when a connected worker announced the idle takes (its pong "takes"),
// built from the takes it has; the line then goes to that worker, everything else to the fastest as before.

test('with only a worker that has the deals (ko2) a talk at rest gets no chain, and the chain uses only the takes the worker announced', () => {
  const idle=[{take:'andas',frames:39},{take:'andasb',frames:39},{take:'huvud',frames:39}];
  const none=talkTable({idle});
  try{
    none.send('paow','join',{name:'Kevin',seats:[3]});
    assert.ok(!none.s.addTalk('paow',{text:'Hej!',lang:'sv',dur:2}).talk.idle,'no idle-capable worker: he rests on his still, the mouth on it, as before');
  }finally{none.close();}
  const some=talkTable({idle,workerIdle:['andas','blickvanster']});
  try{
    some.send('paow','join',{name:'Kevin',seats:[3]});
    const a=some.s.addTalk('paow',{text:'Hej!',lang:'sv',dur:4});
    assert.ok(a.talk.idle?.length>=2);
    assert.deepEqual([...new Set(a.talk.idle.map(c=>c.take))],['andas'],'only the take the worker has, never one it lacks');
  }finally{some.close();}
});

test('a worker announces its takes in pong: a line over idle takes goes to the worker that has them, a plain line to the fastest, and with no such worker to the fastest as before', async () => {
  const {RorligLipsync,idleTakesIn,vilaMap}=await import('../server/rorlig-lipsync.mjs');
  const r=new RorligLipsync({endpointId:'x',apiKey:'x',publicBase:()=>'https://x',publicDir:'.',log:()=>{},horizonMs:60_000,dealers:['dragge']});
  clearInterval(r.timer);
  const pod=()=>{const sent=[],h=[],c=[];return {sent,h,c,ws:{readyState:1,off(ev,f){for(const l of [h,c]){const i=l.indexOf(f);if(i>=0)l.splice(i,1);}},send(m){if(typeof m==='string')sent.push(JSON.parse(m));},on(ev,f){if(ev==='message')h.push(f);if(ev==='close')c.push(f);}}};};
  const ko2=pod(),ours=pod();
  r.addWorker('dragge',ko2.ws,{rutor_per_s:95,spar:1},'ko2');
  r.addWorker('dragge',ours.ws,{rutor_per_s:40,spar:1,takes:['pos1','pos1-i','hole','flip','andas','andasb']},'ours');
  assert.deepEqual(r.idleTakes('dragge'),['andas','andasb'],'the idle takes some connected worker announced');
  assert.equal(r.status().dragge.workers.find(w=>w.pod==='ours').takes,6);
  const starts=p=>p.sent.filter(m=>m.t==='start').map(m=>m.id);
  const done=(p,id)=>[...p.h].forEach(f=>f(JSON.stringify({t:'done',id}),false));
  const now=Date.now();
  const plain=r.speak('dragge','rum',{id:'plain',kartaStart:now+1000,endAt:now+4000,line:'/a.mp4'},[['pos1-i',0,30],['vila',0,10]]);
  assert.deepEqual(starts(ko2),['plain'],'a plain line: the fastest worker');
  done(ko2,'plain');await plain;
  const over=r.speak('dragge','rum',{id:'over',kartaStart:now+1000,endAt:now+4000,line:'/a.mp4'},[['flip',0,20],['andas',0,39],['andasb',0,20]]);
  assert.deepEqual(starts(ours),['over'],'a line over his idle takes: the worker that has them, although slower');
  assert.deepEqual(ours.sent.find(m=>m.id==='over').karta[1],['andas',0,39],'its map keeps the idle takes');
  done(ours,'over');await over;
  assert.deepEqual(idleTakesIn([['flip',0,20],['andas',0,39],['vila',0,2],['posdealer-v',3,4],['hands',0,2]]),['andas']);
  assert.deepEqual(vilaMap([['flip',0,20],['andas',0,39]]),[['flip',0,20],['vila',0,39]]);
  ours.ws.readyState=3;   // only ko2 left: the line goes there as before
  assert.deepEqual(r.idleTakes('dragge'),[]);
  const alone=r.speak('dragge','rum',{id:'alone',kartaStart:now+1000,endAt:now+4000,line:'/a.mp4'},[['andas',0,39]]);
  assert.deepEqual(starts(ko2),['plain','alone']);
  done(ko2,'alone');await alone;
});

test('when the worker with his idle takes goes away mid-line, the line is remade once on another worker with the idle frames as rest', async () => {
  const {RorligLipsync}=await import('../server/rorlig-lipsync.mjs');
  const r=new RorligLipsync({endpointId:'x',apiKey:'x',publicBase:()=>'https://x',publicDir:'.',log:()=>{},horizonMs:60_000,dealers:['dragge']});
  clearInterval(r.timer);
  const pod=()=>{const sent=[],h=[],c=[];return {sent,h,c,ws:{readyState:1,off(ev,f){for(const l of [h,c]){const i=l.indexOf(f);if(i>=0)l.splice(i,1);}},send(m){if(typeof m==='string')sent.push(JSON.parse(m));},on(ev,f){if(ev==='message')h.push(f);if(ev==='close')c.push(f);}}};};
  const ko2=pod(),ours=pod();
  r.addWorker('dragge',ko2.ws,{rutor_per_s:95,spar:1},'ko2');
  r.addWorker('dragge',ours.ws,{rutor_per_s:40,spar:1,takes:['flip','andas']},'ours');
  const now=Date.now();
  const over=r.speak('dragge','rum',{id:'over',kartaStart:now+1000,endAt:now+6000,line:'/a.mp4'},[['flip',0,20],['andas',0,39]]);
  assert.deepEqual(ours.sent.filter(m=>m.t==='start').map(m=>m.id),['over']);
  ours.ws.readyState=3;[...ours.c].forEach(f=>f());   // gone mid-line
  await new Promise(res=>setTimeout(res,10));
  const again=ko2.sent.find(m=>m.t==='start'&&m.id==='over');
  assert.ok(again,'made once more on the other worker');
  assert.deepEqual(again.karta,[['flip',0,20],['vila',0,39]],'with the idle frames as rest, which that worker can make');
  [...ko2.h].forEach(f=>f(JSON.stringify({t:'done',id:'over'}),false));await over;
  assert.equal(r.index('over').fel,null);
  await new Promise(res=>setTimeout(res,0));   // the worker's lane frees after the line's promise settles
  // a plain line that fails is not remade (as before)
  const plain=r.speak('dragge','rum',{id:'plain',kartaStart:now+1000,endAt:now+6000,line:'/a.mp4'},[['flip',0,20]]);
  assert.ok(ko2.sent.some(m=>m.t==='start'&&m.id==='plain'));
  ko2.ws.readyState=3;[...ko2.c].forEach(f=>f());await plain;
  assert.equal(r.index('plain').fel,'worker gone');
});

// Kevin 20 Oct: while the table waits for a player (hit or stand) the dealer does not stand still in his pose: from the
// plan's end, back at VILA, his idle takes run as a chain on the table clock, and the next take starts on a clip boundary.
test('while the player decides, a wait chain runs from the plan\'s end; the hit starts on its next clip boundary and ends it; the round\'s end ends the waits', async () => {
  const {DatabaseSync}=await import('node:sqlite');
  const ms=f=>f*1000/24;
  const idle=[{take:'andas',frames:39,vikt:20,calm:true},{take:'huvud',frames:39,vikt:3,calm:true}];   // both calm here: this test is about the timing
  const t=talkTable({idle,workerIdle:['andas','huvud']});
  try{
    t.send('paow','join',{name:'Kevin',seats:[3]});
    assert.deepEqual(t.st('paow').waits,[],'no wait before the cards');
    t.send('paow','bet',{seat:3,field:'main',chip:5});t.send('paow','ready');
    let view=t.st('paow');
    if(view.round?.phase!=='decisions'){assert.ok(true,'a natural: nothing to decide this time');return;}
    assert.equal(view.waits.length,1,'the opening deal leaves the table waiting for the player: one wait');
    const w=view.waits[0];
    assert.equal(w.from,view.plan.endAt,'from the plan\'s end, when he is back at VILA');
    assert.equal(w.until,null);assert.deepEqual(w.takes.map(x=>x.take),['andas','huvud']);assert.equal(w.seed,view.plan.id);
    // the player hits well into the wait: the take starts on the chain's next boundary, within one clip
    t.box.time=w.from+ms(39)*2+700;
    t.send('paow','act',{action:'hit'});
    view=t.st('paow');
    const first=view.plan.steps.find(x=>x.clip);
    const n=(first.startAt-w.from)/ms(39);
    assert.ok(Math.abs(n-Math.round(n))<.01,'the take starts on a clip boundary');
    assert.ok(first.startAt>=t.box.time+700&&first.startAt<t.box.time+700+ms(39)+1,'at most one clip after the usual lead');
    assert.equal(first.variant.startsWith('i'),true,'from VILA, as every take after a rest');
    const old=view.waits.find(x=>x.seed===w.seed);
    assert.equal(old.until,first.startAt,'the wait ends where the take starts');
    if(view.round?.phase==='decisions'){const w2=view.waits.find(x=>!x.until);assert.ok(w2&&w2.from===view.plan.endAt,'a new wait from the new plan\'s end');}
    // the player stands: the dealer plays and the round settles, no wait is left open
    t.box.time=view.plan.endAt+10;
    if(t.st('paow').round?.phase==='decisions')t.send('paow','act',{action:'stand'});
    view=t.st('paow');
    assert.ok(!view.waits.some(x=>!x.until),'no open wait once the player is done');
    t.box.time=view.plan.endAt+10;t.s.tick();
    t.box.time+=3000;t.s.tick();
    assert.ok(!t.st('paow').waits.some(x=>!x.until));
  }finally{t.close();}
});

test('a dealer whose idles no worker knows still gets the wait chain (it is only his body); without idle takes there is none', () => {
  const idle=[{take:'andas',frames:39,vikt:20,calm:true}];
  const t=talkTable({idle});   // no workerIdle: the worker has the deals only
  try{
    t.send('paow','join',{name:'Kevin',seats:[3]});t.send('paow','bet',{seat:3,field:'main',chip:5});t.send('paow','ready');
    const view=t.st('paow');
    if(view.round?.phase==='decisions'){assert.equal(view.waits.length,1,'the chain is laid: it is his body, no worker needed');
      t.box.time=view.plan.endAt+10;const a=t.s.addTalk('paow',{text:'Jaha',lang:'sv',dur:1});
      assert.ok(!a.talk.idle,'but a talk during it has no chain for the mouth: viewers rest on his still for it');}
  }finally{t.close();}
  const none=talkTable();
  try{
    none.send('paow','join',{name:'Kevin',seats:[3]});none.send('paow','bet',{seat:3,field:'main',chip:5});none.send('paow','ready');
    assert.deepEqual(none.st('paow').waits,[],'no idle takes: he rests as before');
  }finally{none.close();}
});

test('a line over idle takes waits for the busy worker that has them while there is time, and only falls back to the other one when it would be late', async () => {
  const {RorligLipsync}=await import('../server/rorlig-lipsync.mjs');
  const r=new RorligLipsync({endpointId:'x',apiKey:'x',publicBase:()=>'https://x',publicDir:'.',log:()=>{},horizonMs:60_000,urgentMs:400,dealers:['dragge']});
  clearInterval(r.timer);
  const pod=()=>{const sent=[],h=[],c=[];return {sent,h,c,ws:{readyState:1,off(ev,f){for(const l of [h,c]){const i=l.indexOf(f);if(i>=0)l.splice(i,1);}},send(m){if(typeof m==='string')sent.push(JSON.parse(m));},on(ev,f){if(ev==='message')h.push(f);if(ev==='close')c.push(f);}}};};
  const ko2=pod(),ours=pod();
  r.addWorker('dragge',ko2.ws,{rutor_per_s:95,spar:1},'ko2');
  r.addWorker('dragge',ours.ws,{rutor_per_s:40,spar:1,takes:['flip','andas','andasb']},'ours');
  const starts=p=>p.sent.filter(m=>m.t==='start').map(m=>m.id), done=(p,id)=>[...p.h].forEach(f=>f(JSON.stringify({t:'done',id}),false));
  const now=Date.now();
  const answer=r.speak('dragge','rum',{id:'answer',kartaStart:now+500,endAt:now+5000,line:'/a.mp4'},[['andas',0,39],['andasb',0,39]]);
  assert.deepEqual(starts(ours),['answer'],'the answer over idle takes: the worker that has them');
  const line=r.speak('dragge','rum',{id:'lose',kartaStart:now+2000,endAt:now+6000,line:'/l.mp4'},[['flip',0,20],['andas',0,39]]);
  await new Promise(res=>setTimeout(res,30));
  assert.deepEqual(starts(ko2),[],'ko2 is free but has no idle takes: the line waits while there is time');
  done(ours,'answer');await answer;await new Promise(res=>setTimeout(res,200));
  assert.deepEqual(starts(ours),['answer','lose'],'as soon as the worker with the takes is free, the line goes there');
  done(ours,'lose');await line;
  // the same with no time left: it goes to the free worker rather than being late
  const late=r.speak('dragge','rum',{id:'late',kartaStart:now+3000,endAt:now+9000,line:'/a.mp4'},[['andas',0,39]]);
  const urgent=r.speak('dragge','rum',{id:'urgent',kartaStart:Date.now()+300,endAt:now+9000,line:'/u.mp4'},[['andas',0,39]]);
  await new Promise(res=>setTimeout(res,30));
  assert.ok(starts(ours).includes('late')&&starts(ko2).includes('urgent'),'the worker with the takes took the first, the urgent one could not wait');
  done(ours,'late');done(ko2,'urgent');await late;await urgent;
});

test('the wait chain is laid only from the idle takes the connected worker announced; without such a worker from all of them (his body only)', () => {
  const idle=[{take:'andas',frames:39,vikt:20,calm:true},{take:'nick6101',frames:39,vikt:6,calm:true},{take:'vikt6103',frames:39,vikt:6,calm:true}];   // all calm here: this test is about the worker
  const some=talkTable({idle,workerIdle:['andas','vikt6103']});
  try{
    some.send('paow','join',{name:'Kevin',seats:[3]});some.send('paow','bet',{seat:3,field:'main',chip:5});some.send('paow','ready');
    const v=some.st('paow');
    if(v.round?.phase==='decisions')assert.deepEqual(v.waits[0].takes.map(t=>t.take),['andas','vikt6103'],'nick6101 is not in the worker image yet: not in the chain, so the mouth never misses on it');
  }finally{some.close();}
  const none=talkTable({idle});
  try{
    none.send('paow','join',{name:'Kevin',seats:[3]});none.send('paow','bet',{seat:3,field:'main',chip:5});none.send('paow','ready');
    const v=none.st('paow');
    if(v.round?.phase==='decisions')assert.deepEqual(v.waits[0].takes.map(t=>t.take),['andas','nick6101','vikt6103'],'no worker with idle takes: all of them, it is only his body');
  }finally{none.close();}
});

test('while the player decides only the calm takes play (Kevin 21 Oct), among those the worker announced; none calm announced: his breathing take', () => {
  const idle=[{take:'andas',frames:39,vikt:20,calm:true},{take:'vikt6101',frames:39,vikt:6,calm:true},{take:'nick6101',frames:39,vikt:6,calm:false},{take:'huvud',frames:39,vikt:3,calm:false}];
  const deal=t=>{t.send('paow','join',{name:'Kevin',seats:[3]});t.send('paow','bet',{seat:3,field:'main',chip:5});t.send('paow','ready');return t.st('paow');};
  const all=talkTable({idle,workerIdle:['andas','vikt6101','nick6101','huvud']});
  try{const v=deal(all);if(v.round?.phase==='decisions')assert.deepEqual(v.waits[0].takes.map(t=>t.take),['andas','vikt6101'],'calm ones only, nods and head turns are for between rounds');}finally{all.close();}
  const lively=talkTable({idle,workerIdle:['nick6101','huvud']});
  try{const v=deal(lively);if(v.round?.phase==='decisions')assert.deepEqual(v.waits[0].takes.map(t=>t.take),['andas'],'no calm take announced: his breathing take');}finally{lively.close();}
  const none=talkTable({idle});
  try{const v=deal(none);if(v.round?.phase==='decisions')assert.deepEqual(v.waits[0].takes.map(t=>t.take),['andas','vikt6101'],'no idle worker: the calm ones, his body only');}finally{none.close();}
  // between rounds nothing changes: an answer at rest runs over every announced take
  const between=talkTable({idle,workerIdle:['andas','vikt6101','nick6101','huvud']});
  try{between.send('paow','join',{name:'Kevin',seats:[3]});const a=between.s.addTalk('paow',{text:'Hej!',lang:'sv',dur:40});
    assert.ok(a.talk.idle.some(c=>c.take==='nick6101'||c.take==='huvud'),'between rounds the lively takes still play under speech');}finally{between.close();}
});

// Kevin 23 Oct (staging): on a dealer blackjack the line was heard but his mouth did not move. The side-bet line before it
// laid a chain of idles from the flip's end, the result line one of its own (another seed) from its first frame: viewers
// showed the first chain, the worker mapped the mouth on the second, and no patch landed. Rigged shoe: 9 K 9 A.
test('a result line said right after another line at rest goes on with its idle chain, so the mouth lands on the clips viewers show', async () => {
  const {chainClipAt,LEAD}=await import('../public/idle-chain.js');
  const idle=[{take:'andas',frames:39,vikt:20,calm:true},{take:'fingrar',frames:39,vikt:4,calm:true}];
  const t=talkTable({idle,workerIdle:['andas','fingrar']});
  try{
    t.send('paow','join',{name:'Kevin',seats:[3]});t.send('paow','bet',{seat:3,field:'main',chip:5});t.send('paow','bet',{seat:3,field:'pp',chip:5});
    const db=new DatabaseSync(t.file),r=JSON.parse(db.prepare("SELECT state FROM shared_rooms WHERE id='paow'").get().state);
    const card=r.game.shoe.cards.at(-1);r.game.shoe.cards.push(...['A','9','K','9'].map(rank=>({...card,r:rank})));   // drawn from the end: 9 K 9 A
    db.prepare("UPDATE shared_rooms SET state=? WHERE id='paow'").run(JSON.stringify(r));db.close();
    t.send('paow','ready');
    const talks=t.box.planned.flatMap(p=>p.nya??[]),side=talks.find(x=>x.event==='sidebet'),dbj=talks.find(x=>x.event==='dealerblackjack');
    assert.ok(side?.idle?.length&&dbj?.idle?.length,'both lines rest after the flip, each with a chain');
    assert.deepEqual(dbj.chain,side.chain,'the result line goes on with the side-bet line\'s chain');
    for(const c of side.idle)assert.ok(dbj.idle.some(d=>d.take===c.take&&d.startAt===c.startAt),'the same clips where they overlap');
    const steg=t.box.planned.at(-1).steg,all=t.st('paow').talk;
    for(let n=dbj.kartaStart;n<dbj.endAt;n+=40){
      if(dbj.idle.some(c=>c.startAt>n&&c.startAt-n<=LEAD))continue;   // the player takes the next clip LEAD early, to load it
      const shown=chainClipAt(all,n),k=kartaFor(steg,n,1,{restEnd:['hole','flip'],idle:dbj.idle})[0];
      assert.equal(shown?.clip.take,k[0],`at ${n} viewers show the clip the mouth is mapped on`);
    }
    // the player can prepare the clip after the side-bet chain's last one: it comes from the result line's chain
    const lastSide=side.idle.at(-1),at=chainClipAt(all,lastSide.startAt+10);
    if(dbj.idle.some(c=>c.startAt===lastSide.endAt))assert.equal(at.next?.startAt,lastSide.endAt);
  }finally{t.close();}
});

// Kevin 23 Oct: the new H3 v2 idles. The wait for the player lays the flat hands and the lean (fas decide) even when the
// worker has not announced them; a line over such a wait clip is not lip-synced on it, it rests on his still. A take into
// or out of the clasped hands (from/to) never joins a talk's chain.
test('the wait lays the decide takes the worker lacks, and a line over them rests on his still; announced ones carry the mouth', () => {
  const idle=[{take:'andas',frames:39,vikt:20,calm:true},{take:'plattaxlar5101',frames:39,vikt:6,calm:true,fas:'decide'},{take:'lutfram5101',frames:39,vikt:6,calm:true,fas:'decide'},
    {take:'knappin5101',frames:39,vikt:6,calm:true,fas:'bets',to:'knappt'},{take:'knapput5101',frames:39,vikt:2,calm:true,fas:'bets',from:'knappt'}];
  for(const [workerIdle,lips] of [[['andas'],false],[['andas','plattaxlar5101','lutfram5101','knappin5101','knapput5101'],true]]){
    const t=talkTable({idle,workerIdle});
    try{
      t.send('paow','join',{name:'Kevin',seats:[3]});t.send('paow','bet',{seat:3,field:'main',chip:5});t.send('paow','ready');
      const view=t.st('paow');
      if(!['decisions','insurance'].includes(view.round?.phase))continue;   // a dealt blackjack: no wait
      const takes=view.waits[0].takes.map(x=>x.take);
      assert.deepEqual(takes.sort(),['andas','lutfram5101','plattaxlar5101'],'calm and decide takes; no clasped ones');
      t.box.time=view.plan.endAt+3000;
      const a=t.s.addTalk('paow',{text:'Take your time',lang:'en',dur:2});
      const clips=waitClips(view.waits[0],a.talk.kartaStart,a.talk.endAt+600).map(c=>c.take);
      if(lips||clips.every(c=>workerIdle.includes(c)))assert.ok(a.talk.idle?.length,'a wait the worker can map carries the mouth');
      else assert.ok(!a.talk.idle,'a wait clip the worker lacks: the line rests on his still');
    }finally{t.close();}
  }
  const t=talkTable({idle,workerIdle:['andas','knappin5101','knapput5101']});
  try{
    const {talk}=t.s.addTalk('paow',{text:'Hi',lang:'en',dur:3});
    assert.ok(talk.idle?.length&&talk.idle.every(c=>c.take==='andas'),'a chain at rest never takes a clasped-hands take');
  }finally{t.close();}
});
