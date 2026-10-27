import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { scryptSync } from 'node:crypto';
import { craigIdentity } from '../packages/studio-access/server/craig-identity.mjs';
import { playerAuth } from '../services/game/storage/async-player-auth.mjs';
import { createPgliteStore } from './fixtures/pglite-pool.mjs';
// Async CRAIG identity (croupier_auth) and player auth (croupier_game) on real PostgreSQL (PGlite).
const store=await createPgliteStore(),craig=store.boDb,players=store.db;
const password='Legacy123';
const insertUser='INSERT INTO users (id,username,email,salt,hash,role,created_at) VALUES (?,?,?,?,?,?,?)',at=new Date(0).toISOString();
await craig.prepare(insertUser).run(1,'existing','existing@example.invalid','test-salt',scryptSync(password,'test-salt',64).toString('hex'),'admin',at);
await craig.prepare(insertUser).run(2,'invited','invited@example.invalid',null,null,'reader',at);
const users=()=>craig.prepare('SELECT * FROM users ORDER BY id').all();
const before=await users();let created=0;
const makePlayer=async({name})=>{assert.equal(name,'existing');const id=`casino-${++created}`;await players.prepare('INSERT INTO players (id,name,created_at) VALUES (?,?,?)').run(id,name,at);return {id};};
let auth=playerAuth(players,makePlayer,craigIdentity(craig));
const server=createServer(async(req,res)=>{if(await auth.handle(req,res))return;const id=await auth.user(req);res.writeHead(id?200:401);res.end(JSON.stringify({id}));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const login=(email,p=password)=>fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:p})});
try {
assert.equal((await login('existing','wrong')).status,401);assert.equal(created,0);
const invited=await login('invited');assert.equal(invited.status,401);assert.match((await invited.json()).error,/Username or password is incorrect/);assert.equal(created,0);
const first=await login(' EXISTING@EXAMPLE.INVALID ');assert.equal(first.status,200);const cookie=first.headers.get('set-cookie');
assert.deepEqual(await(await fetch(base,{headers:{cookie}})).json(),{id:'casino-1'});
const second=await login('existing');assert.equal(second.status,200);assert.equal(created,1);
assert.equal((await players.prepare('SELECT COUNT(*) n FROM player_accounts').get()).n,0);
assert.deepEqual(await users(),before,'CRAIG credentials and roles unchanged');
auth=playerAuth(players,makePlayer,craigIdentity(craig));assert.equal((await fetch(base,{headers:{cookie}})).status,200);
assert.equal((await fetch(base+'/api/auth/register',{method:'POST',body:'{}'})).status,403);
await craig.prepare('UPDATE users SET hash=? WHERE id=1').run(scryptSync('Changed123','test-salt',64).toString('hex'));
assert.equal((await fetch(base,{headers:{cookie}})).status,401);assert.equal((await login('existing')).status,401);
const changed=await login('existing','Changed123');assert.equal(changed.status,200);assert.equal(created,1);
await craig.prepare('DELETE FROM users WHERE id=1').run();assert.equal((await fetch(base,{headers:{cookie:changed.headers.get('set-cookie')}})).status,401);
console.log('CRAIG integration passed: existing email/username and legacy password, stable profile link, no password/role copying, registration blocked, restart persistence, password-change and deleted-user revocation');
}finally{await new Promise(r=>server.close(r));await store.close();}
