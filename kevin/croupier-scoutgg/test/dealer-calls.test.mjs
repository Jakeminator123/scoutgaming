import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createSharedTable} from '../server/shared-table.mjs';
import {planDraws} from '../public/game-events.js';

// Emil 14 Oct: a ready dealer calls a blackjack or a 21 as the card lands (like a bust), says one of seven variants of
// those lines, and at the end congratulates by name only the players who won money on the round.

const c=(r,shoeDraw)=>({r,s:'♠',shoeDraw});
test('with calls a 21 is called as its card lands: blackjack for a natural, twentyone on more cards; without calls nothing', () => {
  const before={hands:[{box:2,cards:[c('9',1),c('5',3)],splitFrom:null}],dealer:[c('6',2)],holeDraw:4};
  const after={hands:[{box:2,cards:[c('9',1),c('5',3),c('7',5)],splitFrom:null}],dealer:[c('6',2)],holeDraw:4};
  assert.deepEqual(planDraws(before,after,false,{calls:true}).filter(s=>s.kind==='speech').map(s=>s.event),['twentyone']);
  assert.deepEqual(planDraws(before,after,false).filter(s=>s.kind==='speech'),[]);
  const natural={hands:[{box:2,cards:[c('A',1),c('K',3)],splitFrom:null}],dealer:[c('6',2),c('9',4)],holeDraw:4};
  assert.deepEqual(planDraws(null,natural,true,{calls:true}).filter(s=>s.kind==='speech').map(s=>s.event),['blackjack']);
  const split={hands:[{box:2,cards:[c('A',1),c('K',5)],splitFrom:0}],dealer:[c('6',2)],holeDraw:4};
  assert.deepEqual(planDraws({hands:[{box:2,cards:[c('A',1)],splitFrom:0}],dealer:[c('6',2)],holeDraw:4},split,false,{calls:true}).filter(s=>s.kind==='speech').map(s=>s.event),['twentyone']);
});

// a table with a ready dealer that has the new lines (server.mjs counts them from his repliker folders)
function table(ranks,{cheers=[],lang=null,texts=undefined}={}){
  const manifest={deal:[1,2,3,4,5,6,7,'dealer'].map(i=>({id:`deal_pos${i}`,url:`/media/deal/pos${i}.mp4`,dur:.1})).concat(['hole','flip'].map(i=>({id:`deal_${i}`,url:`/media/deal/${i}.mp4`,dur:.1}))),
    repliker:['goodluck','bust','blackjack','win','lose','push','dealerbust'].flatMap(e=>[1,2,3].map(n=>({id:`${e}_${n}`,event:e,url:`/media/repliker/${e}_${n}.mp4`,dur:1}))),idle:[]};
  const take={'-':39,'-i':60,'-u':60,'-iu':81,'-v':39,'-iv':60},frames=Object.fromEntries(['1','2','3','4','5','6','7','dealer'].map(k=>[k,take]));
  frames.hole={'-':39,'-i':60,'-u':39,'-iu':60};frames.flip={'-':56,'-i':56,'-u':56,'-iu':56};
  const ready={frames,restEnd:['hole','flip'],restStart:['flip'],variants:{bust:7,blackjack:7,twentyone:7,win:3},durs:{},texts};
  const dir=mkdtempSync(join(tmpdir(),'calls-'));let time=100000;
  const s=createSharedTable(join(dir,'t.sqlite'),{manifest,now:()=>time,languageFor:()=>lang,readyFor:()=>ready,winners:()=>(names,language,at)=>cheers.push({names,language,at})});
  const st=()=>s.run('kevin',{session:'v',op:'state'});
  const send=(op,extra={})=>s.run('kevin',{session:'v',op,version:st().version,requestId:crypto.randomUUID(),...extra});
  send('join',{name:'Kevin',seats:[3,5]});
  const db=new DatabaseSync(join(dir,'t.sqlite')),row=JSON.parse(db.prepare('SELECT state FROM shared_rooms WHERE id=?').get('v').state);
  row.game.shoe.cards.splice(-ranks.length,ranks.length,...ranks.map((r,i)=>({r,s:['♠','♦','♥','♣'][i%4]})).reverse());
  db.prepare('UPDATE shared_rooms SET state=? WHERE id=?').run(JSON.stringify(row),'v');db.close();
  return{s,st,send,step:()=>{time=st().plan.endAt+10;return st();},close:()=>{s.close();rmSync(dir,{recursive:true,force:true});}};
}
const speech=plan=>plan.steps.filter(x=>x.kind==='speech').map(x=>x.clip.id);

