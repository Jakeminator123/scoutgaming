// Real HTTP + SQLite acceptance. All fixtures live in a disposable copy of
// the server; this test never opens web/data or a running preview database.
import assert from 'node:assert/strict';
import { mkdtemp, readdir, copyFile, symlink, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';

const web = fileURLToPath(new URL('../web/', import.meta.url));
const dir = await mkdtemp(join(tmpdir(), 'croupier-http-qa-'));
const checks = [];
let server, db, cookie = '', player, state;
const socket = createServer();
socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const origin = `http://127.0.0.1:${port}`;
async function start() {
  server = spawn(process.execPath, [join(dir, 'server.mjs')], {
    cwd: dir, env: { PATH: process.env.PATH, HOST: '127.0.0.1', PORT: String(port), DEMO_GUEST_ACCESS: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Isolated server did not start')), 10000);
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.stdout.on('data', data => {
      if (String(data).includes('croupier demo on')) { clearTimeout(timer); resolve(); }
    });
    server.stderr.on('data', () => {}); // Do not expose generated backoffice credentials.
  });
}
async function stop() {
  if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill('SIGTERM'); await stopped; }
}
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
function snapshot() {
  return { table: db.prepare('SELECT state FROM blackjack_tables WHERE player_id=?').get(player.id).state,
    balance: db.prepare('SELECT balance FROM players WHERE id=?').get(player.id).balance,
    transactions: db.prepare('SELECT count(*) AS n FROM transactions WHERE player_id=?').get(player.id).n };
}
function fixture(cards) {
  const g = JSON.parse(snapshot().table);
  assert.ok(!g.round || g.paid, 'Fixture only between collected rounds');
  const before = g.shoe.cards.map(c => c.r+c.s).sort();
  const draws = cards.map(([r,s]) => {
    const index = g.shoe.cards.findIndex(c => c.r === r && c.s === s);
    assert.ok(index >= 0, `Missing fixture card ${r}${s}`);
    return g.shoe.cards.splice(index,1)[0];
  });
  g.shoe.cards.push(...draws.reverse());
  assert.deepEqual(g.shoe.cards.map(c => c.r+c.s).sort(), before, 'Fixture preserves undealt multiset');
  db.prepare('UPDATE blackjack_tables SET state=? WHERE player_id=?').run(JSON.stringify(g),player.id);
}
async function finish() {
  if (state.round.phase === 'insurance') await send('insurance', {take:false});
  while (state.round.phase === 'decisions') await send('act', {action:'stand'});
  assert.equal(state.round.phase, 'settled');
  await send('collect'); assert.equal(state.round, null);
}
try {
  for (const file of await readdir(web)) if (file.endsWith('.mjs')) await copyFile(join(web,file),join(dir,file));
  await symlink(join(web,'public'), join(dir,'public'));
  await start();
  player = await post('/api/player', {}); await refresh();
  db = new DatabaseSync(join(dir,'data/croupier.db'));
  assert.equal(state.balance,1000); assert.equal(state.shoe.remaining,415);
  fixture([['8','♠'],['6','♦'],['8','♥'],['10','♣'],['3','♦'],['2','♣'],['9','♦'],['K','♥'],['5','♠']]);
  const startRequest = await send('start',{bets});
  assert.equal(state.balance,995); assert.equal(state.shoe.remaining,411);
  assert.equal(state.round.dealer.length,1); assert.ok(!('cards' in state.shoe));
  assert.ok(!JSON.stringify(state).includes('holeCard'));
  const initial = snapshot();
  assert.deepEqual(await post('/api/table',startRequest),state); assert.deepEqual(snapshot(),initial);
  await post('/api/table',{...startRequest,requestId:crypto.randomUUID()},400);
  await post('/api/table',request('collect'),400); assert.deepEqual(snapshot(),initial);
  checks.push('Initial deal: one debit, private shoe/hole, duplicate retry and stale/illegal rollback');

  const visible = structuredClone(state);
  await stop(); await start(); await refresh();
  const {shuffled, ...initialState} = visible;
  assert.deepEqual(state, initialState); assert.deepEqual(snapshot(),initial);
  checks.push('Process restart: same guest session, cards, version, shoe and wallet; no second debit');

  const split = request('act',{action:'split'});
  const repeats = await Promise.all([post('/api/table',split),post('/api/table',split)]);
  assert.deepEqual(repeats[0],repeats[1]); state=repeats[0];
  assert.equal(state.balance,990); assert.equal(state.round.hands.length,2); assert.equal(state.shoe.dealt,7);
  await send('act',{action:'hit'}); await send('act',{action:'stand'}); await send('act',{action:'double'});
  assert.equal(state.balance,985); assert.equal(state.round.phase,'settled'); assert.equal(state.shoe.dealt,10);
  const payout = state.round.hands.reduce((n,h)=>n+h.result+h.sideReturn,0);
  const collection = await send('collect'); const paid = snapshot();
  assert.equal(state.balance,985+payout);
  await post('/api/table',collection); assert.deepEqual(snapshot(),paid);
  checks.push('Concurrent split retries: one stake and draw; hit/double/settlement; collection pays once');

  let balance = state.balance;
  fixture([['8','♣'],['A','♦'],['8','♦'],['K','♣']]);
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
    balance=state.balance; fixture(cards); await send('start',{bets});
    if(label==='Player bust')await send('act',{action:'hit'});
    await finish(); assert.equal(state.balance,balance-5+result); checks.push(`${label}: expected settlement`);
  }
  let rounds=0, oldShoe=state.shoe.id;
  while(!state.shoe.cutReached && rounds++<100) {await send('start',{bets}); await finish();}
  assert.ok(state.shoe.cutReached); assert.equal(state.shoe.id,oldShoe);
  await send('start',{bets}); assert.notEqual(state.shoe.id,oldShoe); assert.equal(state.shuffled,true);
  assert.equal(state.shoe.dealt + state.shoe.remaining,416); await finish();
  checks.push('Natural shoe depletion: cut finishes current round; replacement occurs at next start');
  const report={checks, passed:checks.length, cutRounds:rounds, server:'web/server.mjs over HTTP', isolated:true,
    finalBalance:state.balance, limitations:['No rendered motion or audio acceptance; browser evidence is separate.']};
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} finally {
  db?.close(); await stop(); await rm(dir,{recursive:true,force:true});
}
