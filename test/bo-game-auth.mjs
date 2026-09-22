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
import {scryptSync,createHmac,randomUUID} from 'node:crypto';
const dir=await mkdtemp(join(tmpdir(),'bo-game-auth-')),web=new URL('../web/',import.meta.url);
const socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(r=>socket.close(r));
const game=`http://game.localhost:${port}`,bo=`http://bo.localhost:${port}`,password='Isolated-Auth-QA-Only';
let server,db,craig;
const request=async(url,{cookie='',body,headers={},method=body?'POST':'GET'}={})=>{
  const u=new URL(url);assert.ok([game,bo].includes(u.origin));
  return new Promise((resolve,reject)=>{
    const req=httpRequest(`http://127.0.0.1:${port}${u.pathname}${u.search}`,{method,headers:{Host:u.host,Cookie:cookie,...(body?{'Content-Type':'application/json',Origin:u.origin}:{}),...headers}},res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const h=new Headers();for(let i=0;i<res.rawHeaders.length;i+=2)h.append(res.rawHeaders[i],res.rawHeaders[i+1]);resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:h}));});
    });req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
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
  for(const file of await readdir(web))if(file.endsWith('.mjs'))await copyFile(new URL(file,web),join(dir,file));
  await symlink(new URL('public',web),join(dir,'public'),process.platform==='win32'?'junction':'dir');await mkdir(join(dir,'data'));
  craig=new DatabaseSync(join(dir,'data/craig.db'));
  craig.exec('CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE NOT NULL,email TEXT,salt TEXT,hash TEXT,role TEXT NOT NULL,created_at TEXT NOT NULL)');
  craig.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?)').run(1,'demo-reviewer','demo@example.invalid','test-salt',scryptSync(password,'test-salt',64).toString('hex'),'reader',new Date().toISOString());
  server=spawn(process.execPath,[join(dir,'server.mjs')],{cwd:dir,env:{PATH:process.env.PATH,HOST:'127.0.0.1',PORT:String(port),PUBLIC_URL:game,BO_URL:bo,DEMO_GUEST_ACCESS:'0'},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{let startupError='';const timer=setTimeout(()=>reject(Error('Server start timed out'+(startupError?': '+startupError:''))),10000);server.once('error',error=>{clearTimeout(timer);reject(error);});server.once('exit',code=>{clearTimeout(timer);reject(Error(`Server exited ${code}${startupError?': '+startupError:''}`));});server.stdout.on('data',chunk=>{if(String(chunk).includes('croupier demo on')){clearTimeout(timer);resolve();}});server.stderr.on('data',chunk=>{startupError||=String(chunk).match(/(?:Error(?: \[[A-Z_]+\])?|SyntaxError|TypeError|ReferenceError):[^\n]*/)?.[0]??'';});});
  db=new DatabaseSync(join(dir,'data/croupier.db'));
  const denied=await request(game+'/api/auth/access',{headers:{'X-Forwarded-Uri':'/v2/?dealer=astrid'}});assert.equal(denied.status,302);assert.match(location(denied),/^\/api\/auth\/bo\/start/);
  assert.equal((await request(game+'/api/auth/access',{headers:{'X-Forwarded-Uri':'/api/table','X-Forwarded-Method':'POST'}})).status,401);
  assert.equal((await request(game+'/api/table',{body:{op:'state'}})).status,401);
  const initial=await begin();
  const loggedOut=await request(initial.authorize);assert.equal(loggedOut.status,303);assert.match(location(loggedOut),/^\/bo\/login.html\?returnTo=/);
  const loginPage=await request(bo+location(loggedOut));assert.equal(loginPage.status,200);assert.match(await loginPage.text(),/game-login/);
  assert.equal((await request(bo+'/api/bo/login',{body:{user:'demo-reviewer',pass:password},headers:{Origin:'https://evil.invalid'}})).status,403);
  const login=await request(bo+'/api/bo/login',{body:{user:'demo-reviewer',pass:password}});assert.equal(login.status,200);const boCookie=cookies(login);
  const boShell=await request(bo+'/bo/',{cookie:boCookie});assert.equal(boShell.status,200);assert.match(await boShell.text(),/id="content"/);
  const boShort=await request(bo+'/bo',{cookie:boCookie});assert.equal(boShort.status,303);assert.equal(location(boShort),'/bo/');
  const continued=await request(initial.authorize,{cookie:boCookie});assert.equal(continued.status,303);
  const callback=location(continued);
  assert.equal((await request(callback)).status,400,'browser state required');
  const completed=await request(callback,{cookie:initial.stateCookie});assert.equal(completed.status,303);assert.equal(location(completed),'/v2/?dealer=astrid');
  const playerCookie=cookies(completed).split('; bo_game_state=')[0];assert.match(playerCookie,/^player_session=/);assert.match(completed.headers.getSetCookie()[0],/SameSite=Lax/);assert.ok(!completed.headers.getSetCookie()[0].includes('Domain='));assert.ok(!playerCookie.includes('bo_jwt'));
  assert.equal((await request(callback,{cookie:initial.stateCookie})).status,400,'code single use');
  assert.equal((await request(game+'/api/auth/access',{cookie:playerCookie})).status,200);
  assert.deepEqual(await(await request(game+'/api/auth/session',{cookie:playerCookie})).json(),{authenticated:true,guest:false});
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
  const legacy=await authorize(oldBoCookie);assert.equal((await request(legacy.callback,{cookie:legacy.stateCookie})).status,303,'existing BO sessions work without login');
  for(const claims of [{sub:'demo-reviewer',role:'reader',exp:1},{sub:'missing',role:'reader',exp:Date.now()/1000+60},{sub:'demo-reviewer',role:'reader',partner:'operator',exp:Date.now()/1000+60}]) {
    const flow=await begin(),r=await request(flow.authorize,{cookie:'bo_jwt='+sign(claims)});assert.match(location(r),/^\/bo\/login.html/);
  }
  const signatureAt=boCookie.lastIndexOf('.')+1;
  const wrongCookie=boCookie.slice(0,signatureAt)+(boCookie[signatureAt]==='a'?'b':'a')+boCookie.slice(signatureAt+1);
  assert.match(location(await request((await begin()).authorize,{cookie:wrongCookie})),/^\/bo\/login.html/);
  const pending=await authorize(boCookie);
  craig.prepare('UPDATE users SET hash=? WHERE id=1').run(scryptSync('Different-password','test-salt',64).toString('hex'));
  assert.equal((await request(pending.callback,{cookie:pending.stateCookie})).status,401,'password reset while handoff pending');
  assert.equal((await request(game+'/api/auth/access',{cookie:playerCookie,headers:{'X-Forwarded-Uri':'/api/table'}})).status,401);
  assert.match(location(await request((await begin()).authorize,{cookie:boCookie})),/^\/bo\/login.html/,'stamped BO cookie revoked on reset');
  craig.prepare('DELETE FROM users WHERE id=1').run();assert.match(location(await request((await begin()).authorize,{cookie:oldBoCookie})),/^\/bo\/login.html/);
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
  console.log('BO/game auth passed: existing BO login, browser-bound single-use exchange, normal/V2 wallet continuity, complete demo round, normal password login, bad/expired/reset/deleted sessions, origin checks, open redirects, role separation, root/V2 launch tokens and logout.');
} finally {
  if(server&&server.exitCode===null){const stopped=once(server,'exit');server.kill();await stopped;}
  db?.close();craig?.close();await rm(dir,{recursive:true,force:true});
}
