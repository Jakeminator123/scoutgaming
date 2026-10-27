import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewTable} from '../services/game/preview-table.mjs';
import {createPostgresNativeTableCommand} from '../services/game/postgres-native-table.mjs';
import {command as shoeCommand,newGame} from '../services/game/shoe-game.mjs';
import {fakeNativeTablePool} from './fixtures/native-table-fake-pool.mjs';

const bets=[{main:5,pp:0,tp:0},...Array.from({length:6},()=>({main:0,pp:0,tp:0}))];
const card=text=>({r:text.slice(0,-1),s:text.slice(-1)});
// Draw order for one box: player, dealer up, player, hole, then hits. Round one is
// 10+6 against 9 (hit 3, stand, dealer stands on 17); round two is 6+5 against 5
// (double 9, dealer 15 draws 7 and busts).
const draws=['10♠','9♥','6♣','8♦','3♠','6♥','5♣','5♦','10♣','9♥','7♠'];
function seededGame(cards=draws){
  const game=newGame();shoeCommand(game,{op:'state'},1000);game.shoe.id='fixed-shoe';
  game.shoe.cards.splice(-cards.length,cards.length,...cards.map(card).reverse());
  return game;
}
// The same player, seed and requests for the preview table and the production
// PostgreSQL command; only the ledger timestamp and row encoding differ.
function bothTables(game=seededGame()){
  const preview=createPreviewTable({players:[{id:'p1',name:'Fixture',currency:'EUR',balance:1000}],tables:{p1:game}});
  const {pool,store}=fakeNativeTablePool({state:{players:{p1:{id:'p1',name:'Fixture',currency:'EUR',balance:'1000',status:'active'}},tables:{p1:JSON.stringify(game)}}});
  const product=createPostgresNativeTableCommand({pool});
  const outcome=async run=>{try{return {ok:await run()};}catch(error){return {error:error.message};}};
  return {
    preview:{run:req=>outcome(()=>preview.command({id:'p1',...req})),
      committed:()=>({balance:preview.player('p1').balance,receipt:preview.receipt('p1')??null,
        ledger:preview.transactions().map(row=>[row.playerId,row.type,row.amount,row.currency,row.note])})},
    product:{run:req=>outcome(()=>product({id:'p1',...req})),
      committed:()=>{const row=store.state.presentations.p1;return {balance:Number(store.state.players.p1.balance),
        receipt:row?{version:row.version,payload:row.payload}:null,ledger:store.state.transactions.map(args=>args.slice(0,5))};}},
  };
}
async function step(tables,req){
  const preview=await tables.preview.run(req),product=await tables.product.run(req);
  assert.deepEqual(preview,product,JSON.stringify(req));
  assert.deepEqual(tables.preview.committed(),tables.product.committed(),JSON.stringify(req));
  return preview;
}

test('preview table matches the production command for a scripted table, replay and refusals',async()=>{
  const tables=bothTables(),seen=new Set();
  const play=async req=>{const result=await step(tables,req);seen.add(req.action??req.op);return result;};
  let view=(await play({op:'state'})).ok;
  const opening={op:'start',version:view.version,requestId:'round-1',bets};
  view=(await play(opening)).ok;assert.equal(view.balance,995);assert.ok(view.presentation.some(event=>event.type==='deal'));
  const receipt=tables.preview.committed().receipt;assert.equal(receipt.version,view.version);
  assert.deepEqual(await play(opening),{ok:view},'an idempotent replay returns the original response and receipt');
  assert.deepEqual(await play({...opening,bets:bets.map((row,box)=>({...row,main:box?0:10}))}),{error:'Request ID reused with different input'});
  assert.deepEqual(await play({op:'start',version:0,requestId:'stale-1',bets}),{error:'Table changed; reload to resume'});
  assert.deepEqual(await play({op:'act',action:'split',version:view.version,requestId:'split-1'}),{error:'Illegal action'});
  assert.deepEqual(await play({op:'collect',version:view.version,requestId:'early-collect'}),{error:'Round is not settled'});
  assert.deepEqual(tables.preview.committed().receipt,receipt,'refused commands keep the committed receipt');
  view=(await play({op:'act',action:'hit',version:view.version,requestId:'hit-1'})).ok;
  view=(await play({op:'act',action:'stand',version:view.version,requestId:'stand-1'})).ok;assert.equal(view.round.phase,'settled');
  view=(await play({op:'collect',version:view.version,requestId:'collect-1'})).ok;assert.equal(view.balance,1005);
  view=(await play({op:'start',version:view.version,requestId:'round-2',bets})).ok;
  assert.ok(view.round.legalActions.includes('double'));
  view=(await play({op:'act',action:'double',version:view.version,requestId:'double-1'})).ok;assert.equal(view.balance,995);
  view=(await play({op:'collect',version:view.version,requestId:'collect-2'})).ok;assert.equal(view.balance,1015);
  // A stale replay of an older request is refused rather than re-run.
  assert.deepEqual(await play({...opening,version:0}),{error:'Table changed; reload to resume'});
  assert.deepEqual(await play({op:'act',action:'stand',version:view.version,requestId:'no-round'}),{error:'No active round'});
  await play({op:'state'});
  assert.deepEqual([...seen].sort(),['collect','double','hit','split','stand','start','state']);
  assert.deepEqual(tables.preview.committed().ledger.map(row=>[row[1],row[2]]),[['start',-5],['collect',10],['start',-5],['act',-5],['collect',20]]);
});

test('a command that fails after drawing leaves both tables exactly as committed',async()=>{
  // Three cards cannot finish an opening deal, so the shoe is exhausted mid-command.
  const game=seededGame();game.shoe.cards=game.shoe.cards.slice(-3);
  const tables=bothTables(game),before=(await step(tables,{op:'state'})).ok;
  assert.deepEqual(await step(tables,{op:'start',version:0,requestId:'round-1',bets}),{error:'Shoe exhausted; round paused. No mid-round shuffle.'});
  assert.deepEqual((await step(tables,{op:'state'})).ok,before);
  assert.deepEqual(tables.preview.committed(),{balance:1000,receipt:null,ledger:[]});
});

test('preview table hands out copies, rejects unknown players and is unusable after close',()=>{
  const table=createPreviewTable({players:[{id:'p1',name:'Fixture',currency:'EUR',balance:1000}]});
  table.player('p1').balance=0;assert.equal(table.player('p1').balance,1000);
  assert.throws(()=>table.command({id:'other',op:'state'}),/Load your player first/);
  assert.throws(()=>createPreviewTable({players:[{id:'p1',balance:'1000'}]}),/Invalid preview player/);
  assert.throws(()=>createPreviewTable({tables:{p1:newGame()}}),/Invalid preview table/);
  const opened=table.command({id:'p1',op:'start',version:0,requestId:'round-1',bets});
  assert.deepEqual(table.receipt('p1'),{version:opened.version,payload:JSON.stringify(opened.presentation)});
  table.close();
  for(const use of [()=>table.player('p1'),()=>table.receipt('p1'),()=>table.transactions(),()=>table.command({id:'p1',op:'state'})])assert.throws(use,/Preview table closed/);
});
