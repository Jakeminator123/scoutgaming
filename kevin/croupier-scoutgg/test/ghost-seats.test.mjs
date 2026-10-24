import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {classifyManifest} from '../server/media-registry.mjs';
import {createSharedTable} from '../server/shared-table.mjs';
const {manifest}=classifyManifest(JSON.parse(readFileSync(new URL('../public/media/manifest.json',import.meta.url),'utf8')));

// Kevin 24 Oct: "Table is full bugg a player is finished but reserverad all the table"
function table(){
  const dir=mkdtempSync(join(tmpdir(),'ghost-')),clock={t:100000};
  const t=createSharedTable(join(dir,'t.sqlite'),{manifest,now:()=>clock.t});
  const st=who=>t.run(who,{session:'room',op:'state'});
  const send=(who,op,args={})=>t.run(who,{session:'room',op,requestId:crypto.randomUUID(),version:st(who).version,...args});
  return {t,st,send,clock,close:()=>{t.close?.();rmSync(dir,{recursive:true,force:true});}};
}

test('a player still on the page who neither bets nor acts gives up all his boxes after 90 s; one who bets keeps them', () => {
  const x=table();
  try{
    x.send('guest','join',{name:'Guest 769',seats:[0,1,2,3,4,5,6]});
    assert.equal(x.st('kevin').owners.filter(Boolean).length,7,'the table is full');
    x.clock.t+=60000;x.st('guest');x.t.tick();
    assert.equal(x.st('kevin').owners.filter(Boolean).length,7,'not yet at 60 s');
    x.clock.t+=31000;x.st('guest');x.t.tick();   // his page still asks (seen is fresh)
    assert.equal(x.st('kevin').owners.filter(Boolean).length,0,'released after 90 s idle');
    x.send('kevin','join',{name:'Kevin',seats:[3]});
    assert.ok(x.st('kevin').owners[3],'Kevin can sit down');
    x.send('kevin','bet',{seat:3,field:'main',chip:5});
    x.clock.t+=15000;x.st('kevin');x.t.tick();
    assert.ok(x.st('kevin').owners[3],'a player with a bet keeps his box');
  }finally{x.close();}
});

test('a player who closed the page gives up his boxes after 60 s between rounds', () => {
  const x=table();
  try{
    x.send('guest','join',{name:'Guest',seats:[0,1,2]});
    x.clock.t+=59000;x.t.tick();
    assert.equal(x.st('kevin').owners.filter(Boolean).length,3);
    x.clock.t+=2000;x.t.tick();
    assert.equal(x.st('kevin').owners.filter(Boolean).length,0,'gone 61 s: released');
  }finally{x.close();}
});

// play the round to its end: stand every hand, take no insurance, let the plans run out
function playOut(x,who){
  for(let i=0;i<60;i++){
    let s=x.st(who);
    if(s.phase==='settled')return s;
    if(s.plan?.endAt)x.clock.t=Math.max(x.clock.t,s.plan.endAt+1);
    x.t.tick();s=x.st(who);
    if(s.phase==='round'&&s.round?.phase==='insurance')try{x.send(who,'insurance',{take:false});}catch{}
    if(s.phase==='round'&&s.round?.phase==='decisions'){const h=s.round.hands[s.round.active];
      try{x.t.run(who,{session:'room',op:'act',action:'stand',roundId:s.roundId,turnSeq:s.turnSeq,box:h.box,handIndex:s.round.active,version:s.version,requestId:crypto.randomUUID()});}catch{}}
  }
  return x.st(who);
}

test('(a) after a round the boxes he did not bet on are released; (b) with someone waiting he keeps at most 3', () => {
  const x=table();
  try{
    x.send('guest','join',{name:'Guest',seats:[0,1,2]});
    x.send('guest','bet',{seat:1,field:'main',chip:5});x.send('guest','ready');
    x.clock.t+=1000;x.send('kevin','join',{name:'Kevin',seats:[5]});   // sits down during the round
    assert.equal(playOut(x,'guest').phase,'settled');
    x.send('guest','next');
    assert.deepEqual(x.st('guest').owners.map(Boolean),[false,true,false,false,false,true,false],'only the box he played stays, and Kevin keeps the box he took during the round');
  }finally{x.close();}
  const y=table();
  try{
    y.send('guest','join',{name:'Guest',seats:[0,1,2,3,4,5,6]});
    for(const s of [0,1,2,3,4,5,6])y.send('guest','bet',{seat:s,field:'main',chip:5});
    y.send('guest','ready');
    y.st('kevin');   // Kevin looks at the full table: he waits for a place
    assert.equal(playOut(y,'guest').phase,'settled');
    y.st('kevin');
    y.send('guest','next');
    const owned=y.st('kevin').owners.filter(Boolean).length;
    assert.equal(owned,3,'he keeps 3 of his 7 boxes');
    y.send('kevin','join',{name:'Kevin',seats:[y.st('kevin').owners.findIndex(o=>!o)]});
    assert.equal(y.st('kevin').owners.filter(Boolean).length,4,'Kevin sits down');
  }finally{y.close();}
  const z=table();
  try{   // nobody waiting: he keeps all the boxes he played
    z.send('guest','join',{name:'Guest',seats:[0,1,2,3,4,5,6]});
    for(const s of [0,1,2,3,4,5,6])z.send('guest','bet',{seat:s,field:'main',chip:5});
    z.send('guest','ready');assert.equal(playOut(z,'guest').phase,'settled');z.send('guest','next');
    assert.equal(z.st('guest').owners.filter(Boolean).length,7);
  }finally{z.close();}
});
