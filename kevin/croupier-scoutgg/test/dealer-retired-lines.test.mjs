import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,rmSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {classifyManifest} from '../server/media-registry.mjs';
import {activeLine,availableLanguages,speechForEvent,RETIRED_LINES} from '../public/dealer-language.js';
import {createSharedTable} from '../server/shared-table.mjs';

// Serhiy (Axelio fdec6f40): "Dealer busts! Everyone still in the hand gets paid" (dealerbust_1) sounded unnatural and
// still played. It is out of the rotation on the shared and the solo table, for every dealer and language; its clips stay.
const source=JSON.parse(readFileSync(new URL('../public/media/manifest.json',import.meta.url)));
const {manifest}=classifyManifest(source);
const media=new URL('../public/media/',import.meta.url);

test('the active dealerbust line is no longer dealerbust_1, in every language bank the table can pick from', () => {
  assert.ok(RETIRED_LINES.has('dealerbust_1'));
  assert.equal(activeLine(source.repliker,'dealerbust').id,'dealerbust_2');
  assert.ok(!manifest.repliker.some(c=>c.id==='dealerbust_1'));
  for(const bank of Object.values(manifest.repliker_sprak))assert.ok(!bank.some(c=>c.id==='dealerbust_1'));
  for(const language of availableLanguages(manifest)){
    const clip=speechForEvent(manifest,'dealerbust',language);
    assert.equal(clip.event,'dealerbust');assert.ok(!RETIRED_LINES.has(clip.id),`${language}: ${clip.id}`);
  }
  // the other events keep their reviewed line
  assert.equal(activeLine(source.repliker,'bust').id,source.repliker.find(c=>c.event==='bust').id);
  assert.equal(activeLine(source.repliker,'sidebet').id,'sidebet_2');
});

test('the clips stay: Astrid\'s banks and every ready dealer\'s own takes still have dealerbust_1', () => {
  for(const bank of [source.repliker,...Object.values(source.repliker_sprak)]){
    const clip=bank.find(c=>c.id==='dealerbust_1');
    assert.ok(clip&&existsSync(new URL(`..${clip.url}`,media)),clip?.url);
  }
  for(const dealer of ['dragge','paow','astrid2','marten'])
    for(const language of readdirSync(new URL(`dealers/${dealer}/repliker/`,media)))
      assert.ok(existsSync(new URL(`dealers/${dealer}/repliker/${language}/dealerbust_1.mp4`,media)),`${dealer}/${language}`);
});

