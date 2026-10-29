import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {Readable} from 'node:stream';
import {installPartnerApi as asyncFactory} from '../services/game/storage/async-partner-api.mjs';
import {createPartnerDb} from './fixtures/partner-db.mjs';
import {launchGameStart} from '../services/game/game-start.mjs';
import {launchBackendSearch, platformConfiguration, platformRoute} from '../packages/navigation/server/platform-routing.mjs';

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
    assert.equal(result.url,'https://game.example.invalid/blackjack?launch=fixture.claim.signature');
  }
  assert.equal(claims.length,2);assert.ok(claims.every(value => value.sub === minted.playerRef && value.partner === key.id));
  assert.equal(db.tables.players.length,1);
  assert.equal(db.tables.players[0].currency,'EUR');
  assert.equal(db.tables.players[0].balance,127.5);assert.deepEqual(journal,[]);
});

// L1 (O02): a key without company (every key before 012, NYCKEL-BOLAG) names none. Follow the whole landing: launch URL →
// engine landing (launchGameStart, as in server.mjs) → public routing → lobby. Neither
// a new nor an already issued dealer=astrid URL may reach /blackjack without a company.
test('partner launch lands in the lobby without a company and keeps an explicit company room',async () => {
  const db = createPartnerDb(), publicOrigin = 'https://game.example.invalid';
  const partner = asyncFactory({db,boDb:db,publicUrl:publicOrigin,publicGamePath:'/game',root:'',
    getPlayer:id => db.prepare('SELECT * FROM players WHERE id=?').get(id),
    jwtSign:value => 'fixture.'+Buffer.from(JSON.stringify(value)).toString('base64url')+'.signature',logTx:() => {}});
  const key = await partner.keys.create({name:'lobby-landing',scopes:['launch']});
  const minted = await partner.keys.mintLaunch(key.id,{playerId:'external-ref',currency:'EUR'});
  const routing = platformConfiguration({CROUPIER_VERCEL_UI:'1',CROUPIER_VERCEL_UNIFIED_UI:'1',CROUPIER_STUDIO_NATIVE_ADMIN:'1',CROUPIER_STUDIO_NEON_POLICY:'1',
    CROUPIER_PUBLIC_ORIGIN:publicOrigin,CROUPIER_BACKEND_ORIGIN:'https://engine.example.invalid',CROUPIER_LAB_UI_ORIGIN:'https://lab.example.invalid',
    CROUPIER_VERCEL_INGRESS_SECRET:'isolated-unit-secret-'.repeat(3)});
  // L5: the launch passes the public bridge (launchBackendSearch) before the engine, as on Vercel.
  const land = launchUrl => {
    const url = new URL(launchUrl), forwarded = platformRoute(url,routing);
    // The public address forwards a launch to the engine; the engine's 303 is the landing.
    assert.deepEqual(forwarded,{kind:'backend',destination:'https://engine.example.invalid/game'+launchBackendSearch(url)});
    const engine = new URL(forwarded.destination);
    engine.searchParams.delete('launch');
    const destination = launchGameStart(engine.searchParams,{origin:engine.origin});
    return {destination,route:platformRoute(new URL(destination,publicOrigin),routing)};
  };
  const launch = new URL(minted.url).searchParams.get('launch');
  assert.equal(JSON.parse(Buffer.from(launch.split('.')[1],'base64url').toString()).partner,key.id);
  assert.equal(minted.url,publicOrigin+'/game?launch='+launch);
  for (const issued of [minted.url,publicOrigin+'/game?dealer=astrid&launch='+launch,
    publicOrigin+'/game?dealer=astrid&lane=mobile-phone&table=room-1&launch='+launch]) {
    const {destination,route} = land(issued);
    assert.equal(destination,'/game?game=blackjack',issued);
    assert.deepEqual(route,{kind:'redirect',destination:publicOrigin+'/lobby'},issued);
  }
  const company = land(publicOrigin+'/game?operator=sg-test&table=room-1&dealer=astrid&launch='+launch);
  assert.equal(company.destination,'/game?game=blackjack&dealer=astrid&table=room-1&operator=sg-test');
  assert.deepEqual(company.route,{kind:'frontend'});
});
