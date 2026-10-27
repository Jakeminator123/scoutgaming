import test from 'node:test';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHmac} from 'node:crypto';
import {Readable} from 'node:stream';
import {installPartnerApi as asyncFactory} from '../services/game/storage/async-partner-api.mjs';

// Postgres-shaped players, api_keys and partner_players rows. Only the statements the
// partner API issues are answered; row locks must be taken inside a transaction, and
// a failed transaction restores every table.
function partnerDb() {
  const context = new AsyncLocalStorage();
  let tables = {players:[],api_keys:[],partner_players:[]};
  const duplicate = () => {throw Object.assign(Error('duplicate key value'),{code:'23505'});};
  const statements = {
    'INSERT INTO api_keys (id,name,key,secret,scopes,wallet_url,ip_allow,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)':(id,name,key,secret,scopes,wallet_url,ip_allow,created_by,created_at) => {
      if (tables.api_keys.some(row => row.id === id || row.key === key)) duplicate();
      tables.api_keys.push({id,name,key,secret,scopes,wallet_url,ip_allow,created_by,created_at,last_used:null,revoked_at:null});return {changes:1};},
    'SELECT * FROM api_keys WHERE id=? AND revoked_at IS NULL':id => tables.api_keys.filter(row => row.id === id && row.revoked_at === null),
    'SELECT * FROM api_keys WHERE key=? AND revoked_at IS NULL':key => tables.api_keys.filter(row => row.key === key && row.revoked_at === null),
    'SELECT secret,revoked_at FROM api_keys WHERE id=?':id => tables.api_keys.filter(row => row.id === id).map(({secret,revoked_at}) => ({secret,revoked_at})),
    'UPDATE api_keys SET last_used=? WHERE id=?':(at,id) => {const hit = tables.api_keys.filter(row => row.id === id);for (const row of hit) row.last_used = at;return {changes:hit.length};},
    'SELECT player_id FROM partner_players WHERE key_id=? AND partner_player=?':(keyId,partnerPlayer) => tables.partner_players
      .filter(row => row.key_id === keyId && row.partner_player === partnerPlayer).map(({player_id}) => ({player_id})),
    'INSERT INTO partner_players VALUES (?,?,?)':(key_id,partner_player,player_id) => {
      if (tables.partner_players.some(row => row.key_id === key_id && row.partner_player === partner_player)) duplicate();
      tables.partner_players.push({key_id,partner_player,player_id});return {changes:1};},
    'SELECT id,name,currency,balance,status FROM players WHERE id=? FOR UPDATE':id => {
      assert.equal(context.getStore(),true,'player row locks are taken inside a transaction');
      return tables.players.filter(row => row.id === id).map(({id,name,currency,balance,status}) => ({id,name,currency,balance,status}));},
    'SELECT * FROM players WHERE id=?':id => tables.players.filter(row => row.id === id),
    'INSERT INTO players (id,name,currency,balance,created_at) VALUES (?,?,?,?,?)':(id,name,currency,balance,created_at) => {
      if (tables.players.some(row => row.id === id)) duplicate();
      tables.players.push({id,name,currency,balance,created_at,status:'active'});return {changes:1};},
  };
  return {
    get tables() {return tables;},
    prepare(sql) {
      const answer = statements[sql];if (!answer) throw Error('unexpected SQL: '+sql);
      return {get:async (...args) => structuredClone(answer(...args)[0]),all:async (...args) => structuredClone(answer(...args)),run:async (...args) => answer(...args)};
    },
    async transaction(work) {if (context.getStore()) return work();const snapshot = structuredClone(tables);try {return await context.run(true,work);}catch(error) {tables = snapshot;throw error;}},
  };
}

test('async storage contract partner launch returns canonical game address with preserved identity and wallet',async () => {
  const db = partnerDb();
  const claims = [],journal = [];
  const partner = asyncFactory({db,boDb:db,publicUrl:'https://game.example.invalid',publicGamePath:'/blackjack',root:'',
    getPlayer:id => db.prepare('SELECT * FROM players WHERE id=?').get(id),
    jwtSign:value => {claims.push(value);return 'fixture.claim.signature';},logTx:(...args) => journal.push(args)});
  const key = await partner.keys.create({name:'isolated-game-address',scopes:['launch']});
  const minted = await partner.keys.mintLaunch(key.id,{playerId:'stable-external-ref',displayName:'Player',currency:'EUR'});
  db.tables.players.find(row => row.id === minted.playerRef).balance = 127.5;
  const path = '/api/v1/launch',body = JSON.stringify({playerId:'stable-external-ref',displayName:'Player',currency:'EUR'}),timestamp = String(Math.floor(Date.now()/1000));
  const request = Readable.from([body]);request.method = 'POST';request.headers = {'x-api-key':key.key,'x-timestamp':timestamp,
    'x-signature':createHmac('sha256',key.secret).update(`${timestamp}.POST.${path}.${body}`).digest('hex')};
  const response = {writeHead(status) {this.status = status;},end(text) {this.body = JSON.parse(text);}};
  await partner.handle(request,response,path);
  assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.playerRef,minted.playerRef);
  for (const result of [minted,response.body]) {
    assert.equal(result.url,'https://game.example.invalid/blackjack?dealer=astrid&launch=fixture.claim.signature');
  }
  assert.equal(claims.length,2);assert.ok(claims.every(value => value.sub === minted.playerRef && value.partner === key.id));
  assert.equal(db.tables.players.length,1);
  assert.equal(db.tables.players[0].currency,'EUR');
  assert.equal(db.tables.players[0].balance,127.5);assert.deepEqual(journal,[]);
});
