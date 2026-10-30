// Real HTTP acceptance of the authoritative blackjack table on PostgreSQL. The
// engine runs from the repository against its own disposable database and role
// (test/fixtures/engine-qa.mjs); this test never opens a running preview database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ENGINE_QA_SKIP, createEngineDatabase, freePort, installBaseStudioRuntime, startEngine } from './fixtures/engine-qa.mjs';

test('authoritative table over HTTP: empty entry, debit once, retries, restart, settlement and shoe depletion', { skip: ENGINE_QA_SKIP }, async t => {
  const database = await createEngineDatabase(t), { db } = database.store, studio = await installBaseStudioRuntime(t, database);
  const port = await freePort(), origin = `http://127.0.0.1:${port}`;
  const checks = [];
  let engine, cookie = '', player, state;
  const start = async () => { engine = await startEngine(t, { database, port, preload: studio.preload, env: { ...studio.env, DEMO_GUEST_ACCESS: '1' } }); };
  const stop = async () => { await engine?.stop(); };
  async function post(path, body, expected = 200) {
    const response = await fetch(origin + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
      body: JSON.stringify(body), signal: AbortSignal.timeout(10000)
    });
    cookie = response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ') || cookie;
    const value = await response.json();
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(value)}`);
    return value;
  }
  const request = (op, extra = {}) => ({ op, version: state.version, requestId: crypto.randomUUID(), ...extra });
  async function send(op, extra = {}) { const req = request(op, extra); state = await post('/api/table', req); return req; }
  async function refresh() { state = await post('/api/table', { op: 'state' }); return state; }
  const bets = [{main:5,pp:0,tp:0}, ...Array.from({length:6},()=>({main:0,pp:0,tp:0}))];
  // The engine's own store normalizes NUMERIC/BIGINT exactly as the server reads them.
  async function snapshot() {
    return { table: (await db.prepare('SELECT state FROM blackjack_tables WHERE player_id=?').get(player.id)).state,
      balance: (await db.prepare('SELECT balance FROM players WHERE id=?').get(player.id)).balance,
      transactions: (await db.prepare('SELECT count(*) AS n FROM transactions WHERE player_id=?').get(player.id)).n };
  }
  async function fixture(cards) {
    const g = JSON.parse((await snapshot()).table);
    assert.ok(!g.round || g.paid, 'Fixture only between collected rounds');
    const before = g.shoe.cards.map(c => c.r+c.s).sort();
    const draws = cards.map(([r,s]) => {
      const index = g.shoe.cards.findIndex(c => c.r === r && c.s === s);
      assert.ok(index >= 0, `Missing fixture card ${r}${s}`);
      return g.shoe.cards.splice(index,1)[0];
    });
    g.shoe.cards.push(...draws.reverse());
    assert.deepEqual(g.shoe.cards.map(c => c.r+c.s).sort(), before, 'Fixture preserves undealt multiset');
    await db.prepare('UPDATE blackjack_tables SET state=? WHERE player_id=?').run(JSON.stringify(g),player.id);
  }
  async function finish() {
    if (state.round.phase === 'insurance') await send('insurance', {take:false});
    while (state.round.phase === 'decisions') await send('act', {action:'stand'});
    assert.equal(state.round.phase, 'settled');
    await send('collect'); assert.equal(state.round, null);
  }
  await start();
  let entryHtml;
  for (const path of ['/v2', '/v2/', '/v2/index.html']) {
    const retired = await fetch(origin + path + '?dealer=astrid', { redirect: 'manual' });
    assert.equal(retired.status, 404, `retired V2 alias ${path} is gone, not redirected`);
    await retired.text();
  }
  // The canonical entry is fixed: the root moves a dealer query to /game, whose shell
  // never turns the query into a presentation without a published table.
  for (const path of ['/']) {
    const response = await fetch(origin + path + '?dealer=astrid', { redirect: 'manual' });
    assert.equal(response.status, 307, `empty installation entry ${path}`);
    assert.equal(response.headers.get('location'), '/game?dealer=astrid');
    const html = await (await fetch(origin + '/game?dealer=astrid', { redirect: 'manual' })).text();
    assert.doesNotMatch(html,/data-game-dealer=|data-dealer=|data-game-lane=/,'a dealer query cannot create a playable presentation');
    entryHtml ??= html;
    assert.equal(html, entryHtml, 'the empty entry has one response');
  }
  checks.push('Empty entry fails closed and V2 is gone; explicit dealer query never creates a presentation');
  player = await post('/api/player', {}); await refresh();
  checks.push('Isolated guest session still authenticates the authoritative table API');
  assert.equal(state.balance,1000); assert.equal(state.shoe.remaining,415);
  const beforeUnavailableSpeech = await snapshot();
  const unavailableSpeech = await post('/api/table',request('start',{dealer:'dragan',bets,
    movingSpeech:{sessionRevision:'session-before-disable',context:{operatorSlug:'dragan-test',roomId:'test-room',packageRevision:4,dealerId:'dragan'}}}),409);
  assert.equal(unavailableSpeech.error,'moving_deal_speech_unavailable');
  assert.deepEqual(await snapshot(),beforeUnavailableSpeech,'disabled speech cannot debit, deal or advance the table');
  for(const invalid of [request('state',{movingSpeech:{sessionRevision:'valid-session'}}),
    request('start',{dealer:'dragan',bets,movingSpeech:{sessionRevision:''}})]){
    const refused=await post('/api/table',invalid,409);
    assert.equal(refused.error,'invalid_moving_deal_context');
    assert.deepEqual(await snapshot(),beforeUnavailableSpeech);
  }
  checks.push('Disabled dealing speech is rejected before any table or wallet mutation; invalid contexts remain blocked');
  await fixture([['8','♠'],['6','♦'],['8','♥'],['10','♣'],['3','♦'],['2','♣'],['9','♦'],['K','♥'],['5','♠']]);
  const startRequest = await send('start',{bets});
  assert.equal(state.balance,995); assert.equal(state.shoe.remaining,411);
  assert.equal(state.round.dealer.length,1); assert.ok(!('cards' in state.shoe));
  assert.ok(!JSON.stringify(state).includes('holeCard'));
  const initial = await snapshot();
  assert.deepEqual(await post('/api/table',startRequest),state); assert.deepEqual(await snapshot(),initial);
  await post('/api/table',{...startRequest,requestId:crypto.randomUUID()},400);
  await post('/api/table',request('collect'),400); assert.deepEqual(await snapshot(),initial);
  checks.push('Initial deal: one debit, private shoe/hole, duplicate retry and stale/illegal rollback');

  const visible = structuredClone(state);
  await stop(); await start(); await refresh();
  const {shuffled, presentation: priorPresentation, op: priorOp, requestId: priorRequestId, ...initialState} = visible;
  const {presentation, op, requestId, ...refreshedState} = state;
  assert.equal(op, 'state'); assert.equal(requestId, null); assert.deepEqual(presentation, []);
  assert.equal(priorOp, 'start'); assert.equal(priorRequestId, startRequest.requestId);
  assert.ok(priorPresentation.length > 0);
  assert.deepEqual(refreshedState, initialState); assert.deepEqual(await snapshot(),initial);
  checks.push('Process restart: same guest session, cards, version, shoe and wallet; no second debit');

  const split = request('act',{action:'split'});
  const repeats = await Promise.all([post('/api/table',split),post('/api/table',split)]);
  assert.deepEqual(repeats[0],repeats[1]); state=repeats[0];
  assert.equal(state.balance,990); assert.equal(state.round.hands.length,2); assert.equal(state.shoe.dealt,7);
  await send('act',{action:'hit'}); await send('act',{action:'stand'}); await send('act',{action:'double'});
  assert.equal(state.balance,985); assert.equal(state.round.phase,'settled'); assert.equal(state.shoe.dealt,10);
  const payout = state.round.hands.reduce((n,h)=>n+h.result+h.sideReturn,0);
  const collection = await send('collect'); const paid = await snapshot();
  assert.equal(state.balance,985+payout);
  await post('/api/table',collection); assert.deepEqual(await snapshot(),paid);
  checks.push('Concurrent split retries: one stake and draw; hit/double/settlement; collection pays once');

  let balance = state.balance;
  await fixture([['8','♣'],['A','♦'],['8','♦'],['K','♣']]);
  await send('start',{bets}); assert.equal(state.round.phase,'insurance');
  assert.equal(state.round.dealer.length,1);
  await send('insurance',{take:true}); assert.equal(state.balance,balance-7.5);
  assert.equal(state.round.phase,'settled'); assert.equal(state.round.dealer.length,2);
  await send('collect'); assert.equal(state.balance,balance);
  checks.push('Insurance: half-stake charge, delayed hole reveal, dealer blackjack payout');

  for (const [label,cards,result] of [
    ['Player blackjack',[['A','♠'],['9','♣'],['K','♦'],['8','♣']],12.5],
    ['Push',[['K','♠'],['Q','♣'],['8','♥'],['8','♦']],5],
    ['Player bust',[['K','♦'],['6','♣'],['9','♥'],['10','♦'],['5','♣']],0]
  ]) {
    balance=state.balance; await fixture(cards); await send('start',{bets});
    if(label==='Player bust')await send('act',{action:'hit'});
    await finish(); assert.equal(state.balance,balance-5+result); checks.push(`${label}: expected settlement`);
  }
  let rounds=0, oldShoe=state.shoe.id;
  while(!state.shoe.cutReached && rounds++<100) {await send('start',{bets}); await finish();}
  assert.ok(state.shoe.cutReached); assert.equal(state.shoe.id,oldShoe);
  await send('start',{bets}); assert.notEqual(state.shoe.id,oldShoe); assert.equal(state.shuffled,true);
  assert.equal(state.shoe.dealt + state.shoe.remaining,416); await finish();
  checks.push('Natural shoe depletion: cut finishes current round; replacement occurs at next start');
  t.diagnostic(JSON.stringify({checks, passed:checks.length, cutRounds:rounds, server:'services/game/server.mjs over HTTP on PostgreSQL', isolated:true,
    finalBalance:state.balance, limitations:['No rendered motion or audio acceptance; browser evidence is separate.']}));
});
