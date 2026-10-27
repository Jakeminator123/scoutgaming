import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {backofficeGameAuth as asyncFactory} from '../services/game/storage/async-bo-game-auth.mjs';
import {playerAuth} from '../services/game/storage/async-player-auth.mjs';
const game='https://game.example.invalid',bo='https://bo.example.invalid';
const stampA='a'.repeat(64),stampB='b'.repeat(64);
// Postgres-shaped handoff, player, session and link rows. Only the statements the
// async BO handoff and player auth issue are answered; row locks require a
// transaction, and a failed transaction restores every table.
function handoffDb() {
  let tables={bo_game_handoffs:[],players:[],player_sessions:[],craig_player_links:[]},inTransaction=false;
  const duplicate=()=>{throw Object.assign(Error('duplicate key value'),{code:'23505'});};
  const remove=(name,keep)=>{const before=tables[name].length;const removed=tables[name].filter(row=>!keep(row));tables[name]=tables[name].filter(keep);return {changes:before-tables[name].length,removed};};
  const statements={
    'DELETE FROM bo_game_handoffs WHERE expires<=?':now=>remove('bo_game_handoffs',row=>!(row.expires<=now)),
    'INSERT INTO bo_game_handoffs (state_digest,next_path,expires) VALUES (?,?,?)':(state_digest,next_path,expires)=>{
      if(tables.bo_game_handoffs.some(row=>row.state_digest===state_digest))duplicate();
      tables.bo_game_handoffs.push({state_digest,next_path,expires,code_digest:null,craig_user_id:null,username:null,source_stamp:null,session_until:null});return {changes:1};},
    'SELECT * FROM bo_game_handoffs WHERE state_digest=? AND expires>? AND code_digest IS NULL':(state,now)=>tables.bo_game_handoffs.filter(row=>row.state_digest===state&&row.expires>now&&row.code_digest===null),
    'UPDATE bo_game_handoffs SET code_digest=?,craig_user_id=?,username=?,source_stamp=?,session_until=?,expires=? WHERE state_digest=?':(code_digest,craig_user_id,username,source_stamp,session_until,expires,state)=>{
      if(tables.bo_game_handoffs.some(row=>row.code_digest===code_digest&&row.state_digest!==state))duplicate();
      const hit=tables.bo_game_handoffs.filter(row=>row.state_digest===state);
      for(const row of hit)Object.assign(row,{code_digest,craig_user_id,username,source_stamp,session_until,expires});return {changes:hit.length};},
    'DELETE FROM bo_game_handoffs WHERE state_digest=? AND code_digest=? AND expires>? RETURNING *':(state,code,now)=>remove('bo_game_handoffs',row=>!(row.state_digest===state&&row.code_digest===code&&row.expires>now)).removed,
    'SELECT player_id,source_stamp,display_name,expires FROM player_sessions WHERE digest=? AND expires>?':(digest,now)=>tables.player_sessions
      .filter(row=>row.digest===digest&&row.expires>now).map(({player_id,source_stamp,display_name,expires})=>({player_id,source_stamp,display_name,expires})),
    'SELECT status FROM players WHERE id=?':id=>tables.players.filter(row=>row.id===id).map(({status})=>({status})),
    'SELECT status FROM players WHERE id=? FOR UPDATE':id=>{assert.equal(inTransaction,true,'player row locks are taken inside a transaction');
      return tables.players.filter(row=>row.id===id).map(({status})=>({status}));},
    'SELECT craig_user_id FROM craig_player_links WHERE player_id=?':id=>tables.craig_player_links.filter(row=>row.player_id===id).map(({craig_user_id})=>({craig_user_id})),
    'SELECT player_id FROM craig_player_links WHERE craig_user_id=?':id=>tables.craig_player_links.filter(row=>row.craig_user_id===id).map(({player_id})=>({player_id})),
    'INSERT INTO craig_player_links VALUES (?,?)':(craig_user_id,player_id)=>{
      if(tables.craig_player_links.some(row=>row.craig_user_id===craig_user_id||row.player_id===player_id))duplicate();
      tables.craig_player_links.push({craig_user_id,player_id});return {changes:1};},
    'DELETE FROM player_sessions WHERE expires<=?':now=>remove('player_sessions',row=>!(row.expires<=now)),
    'INSERT INTO player_sessions (digest,player_id,expires,source_stamp,display_name) VALUES (?,?,?,?,?)':(digest,player_id,expires,source_stamp,display_name)=>{
      if(tables.player_sessions.some(row=>row.digest===digest))duplicate();
      tables.player_sessions.push({digest,player_id,expires,source_stamp,display_name});return {changes:1};},
  };
  return {
    get tables(){return tables;},
    prepare(sql){const answer=statements[sql];if(!answer)throw Error('unexpected SQL: '+sql);
      return {get:async(...args)=>structuredClone([answer(...args)].flat()[0]),all:async(...args)=>structuredClone(answer(...args)),run:async(...args)=>{const {changes}=answer(...args);return {changes};}};},
    async transaction(work){assert.equal(inTransaction,false,'transactions are not nested');const snapshot=structuredClone(tables);inTransaction=true;
      try{return await work();}catch(error){tables=snapshot;throw error;}finally{inTransaction=false;}},
  };
}
test('PostgreSQL contract BO handoff canonicalizes next/callback without passing launch or foreign redirect data',async () => {
  const db = handoffDb();
  const auth = {user:async ()=>null,fromBackoffice:async ()=> 'player_session=preserved; Path=/'};
  const handle = asyncFactory({db,auth,identity:{find:async ()=>({id:'account',name:'Operator',stamp:stampA})},boSession:async ()=>({sub:'Operator',role:'admin',source_stamp:stampA,auth_epoch:0,exp:Math.floor(Date.now()/1000)+3600}),
    validLaunch:async token=>token==='a.b.c',publicUrl:game,boUrl:bo,publicGamePath:'/blackjack'});
  async function request(address,cookie) {const url=new URL(address,game),req={url:url.pathname+url.search,method:'GET',headers:{host:url.host,...(cookie?{cookie}:{})},socket:{encrypted:true}};
    const res={writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;}};await handle(req,res);return res;}
  const begin = await request('/api/auth/bo/start?next='+encodeURIComponent('/game?game=blackjack&dealer=linnea&presentation=local&launch=a.b.c&returnTo=https://evil.invalid#bad'));
  assert.equal(begin.status,303);const state = new URL(begin.headers.Location).searchParams.get('state');
  assert.equal(db.tables.bo_game_handoffs[0].next_path,'/game?game=blackjack&dealer=linnea&presentation=local');
  const login = await request(begin.headers.Location);assert.equal(login.status,303);
  const callback = await request(login.headers.Location,`bo_game_state=${state}`);
  assert.equal(callback.status,303);assert.equal(callback.headers.Location,'/game?game=blackjack&dealer=linnea&presentation=local');
  // The engine still names its own /blackjack entry; the handoff keeps it as the one game start.
  assert.equal((await request('/api/auth/bo/start?next='+encodeURIComponent('/blackjack?dealer=linnea&launch=a.b.c'))).status,303);
  assert.equal(db.tables.bo_game_handoffs[0].next_path,'/blackjack?dealer=linnea');
  db.tables.bo_game_handoffs.length=0;
  assert.ok(callback.headers['Set-Cookie'].includes('player_session=preserved; Path=/'));
  assert.equal((await request('/api/auth/bo/start?next='+encodeURIComponent('//evil.invalid/game'))).status,303);
  assert.equal(db.tables.bo_game_handoffs[0].next_path,'/game');
  // The return names its game; an unknown or repeated game is no game and opens the plain game start.
  for (const [next,expected] of [['/?game=roulette&table=r-1&operator=north&launch=a.b.c','/game?game=roulette&table=r-1&operator=north'],
    ['/game/?game=poker&dealer=linnea','/game'],['/game/?game=roulette&game=blackjack&dealer=linnea','/game']]) {
    db.tables.bo_game_handoffs.length=0;assert.equal((await request('/api/auth/bo/start?next='+encodeURIComponent(next))).status,303);
    assert.equal(db.tables.bo_game_handoffs[0].next_path,expected,next);
  }
});


