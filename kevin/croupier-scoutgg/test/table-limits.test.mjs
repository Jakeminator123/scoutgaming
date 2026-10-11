import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSharedTable} from '../server/shared-table.mjs';
import {LIMIT_PRESETS,DEFAULT_LIMITS} from '../server/studio-tables.mjs';

// Table Studio limits are enforced by the server and the engine, per room.
const manifest={deal:[1,2,3,4,5,6,7,'dealer'].map(i=>({id:`deal_pos${i}`,url:`/${i}.mp4`,dur:.1})).concat(['hole','flip'].map(i=>({id:`deal_${i}`,url:`/${i}.mp4`,dur:.1}))),repliker:[],idle:[]};
const rooms={whales:{...LIMIT_PRESETS.high,preset:'high',tableName:'Whales'},pennies:{...LIMIT_PRESETS.casual,preset:'casual',tableName:'Pennies'}};
function setup(){
  const dir=mkdtempSync(join(tmpdir(),'limits-')),time=100000;
  const s=createSharedTable(join(dir,'t.sqlite'),{manifest,now:()=>time,limitsFor:room=>rooms[room]??DEFAULT_LIMITS});
  const state=(room,who='kevin')=>s.run(who,{session:room,op:'state'});
  const send=(room,op,extra={},who='kevin')=>s.run(who,{session:room,op,version:state(room,who).version,requestId:crypto.randomUUID(),...extra});
  return{s,state,send,close(){s.close();rmSync(dir,{recursive:true,force:true});}};
}

test('a High Roller table opens with $50,000, takes only its chips, caps bets at $25,000 and starts the round', () => {
  const t=setup();try{
    const me=t.send('whales','join',{name:'Kevin',seats:[3]}).me;assert.equal(me.balance,50000);
    assert.deepEqual(t.state('whales').limits,{name:'High Roller',tableName:'Whales',min:100,max:25000,sideMax:1000,chips:[100,500,1000,5000,10000,25000],refill:50000});
    assert.throws(()=>t.send('whales','bet',{seat:3,field:'main',chip:5}),/Choose a chip from this table/);
    t.send('whales','bet',{seat:3,field:'main',chip:25000});
    assert.throws(()=>t.send('whales','bet',{seat:3,field:'main',chip:100}),/Maximum \$25,000 per bet/);
    t.send('whales','bet',{seat:3,field:'pp',chip:1000});
    assert.throws(()=>t.send('whales','bet',{seat:3,field:'pp',chip:100}),/Side bets up to \$1,000/);
    t.send('whales','ready');
    const round=t.state('whales');assert.equal(round.phase,'round');assert.equal(round.me.balance,24000);
  }finally{t.close();}
});

test('a Casual table opens with $500, takes a $1 bet and the engine starts the round with it', () => {
  const t=setup();try{
    assert.equal(t.send('pennies','join',{name:'Kevin',seats:[1]}).me.balance,500);
    t.send('pennies','bet',{seat:1,field:'main',chip:1});
    assert.throws(()=>t.send('pennies','bet',{seat:1,field:'tp',chip:100}),/Side bets up to \$50/);
    t.send('pennies','ready');
    assert.equal(t.state('pennies').phase,'round');assert.equal(t.state('pennies').me.balance,499);
  }finally{t.close();}
});

test('a refill adds the table preset balance; a room without a studio table keeps the demo limits', () => {
  const t=setup();try{
    t.send('whales','join',{name:'Kevin',seats:[0]});assert.equal(t.send('whales','refill').me.balance,100000);
    t.send('party','join',{name:'Kevin',seats:[0]});assert.equal(t.send('party','refill').me.balance,2000);
    assert.deepEqual(t.state('party').limits.chips,[5,10,25,50,100,500]);
    assert.throws(()=>t.send('party','bet',{seat:0,field:'main',chip:1}),/Choose a chip from this table/);
  }finally{t.close();}
});