test('a blackjack is called as it is dealt with one of the variants, and its winner is congratulated by name at the end', () => {
  const cheers=[],t=table(['A','10','9','K','7','8'],{cheers});   // one box gets the blackjack, the other 17
  try{
    t.send('bet',{seat:3,field:'main',chip:5});t.send('bet',{seat:5,field:'main',chip:5});t.send('ready');
    const open=speech(t.st().plan);
    assert.ok(open.some(id=>/^blackjack_[1-7]$/.test(id)),open.join());
    let x=t.step();
    for(let i=0;i<6&&x.phase==='round'&&x.round?.phase==='decisions';i++){t.send('act',{action:'stand'});x=t.step();}
    const end=speech(t.st().plan);
    assert.ok(!end.some(id=>/^(win|blackjack)_/.test(id)),'the names, not a recorded line: '+end.join());
    assert.equal(cheers.length,1);
    assert.deepEqual(cheers[0].names,['Kevin']);
    assert.ok(cheers[0].at>=t.st().plan.startAt);
  }finally{t.close();}
});

test('a player who won one box but lost more on the round is not congratulated, and nobody else up means no line', () => {
  const cheers=[],t=table(['10','10','9','9','6','8'],{cheers});   // seat 3: 16 on 25 (loses), seat 5: 19 on 5 (wins), dealer 18
  try{
    t.send('bet',{seat:3,field:'main',chip:25});t.send('bet',{seat:5,field:'main',chip:5});t.send('ready');
    let x=t.step();
    for(let i=0;i<6&&x.phase==='round'&&x.round?.phase==='decisions';i++){t.send('act',{action:'stand'});x=t.step();}
    assert.equal(cheers.length,0);
    assert.ok(!speech(t.st().plan).some(id=>/^(win|blackjack|dealerbust)_/.test(id)),speech(t.st().plan).join());
  }finally{t.close();}
});

test('the variants come at random and never the same one twice in a row', () => {
  const ids=[];
  for(let k=0;k<12;k++){
    const t=table(['10','10','9','6','6','8','10','10']);   // seat 3 hits 16 and busts
    try{
      t.send('bet',{seat:3,field:'main',chip:5});t.send('bet',{seat:5,field:'main',chip:5});t.send('ready');
      t.step();t.send('act',{action:'hit'});
      ids.push(...speech(t.st().plan).filter(id=>id.startsWith('bust_')));
    }finally{t.close();}
  }
  assert.ok(ids.length>=10,ids.join());
  assert.ok(new Set(ids).size>=3,'several variants: '+ids.join());
  for(const id of ids)assert.match(id,/^bust_[1-7]$/);
});

test("the caption is what the dealer says in that line in the table's language, never Astrid's English text", () => {
  const sv=Object.fromEntries([1,2,3,4,5,6,7].map(n=>[`bust_${n}`,`Tjock ${n}.`])),en=Object.fromEntries([1,2,3,4,5,6,7].map(n=>[`bust_${n}`,`Bust ${n}.`]));
  const t=table(['10','10','9','6','6','8','10','10'],{lang:'sv',texts:{sv,en}});
  try{
    t.send('bet',{seat:3,field:'main',chip:5});t.send('bet',{seat:5,field:'main',chip:5});t.send('ready');
    t.step();t.send('act',{action:'hit'});
    const bust=t.st().plan.steps.find(x=>x.clip?.event==='bust');
    assert.ok(bust,'a bust line');
    assert.equal(bust.clip.text,sv[bust.clip.id]);
  }finally{t.close();}
});

test('the winners are cheered on the talk track as a cheer, not as a chat answer', () => {
  const dir=mkdtempSync(join(tmpdir(),'cheer-'));
  const s=createSharedTable(join(dir,'t.sqlite'),{manifest:{deal:[],repliker:[],idle:[]}});
  try{
    s.run('kevin',{session:'v',op:'state'});
    const {talk}=s.addTalk('v',{kind:'cheer',text:'Grattis Kevin!',lang:'sv',dur:1.2,notBefore:Date.now()+5000});
    assert.equal(talk.kind,'cheer');
    assert.ok(talk.startAt>=Date.now()+4900,'not before the last card has landed');
    assert.equal(talk.notBefore,undefined);
  }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