test('PostgreSQL contract N1 handoff replaces a foreign player, reuses its own wallet and consumes its browser-bound code once',async()=>{
  const db=handoffDb();
  const accounts=[{id:'A',name:'AdminA',stamp:stampA,authEpoch:0},{id:'B',name:'AdminB',stamp:stampB,authEpoch:0}];
  const identity={candidates:()=>[],authenticate:()=>null,find:name=>accounts.find(a=>a.name===name),stamp:id=>accounts.find(a=>a.id===id)?.stamp};
  let created=0;
  const balance=id=>db.tables.players.find(row=>row.id===id).balance;
  const auth=playerAuth(db,()=>{const id='player-'+(++created);assert.equal(db.tables.players.some(row=>row.id===id),false);db.tables.players.push({id,status:'active',balance:100});return {id};},identity,{authEpoch:()=>0});
  const origin='https://www.fixture.invalid';
  const request=(path,cookie='')=>({url:path,method:'GET',headers:{host:'www.fixture.invalid',cookie},socket:{encrypted:true}});
  const foreign=(await auth.fromBackoffice(request('/'),accounts[1])).split(';')[0];
  for(const row of db.tables.players)row.balance=17;
  const handle=asyncFactory({db,auth,identity,boSession:async req=>{const id=req.headers.cookie.includes('bo_jwt=valid-A')?'A':req.headers.cookie.includes('bo_jwt=valid-B')?'B':null;return id?{sub:'Admin'+id,aud:'backoffice',role:'admin',source_stamp:id==='A'?stampA:stampB,auth_epoch:0,exp:Math.floor(Date.now()/1000)+3600}:null;},validLaunch:()=>false,publicUrl:origin,boUrl:origin,publicGamePath:'/blackjack'});
  async function run(path,cookie=''){const url=new URL(path,origin);const res={writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;}};await handle(request(url.pathname+url.search,cookie),res);return res;}
  const begin=await run('/api/auth/bo/start?next='+encodeURIComponent('/play/profil'),'bo_jwt=valid-A; '+foreign);
  assert.equal(begin.status,303);assert.match(begin.headers.Location,/\/api\/bo\/game-login\?state=/);
  const state=new URL(begin.headers.Location).searchParams.get('state');
  const authorize=await run(begin.headers.Location,'bo_jwt=valid-A');
  assert.equal((await run(authorize.headers.Location)).status,400,'code cannot switch a different browser');
  const complete=await run(authorize.headers.Location,'bo_jwt=valid-A; bo_game_state='+state+'; '+foreign);
  assert.equal(complete.status,303);assert.equal(complete.headers.Location,'/play/profil');
  const playerCookie=complete.headers['Set-Cookie'].find(c=>c.startsWith('player_session=')).split(';')[0];
  const playerId=await auth.user(request('/',playerCookie));
  assert.equal(playerId,db.tables.craig_player_links.find(row=>row.craig_user_id==='A').player_id);
  assert.equal(balance(playerId),100);
  assert.equal(balance(await auth.user(request('/',foreign))),17);
  assert.equal((await run(authorize.headers.Location,'bo_game_state='+state)).status,400,'one-use callback rejects replay');
  const same=await run('/api/auth/bo/start?next='+encodeURIComponent('/play/historik'),'bo_jwt=valid-A; '+playerCookie);
  assert.equal(same.headers.Location,'/play/historik');assert.equal(created,2);
  assert.equal(db.tables.bo_game_handoffs.length,0);
  const pending=await run('/api/auth/bo/start?next=/play/profil','bo_jwt=valid-A');
  const pendingState=new URL(pending.headers.Location).searchParams.get('state'),issued=await run(pending.headers.Location,'bo_jwt=valid-A');
  assert.equal((await run(issued.headers.Location,'bo_game_state='+pendingState)).status,401,'shared-origin callback cannot restore a session after N3 logout cleared BO');
  const switched=await run('/api/auth/bo/start?next=/play/profil','bo_jwt=valid-A');
  const switchedState=new URL(switched.headers.Location).searchParams.get('state'),switchedCode=await run(switched.headers.Location,'bo_jwt=valid-A');
  assert.equal((await run(switchedCode.headers.Location,'bo_jwt=valid-B; bo_game_state='+switchedState)).status,401,'a later N1 login cannot complete another account handoff');
});


