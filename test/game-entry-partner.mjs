import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHmac} from 'node:crypto';
import {Readable} from 'node:stream';
import {installPartnerApi as syncFactory} from '../services/game/partner-api.mjs';
import {installPartnerApi as asyncFactory} from '../services/game/storage/async-partner-api.mjs';

for (const [name,factory,asynchronous] of [['SQLite',syncFactory,false],['async storage contract',asyncFactory,true]]) {
  test(`${name} partner launch returns canonical game address with preserved identity and wallet`,async t => {
    const sqlite = new DatabaseSync(':memory:');t.after(() => sqlite.close());
    sqlite.exec(`CREATE TABLE players(id TEXT PRIMARY KEY,name TEXT,currency TEXT,balance REAL,created_at TEXT,status TEXT DEFAULT 'active');
      CREATE TABLE api_keys(id TEXT PRIMARY KEY,name TEXT,key TEXT UNIQUE,secret TEXT,scopes TEXT,wallet_url TEXT,ip_allow TEXT,created_by TEXT,created_at TEXT,last_used TEXT,revoked_at TEXT);
      CREATE TABLE partner_players(key_id TEXT,partner_player TEXT,player_id TEXT,PRIMARY KEY(key_id,partner_player));`);
    const context = new AsyncLocalStorage();
    const db = asynchronous ? {
      prepare(sql) {const statement = sqlite.prepare(sql.replace(/ FOR UPDATE\b/g,''));return Object.fromEntries(['get','all','run'].map(method => [method,async (...args) => statement[method](...args)]));},
      async transaction(work) {if (context.getStore()) return work();sqlite.exec('BEGIN');try {const result = await context.run(true,work);sqlite.exec('COMMIT');return result;}catch(error) {sqlite.exec('ROLLBACK');throw error;}},
    } : sqlite;
    const claims = [],journal = [];
    const partner = factory({db,boDb:db,publicUrl:'https://game.example.invalid',publicGamePath:'/blackjack',root:'',
      getPlayer:id => db.prepare('SELECT * FROM players WHERE id=?').get(id),
      jwtSign:value => {claims.push(value);return 'fixture.claim.signature';},logTx:(...args) => journal.push(args)});
    const key = await partner.keys.create({name:'isolated-game-address',scopes:['launch']});
    const minted = await partner.keys.mintLaunch(key.id,{playerId:'stable-external-ref',displayName:'Player',currency:'EUR'});
    sqlite.prepare('UPDATE players SET balance=127.5 WHERE id=?').run(minted.playerRef);
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
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM players').get().count,1);
    assert.equal(sqlite.prepare('SELECT currency FROM players').get().currency,'EUR');
    assert.equal(sqlite.prepare('SELECT balance FROM players').get().balance,127.5);assert.deepEqual(journal,[]);
  });
}
