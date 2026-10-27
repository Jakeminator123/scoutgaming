import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { scryptSync } from 'node:crypto';
import { craigIdentity } from '../packages/studio-access/server/craig-identity.mjs';
import { playerAuth } from '../services/game/storage/async-player-auth.mjs';
import { createPgliteStore } from './fixtures/pglite-pool.mjs';

// Async player auth on real PostgreSQL (PGlite); created players satisfy the schema's foreign keys.
const playerFactory=db=>{let created=0;return async()=>{const id=`player-${++created}`;
  await db.prepare('INSERT INTO players (id,name,created_at) VALUES (?,?,?)').run(id,id,new Date(0).toISOString());return {id};};};

async function serve(auth) {
  const server=createServer(async(req,res)=>{
    if(await auth.handle(req,res))return;
    res.writeHead(404);res.end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  return {
    post:(path,body,headers={})=>fetch(base+path,{method:'POST',headers:{
      'content-type':'application/json',origin:base,...headers,
    },body:JSON.stringify(body)}),
    close:()=>new Promise(resolve=>server.close(resolve)),
  };
}

test('CRAIG aliases share a failure limit while other accounts on loopback can sign in',async()=>{
  const store=await createPgliteStore(),craig=store.boDb,players=store.db;
  const password='Synthetic-Test-Password';
  for(const [id,name] of [[1,'alice'],[2,'bob']]){
    const salt=`salt-${name}`;
    await craig.prepare('INSERT INTO users (id,username,email,salt,hash,role,created_at) VALUES (?,?,?,?,?,?,?)').run(id,name,`${name}@example.invalid`,salt,
      scryptSync(password,salt,64).toString('hex'),'reader',new Date(0).toISOString());
  }
  const auth=playerAuth(players,playerFactory(players),craigIdentity(craig));
  const site=await serve(auth);
  const login=(email,pass=password,headers={})=>site.post('/api/auth/login',{email,password:pass},headers);
  try{
    for(let i=0;i<11;i++)assert.equal((await login('alice','wrong')).status,401);
    // A successful login clears earlier failures; successes never consume the limit.
    for(let i=0;i<15;i++)assert.equal((await login('ALICE@EXAMPLE.INVALID')).status,200);
    for(let i=0;i<12;i++)assert.equal((await login(i%2?'alice@example.invalid':'alice','wrong')).status,401);
    assert.equal((await login('alice',password,{'x-forwarded-for':'203.0.113.1'})).status,429);
    assert.equal((await login('bob','wrong',{'x-forwarded-for':'203.0.113.1'})).status,401);
    assert.equal((await login('bob')).status,200);
  }finally{await site.close();await store.close();}
});

test('local player failures do not block another player on the same loopback socket',async()=>{
  const store=await createPgliteStore(),db=store.db;
  const auth=playerAuth(db,playerFactory(db),null,{playerAccounts:true});
  const site=await serve(auth);
  const password='Synthetic-Test-Password';
  const login=(username,pass=password,headers={})=>site.post('/api/auth/player/login',{username,password:pass},headers);
  try{
    for(const username of ['alice','bob']){
      assert.equal((await site.post('/api/auth/player/register',{username,password})).status,200);
    }
    for(let i=0;i<12;i++)assert.equal((await login('ALICE','wrong')).status,400);
    assert.equal((await login('alice',password,{'x-forwarded-for':'198.51.100.7'})).status,429);
    assert.equal((await login('bob')).status,200);
  }finally{await site.close();await store.close();}
});
