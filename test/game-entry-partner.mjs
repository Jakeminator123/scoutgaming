import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {Readable} from 'node:stream';
import {installPartnerApi as asyncFactory} from '../services/game/storage/async-partner-api.mjs';
import {createPartnerDb} from './fixtures/partner-db.mjs';

test('async storage contract partner launch returns canonical game address with preserved identity and wallet',async () => {
  const db = createPartnerDb();
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
