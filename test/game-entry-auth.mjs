import test from 'node:test';
import assert from 'node:assert/strict';
import {backofficeGameAuth as asyncFactory} from '../services/game/storage/async-bo-game-auth.mjs';
import {playerAuth} from '../services/game/storage/async-player-auth.mjs';
import {createStatementDb,duplicateKey} from './fixtures/statement-db.mjs';
const game='https://game.example.invalid',bo='https://bo.example.invalid';
const stampA='a'.repeat(64),stampB='b'.repeat(64);
// Postgres-shaped handoff, player, session and link rows. Only the statements the
// async BO handoff and player auth issue are answered; row locks require a
// transaction, and a failed transaction restores every table.
function handoffDb() {
  const tables={bo_game_handoffs:[],players:[],player_sessions:[],craig_player_links:[]};
  const remove=(name,keep)=>{const removed=tables[name].filter(row=>!keep(row));tables[name]=tables[name].filter(keep);return removed;};
  const forUpdate='SELECT status FROM players WHERE id=? FOR UPDATE';
  const statements={
    'DELETE FROM bo_game_handoffs WHERE expires<=?':now=>({changes:remove('bo_game_handoffs',row=>!(row.expires<=now)).length}),
    'INSERT INTO bo_game_handoffs (state_digest,next_path,expires) VALUES (?,?,?)':(state_digest,next_path,expires)=>{
      if(tables.bo_game_handoffs.some(row=>row.state_digest===state_digest))duplicateKey();
      tables.bo_game_handoffs.push({state_digest,next_path,expires,code_digest:null,craig_user_id:null,username:null,source_stamp:null,session_until:null});return {changes:1};},
    'SELECT * FROM bo_game_handoffs WHERE state_digest=? AND expires>? AND code_digest IS NULL':(state,now)=>tables.bo_game_handoffs.filter(row=>row.state_digest===state&&row.expires>now&&row.code_digest===null),
    'UPDATE bo_game_handoffs SET code_digest=?,craig_user_id=?,username=?,source_stamp=?,session_until=?,expires=? WHERE state_digest=?':(code_digest,craig_user_id,username,source_stamp,session_until,expires,state)=>{
      if(tables.bo_game_handoffs.some(row=>row.code_digest===code_digest&&row.state_digest!==state))duplicateKey();
      const hit=tables.bo_game_handoffs.filter(row=>row.state_digest===state);
      for(const row of hit)Object.assign(row,{code_digest,craig_user_id,username,source_stamp,session_until,expires});return {changes:hit.length};},
    'DELETE FROM bo_game_handoffs WHERE state_digest=? AND code_digest=? AND expires>? RETURNING *':(state,code,now)=>remove('bo_game_handoffs',row=>!(row.state_digest===state&&row.code_digest===code&&row.expires>now)),
    'SELECT player_id,source_stamp,display_name,expires FROM player_sessions WHERE digest=? AND expires>?':(digest,now)=>tables.player_sessions
      .filter(row=>row.digest===digest&&row.expires>now).map(({player_id,source_stamp,display_name,expires})=>({player_id,source_stamp,display_name,expires})),
    'SELECT status FROM players WHERE id=?':id=>tables.players.filter(row=>row.id===id).map(({status})=>({status})),
    [forUpdate]:id=>tables.players.filter(row=>row.id===id).map(({status})=>({status})),
    'SELECT craig_user_id FROM craig_player_links WHERE player_id=?':id=>tables.craig_player_links.filter(row=>row.player_id===id).map(({craig_user_id})=>({craig_user_id})),
    'SELECT player_id FROM craig_player_links WHERE craig_user_id=?':id=>tables.craig_player_links.filter(row=>row.craig_user_id===id).map(({player_id})=>({player_id})),
    'INSERT INTO craig_player_links VALUES (?,?)':(craig_user_id,player_id)=>{
      if(tables.craig_player_links.some(row=>row.craig_user_id===craig_user_id||row.player_id===player_id))duplicateKey();
      tables.craig_player_links.push({craig_user_id,player_id});return {changes:1};},
    'DELETE FROM player_sessions WHERE expires<=?':now=>({changes:remove('player_sessions',row=>!(row.expires<=now)).length}),
    'INSERT INTO player_sessions (digest,player_id,expires,source_stamp,display_name) VALUES (?,?,?,?,?)':(digest,player_id,expires,source_stamp,display_name)=>{
      if(tables.player_sessions.some(row=>row.digest===digest))duplicateKey();
      tables.player_sessions.push({digest,player_id,expires,source_stamp,display_name});return {changes:1};},
  };
  return createStatementDb({tables,statements,transactional:[forUpdate]});
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
