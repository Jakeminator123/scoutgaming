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
import {scryptSync,createHmac,randomUUID,randomBytes} from 'node:crypto';
import {copyOpenClawRuntime} from './fixtures/copy-openclaw-runtime.mjs';
const dir=await mkdtemp(join(tmpdir(),'bo-game-auth-')),web=new URL('../web/',import.meta.url);
const webDir=join(dir,'web');
const socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(r=>socket.close(r));
const game=`http://game.localhost:${port}`,bo=`http://bo.localhost:${port}`,password='Isolated-Auth-QA-Only';
let server,db,craig;
const request=async(url,{cookie='',body,headers={},omitOrigin=false,method=body?'POST':'GET',holdBody}={})=>{
  const u=new URL(url);assert.ok([game,bo].includes(u.origin));
  return new Promise((resolve,reject)=>{
    const req=httpRequest(`http://127.0.0.1:${port}${u.pathname}${u.search}`,{method,headers:{Host:u.host,Cookie:cookie,...(body?{'Content-Type':'application/json',...(!omitOrigin?{Origin:u.origin}:{})}:{}),...headers}},res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const h=new Headers();for(let i=0;i<res.rawHeaders.length;i+=2)h.append(res.rawHeaders[i],res.rawHeaders[i+1]);resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:h}));});
    });req.on('error',reject);
    if(holdBody){const raw=JSON.stringify(body);req.write(raw.slice(0,-1),()=>{Promise.resolve().then(holdBody).then(()=>req.end(raw.slice(-1)),error=>{req.destroy();reject(error);});});}
    else req.end(body?JSON.stringify(body):undefined);
  });
};
const cookies=response=>response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
const location=response=>response.headers.get('location');
async function begin(next='/v2/?dealer=astrid') {
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
try {
  await mkdir(webDir);await copyOpenClawRuntime(dir);
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
  const denied=await request(game+'/api/auth/access',{headers:{'X-Forwarded-Uri':'/v2/?dealer=astrid'}});assert.equal(denied.status,302);assert.match(location(denied),/^\/api\/auth\/bo\/start/);
  assert.equal((await request(game+'/api/auth/access',{headers:{'X-Forwarded-Uri':'/api/table','X-Forwarded-Method':'POST'}})).status,401);
  assert.equal((await request(game+'/api/table',{body:{op:'state'}})).status,401);
  const initial=await begin();
  const loggedOut=await request(initial.authorize);assert.equal(loggedOut.status,303);assert.match(location(loggedOut),/^\/bo\/login.html\?returnTo=/);
  const loginPage=await request(bo+location(loggedOut));assert.equal(loginPage.status,200);assert.match(await loginPage.text(),/game-login/);
  assert.equal((await request(bo+'/api/bo/login',{body:{user:'demo-reviewer',pass:password},headers:{Origin:'https://evil.invalid'}})).status,403);
  const login=await request(bo+'/api/bo/login',{body:{user:'demo-reviewer',pass:password}});assert.equal(login.status,200);let boCookie=cookies(login);
  const emailLogin=await request(bo+'/api/bo/login',{body:{user:'demo@example.invalid',pass:password}});
  assert.equal(emailLogin.status,200);
  assert.deepEqual(await(await request(bo+'/api/bo/me',{cookie:cookies(emailLogin)})).json(),{user:'demo-reviewer',role:'admin'},'email login uses canonical CRAIG identity');
  const boShell=await request(bo+'/bo/',{cookie:boCookie});assert.equal(boShell.status,200);assert.match(await boShell.text(),/id="content"/);
  const boShort=await request(bo+'/bo',{cookie:boCookie});assert.equal(boShort.status,303);assert.equal(location(boShort),'/bo/');
  const boClaims=JSON.parse(Buffer.from(boCookie.split('.')[1],'base64url').toString());
  const boPlayers=bo+'/api/bo/players';
  assert.equal((await request(boPlayers,{cookie:boCookie})).status,200,'current administrator can read BO data');
  const adminUsers=await request(bo+'/api/bo/users',{cookie:boCookie});assert.equal(adminUsers.status,200,'admin has the highest users administration access');
  assert.equal((await adminUsers.json()).users.find(row=>row.username==='demo-reviewer').role,'admin');
  const launchCookie='bo_jwt='+sign({sub:'partner-player',partner:'partner-key',exp:boClaims.exp});
  assert.equal((await request(boPlayers,{cookie:launchCookie})).status,401,'Partner launch JWT is not a BO session');
  assert.equal((await request(bo+'/api/bo/me',{cookie:launchCookie})).status,200);
  assert.deepEqual(await(await request(bo+'/api/bo/me',{cookie:launchCookie})).json(),{},'Partner token reveals no BO identity');
  for(const claims of [
    {...boClaims,aud:'partner'},
    {...boClaims,partner:'partner-key'},
    {...boClaims,source_stamp:'stale'},
    {...boClaims,role:'superadmin'},
  ])assert.equal((await request(boPlayers,{cookie:'bo_jwt='+sign(claims)})).status,401,'wrong audience, partner, fingerprint or role is rejected');
  craig.prepare("UPDATE users SET role='superadmin' WHERE id=1").run();
  assert.equal((await request(boPlayers,{cookie:boCookie})).status,401,'role change revokes old BO cookie');
  const adminLogin=await request(bo+'/api/bo/login',{body:{user:'demo-reviewer',pass:password}});
  assert.equal(adminLogin.status,200);const adminCookie=cookies(adminLogin);
  const room=bo+'/api/bo/room',roomUpdate={id:'darkhall',state:'live'};
  const roomState=async()=>((await(await request(bo+'/api/bo/config')).json()).rooms.find(entry=>entry.id==='darkhall').state);
  assert.equal(await roomState(),'preview');
  for(const options of [
    {headers:{Origin:game}},
    {headers:{Origin:'https://'+new URL(bo).host}},
    {headers:{Origin:bo+'/bo/'}},
    {headers:{Origin:'null'}},
    {omitOrigin:true},
    {headers:{'Sec-Fetch-Site':'same-site'}},
    {headers:{'Sec-Fetch-Site':'cross-site'}},
  ])assert.equal((await request(room,{cookie:adminCookie,body:roomUpdate,...options})).status,403,'BO mutation requires exact same origin');
  assert.equal(await roomState(),'preview','blocked requests did not change BO config');
  assert.equal((await request(room,{cookie:adminCookie,body:roomUpdate,headers:{'Sec-Fetch-Site':'same-origin'}})).status,200);
  assert.equal(await roomState(),'live','same-origin BO mutation still works');
  assert.equal((await request(bo+'/api/bo/reset-request',{body:{user:'missing'},headers:{Origin:game}})).status,403,'public reset endpoint also rejects sibling origin');
  craig.prepare("UPDATE users SET role='reader' WHERE id=1").run();
  assert.equal((await request(boPlayers,{cookie:boCookie})).status,401,'old BO cookie cannot revive when role is restored');
  assert.equal((await request(bo+'/api/bo/login',{body:{user:'demo-reviewer',pass:password}})).status,401,'legacy reader cannot log into Backoffice');
  craig.prepare("UPDATE users SET role='admin' WHERE id=1").run();
  const renewedAdministrator=await request(bo+'/api/bo/login',{body:{user:'demo-reviewer',pass:password}});
  assert.equal(renewedAdministrator.status,200);boCookie=cookies(renewedAdministrator);
  const continued=await request(initial.authorize,{cookie:boCookie});assert.equal(continued.status,303);
  const callback=location(continued);
  assert.equal((await request(callback)).status,400,'browser state required');
  const completed=await request(callback,{cookie:initial.stateCookie});assert.equal(completed.status,303);assert.equal(location(completed),'/v2/?dealer=astrid');
  const playerCookie=cookies(completed).split('; bo_game_state=')[0];assert.match(playerCookie,/^player_session=/);assert.match(completed.headers.getSetCookie()[0],/SameSite=Lax/);assert.ok(!completed.headers.getSetCookie()[0].includes('Domain='));assert.ok(!playerCookie.includes('bo_jwt'));
  assert.equal((await request(callback,{cookie:initial.stateCookie})).status,400,'code single use');
  assert.equal((await request(game+'/api/auth/access',{cookie:playerCookie})).status,200);
  assert.deepEqual(await(await request(game+'/api/auth/session',{cookie:playerCookie})).json(),{authenticated:true,guest:false,sharedCredentials:true});
  assert.equal((await request(game+'/api/bo/users',{cookie:playerCookie})).status,401,'game session cannot grant BO roles');
  const player=await(await request(game+'/api/player',{cookie:playerCookie,body:{}})).json();
  let state=await(await request(game+'/api/table',{cookie:playerCookie,body:{op:'state'}})).json();
  const command=async(op,extra={})=>{const r=await request(game+'/api/table',{cookie:playerCookie,body:{op,version:state.version,requestId:randomUUID(),...extra}});assert.equal(r.status,200);state=await r.json();assert.ok(!state.error);};
  await command('start',{bets:Array.from({length:7},(_,i)=>({main:i===3?5:0,pp:0,tp:0}))});
  if(state.round.phase==='insurance')await command('insurance',{take:false});
  while(state.round.phase==='decisions')await command('act',{action:'stand'});
  assert.equal(state.round.phase,'settled');await command('collect');assert.equal(state.round,null);const finalBalance=state.balance;
  for(const next of ['/?dealer=amira','/v2/?dealer=amira']) {
    const flow=await authorize(boCookie,next),r=await request(flow.callback,{cookie:flow.stateCookie});assert.equal(location(r),next);
    const p=await(await request(game+'/api/player',{cookie:cookies(r),body:{}})).json();assert.equal(p.id,player.id);assert.equal(p.balance,finalBalance);
  }
  const normal=await request(game+'/api/auth/login',{body:{email:'demo@example.invalid',password}});assert.equal(normal.status,200);
  assert.equal((await(await request(game+'/api/player',{cookie:cookies(normal),body:{}})).json()).id,player.id,'password and BO use same wallet');
  assert.equal(db.prepare('SELECT count(*) n FROM players').get().n,1);
  for(const bad of ['//evil.invalid/','https://evil.invalid/','/\\evil.invalid/','/api/bo/users']) {
    const flow=await authorize(boCookie,bad),r=await request(flow.callback,{cookie:flow.stateCookie});assert.equal(location(r),'/');
  }
  const expired=await authorize(boCookie);db.prepare('UPDATE bo_game_handoffs SET expires=0').run();assert.equal((await request(expired.callback,{cookie:expired.stateCookie})).status,400);
  const oldBoCookie='bo_jwt='+sign({sub:'demo-reviewer',role:'reader',exp:Date.now()/1000+300});
  assert.match(location(await request((await begin()).authorize,{cookie:oldBoCookie})),/^\/bo\/login.html/,'legacy cookie without BO audience must re-login');
  for(const claims of [{sub:'demo-reviewer',role:'reader',exp:1},{sub:'missing',role:'reader',exp:Date.now()/1000+60},{sub:'demo-reviewer',role:'reader',partner:'operator',exp:Date.now()/1000+60}]) {
    const flow=await begin(),r=await request(flow.authorize,{cookie:'bo_jwt='+sign(claims)});assert.match(location(r),/^\/bo\/login.html/);
  }
  const signatureAt=boCookie.lastIndexOf('.')+1;
  const wrongCookie=boCookie.slice(0,signatureAt)+(boCookie[signatureAt]==='a'?'b':'a')+boCookie.slice(signatureAt+1);
  assert.match(location(await request((await begin()).authorize,{cookie:wrongCookie})),/^\/bo\/login.html/);
  const pending=await authorize(boCookie);
  craig.prepare('UPDATE users SET hash=? WHERE id=1').run(scryptSync('Different-password','test-salt',64).toString('hex'));
  assert.equal((await request(boPlayers,{cookie:boCookie})).status,401,'password change revokes BO data access');
  assert.equal((await request(pending.callback,{cookie:pending.stateCookie})).status,401,'password reset while handoff pending');
  assert.equal((await request(game+'/api/auth/access',{cookie:playerCookie,headers:{'X-Forwarded-Uri':'/api/table'}})).status,401);
  assert.match(location(await request((await begin()).authorize,{cookie:boCookie})),/^\/bo\/login.html/,'stamped BO cookie revoked on reset');
  craig.prepare('DELETE FROM users WHERE id=1').run();
  assert.equal((await request(boPlayers,{cookie:boCookie})).status,401,'deleted account cannot read BO data');
  assert.match(location(await request((await begin()).authorize,{cookie:oldBoCookie})),/^\/bo\/login.html/);
  const launch=sign({sub:player.id,partner:'isolated',exp:Date.now()/1000+60});
  for(const path of ['/','/v2/']) {
    const observer='&labObserverOrigin=http%3A%2F%2F127.0.0.1%3A4192&labObserverChannel=isolated-comparison';
    const target=path+'?dealer=astrid&launch='+launch+observer;
    assert.equal((await request(game+'/api/auth/access',{headers:{'X-Forwarded-Uri':target}})).status,200);
    const r=await request(game+target);assert.equal(r.status,303);assert.equal(location(r),path+'?dealer=astrid'+observer);
    assert.equal((await request(game+'/api/auth/access',{cookie:cookies(r)})).status,200);
    await request(game+'/api/auth/logout',{cookie:cookies(r),body:{}});
    assert.equal((await request(game+'/api/auth/session',{cookie:cookies(r)})).status,200);
    assert.equal((await(await request(game+'/api/auth/session',{cookie:cookies(r)})).json()).authenticated,false);
  }
  // Only disposable users in this fixture: exercise final authorization after
  // a streamed body and simultaneous administrators changing one another.
  const fixtureAdmin=async username=>{
    const secret=randomBytes(24).toString('base64url'),salt=randomBytes(16).toString('hex');
    craig.prepare('INSERT INTO users(username,email,salt,hash,role,created_at) VALUES(?,?,?,?,?,?)')
      .run(username,`${username}@example.invalid`,salt,scryptSync(secret,salt,64).toString('hex'),'admin',new Date().toISOString());
    const login=await request(bo+'/api/bo/login',{body:{user:username,pass:secret}});assert.equal(login.status,200);
    return{username,cookie:cookies(login)};
  };
  const primary=await fixtureAdmin('legacy-primary'),secondary=await fixtureAdmin('legacy-secondary'),third=await fixtureAdmin('legacy-third');
  const delayed=request(bo+'/api/bo/users/remove',{cookie:secondary.cookie,body:{username:primary.username},holdBody:async()=>{
    await new Promise(resolve=>setTimeout(resolve,50));
    assert.equal((await request(bo+'/api/bo/users/role',{cookie:primary.cookie,body:{username:secondary.username,role:'reader'}})).status,200);
  }});
  assert.equal((await delayed).status,403,'actor demoted after headers cannot use its captured authorization when the body completes');
  assert.ok(craig.prepare('SELECT id FROM users WHERE username=?').get(primary.username));
  assert.equal((await request(bo+'/api/bo/users/remove',{cookie:secondary.cookie,body:{username:third.username}})).status,401,'old actor session cannot perform the next change');
  assert.equal((await request(bo+'/api/bo/users/remove',{cookie:primary.cookie,body:{username:third.username}})).status,200,'admin can remove another administrator');
  assert.equal((await request(boPlayers,{cookie:third.cookie})).status,401,'removed administrator session is revoked');
  for(const [username,email,hash,role] of [['unknown-role','unknown-role@example.invalid',null,'unknown'],['bad-email','invalid-email',null,'admin'],['bad-hash','bad-hash@example.invalid','invalid-hash','admin']]){
    craig.prepare('INSERT INTO users(username,email,salt,hash,role,created_at) VALUES(?,?,?,?,?,?)').run(username,email,'fixture-salt',hash,role,new Date().toISOString());
    assert.equal((await request(bo+'/api/bo/users/remove',{cookie:primary.cookie,body:{username}})).status,409,'unknown credential metadata fails closed');
  }
  assert.equal((await request(bo+'/api/bo/users/role',{cookie:primary.cookie,body:{username:secondary.username,role:'unknown'}})).status,400);
  assert.equal((await request(bo+'/api/bo/users/remove',{cookie:primary.cookie,body:{username:primary.username+'@example.invalid'}})).status,403,'self is the stored identity even when addressed through its email');
  for(const action of ['role','remove']){
    craig.exec('DELETE FROM users');
    const a=await fixtureAdmin('concurrent-alpha'),b=await fixtureAdmin('concurrent-beta');
    const mutate=(actor,target)=>request(bo+'/api/bo/users/'+action,{cookie:actor.cookie,body:{username:target.username,...(action==='role'?{role:'reader'}:{})}});
    const results=await Promise.all([mutate(a,b),mutate(b,a)]);
    assert.equal(results.filter(row=>row.status===200).length,1);assert.equal(results.filter(row=>[401,403].includes(row.status)).length,1,'concurrent cross changes cannot retain a revoked actor');
    assert.equal(craig.prepare("SELECT count(*) n FROM users WHERE role IN ('admin','superadmin') AND hash IS NOT NULL").get().n,1,'one active administrator survives');
    const survivor=craig.prepare("SELECT username FROM users WHERE role='admin'").get(),actor=survivor.username===a.username?a:b;
    assert.equal((await mutate(actor,actor)).status,403,'last active administrator cannot remove or demote itself');
  }
  console.log('BO/game auth passed: BO audience and current identity/role, rejected Partner JWT as BO cookie, exact-origin BO POSTs, browser-bound single-use exchange, normal/V2 wallet continuity, complete demo round, normal password login, bad/expired/reset/deleted sessions, open redirects, role separation, root/V2 launch tokens and logout.');
} finally {
  if(server&&server.exitCode===null){const stopped=once(server,'exit');server.kill();await stopped;}
  db?.close();craig?.close();await rm(dir,{recursive:true,force:true});
}