// a shared table whose dealer varies dealerbust (variantOf), without the calls, so the settle line is the recorded one
function table(ready,talk=()=>null){
  const manifest={deal:[1,2,3,4,5,6,7,'dealer'].map(i=>({id:`deal_pos${i}`,url:`/media/deal/pos${i}.mp4`,dur:.1})).concat(['hole','flip'].map(i=>({id:`deal_${i}`,url:`/media/deal/${i}.mp4`,dur:.1}))),
    repliker:['goodluck','bust','win','lose','push','dealerbust'].flatMap(e=>[1,2,3].map(n=>({id:`${e}_${n}`,event:e,url:`/media/repliker/${e}_${n}.mp4`,dur:1}))),idle:[]};
  const dir=mkdtempSync(join(tmpdir(),'retired-'));let time=100000;
  const s=createSharedTable(join(dir,'t.sqlite'),{manifest,now:()=>time,languageFor:()=>null,readyFor:()=>ready,talk});
  const st=()=>s.run('kevin',{session:'v',op:'state'});
  const send=(op,extra={})=>s.run('kevin',{session:'v',op,version:st().version,requestId:crypto.randomUUID(),...extra});
  send('join',{name:'Kevin',seats:[3,5]});
  // both boxes 20, dealer 6 + 10 draws a 10: the dealer busts
  const ranks=['10','10','6','10','10','10','10'];
  const db=new DatabaseSync(join(dir,'t.sqlite')),row=JSON.parse(db.prepare('SELECT state FROM shared_rooms WHERE id=?').get('v').state);
  row.game.shoe.cards.splice(-ranks.length,ranks.length,...ranks.map((r,i)=>({r,s:['♠','♦','♥','♣'][i%4]})).reverse());
  db.prepare('UPDATE shared_rooms SET state=? WHERE id=?').run(JSON.stringify(row),'v');db.close();
  return{st,send,step:()=>{time=st().plan.endAt+10;return st();},close:()=>{s.close();rmSync(dir,{recursive:true,force:true});}};
}
const take={'-':39,'-i':60,'-u':60,'-iu':81,'-v':39,'-iv':60},frames=Object.fromEntries(['1','2','3','4','5','6','7','dealer'].map(k=>[k,take]));
frames.hole={'-':39,'-i':60,'-u':39,'-iu':60};frames.flip={'-':56,'-i':56,'-u':56,'-iu':56};
const varied={frames,restEnd:['hole','flip'],restStart:['flip'],variants:{dealerbust:3},durs:{}};
function dealerBustLines(ready,talk){
  const t=table(ready,talk);
  try{
    t.send('bet',{seat:3,field:'main',chip:5});t.send('bet',{seat:5,field:'main',chip:5});t.send('ready');
    let x=t.step();
    for(let i=0;i<6&&x.phase==='round'&&x.round?.phase==='decisions';i++){t.send('act',{action:'stand'});x=t.step();}
    // a dealer on the moving clips says it on the talk track (state.talk), else it is a recorded step
    return [...t.st().plan.steps.filter(s=>s.kind==='speech').map(s=>s.clip.id),...(t.st().talk??[]).map(x=>x.clip?.id)].filter(id=>id?.startsWith('dealerbust_'));
  }finally{t.close();}
}

test('the shared table never says dealerbust_1: neither as the recorded line nor as a dealer\'s variant', () => {
  assert.deepEqual(dealerBustLines(null),['dealerbust_2']);
  const ids=[];
  for(let k=0;k<16;k++)ids.push(...dealerBustLines(varied));
  assert.equal(ids.length,16,ids.join());
  assert.ok(!ids.includes('dealerbust_1'),ids.join());
  assert.deepEqual([...new Set(ids)].sort(),['dealerbust_2','dealerbust_3']);
});

test('the solo table filters the retired line out of its random pick', () => {
  const src=readFileSync(new URL('../public/game-table.js',import.meta.url),'utf8');
  assert.match(src,/manifest\.repliker\.filter\(c => c\.event === event && !RETIRED_LINES\.has\(c\.id\)\)/);
});

// today's talk track (23 Oct): a dealer with a warm lip-sync worker says the settle line over his clips, from his own
// takes (talker.line); dealerbust is varied for every ready dealer now (server.mjs VARIED), 2 and 3, never 1
test('on the talk track the dealer says dealerbust_2 or _3, never dealerbust_1, and they alternate', () => {
  const said=[],talk=()=>({line:clip=>{said.push(clip.id);return{url:clip.url.replace('/media/repliker/','/media/dealers/paow/repliker/en/'),lang:'en',dur:1.4};}});
  const ids=[];
  for(let k=0;k<16;k++)ids.push(...dealerBustLines(varied,talk));
  assert.equal(ids.length,16,ids.join());
  assert.ok(!ids.includes('dealerbust_1')&&!said.includes('dealerbust_1'),ids.join());
  assert.deepEqual([...new Set(ids)].sort(),['dealerbust_2','dealerbust_3']);
  const server=readFileSync(new URL('../server/server.mjs',import.meta.url),'utf8');
  assert.match(server,/const VARIED = \['bust', 'blackjack', 'twentyone', 'win', 'dealerbust'\];/);
  for(const d of ['dragge','paow','astrid2'])for(const n of [2,3])assert.ok(existsSync(new URL(`dealers/${d}/repliker/en/dealerbust_${n}.mp4`,media)),`${d} dealerbust_${n}`);
});
