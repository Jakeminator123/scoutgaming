// Actual server and disposable SQLite files. No live users, wallets or cookies.
import assert from 'node:assert/strict';
import {mkdtemp,readdir,copyFile,symlink,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {request as httpRequest} from 'node:http';
import {once} from 'node:events';
import {DatabaseSync} from 'node:sqlite';
import {scryptSync,createHmac,createHash,randomUUID} from 'node:crypto';
import {copyOpenClawRuntime} from './fixtures/copy-openclaw-runtime.mjs';
const dir=await mkdtemp(join(tmpdir(),'bo-game-auth-')),web=new URL('../services/game/',import.meta.url);
const webDir=join(dir,'services','game');
const socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(r=>socket.close(r));
const game=`http://game.localhost:${port}`,bo=`http://bo.localhost:${port}`,password='Isolated-Auth-QA-Only';
let server,db,craig;
const request=async(url,{cookie='',body,headers={},omitOrigin=false,method=body?'POST':'GET'}={})=>{
  const u=new URL(url);assert.ok([game,bo].includes(u.origin));
  return new Promise((resolve,reject)=>{
    const req=httpRequest(`http://127.0.0.1:${port}${u.pathname}${u.search}`,{method,headers:{Host:u.host,Cookie:cookie,...(body?{'Content-Type':'application/json',...(!omitOrigin?{Origin:u.origin}:{})}:{}),...headers}},res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const h=new Headers();for(let i=0;i<res.rawHeaders.length;i+=2)h.append(res.rawHeaders[i],res.rawHeaders[i+1]);resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:h}));});
    });req.on('error',reject);
    req.end(body?JSON.stringify(body):undefined);
  });
};
const cookies=response=>response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
const location=response=>response.headers.get('location');
async function begin(next='/game/?dealer=astrid') {
  const start=await request(game+'/api/auth/bo/start?next='+encodeURIComponent(next));assert.equal(start.status,303);
  return {start,stateCookie:cookies(start),authorize:location(start)};
}
async function authorize(boCookie,next) {
  const flow=await begin(next),authorized=await request(flow.authorize,{cookie:boCookie});assert.equal(authorized.status,303);
  assert.equal(new URL(location(authorized)).origin,game);
  return {...flow,callback:location(authorized)};
}
const sign=claims=>{
  const secret=Buffer.from(craig.prepare("SELECT v FROM meta WHERE k='jwt_secret'").get().v,'hex');
  const message=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify(claims)).toString('base64url');
  return message+'.'+createHmac('sha256',secret).update(message).digest('base64url');
};
const administratorCookie=()=>{
  const account=craig.prepare('SELECT id,username,salt,hash,role FROM users WHERE id=1').get();
  const epoch=craig.prepare('SELECT epoch FROM bo_auth_epochs WHERE user_id=?').get(account.id)?.epoch??0;
  const source_stamp=createHash('sha256').update(`${account.salt}:${account.hash}`).digest('hex');
  return 'bo_jwt='+sign({sub:account.username,role:account.role,aud:'backoffice',source_stamp,auth_epoch:epoch,exp:Date.now()/1000+3600});
};
try {
  await mkdir(webDir,{recursive:true});await copyOpenClawRuntime(dir);
  for(const file of await readdir(web))if(file.endsWith('.mjs'))await copyFile(new URL(file,web),join(webDir,file));
  await symlink(new URL('public',web),join(webDir,'public'),process.platform==='win32'?'junction':'dir');await mkdir(join(dir,'data'));
  craig=new DatabaseSync(join(dir,'data/craig.db'));
  craig.exec('CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE NOT NULL,email TEXT,salt TEXT,hash TEXT,role TEXT NOT NULL,created_at TEXT NOT NULL)');
  craig.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?)').run(1,'demo-reviewer','demo@example.invalid','test-salt',scryptSync(password,'test-salt',64).toString('hex'),'admin',new Date().toISOString());
  server=spawn(process.execPath,[join(webDir,'server.mjs')],{cwd:webDir,env:{PATH:process.env.PATH,HOST:'127.0.0.1',PORT:String(port),PUBLIC_URL:game,BO_URL:bo,DEMO_GUEST_ACCESS:'0',CROUPIER_DATA_DIR:join(dir,'data')},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{let startupError='';const timer=setTimeout(()=>reject(Error('Server start timed out'+(startupError?': '+startupError:''))),10000);server.once('error',error=>{clearTimeout(timer);reject(error);});server.once('exit',code=>{clearTimeout(timer);reject(Error(`Server exited ${code}${startupError?': '+startupError:''}`));});server.stdout.on('data',chunk=>{if(String(chunk).includes('croupier demo on')){clearTimeout(timer);resolve();}});server.stderr.on('data',chunk=>{startupError||=String(chunk).match(/(?:Error(?: \[[A-Z_]+\])?|SyntaxError|TypeError|ReferenceError):[^\n]*/)?.[0]??'';});});
  db=new DatabaseSync(join(dir,'data/croupier.db'));
  const capability=await request(game+'/api/auth/session');assert.equal(capability.status,200);
  assert.equal(capability.headers.get('cache-control'),'no-store');
  assert.deepEqual(await capability.json(),{authenticated:false,guest:false,sharedCredentials:true},'installed login protocol is readable before authentication without granting a session');
  const denied=await request(game+'/api/auth/access',{headers:{'X-Forwarded-Uri':'/game/?dealer=astrid'}});assert.equal(denied.status,302);assert.match(location(denied),/^\/api\/auth\/bo\/start/);
  assert.equal((await request(game+'/api/auth/access',{headers:{'X-Forwarded-Uri':'/api/table','X-Forwarded-Method':'POST'}})).status,401);
  assert.equal((await request(game+'/api/table',{body:{op:'state'}})).status,401);
  const initial=await begin();
  const loggedOut=await request(initial.authorize);assert.equal(loggedOut.status,303);assert.match(location(loggedOut),/^\/admin\/login\?returnTo=%2Fapi%2Fbo%2Fgame-login%3Fstate%3D[a-f0-9]{64}$/);
  const aliasState='a'.repeat(64),token='b'.repeat(43);
  for(const [path,destination] of [['/bo','/control/administration'],['/bo/','/control/administration'],['/bo/index.html','/control/administration'],
    ['/bo/login.html','/admin/login'],[`/bo/login.html?returnTo=${encodeURIComponent(`/api/bo/game-login?state=${aliasState}`)}`,`/admin/login?returnTo=${encodeURIComponent(`/api/bo/game-login?state=${aliasState}`)}`],
    [`/bo/set-password.html?t=${token}`,`/admin/set-password?t=${token}`]]){
    const response=await request(bo+path);assert.equal(response.status,308,path);assert.equal(location(response),destination,path);
  }
  assert.equal(location(await request(bo+'/bo/login.html?returnTo=https://attacker.invalid')),'/admin/login');
  assert.equal(location(await request(bo+'/bo/set-password.html?t=private.bad')),'/admin/set-password');
  assert.equal((await request(bo+'/api/bo/config')).status,503,'legacy disk defaults cannot answer the public game projection');
  for(const [path,options] of [['/api/bo/me',{}],['/api/bo/players',{}],['/api/bo/login',{body:{user:'demo-reviewer',pass:password}}],
    ['/api/bo/users/remove',{body:{username:'demo-reviewer'}}]])assert.equal((await request(bo+path,options)).status,404,path);
  let boCookie=administratorCookie();
  const speechQa=await request(bo+'/bo/speech-qa.html',{cookie:boCookie});assert.equal(speechQa.status,200);assert.match(await speechQa.text(),/speech-qa\.mjs/);
  const protectedMedia=await request(bo+'/bo/speech-qa.mjs');assert.equal(protectedMedia.status,302);assert.equal(location(protectedMedia),'/admin/login');
  const boClaims=JSON.parse(Buffer.from(boCookie.split('.')[1],'base64url').toString());
  const launchCookie='bo_jwt='+sign({sub:'partner-player',partner:'partner-key',exp:boClaims.exp});
  assert.equal(location(await request((await begin()).authorize,{cookie:launchCookie})).startsWith('/admin/login'),true,'Partner launch JWT is not a BO session');
  for(const claims of [
    {...boClaims,aud:'partner'},
    {...boClaims,partner:'partner-key'},
    {...boClaims,source_stamp:'stale'},
    {...boClaims,role:'superadmin'},
  ])assert.equal(location(await request((await begin()).authorize,{cookie:'bo_jwt='+sign(claims)})).startsWith('/admin/login'),true,'wrong audience, partner, fingerprint or role is rejected');
  craig.prepare("UPDATE users SET role='superadmin' WHERE id=1").run();
  assert.match(location(await request((await begin()).authorize,{cookie:boCookie})),/^\/admin\/login/,'role change revokes old BO cookie');
  boCookie=administratorCookie();
  const continued=await request(initial.authorize,{cookie:boCookie});assert.equal(continued.status,303);
  const callback=location(continued);
  assert.equal((await request(callback)).status,400,'browser state required');
  const completed=await request(callback,{cookie:initial.stateCookie});assert.equal(completed.status,303);assert.equal(location(completed),'/game/?dealer=astrid');
  const playerCookie=cookies(completed).split('; bo_game_state=')[0];assert.match(playerCookie,/^player_session=/);assert.match(completed.headers.getSetCookie()[0],/SameSite=Lax/);assert.ok(!completed.headers.getSetCookie()[0].includes('Domain='));assert.ok(!playerCookie.includes('bo_jwt'));
  assert.equal((await request(callback,{cookie:initial.stateCookie})).status,400,'code single use');
  assert.equal((await request(game+'/api/auth/access',{cookie:playerCookie})).status,200);
  assert.deepEqual(await(await request(game+'/api/auth/session',{cookie:playerCookie})).json(),{authenticated:true,guest:false,sharedCredentials:true});
  assert.equal((await request(game+'/bo/speech-qa.html',{cookie:playerCookie})).status,302,'game session cannot grant BO roles');
  const player=await(await request(game+'/api/player',{cookie:playerCookie,body:{}})).json();
  let state=await(await request(game+'/api/table',{cookie:playerCookie,body:{op:'state'}})).json();
  const command=async(op,extra={})=>{const r=await request(game+'/api/table',{cookie:playerCookie,body:{op,version:state.version,requestId:randomUUID(),...extra}});assert.equal(r.status,200);state=await r.json();assert.ok(!state.error);};
  await command('start',{bets:Array.from({length:7},(_,i)=>({main:i===3?5:0,pp:0,tp:0}))});
  if(state.round.phase==='insurance')await command('insurance',{take:false});
  while(state.round.phase==='decisions')await command('act',{action:'stand'});
  assert.equal(state.round.phase,'settled');await command('collect');assert.equal(state.round,null);const finalBalance=state.balance;
  for(const next of ['/?dealer=amira','/game?dealer=astrid']) {
    const flow=await authorize(boCookie,next),r=await request(flow.callback,{cookie:flow.stateCookie});assert.equal(location(r),next);
    const p=await(await request(game+'/api/player',{cookie:cookies(r),body:{}})).json();assert.equal(p.id,player.id);assert.equal(p.balance,finalBalance);
  }
  const normal=await request(game+'/api/auth/login',{body:{email:'demo@example.invalid',password}});assert.equal(normal.status,200);
  assert.equal((await(await request(game+'/api/player',{cookie:cookies(normal),body:{}})).json()).id,player.id,'password and BO use same wallet');
  assert.equal(db.prepare('SELECT count(*) n FROM players').get().n,1);
  for(const bad of ['//evil.invalid/','https://evil.invalid/','/\\evil.invalid/','/api/bo/users','/v2/?dealer=amira']) {
    const flow=await authorize(boCookie,bad),r=await request(flow.callback,{cookie:flow.stateCookie});assert.equal(location(r),'/');
  }
  const expired=await authorize(boCookie);db.prepare('UPDATE bo_game_handoffs SET expires=0').run();assert.equal((await request(expired.callback,{cookie:expired.stateCookie})).status,400);
  const oldBoCookie='bo_jwt='+sign({sub:'demo-reviewer',role:'reader',exp:Date.now()/1000+300});
  assert.match(location(await request((await begin()).authorize,{cookie:oldBoCookie})),/^\/admin\/login/,'legacy cookie without BO audience must re-login');
  for(const claims of [{sub:'demo-reviewer',role:'reader',exp:1},{sub:'missing',role:'reader',exp:Date.now()/1000+60},{sub:'demo-reviewer',role:'reader',partner:'operator',exp:Date.now()/1000+60}]) {
    const flow=await begin(),r=await request(flow.authorize,{cookie:'bo_jwt='+sign(claims)});assert.match(location(r),/^\/admin\/login/);
  }
  const signatureAt=boCookie.lastIndexOf('.')+1;
  const wrongCookie=boCookie.slice(0,signatureAt)+(boCookie[signatureAt]==='a'?'b':'a')+boCookie.slice(signatureAt+1);
  assert.match(location(await request((await begin()).authorize,{cookie:wrongCookie})),/^\/admin\/login/);
  const pending=await authorize(boCookie);
  craig.prepare('UPDATE users SET hash=? WHERE id=1').run(scryptSync('Different-password','test-salt',64).toString('hex'));
  assert.equal((await request(pending.callback,{cookie:pending.stateCookie})).status,401,'password reset while handoff pending');
  assert.equal((await request(game+'/api/auth/access',{cookie:playerCookie,headers:{'X-Forwarded-Uri':'/api/table'}})).status,401);
  assert.match(location(await request((await begin()).authorize,{cookie:boCookie})),/^\/admin\/login/,'stamped BO cookie revoked on reset');
  craig.prepare('DELETE FROM users WHERE id=1').run();
  assert.match(location(await request((await begin()).authorize,{cookie:boCookie})),/^\/admin\/login/,'deleted account cannot authorize a handoff');
  const launch=sign({sub:player.id,partner:'isolated',exp:Date.now()/1000+60});
  assert.equal((await request(game+'/api/auth/access',{headers:{'X-Forwarded-Uri':'/v2/?dealer=astrid&launch='+launch}})).status,401,'retired V2 is no launch entry');
  for(const path of ['/','/game/']) {
    const observer='&labObserverOrigin=http%3A%2F%2F127.0.0.1%3A4192&labObserverChannel=isolated-comparison';
    const target=path+'?dealer=astrid&launch='+launch+observer;
    assert.equal((await request(game+'/api/auth/access',{headers:{'X-Forwarded-Uri':target}})).status,200);
    const r=await request(game+target);assert.equal(r.status,303);assert.equal(location(r),path+'?dealer=astrid'+observer);
    assert.equal((await request(game+'/api/auth/access',{cookie:cookies(r)})).status,200);
    await request(game+'/api/auth/logout',{cookie:cookies(r),body:{}});
    assert.equal((await request(game+'/api/auth/session',{cookie:cookies(r)})).status,200);
    assert.equal((await(await request(game+'/api/auth/session',{cookie:cookies(r)})).json()).authenticated,false);
  }
  console.log('BO/game auth passed: retired BO routes stay absent, native Studio aliases are bounded, BO audience and current identity/role guard one-use handoff, normal/game wallet continuity, complete demo round, password login, revocation, launch tokens and logout.');
} finally {
  if(server&&server.exitCode===null){const stopped=once(server,'exit');server.kill();await stopped;}
  db?.close();craig?.close();await rm(dir,{recursive:true,force:true});
}