test('a studio table opens in its own dealer language; other rooms keep English', () => {
  const dir=mkdtempSync(join(tmpdir(),'lang-'));
  const s=createSharedTable(join(dir,'t.sqlite'),{manifest,limitsFor:()=>DEFAULT_LIMITS,languageFor:room=>({svenska:'sv',klingon:'tlh'})[room]??null});
  try{
    assert.equal(s.run('kevin',{session:'svenska',op:'state'}).language,'sv');
    assert.equal(s.run('kevin',{session:'klingon',op:'state'}).language,'en');
    assert.equal(s.run('kevin',{session:'astrid',op:'state'}).language,'en');
  }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});

test("a ready dealer's studio table deals the run back to back on his own takes; other rooms keep the filmed slots", () => {
  const dir=mkdtempSync(join(tmpdir(),'ready-')),time=100000;
  const take={'-':26,'-i':53,'-u':53,'-iu':80},frames=Object.fromEntries(['1','2','3','4','5','6','7','dealer','hole','flip'].map(k=>[k,take]));
  const s=createSharedTable(join(dir,'t.sqlite'),{manifest,now:()=>time,readyFor:room=>room==='dragges'?{frames}:null});
  const deal=room=>{const st=()=>s.run('kevin',{session:room,op:'state'});const send=(op,extra={})=>s.run('kevin',{session:room,op,version:st().version,requestId:crypto.randomUUID(),...extra});
    send('join',{name:'Kevin',seats:[3]});send('bet',{seat:3,field:'main',chip:5});send('ready');
    // the run is every dealing step: a blackjack turns the hole card straight after the deal, in the same run
    return st().plan.steps.filter(x=>x.clip&&(x.kind==='deal'||x.kind==='reveal'));};
  try{
    const run=deal('dragges');
    assert.deepEqual(run.map(x=>x.variant),['i',...Array(run.length-2).fill(''),'u']);
    assert.deepEqual(run.map(x=>Math.round(x.endAt-x.startAt)),[2208,...Array(run.length-2).fill(1083),2208]);
    for(let i=1;i<run.length;i++)assert.equal(run[i].startAt,run[i-1].endAt,'the cards join with no gap');
    const filmed=deal('astrid');
    assert.ok(filmed.every(x=>x.variant===undefined&&Math.round(x.endAt-x.startAt)===100));
  }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});

test("takes that end or start at rest (Paow's hole card, her filmed turn) never jump between REDO and rest", () => {
  const dir=mkdtempSync(join(tmpdir(),'rest-')),time=100000;
  const take={'-':26,'-i':53,'-u':53,'-iu':80},frames=Object.fromEntries(['1','2','3','4','5','6','7','dealer'].map(k=>[k,take]));
  frames.hole={'-':35,'-i':56,'-u':35,'-iu':56};frames.flip={'-':31,'-i':31,'-u':31,'-iu':31};
  const s=createSharedTable(join(dir,'t.sqlite'),{manifest,now:()=>time,readyFor:()=>({frames,restEnd:['hole','flip'],restStart:['flip']})});
  try{
    const st=()=>s.run('kevin',{session:'paows',op:'state'});const send=(op,extra={})=>s.run('kevin',{session:'paows',op,version:st().version,requestId:crypto.randomUUID(),...extra});
    send('join',{name:'Kevin',seats:[3]});send('bet',{seat:3,field:'main',chip:5});send('ready');
    const run=st().plan.steps.filter(x=>x.clip&&(x.kind==='deal'||x.kind==='reveal'));
    const hole=run.find(x=>x.track==='hole');
    assert.equal(run[0].variant,'i');
    assert.ok(!hole.variant.includes('u'),'the hole take already ends at rest');
    assert.equal(Math.round(hole.endAt-hole.startAt),Math.round(frames.hole[`-${hole.variant}`]/24*1000));
    const flip=run.find(x=>x.kind==='reveal');
    if(flip)assert.equal(flip.variant,'','a turn from rest to rest gets no transitions');
  }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});

