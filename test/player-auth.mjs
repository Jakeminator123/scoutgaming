import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {playerAuth} from '../web/player-auth.mjs';
const db=new DatabaseSync(':memory:');let created=0;
const auth=playerAuth(db,()=>({id:`player-${++created}`}));
const server=createServer(async(req,res)=>{if(await auth.handle(req,res))return;const id=auth.user(req);res.writeHead(id?200:401);res.end(id??'unauthorized');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const email='qa@example.invalid',password='Temporary-Test-Password-4173';
const post=(path,body,cookie='',origin)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',cookie,...(origin?{origin}:{})},body:JSON.stringify(body)});
try {
assert.equal((await fetch(base)).status,401);
let r=await post('/api/auth/register',{email,password});assert.equal(r.status,200);
const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);
assert.equal(await(await fetch(base,{headers:{cookie}})).text(),'player-1');
const account=db.prepare('SELECT * FROM player_accounts').get();assert.notEqual(account.hash,password);assert.equal(account.hash.length,128);
assert.equal((await post('/api/auth/login',{email,password:'Incorrect-Password-4173'})).status,401);
assert.equal((await post('/api/auth/register',{email,password})).status,400);
assert.equal((await post('/api/auth/login',{email,password},'','https://evil.invalid')).status,403);
r=await post('/api/auth/login',{email,password});assert.equal(r.status,200);const loginCookie=r.headers.get('set-cookie');
// Reconstructing the auth module preserves sessions in the database.
const restarted=playerAuth(db,()=>{throw Error('unexpected');});assert.equal(restarted.user({headers:{cookie:loginCookie}}),'player-1');
const partnerToken='a'.repeat(64),partnerDigest=createHash('sha256').update(partnerToken).digest('hex');
db.prepare('INSERT INTO player_sessions (digest,player_id,expires,source_stamp,display_name) VALUES (?,?,?,?,?)').run(partnerDigest,'partner-player',Date.now()+60000,'partner:key-1','Jakob');
assert.deepEqual(restarted.session({headers:{cookie:`player_session=${partnerToken}`}}),{playerId:'partner-player',partnerKeyId:'key-1',displayName:'Jakob'});
const neutralToken='b'.repeat(64),neutralDigest=createHash('sha256').update(neutralToken).digest('hex');
db.prepare('INSERT INTO player_sessions (digest,player_id,expires,source_stamp,display_name) VALUES (?,?,?,?,NULL)').run(neutralDigest,'partner-player',Date.now()+60000,'partner:key-1');
assert.deepEqual(restarted.session({headers:{cookie:`player_session=${neutralToken}`}}),{playerId:'partner-player',partnerKeyId:'key-1',displayName:'spelaren'});
const claimCookie=restarted.fromPartner({headers:{},socket:{}},{sub:'partner-player',partner:'key-2',displayName:'Jäkob'});
assert.deepEqual(restarted.session({headers:{cookie:claimCookie}}),{playerId:'partner-player',partnerKeyId:'key-2',displayName:'Jäkob'});
const fallbackCookie=restarted.fromPartner({headers:{},socket:{}},{sub:'partner-player',partner:'key-2'});
assert.deepEqual(restarted.session({headers:{cookie:fallbackCookie}}),{playerId:'partner-player',partnerKeyId:'key-2',displayName:'spelaren'});
assert.throws(()=>restarted.fromPartner({headers:{},socket:{}},{sub:'partner-player'}),/Partner launch claims/);
await post('/api/auth/logout',{},loginCookie);assert.equal((await fetch(base,{headers:{cookie:loginCookie}})).status,401);
db.prepare('UPDATE player_sessions SET expires=0').run();assert.equal((await fetch(base,{headers:{cookie}})).status,401);
assert.equal(created,1);
console.log('Auth checks passed: registration, password hashing, login, invalid credentials, origin, session persistence, logout and expiry');
}finally{await new Promise(r=>server.close(r));db.close();}