test('automatic N1 handoff requires one verified current admin on the exact shared origin',async()=>{
  const {backofficePlayerHandoffRequired:required}=await import('../services/game/bo-player-session.mjs');
  const origin='https://www.fixture.invalid',account={id:'A',name:'Admin',stamp:stampA};
  const claims={sub:'Admin',role:'admin',aud:'backoffice',source_stamp:stampA,auth_epoch:0,exp:Date.now()/1000+3600};
  const request={headers:{host:'www.fixture.invalid',cookie:'bo_jwt=verified'}};
  let reads=0;
  const settings={db:{prepare(){reads++;return {get:async()=>({player_id:'own'})};}},identity:{find:async()=>account},boSession:async()=>claims,publicUrl:origin,boUrl:origin,playerId:null};
  assert.equal(await required(request,settings),true);assert.equal(reads,0,'no account creation or wallet read');
  assert.equal(await required(request,{...settings,playerId:'own'}),false);
  assert.equal(await required(request,{...settings,playerId:'foreign'}),true);
  for(const extra of [{partner:'operator'},{role:'reader'},{role:'staff'},{aud:'player'},{source_stamp:'old'},{auth_epoch:undefined},{auth_epoch:-1},{auth_epoch:0.5},{exp:0},{exp:Infinity}])
    assert.equal(await required(request,{...settings,boSession:async()=>({...claims,...extra})}),false);
  assert.equal(await required(request,{...settings,boSession:async()=>null}),false);
  assert.equal(await required(request,{...settings,identity:{find:async()=>null}}),false);
  for(const cookie of ['', 'bo_jwt=first; bo_jwt=second']) assert.equal(await required({headers:{...request.headers,cookie}},settings),false);
  assert.equal(await required({headers:{...request.headers,host:'attacker.invalid'}},settings),false);
  assert.equal(await required(request,{...settings,boUrl:'https://separate-bo.invalid'}),false,'separate-host installations keep explicit handoff');
});