test('a ready dealer with a hands take shows both hands empty before the first card (Serhiy), silent and rest to rest', () => {
  const dir=mkdtempSync(join(tmpdir(),'hands-')),time=100000;
  const take={'-':26,'-i':53,'-u':53,'-iu':80},frames=Object.fromEntries(['1','2','3','4','5','6','7','dealer','hole'].map(k=>[k,take]));
  const s=createSharedTable(join(dir,'t.sqlite'),{manifest,now:()=>time,readyFor:()=>({frames,hands:48,dir:'/media/dealers/paow/v2/'})});
  try{
    const st=()=>s.run('kevin',{session:'h',op:'state'});const send=(op,extra={})=>s.run('kevin',{session:'h',op,version:st().version,requestId:crypto.randomUUID(),...extra});
    send('join',{name:'Kevin',seats:[3]});send('bet',{seat:3,field:'main',chip:5});send('ready');
    const steps=st().plan.steps,i=steps.findIndex(x=>x.kind==='hands'),first=steps.findIndex(x=>x.kind==='deal');
    assert.ok(i>=0&&i<first,'hands come before the first card');
    assert.equal(steps[i].clip.url,'/media/dealers/paow/v2/hands.mp4');assert.equal(steps[i].clip.sound,false);
    assert.equal(Math.round(steps[i].endAt-steps[i].startAt),2000);
    assert.equal(steps[first].variant[0],'i','the first card reaches for the shoe from rest');
  }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});

test("a card that ends the run plays Emil's rest take (hand off the shoe on film) on its own card track", () => {
  const dir=mkdtempSync(join(tmpdir(),'vila-'));let time=100000;
  const take={'-':26,'-i':47,'-u':47,'-iu':68,'-v':26,'-iv':47},frames=Object.fromEntries(['1','2','3','4','5','6','7','dealer'].map(k=>[k,take]));
  frames.hole={'-':26,'-i':47,'-u':26,'-iu':47};frames.flip={'-':31,'-i':31,'-u':31,'-iu':31};
  const s=createSharedTable(join(dir,'t.sqlite'),{manifest,now:()=>time,readyFor:()=>({frames,restEnd:['hole','flip'],restStart:['flip']})});
  try{
    const st=()=>s.run('kevin',{session:'v',op:'state'});const send=(op,extra={})=>s.run('kevin',{session:'v',op,version:st().version,requestId:crypto.randomUUID(),...extra});
    send('join',{name:'Kevin',seats:[3]});
    // A fixed shoe so the hand can always take a hit (5+7 against a 6, then a 3): with a random shoe a blackjack or a
    // dealer blackjack ended the round before any hit, and the test failed about one run in three.
    {const db=new DatabaseSync(join(dir,'t.sqlite')),row=JSON.parse(db.prepare('SELECT state FROM shared_rooms WHERE id=?').get('v').state);
     const ranks=['5','6','7','10','3','2','2','2'];row.game.shoe.cards.splice(-ranks.length,ranks.length,...ranks.map((r,i)=>({r,s:['♠','♦','♥','♣'][i%4]})).reverse());
     db.prepare('UPDATE shared_rooms SET state=? WHERE id=?').run(JSON.stringify(row),'v');db.close();}
    send('bet',{seat:3,field:'main',chip:5});send('ready');
    let checked=false;const opening=st().plan.steps.filter(x=>x.kind==='deal');
    assert.ok(opening.every(x=>!x.variant.endsWith('v')),'the opening ends on the hole card, no rest take inside it');
    for(let i=0;i<6;i++){
      time=st().plan.endAt+10;if(st().round?.phase!=='decisions')break;
      send('act',{action:'hit'});const deal=st().plan?.steps.filter(x=>x.kind==='deal');
      if(!deal?.length)continue;
      const hit=deal[0];assert.equal(hit.variant,'iv');assert.equal(hit.track,`${hit.seat}v`);
      assert.equal(Math.round(hit.endAt-hit.startAt),Math.round(47/24*1000));checked=true;break;
    }
    assert.ok(checked,'a hit was dealt');
  }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
