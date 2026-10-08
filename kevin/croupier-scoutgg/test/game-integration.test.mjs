import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createTableService } from '../server/table-service.mjs';
import { newGame, command } from '../vendor/croupier/shoe-game.mjs';
import { planDraws, outcomeSpeech } from '../public/game-events.js';
const bets = Array.from({length:7},(_,i)=>({main:i===3?5:0,pp:0,tp:0}));
function fixture(stack) {
  const g=newGame();command(g,{op:'state'},1000);
  g.shoe.cards.splice(-stack.length,stack.length,...stack.map((r,i)=>({r,s:['♠','♦','♥','♣'][i%4]})).reverse());
  return g;
}
function move(g,op,extra={}) {return command(g,{op,version:g.version,requestId:crypto.randomUUID(),...extra},1000).view;}

test('opening deals all seven seats right-to-left, with a private dealer hole card',()=>{
  const g=fixture(['8','7','6','5','4','3','2','6','9','9','9','9','9','9','9','10']);
  const view=move(g,'start',{bets:bets.map(()=>({main:5,pp:0,tp:0}))});
  const steps=planDraws(null,view.round,true).filter(s=>s.kind==='deal');
  assert.deepEqual(steps.map(s=>s.clipId),[...[7,6,5,4,3,2,1,'dealer',7,6,5,4,3,2,1].map(s=>`deal_pos${s}`),'deal_hole']);
  assert.equal(steps.at(-1).card,null);assert.equal(new Set(steps.map(s=>s.shoeDraw)).size,16);
  assert.equal(view.round.dealer.length,1);assert.ok(!JSON.stringify(view).includes('holeCard'));
});

test('split/hit/double preserve original draws; hole reveal never consumes another card',()=>{
  const g=fixture(['8','6','8','10','3','2','9','K','5']);
  let before=structuredClone(move(g,'start',{bets}).round);
  let after=structuredClone(move(g,'act',{action:'split'}).round);
  assert.deepEqual(planDraws(before,after).filter(s=>s.kind==='deal').map(s=>s.clipId),['deal_pos4','deal_pos4']);
  before=after;after=structuredClone(move(g,'act',{action:'hit'}).round);
  assert.equal(planDraws(before,after).filter(s=>s.kind==='deal').length,1);
  move(g,'act',{action:'stand'});before=structuredClone(g.round);
  after=structuredClone(move(g,'act',{action:'double'}).round);
  const steps=planDraws({...before,holeDraw:before.holeCard.shoeDraw},after);
  assert.equal(steps.filter(s=>s.kind==='reveal').length,1);
  assert.deepEqual(steps.filter(s=>s.kind==='deal').map(s=>s.clipId),['deal_pos4','deal_posdealer']);
});

test('immediate blackjack is dealt face down first, then revealed with the matching speech',()=>{
  const g=fixture(['8','K','9','A']);const round=move(g,'start',{bets}).round;
  const steps=planDraws(null,round,true);
  assert.equal(steps.filter(s=>s.kind==='deal').length,4);
  assert.equal(steps.at(-1).kind,'reveal');assert.equal(outcomeSpeech(round),'dealerblackjack');
});

test('SQLite demo wallets persist, isolate sessions, roll back and debit/credit once',()=>{
  const dir=mkdtempSync(join(tmpdir(),'astrid-engine-test-'));const file=join(dir,'table.sqlite');
  let service=createTableService(file);
  try {
    service.run('alice',{op:'state'});
    const db=new DatabaseSync(file);
    db.prepare('UPDATE demo_tables SET state=? WHERE session=?').run(JSON.stringify(fixture(['8','A','8','K'])),createHash('sha256').update('alice').digest('hex'));db.close();
    const start={op:'start',version:0,requestId:'start-1',bets};
    const one=service.run('alice',start);assert.equal(one.balance,995);
    assert.deepEqual(service.run('alice',start),one);
    assert.equal(service.run('bob',{op:'state'}).balance,1000);
    assert.throws(()=>service.run('alice',{op:'act',action:'hit',version:1,requestId:'illegal'}));
    assert.equal(service.run('alice',{op:'state'}).version,1);
    service.close();service=createTableService(file);
    const insured=service.run('alice',{op:'insurance',take:true,version:1,requestId:'insure-1'});assert.equal(insured.balance,992.5);
    const collect={op:'collect',version:2,requestId:'collect-1'};
    assert.equal(service.run('alice',collect).balance,1000);assert.equal(service.run('alice',collect).balance,1000);
    assert.equal(service.run('alice',{op:'state'}).round,null);
    const current=service.run('bob',{op:'state'});
    assert.throws(()=>service.run('bob',{op:'start',version:current.version,requestId:'poor',bets:bets.map(()=>({main:2000,pp:0,tp:0}))}));
    assert.deepEqual(service.run('bob',{op:'state'}),current);
  } finally {service.close();rmSync(dir,{recursive:true,force:true});}
});