test('player handoff only retains current document returns and approved game selectors',async()=>{
  const {playerHandoffPath:path,playerHandoffDestination:destination}=await import('../packages/navigation/player-handoff.mjs');
  for(const target of ['/play','/play/profil','/play/historik','/play?operator=swedish-games','/game?game=roulette&table=room-evening','/game?table=room-evening','/play/roulette?table=room-evening','/play/blackjack?table=room-evening']) {
    assert.equal(path(target),target);assert.equal(destination(target),'/api/auth/bo/start?next='+encodeURIComponent(target));
  }
  for(const target of ['https://attacker.invalid/play/profil','//attacker.invalid/play/profil','/play\\profil','/play/%70rofil','/other/../play/profil','/api/auth/bo/start','/admin/login','/player-login','/play/profil?returnTo=/admin','/play/profil#secret','/play?operator=a&operator=b','/play\n/profil','/v2?dealer=astrid','/game/extra','/casino.html','/demo']) assert.equal(path(target),null,target);
  assert.equal(path('/play/blackjack?launch=a.b.c&returnTo=https://attacker.invalid&table=room-evening'),'/play/blackjack?table=room-evening');
  assert.equal(path('/game?game=poker&launch=a.b.c&returnTo=https://attacker.invalid&table=room-evening'),'/game?table=room-evening');
  const observed='/play/blackjack?labObserverOrigin='+encodeURIComponent('https://www.fixture.invalid')+'&labObserverChannel=12345678-1234-1234-1234-123456789abc';
  assert.equal(path(observed,{origin:'https://www.fixture.invalid'}),observed);
});


