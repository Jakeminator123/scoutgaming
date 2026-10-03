import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {backofficeGameAuth as syncFactory} from '../web/bo-game-auth.mjs';
import {backofficeGameAuth as asyncFactory} from '../web/storage/async-bo-game-auth.mjs';
const game='https://game.example.invalid',bo='https://bo.example.invalid';
for (const [name,factory,asynchronous] of [['SQLite',syncFactory,false],['PostgreSQL contract',asyncFactory,true]]) test(`${name} BO handoff canonicalizes next/callback without passing launch or foreign redirect data`,async t => {
  const sqlite = new DatabaseSync(':memory:');t.after(() => sqlite.close());
  if(asynchronous) sqlite.exec('CREATE TABLE bo_game_handoffs(state_digest TEXT PRIMARY KEY,next_path TEXT NOT NULL,expires INTEGER NOT NULL,code_digest TEXT UNIQUE,craig_user_id TEXT,username TEXT,source_stamp TEXT,session_until INTEGER)');
  const db = asynchronous ? {prepare:sql => {const statement=sqlite.prepare(sql);return {get:async (...args)=>statement.get(...args),run:async (...args)=>statement.run(...args)};}} : sqlite;
  const auth = {user:async ()=>null,fromBackoffice:async ()=> 'player_session=preserved; Path=/'};
  const handle = factory({db,auth,identity:{find:async ()=>({id:'account',name:'Operator',stamp:'same'})},boSession:async ()=>({sub:'Operator',role:'admin',source_stamp:'same',exp:Math.floor(Date.now()/1000)+3600}),
    validLaunch:async token=>token==='a.b.c',publicUrl:game,boUrl:bo,publicGamePath:'/blackjack'});
  async function request(address,cookie) {const url=new URL(address,game),req={url:url.pathname+url.search,method:'GET',headers:{host:url.host,...(cookie?{cookie}:{})},socket:{encrypted:true}};
    const res={writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;}};await handle(req,res);return res;}
  const begin = await request('/api/auth/bo/start?next='+encodeURIComponent('/game?dealer=mei&presentation=local&launch=a.b.c&returnTo=https://evil.invalid#bad'));
  assert.equal(begin.status,303);const state = new URL(begin.headers.Location).searchParams.get('state');
  assert.equal(sqlite.prepare('SELECT next_path FROM bo_game_handoffs').get().next_path,'/blackjack?dealer=mei&presentation=local');
  const login = await request(begin.headers.Location);assert.equal(login.status,303);
  const callback = await request(login.headers.Location,`bo_game_state=${state}`);
  assert.equal(callback.status,303);assert.equal(callback.headers.Location,'/blackjack?dealer=mei&presentation=local');
  assert.ok(callback.headers['Set-Cookie'].includes('player_session=preserved; Path=/'));
  assert.equal((await request('/api/auth/bo/start?next='+encodeURIComponent('//evil.invalid/game'))).status,303);
  assert.equal(sqlite.prepare('SELECT next_path FROM bo_game_handoffs').get().next_path,'/blackjack');
});