test('demo refills are fixed, durable, isolated and idempotent without changing the shoe',()=>{
  const dir=mkdtempSync(join(tmpdir(),'astrid-refill-test-'));const file=join(dir,'table.sqlite');
  let service=createTableService(file);
  try {
    const before=service.run('alice',{op:'state'});
    const first={op:'refill',version:before.version,requestId:'refill-1',amount:999999};
    const credited=service.run('alice',first);
    assert.equal(credited.balance,2000);assert.deepEqual(credited.shoe,before.shoe);
    assert.equal(credited.version,before.version+1);assert.equal(credited.round,null);
    assert.equal(service.run('alice',first).balance,2000);
    assert.equal(service.run('bob',{op:'state'}).balance,1000);
    assert.throws(()=>service.run('alice',{...first,amount:1}),/different input/);
    assert.throws(()=>service.run('alice',{...first,requestId:'stale'}),/Table changed/);
    service.run('alice',{op:'refill',version:credited.version,requestId:'refill-2'});
    service.close();service=createTableService(file);
    assert.equal(service.run('alice',first).balance,3000);
    const db=new DatabaseSync(file),g=fixture(['8','6','8','10','3','2']);
    db.prepare('UPDATE demo_tables SET state=? WHERE session=?').run(JSON.stringify(g),createHash('sha256').update('alice').digest('hex'));db.close();
    const active=service.run('alice',{op:'start',version:0,requestId:'start',bets});
    const topped=service.run('alice',{op:'refill',version:active.version,requestId:'mid-round'});
    assert.equal(topped.balance,active.balance+1000);
    assert.deepEqual(topped.round,active.round);assert.deepEqual(topped.shoe,active.shoe);
    assert.equal(topped.version,active.version+1);
  } finally {service.close();rmSync(dir,{recursive:true,force:true});}
});

test('a push beside a bust closes on the push line: the bust was already voiced (CH report)', () => {
  const c = r => ({ r, s: '♠' });
  const bust = { box: 5, stake: 10, result: 0, splitFrom: null, cards: [c('7'), c('6'), c('2'), c('10')] };
  const push = { box: 6, stake: 10, result: 10, splitFrom: null, cards: [c('K'), c('J')] };
  const dealer = [c('10'), c('3'), c('7')];
  assert.equal(outcomeSpeech({ dealer, hands: [bust, push] }), 'push');
  assert.equal(outcomeSpeech({ dealer, hands: [bust, push, { ...push, box: 4, result: 0, cards: [c('10'), c('8')] }] }), 'lose');
  assert.equal(outcomeSpeech({ dealer, hands: [bust] }), 'lose');
});

test('dealer bust beside a busted hand closes on a plain win line, not "everyone gets paid" (CH)', () => {
  const c = r => ({ r, s: '♠' });
  const dealer = [c('10'), c('6'), c('9')];
  const won = { box: 6, stake: 10, result: 20, splitFrom: null, cards: [c('10'), c('8')] };
  const bust = { box: 5, stake: 500, result: 0, splitFrom: null, cards: [c('10'), c('6'), c('9')] };
  assert.equal(outcomeSpeech({ dealer, hands: [won] }), 'dealerbust');
  assert.equal(outcomeSpeech({ dealer, hands: [bust, won] }), 'win');
});