test('fresh native N1 login reaches its own profile through the actual isolated engine and logs out coherently',async()=>{
  const {mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join,resolve}=await import('node:path');
  const {spawn}=await import('node:child_process'),{once}=await import('node:events'),{createServer}=await import('node:net'),{request:httpRequest}=await import('node:http');
  const {fileURLToPath}=await import('node:url');
  const {createStudioNativeAuthActions}=await import('../apps/studio/lib/studio-native-auth-actions.mjs');
  const {createStudioNativeAuth}=await import('../packages/studio-access/studio-native-auth.mjs');
  const {playerAreaPage}=await import('../apps/web/lib/player-area.mjs');
  const directory=await mkdtemp(join(tmpdir(),'n1-session-'));
  const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(done=>listener.close(done));
  const origin='https://www.fixture.invalid',password='Isolated-N1-Player-Test-Password';let child,users,players;
  const request=(path,{method='GET',cookie='',body,originHeader=origin}={})=>new Promise((resolve,reject)=>{
    const url=new URL(path,origin);
    const req=httpRequest({hostname:'127.0.0.1',port,path:url.pathname+url.search,method,headers:{host:new URL(origin).host,cookie,origin:originHeader,'content-type':'application/json'}},res=>{
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{const headers=new Headers();for(let i=0;i<res.rawHeaders.length;i+=2)headers.append(res.rawHeaders[i],res.rawHeaders[i+1]);resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers}));});
    });req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));
  });
  try {
    const env=Object.fromEntries(['PATH','Path','SystemRoot','SYSTEMROOT','TEMP','TMP'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
    Object.assign(env,{HOST:'127.0.0.1',PORT:String(port),NODE_ENV:'production',CROUPIER_DATA_DIR:directory,CROUPIER_CLOUD_RUNTIME:'1',CROUPIER_PLAYER_ACCOUNTS:'1',
      CROUPIER_CLOUD_BOOTSTRAP_ADMIN_USER:'fixtureadmin',CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD:password,
      DEMO_GUEST_ACCESS:'1',CROUPIER_GENERATED_SPEECH:'',CROUPIER_GENERATED_SPEECH_STREAMING:'',CROUPIER_ASTRID_CAMERA:'',PUBLIC_URL:origin,BO_URL:origin});
    child=spawn(process.execPath,['--import',new URL('./fixtures/generated-speech-stream-fetch.mjs',import.meta.url).href,fileURLToPath(new URL('../services/game/server.mjs',import.meta.url))],
      {cwd:fileURLToPath(new URL('../services/game/',import.meta.url)),env,windowsHide:true,stdio:['ignore','pipe','pipe']});
    child.stderr.on('data',()=>{});
    await new Promise((done,reject)=>{const timer=setTimeout(()=>reject(Error('Isolated N1 fixture timeout')),10000);child.once('error',()=>{clearTimeout(timer);reject(Error('Isolated N1 fixture failed'));});child.once('exit',()=>{clearTimeout(timer);reject(Error('Isolated N1 fixture exited'));});child.stdout.on('data',chunk=>{if(String(chunk).includes('croupier demo on')){clearTimeout(timer);done();}});});
    users=new DatabaseSync(join(directory,'craig.db'));players=new DatabaseSync(join(directory,'croupier.db'));
    // Native Studio schema; the standalone SQLite engine does not mount Lab.
    users.exec('CREATE TABLE IF NOT EXISTS lab_sessions(craig_user_id TEXT); CREATE TABLE IF NOT EXISTS bo_lab_handoffs(craig_user_id TEXT)');
    const adapter=sqlite=>({prepare:sql=>sqlite.prepare(sql.replace(/\s+FOR UPDATE\b/g,'')),async transaction(work){sqlite.exec('BEGIN IMMEDIATE');try{const result=await work();sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}});
    const boDb=adapter(users),gameDb=adapter(players),scope={environment:'fixture',workspaceId:'croupier'};
    const authorize=createStudioNativeAuth({boDb,scope});
    const actions=createStudioNativeAuthActions({boDb,gameDb,scope,authorize,publicOrigin:origin,rateLimit:async()=>true,clientAddress:()=> 'fixture'});
    const native=async(action,body,cookie='')=>actions.handle(new Request(origin+'/studio/api/auth/'+action,{method:'POST',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json',cookie},body:JSON.stringify(body)}));
    const other=await request('/api/auth/player/register',{method:'POST',body:{username:'other-player',password}});assert.equal(other.status,200);
    const foreign=other.headers.getSetCookie().find(value=>value.startsWith('player_session=')).split(';')[0];
    const foreignPlayer=await (await request('/api/player',{method:'POST',cookie:foreign,body:{}})).json();
    const loggedIn=await native('login',{user:'fixtureadmin',pass:password},foreign);assert.equal(loggedIn.status,200);
    const boCookie=loggedIn.headers.getSetCookie().find(value=>value.startsWith('bo_jwt=')).split(';')[0];
    assert.match(loggedIn.headers.getSetCookie().find(value=>value.startsWith('player_session=')),/Max-Age=0/);
    const playersBeforeHandoff=players.prepare('SELECT count(*) n FROM players').get().n;
    const freshSession=await(await request('/api/auth/session',{cookie:boCookie})).json();
    assert.equal(freshSession.backofficeHandoff,true,'fresh N1 alone advertises verified handoff');assert.equal(freshSession.guest,false);
    assert.equal(players.prepare('SELECT count(*) n FROM players').get().n,playersBeforeHandoff,'session decision does not create a disposable guest wallet');
    for(const entry of ['/blackjack?table=room-evening','/play/roulette?table=room-evening']) {
      const gameEntry=await request(entry,{cookie:boCookie});assert.equal(gameEntry.status,303);
      assert.equal(gameEntry.headers.get('location'),'/api/auth/bo/start?next='+encodeURIComponent(entry));
    }
    const mixed=boCookie+'; '+foreign;
    const session=await(await request('/api/auth/session',{cookie:mixed})).json();assert.equal(session.authenticated,false);assert.equal(session.backofficeHandoff,true);
    const profilePage=cookie=>playerAreaPage(new Request(origin+'/play/profil',{headers:{cookie}}),{
      CROUPIER_VERCEL_UI:'1',CROUPIER_VERCEL_UNIFIED_UI:'1',CROUPIER_STUDIO_NATIVE_ADMIN:'1',CROUPIER_PUBLIC_ORIGIN:origin,CROUPIER_LAB_UI_ORIGIN:origin,CROUPIER_BACKEND_ORIGIN:'https://engine.fixture.invalid',CROUPIER_VERCEL_INGRESS_SECRET:'fixture-ingress-secret-'.repeat(3)
    },'profil',{fetchImpl:(url,init)=>request(new URL(url).pathname,{method:init.method||'GET',cookie:init.headers.get('cookie'),...(init.body?{body:JSON.parse(init.body)}:{})})});
    const page=await profilePage(mixed);
    assert.equal(page.redirect,'/api/auth/bo/start?next=%2Fplay%2Fprofil');
    const start=await request(page.redirect,{cookie:mixed}),state=start.headers.getSetCookie()[0].split(';')[0];assert.equal(start.status,303);
    const approved=await request(start.headers.get('location'),{cookie:boCookie});assert.equal(approved.status,303);
    const callback=await request(approved.headers.get('location'),{cookie:state+'; '+mixed});assert.equal(callback.status,303);assert.equal(callback.headers.get('location'),'/play/profil');
    const own=callback.headers.getSetCookie().find(value=>value.startsWith('player_session=')).split(';')[0],cookie=boCookie+'; '+own;
    const authenticated=await(await request('/api/auth/session',{cookie})).json();assert.equal(authenticated.authenticated,true);assert.equal(authenticated.backofficeHandoff,undefined);
    const player=await(await request('/api/player',{method:'POST',cookie,body:{}})).json();assert.notEqual(player.id,foreignPlayer.id);assert.equal(player.name,'fixtureadmin');
    assert.deepEqual(await(await request('/api/player',{method:'POST',cookie:foreign,body:{}})).json(),foreignPlayer,'other account balance and data remain unchanged');
    const ownProfile=await profilePage(cookie);assert.equal(ownProfile.redirect,null);assert.equal(ownProfile.data.player.name,'fixtureadmin');assert.match(ownProfile.html,/fixtureadmin/);
    const pendingCode=async bo=>{const start=await request('/api/auth/bo/start?next=/play/profil',{cookie:bo});const issued=await request(start.headers.get('location'),{cookie:bo});return {url:issued.headers.get('location'),state:start.headers.getSetCookie()[0].split(';')[0]};};
    const pending=await pendingCode(boCookie);
    const logout=await native('logout',{},cookie);assert.equal(logout.status,200);
    assert.equal((await(await request('/api/auth/session',{cookie})).json()).authenticated,false,'revoked player cookie cannot be replayed');
    assert.equal((await(await request('/api/auth/session',{cookie})).json()).backofficeHandoff,undefined,'revoked BO epoch cannot restart SSO');
    const before=players.prepare('SELECT count(*) n FROM player_sessions').get().n;
    assert.ok([400,401].includes((await request(pending.url,{cookie:pending.state+'; '+cookie})).status),'pending code cannot survive native logout');
    const again=await native('login',{user:'fixtureadmin',pass:password}),newBo=again.headers.getSetCookie().find(value=>value.startsWith('bo_jwt=')).split(';')[0];
    const pendingPlayerLogout=await pendingCode(newBo);
    const playerLogout=await request('/api/auth/logout',{method:'POST',cookie:newBo,body:{}});assert.equal(playerLogout.status,200);
    assert.ok(playerLogout.headers.getSetCookie().some(value=>value.startsWith('bo_game_state=; Path=/api/auth/bo/callback;')));
    assert.ok(playerLogout.headers.getSetCookie().some(value=>value.startsWith('bo_jwt=;')));
    assert.ok([400,401].includes((await request(pendingPlayerLogout.url,{cookie:pendingPlayerLogout.state+'; '+newBo})).status),'a delayed callback carrying both pre-logout cookies must be revoked server-side');
    assert.equal(players.prepare('SELECT count(*) n FROM player_sessions').get().n,before,'logout callbacks cannot mint another session');
    assert.equal((await(await request('/api/auth/session',{cookie:newBo})).json()).backofficeHandoff,undefined,'old BO cookie cannot advertise a new authenticated handoff');
    const newStart=await request('/api/auth/bo/start?next=/play/profil',{cookie:newBo});assert.equal(newStart.status,303);
    const newAuthorization=await request(newStart.headers.get('location'),{cookie:newBo});
    assert.equal(newAuthorization.status,303);assert.match(newAuthorization.headers.get('location'),/^\/admin\/login\?returnTo=/,'old BO cookie must reauthenticate before a fresh code can be minted');
    assert.equal(players.prepare('SELECT count(*) n FROM player_sessions').get().n,before);
  } finally {
    if(child&&child.exitCode===null){const stopped=once(child,'exit');child.kill();await stopped;}
    users?.close();players?.close();assert.ok(resolve(directory).startsWith(join(resolve(tmpdir()),'n1-session-')));
    await rm(directory,{recursive:true,force:true});
  }
});
