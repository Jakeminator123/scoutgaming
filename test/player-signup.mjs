import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { playerAuth } from '../web/player-auth.mjs';
import { blackjackUrl } from '../ops/vercel-entry/build.mjs';

test('player account survives restart, remains separate from Scout, rejects impersonation and revokes sessions', async () => {
  const directory=mkdtempSync(join(tmpdir(),'player-signup-'));
  let db=new DatabaseSync(join(directory,'test.db'));
  db.exec('CREATE TABLE players (id INTEGER PRIMARY KEY, name TEXT)');
  const createPlayer=({name})=>({id:String(db.prepare('INSERT INTO players (name) VALUES (?)').run(name).lastInsertRowid)});
  const identity={candidates:()=>[],find:()=>({id:'operator'}),stamp:()=> 'operator-stamp',authenticate:()=>{throw Error('Player login must not query CRAIG');}};
  let auth=playerAuth(db,createPlayer,identity,{playerAccounts:true});
  const server=createServer(async(req,res)=>{if(await auth.handle(req,res))return;const playerId=auth.user(req);res.writeHead(playerId?200:401);res.end(playerId??'unauthorized');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=(path,body,cookie='',origin=base)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json',origin,cookie},body:JSON.stringify(body)});
  const password='Synthetic-Test-Password';
  try {
    assert.equal((await post('/api/auth/player/register',{username:'demo',password},'','https://foreign.invalid')).status,403);
    let response=await post('/api/auth/player/register',{username:'Demo',password,playerId:'operator',role:'admin'});
    assert.equal(response.status,200);
    const cookie=response.headers.get('set-cookie');
    assert.match(cookie,/HttpOnly/); assert.match(cookie,/SameSite=Strict/);
    assert.equal(await(await fetch(base,{headers:{cookie}})).text(),'1');
    assert.equal(db.prepare('SELECT count(*) AS n FROM craig_player_links').get().n,0);
    const account=db.prepare('SELECT * FROM player_accounts').get();
    assert.equal(account.email,'username:demo');assert.notEqual(account.hash,password);
    assert.equal((await post('/api/auth/player/register',{username:'demo',password})).status,400);
    assert.equal(db.prepare('SELECT count(*) AS n FROM players').get().n,1);
    assert.equal((await post('/api/auth/player/login',{username:'demo',password:'wrong'})).status,400);
    assert.equal((await post('/api/auth/register',{email:'demo@example.invalid',password})).status,403);
    db.close();db=new DatabaseSync(join(directory,'test.db'));auth=playerAuth(db,createPlayer,identity,{playerAccounts:true});
    assert.equal(await(await fetch(base,{headers:{cookie}})).text(),'1');
    response=await post('/api/auth/player/login',{username:'DEMO',password});assert.equal(response.status,200);
    const cookie2=response.headers.get('set-cookie');
    await post('/api/auth/logout',{},cookie2);assert.equal((await fetch(base,{headers:{cookie:cookie2}})).status,401);
    auth=playerAuth(db,createPlayer,identity);assert.equal((await fetch(base,{headers:{cookie}})).status,401);
    assert.equal((await post('/api/auth/player/login',{username:'demo',password})).status,403);
    auth=playerAuth(db,createPlayer,identity,{playerAccounts:true});
    db.prepare('UPDATE player_accounts SET hash=?').run('a'.repeat(128));
    assert.equal((await fetch(base,{headers:{cookie}})).status,401);
    db.prepare('DELETE FROM player_accounts').run();
    assert.equal((await fetch(base,{headers:{cookie}})).status,401);
  } finally {await new Promise(resolve=>server.close(resolve));db.close();rmSync(directory,{recursive:true,force:true});}
});

test('Vercel entrance accepts exact HTTPS origin and uses the blackjack route',()=>{
  assert.equal(blackjackUrl('https://game.example.invalid'),'https://game.example.invalid/blackjack');
  assert.equal(blackjackUrl('http://127.0.0.1:4200',{local:true}),'http://127.0.0.1:4200/blackjack');
  for(const value of ['', 'http://game.example.invalid','https://user:password@game.example.invalid','https://game.example.invalid/path','https://game.example.invalid?x=1','https://localhost'])assert.throws(()=>blackjackUrl(value));
});
