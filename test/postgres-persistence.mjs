import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID, randomBytes, scryptSync } from 'node:crypto';
import { createHash, createHmac } from 'node:crypto';
import { createPostgresStore } from '../services/game/storage/postgres-store.mjs';
import { postgresStatement,validateGameConnection } from '../packages/storage/server/postgres-store.mjs';
import { createStudioRepository } from '../packages/studio-registry/server/document-repository.mjs';
import { createStudioDocumentApi } from '../apps/studio/lib/studio-document-api.mjs';
import { createPostgresNativeTableCommand } from '../services/game/postgres-native-table.mjs';
import { createPlayerAdministration } from '../packages/storage/server/player-administration.mjs';
import { playerAuth } from '../services/game/storage/async-player-auth.mjs';
import { craigIdentity } from '../packages/studio-access/server/craig-identity.mjs';
import { installBoAuthEpoch } from '../packages/studio-access/server/bo-auth-epoch.mjs';
import { createPlayerChatMemory } from '../services/game/storage/async-player-chat-memory.mjs';
import { createPlayerProbeStore } from '../services/game/storage/async-player-probe-store.mjs';
import { createDefaultProbePolicy } from '../packages/presentation/contracts/probe-policy.mjs';
import { installPartnerApi } from '../services/game/storage/async-partner-api.mjs';
import { command as shoeCommand, newGame } from '../services/game/shoe-game.mjs';

async function invoke(handler,url,{cookie='',body='',headers={},method='GET'}={}){
  const target=new URL(url),req={url:target.pathname+target.search,method,headers:{host:target.host,cookie,...headers},socket:{encrypted:true,remoteAddress:'127.0.0.1'},async *[Symbol.asyncIterator](){if(body)yield body;}};
  const response={writeHead(status,headers={}){this.status=status;this.headers=headers;},end(body=''){this.body=body;}};
  await handler(req,response,target.pathname);return response;
}

test('Postgres SQL binds parameters, preserves quoted punctuation and rejects SQLite schema SQL',()=>{
  assert.equal(postgresStatement("SELECT '?' AS literal FROM players WHERE id=? AND name='a''?b'"),"SELECT '?' AS literal FROM players WHERE id=$1 AND name='a''?b'");
  assert.equal(postgresStatement('INSERT INTO x VALUES (?) ON CONFLICT DO NOTHING'),'INSERT INTO x VALUES ($1) ON CONFLICT DO NOTHING');
  assert.equal(postgresStatement('SELECT player_id AS playerId FROM players'),'SELECT player_id AS "playerId" FROM players');
  assert.throws(()=>postgresStatement('PRAGMA table_info(players)'),/SQLite/);
  assert.throws(()=>validateGameConnection('postgresql://u:p@host/game?sslmode=disable'),/TLS/);
  assert.throws(()=>validateGameConnection('postgresql://other:other@ep.example/game?sslmode=require','postgresql://zones:p@ep-pooler.example/game?sslmode=require'),/separate/);
});

test('Postgres facade shares nested work on one client and rolls back on failure',async()=>{
  const statements=[],client={async query(sql){statements.push(sql);return{rows:[{n:'1'}],fields:[{name:'n',dataTypeID:20}],rowCount:1};},release(){statements.push('release');}};
  const pool={async connect(){return client;},async query(sql){return client.query(sql);},async end(){}};
  const store=createPostgresStore({pool});
  assert.equal((await store.db.prepare("SELECT '?' AS literal FROM players WHERE id=?").get('qa')).n,1);
  assert.ok(statements.includes("SELECT '?' AS literal FROM croupier_game.players WHERE id=$1"));
  statements.length=0;
  await assert.rejects(store.db.transaction(async()=>{await store.boDb.transaction(async()=>store.boDb.prepare('SELECT id FROM users').get());throw Error('fixture failure');}),/fixture failure/);
  assert.equal(statements.filter(sql=>sql.startsWith('BEGIN;')).length,1);assert.ok(statements.includes('ROLLBACK'));assert.equal(statements.at(-1),'release');
  await assert.rejects(store.db.exec('BEGIN IMMEDIATE'),/transaction/);
  await assert.rejects(store.db.transaction(async()=>{try{await store.db.transaction(async()=>{throw Error('caught inner failure');});}catch{}}),/caught inner failure/);
});

test('memory transaction takes the game lock before the canonical Studio lock and uses one client',async()=>{
  const statements=[],client={async query(sql,values=[]){statements.push({sql,values});return{rows:[],fields:[],rowCount:0};},release(){}};
  let connects=0;
  const pool={async connect(){connects++;return client;},query(){throw Error('No query may bypass the transaction');}};
  const {db}=createPostgresStore({pool}),studioScope={workspaceId:'croupier',environment:'production'};
  await db.transaction(async()=>{
    await db.prepare("SELECT value FROM croupier_studio.documents WHERE environment_id=? AND workspace_id=? AND kind='project'").get('production','croupier');
    await db.transaction(async()=>db.prepare('SELECT 1 FROM player_chat_memory_profiles').get(),{studioScope});
  },{studioScope});
  const expected=createHash('sha256').update('croupier-studio\0{"environment":"production","workspaceId":"croupier"}').digest();
  assert.equal(connects,1);
  assert(statements[0].sql.endsWith('; SELECT pg_advisory_xact_lock(1129467984)'));
  assert.deepEqual(statements[1],{sql:'SELECT pg_advisory_xact_lock($1::integer, $2::integer)',values:[expected.readInt32BE(0),expected.readInt32BE(4)]});
  assert(statements[2].sql.includes('FROM croupier_studio.documents'));
  assert.equal(statements.filter(({sql})=>sql.includes('pg_advisory_xact_lock')).length,2);
  assert.equal(statements.at(-1).sql,'COMMIT');
});

test('nested Studio lock escalation or scope mismatch rolls back instead of reversing lock order',async()=>{
  const statements=[],client={async query(sql){statements.push(sql);return{rows:[],fields:[],rowCount:0};},release(){}};
  const {db}=createPostgresStore({pool:{connect:async()=>client,query:sql=>client.query(sql)}});
  const scope={environment:'production',workspaceId:'croupier'};
  for(const outer of [{},{studioScope:scope}]){
    statements.length=0;
    await assert.rejects(db.transaction(async()=>{
      try{await db.transaction(()=>assert.fail('Rejected nested callback must not run'),{studioScope:{...scope,workspaceId:'other'}});}catch{}
    },outer),/Studio transaction scope mismatch/);
    assert(statements.includes('ROLLBACK'));assert(!statements.includes('COMMIT'));
  }
});

test('nested scoped memory cannot escalate from a Studio-only transaction to the game lock',async()=>{
  const statements=[],client={async query(sql){statements.push(sql);return{rows:[],fields:[],rowCount:0};},release(){}};
  const {db}=createPostgresStore({pool:{connect:async()=>client,query:sql=>client.query(sql)}});
  const studioScope={environment:'production',workspaceId:'croupier'};
  for(const nested of [{studioScope},{}]){
    statements.length=0;
    await assert.rejects(db.transaction(async()=>{
      try{await db.transaction(()=>assert.fail('Escalated callback must not run'),nested);}catch{}
    },{studioScope,serialize:false}),/Studio transaction lock escalation/);
    assert(statements.includes('ROLLBACK'));assert(!statements.includes('COMMIT'));
    assert(!statements.some(sql=>sql.includes('1129467984')));
  }
});

test('native project PUT and scoped memory serialize game then Studio without cross-client deadlock',{timeout:3000},async t=>{
  const holders=new Map(),waiting=new Map(),trace=[];
  const nativeSaving=Promise.withResolvers(),chatAttempted=Promise.withResolvers();
  let connects=0;
  function grant(client,key){holders.set(key,client);trace.push(`acquire:${client}:${key}`);}
  async function lock(client,key){
    trace.push(`request:${client}:${key}`);
    if(client===2)chatAttempted.resolve();
    if(holders.has(key)&&holders.get(key)!==client){
      await new Promise((resolve,reject)=>{const queue=waiting.get(key)??[];queue.push({client,resolve,reject});waiting.set(key,queue);});
    }else grant(client,key);
  }
  function unlock(client){
    for(const [key,owner] of holders){
      if(owner!==client)continue;
      holders.delete(key);const next=waiting.get(key)?.shift();
      if(next){grant(next.client,key);next.resolve();}
    }
  }
  t.after(()=>{for(const queue of waiting.values())for(const item of queue)item.reject(Error('Fixture closed'));});
  const pool={query(){throw Error('Query bypassed transaction');},async connect(){
    const client=++connects;
    return {release(){assert(![...holders.values()].includes(client),'Connection released while holding a lock');},async query(sql,values=[]){
      if(sql==='COMMIT'||sql==='ROLLBACK')unlock(client);
      else if(sql.includes('pg_advisory_xact_lock(1129467984)'))await lock(client,'game');
      else if(sql.includes('pg_advisory_xact_lock($1::integer, $2::integer)'))await lock(client,`studio:${values.join(':')}`);
      return {rows:[],fields:[],rowCount:0,command:sql};
    }};
  }};
  const store=createPostgresStore({pool}),studioScope={environment:'test',workspaceId:'native-lock-order'};
  const repository=createStudioRepository({pool,scope:studioScope}),origin='https://admin.example.invalid';
  const api=createStudioDocumentApi({repository,
    config:{scope:studioScope,apiBase:'/api/admin',allowedOrigins:[origin,'https://studio.example.invalid'],publicHosts:['admin.example.invalid','studio.example.invalid']},
    authorize:async()=>({user:'synthetic-admin',role:'admin',scope:studioScope}),validateProjectBindings:async()=>{},
    // The native runtime keeps the auth/game transaction outside the separate
    // Studio repository connection. Moving Studio onto that outer client would
    // make its own repository connection wait forever for the same lock.
    mutationTransaction:work=>store.boDb.transaction(work),
    gamePolicy:{projectStore:()=>({async save(project,expectedRevision){
      assert.equal(expectedRevision,'before');nativeSaving.resolve();await chatAttempted.promise;
      return repository.transaction(async()=>{trace.push('native:saved');return {...project,revision:'after'};});
    }})},
  });
  const native=api.handle(new Request(origin+'/api/project',{method:'PUT',
    headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'},
    body:JSON.stringify({project:{},expectedRevision:'before'})}));
  const early=await Promise.race([nativeSaving.promise.then(()=>null),native]);
  if(early)assert.fail(`Native fixture returned before save: ${early.status} ${await early.text()}`);
  const memory=store.db.transaction(async()=>{trace.push('memory:read');},{studioScope});
  const [response]=await Promise.all([native,memory]);
  assert.equal(response.status,200);assert.equal((await response.json()).project.revision,'after');
  assert.equal(connects,3,'Native auth, native Studio and concurrent memory each use their own client');
  assert(trace.indexOf('native:saved')<trace.indexOf('memory:read'));
  for(const client of [1,2])assert(trace.includes(`acquire:${client}:game`));
  assert(trace.indexOf('acquire:2:game')<trace.findIndex(event=>event.startsWith('acquire:2:studio:')));
  assert.equal(holders.size,0);
});

test('Postgres partner sessions require a current internal-wallet authority and fail closed',async()=>{
  const db={prepare(sql){return{async get(){return sql.includes('FROM player_sessions')?{player_id:'synthetic-player',source_stamp:'partner:synthetic-key'}:sql.includes('FROM players')?{status:'active'}:undefined;},async run(){return{changes:1};}};},async transaction(work){return work();}};
  let key={id:'synthetic-key',revoked_at:null,wallet_url:null};
  const auth=playerAuth(db,()=>{throw Error('unexpected creation');},null,{partnerAuthority:async()=>key});
  const request={headers:{cookie:'player_session='+ 'a'.repeat(64)},socket:{}},claims={sub:'synthetic-player',partner:'synthetic-key'};
  assert.equal(await auth.user(request),'synthetic-player');assert.match(await auth.fromPartner(request,claims),/^player_session=/);
  for(const denied of [null,{...key,id:'another-key'},{...key,revoked_at:'revoked'},{...key,wallet_url:'https://wallet.example.invalid'}]){
    key=denied;assert.equal(await auth.user(request),null);await assert.rejects(auth.fromPartner(request,claims),/unavailable/);
  }
  assert.equal(await playerAuth(db,()=>{}).user(request),null);
  const broken=playerAuth(db,()=>{},null,{partnerAuthority:async()=>{throw Error('synthetic transport failure');}});
  await assert.rejects(broken.user(request),/transport failure/,'a failed authority lookup cannot fall back to guest access');
});

const enabled=Boolean(process.env.CROUPIER_POSTGRES_QA_CONFIG);
test('real Neon persists atomic commands, auth epochs, account lifecycle and probe receipts under concurrency', {skip:!enabled},async()=>{
  const config=JSON.parse(await readFile(process.env.CROUPIER_POSTGRES_QA_CONFIG,'utf8')),store=createPostgresStore({connectionString:config.databaseUrl});
  const suffix=randomUUID().slice(0,8),username=`qa-${suffix}`,password='Synthetic-Only-Password-4173',actor='qa-operator';
  let player,profile,operatorId,partnerKey,partnerPlayer;
  try {
    assert.equal((await store.pool.query('SELECT current_database() AS name')).rows[0].name,'croupier_game_qa');
    const admin=createPlayerAdministration({db:store.db});player=await admin.create({username,password,actor,reason:'synthetic lifecycle/concurrency test'});
    const bets=[{main:5,pp:0,tp:0},...Array.from({length:6},()=>({main:0,pp:0,tp:0}))],command=createPostgresNativeTableCommand({pool:store.gamePool});
    const request={id:player.id,op:'start',version:0,requestId:'qa-same-command',bets};
    const receipts=await Promise.all([command(request),command(request),command(request)]);assert.deepEqual(receipts[0],receipts[1]);assert.deepEqual(receipts[1],receipts[2]);
    assert.equal((await store.db.prepare('SELECT balance FROM players WHERE id=?').get(player.id)).balance,995);
    assert.equal((await store.db.prepare("SELECT COUNT(*) AS n FROM transactions WHERE player_id=? AND type='start'").get(player.id)).n,1);
    const before=await store.db.prepare('SELECT state FROM blackjack_tables WHERE player_id=?').get(player.id);
    await assert.rejects(store.db.transaction(async()=>{await store.db.prepare('UPDATE players SET balance=? WHERE id=?').run(1,player.id);await store.db.prepare('INSERT INTO transactions(player_id,type,amount,currency,at) VALUES(?,?,?,?,?)').run('missing-player','qa',1,'USD','qa');}),/foreign key/);
    assert.equal((await store.db.prepare('SELECT balance FROM players WHERE id=?').get(player.id)).balance,995);assert.deepEqual(await store.db.prepare('SELECT state FROM blackjack_tables WHERE player_id=?').get(player.id),before);
    await assert.rejects(admin.setStatus({playerId:player.id,status:'closed',actor,reason:'active-hand close must fail'}),/round/);
    const identity=craigIdentity(store.boDb),epoch=installBoAuthEpoch(store.boDb),salt=randomBytes(16).toString('hex'),hash=scryptSync(password,salt,64).toString('hex');
    operatorId=(await store.pool.query('INSERT INTO croupier_auth.users(username,salt,hash,role,created_at)VALUES($1,$2,$3,$4,$5)RETURNING id',[`qa-op-${suffix}`,salt,hash,'admin',new Date().toISOString()])).rows[0].id;
    const authenticated=await identity.authenticate(`qa-op-${suffix}`,password);assert.equal(authenticated.id,operatorId);assert.equal(await epoch(operatorId),0);
    await store.boDb.prepare('UPDATE users SET role=? WHERE id=?').run('reader',operatorId);assert.equal(await epoch(operatorId),1);
    await store.boDb.prepare('UPDATE users SET role=? WHERE id=?').run('admin',operatorId);assert.equal(await epoch(operatorId),2);
    const account=await identity.find(`qa-op-${suffix}`);
    const partner=installPartnerApi({db:store.db,boDb:store.boDb,shoeCommand,newGame,getPlayer:id=>store.db.prepare('SELECT * FROM players WHERE id=?').get(id),logTx:(id,type,amount,currency,meta)=>store.db.prepare('INSERT INTO transactions(player_id,type,amount,currency,meta,at)VALUES(?,?,?,?,?,?)').run(id,type,amount,currency,meta,new Date().toISOString()),jwtSign:()=> 'synthetic-launch',publicUrl:origins.publicUrl,publicGamePath:'/game',root:'.'});
    partnerKey=await partner.keys.create({name:`QA ${suffix}`},account.name);
    const signed=async(path,input,{timestamp=String(Math.floor(Date.now()/1000))}={})=>{const body=JSON.stringify(input),signature=createHmac('sha256',partnerKey.secret).update(`${timestamp}.POST.${path}.${body}`).digest('hex');const result=await invoke(partner.handle,origins.publicUrl+path,{body,method:'POST',headers:{'x-api-key':partnerKey.key,'x-timestamp':timestamp,'x-signature':signature}});return {...result,json:JSON.parse(result.body)};};
    assert.equal((await signed('/api/v1/ping',{}, {timestamp:'not-a-number'})).status,401);
    assert.equal((await signed('/api/v1/demo-credit',{playerId:'synthetic-partner',amount:100})).status,200);
    partnerPlayer=(await store.db.prepare('SELECT player_id FROM partner_players WHERE key_id=?').get(partnerKey.id)).player_id;
    const launch=await signed('/api/v1/launch',{playerId:'synthetic-partner'});assert.equal(launch.status,200);assert.match(launch.json.url,/\/game\?dealer=astrid&launch=/);
    const partnerCommand={playerId:'synthetic-partner',op:'start',requestId:`partner-${suffix}`,version:0,bets};
    const concurrent=await Promise.all([signed('/api/v1/table',partnerCommand),signed('/api/v1/table',partnerCommand)]);assert.equal(concurrent[0].status,200);assert.deepEqual(concurrent[0].json,concurrent[1].json);
    assert.equal((await store.db.prepare('SELECT balance FROM players WHERE id=?').get(partnerPlayer)).balance,95);
    const wrongPlayer=await signed('/api/v1/table',{...partnerCommand,playerId:'other-player'});assert.equal(wrongPlayer.status,400);assert.match(wrongPlayer.json.error,/another player/);
    assert.equal((await store.db.prepare('SELECT COUNT(*) AS n FROM partner_players WHERE key_id=?').get(partnerKey.id)).n,1,'failed reused request does not create another player');
    const history=await signed('/api/v1/history',{playerId:'synthetic-partner'});assert.equal(history.json.count,1);assert.equal(history.json.rounds[0].playerId,'synthetic-partner');assert.equal(history.json.rounds[0].requestId,partnerCommand.requestId);assert.equal(history.json.rounds[0].tableVersion,1);
    await store.boDb.prepare('UPDATE api_keys SET wallet_url=? WHERE id=?').run('https://wallet.example.invalid',partnerKey.id);
    assert.equal((await signed('/api/v1/balance',{playerId:'synthetic-partner'})).status,503,'external wallet never silently falls back to internal funds');
    const partnerAuthority=id=>store.boDb.prepare('SELECT id,revoked_at,wallet_url FROM api_keys WHERE id=?').get(id);
    const auth=playerAuth(store.db,()=>{throw Error('unexpected player creation');},identity,{playerAccounts:true,partnerAuthority});
    const req={headers:{},socket:{}},claims={sub:player.id,partner:partnerKey.id,displayName:'Synthetic'};
    assert.equal(await auth.partnerAllowed(partnerKey.id),false);
    await assert.rejects(auth.fromPartner(req,claims),/launch is unavailable/);
    await store.boDb.prepare('UPDATE api_keys SET wallet_url=NULL WHERE id=?').run(partnerKey.id);
    const cookie=await auth.fromPartner(req,claims);
    assert.equal((await auth.session({headers:{cookie},socket:{}})).playerId,player.id);
    const restarted=playerAuth(store.db,()=>{throw Error('unexpected');},identity,{playerAccounts:true,partnerAuthority});assert.equal(await restarted.user({headers:{cookie}}),player.id);
    await store.boDb.prepare('UPDATE api_keys SET revoked_at=? WHERE id=?').run('synthetic-revocation',partnerKey.id);
    assert.equal(await restarted.user({headers:{cookie}}),null,'revoked partner cookie cannot enter the native game');
    await assert.rejects(auth.fromPartner(req,claims),/launch is unavailable/);
    await store.boDb.prepare('UPDATE api_keys SET revoked_at=NULL,wallet_url=? WHERE id=?').run('https://wallet.example.invalid',partnerKey.id);
    assert.equal(await restarted.user({headers:{cookie}}),null,'external partner cookie cannot bypass the explicit wallet gate');
    const missingAuthority=playerAuth(store.db,()=>{throw Error('unexpected');},identity);
    assert.equal(await missingAuthority.user({headers:{cookie}}),null,'missing partner authority fails closed');
    await store.boDb.prepare('UPDATE api_keys SET wallet_url=NULL WHERE id=?').run(partnerKey.id);
    await admin.setStatus({playerId:player.id,status:'blocked',actor,reason:'synthetic block'});assert.equal(await restarted.user({headers:{cookie}}),null);
    await assert.rejects(command({id:player.id,op:'state'}),/unavailable/);await assert.rejects(auth.fromPartner(req,claims),/unavailable/);
    await admin.setStatus({playerId:player.id,status:'active',actor,reason:'synthetic reactivate'});
    assert.equal(await restarted.user({headers:{cookie}}),null);assert.equal((await store.db.prepare('SELECT balance FROM players WHERE id=?').get(player.id)).balance,995);
    const memory=await createPlayerChatMemory(store.db),scope={playerId:player.id,dealerId:'astrid'};profile=await memory.profile(scope);
    const pending=await memory.begin({...scope,requestId:'qa-chat-1',message:'Retain this synthetic history'});await pending.commit({kind:'generatedText',exactText:'Synthetic response'});
    assert.equal((await memory.profile(scope)).history.length,2);
    const forgetRace=await memory.begin({...scope,requestId:'qa-chat-2',message:'Must not resurrect after forget'});await memory.forget(scope);await assert.rejects(forgetRace.commit({kind:'generatedText',exactText:'Discard this answer'}),/forgotten|stale/);
    assert.equal((await memory.profile(scope)).history.length,0);
    const probe=await createPlayerProbeStore(store.db,memory,{random:()=>0}),policy={...createDefaultProbePolicy(),mode:'automatic',probability:1,inactivityMs:0,cooldownMs:0,maxPerHour:10};
    const owner='qa-owner',tab='qa-tab',flags={present:true,quiet:true,typing:false,enabled:true,sound:true};
    await probe.observe(scope,{owner,tab,flags,policy,revision:'qa-policy'});
    const reserved=await probe.reserve(scope,{requestId:'qa-probe-1',owner,tab,policy,revision:'qa-policy',quiet:true});assert.equal(reserved.reason,'reserved');
    await probe.generated(scope,reserved.ticket,{speak:true,text:'A synthetic initiative.',topicId:'qa-topic',memoryIds:[]});
    assert.equal(await probe.finish(scope,reserved.ticket,'playing'),true);assert.equal(await probe.finish(scope,reserved.ticket,'played'),true);
    assert.equal((await memory.profile(scope)).history.at(-1).text,'A synthetic initiative.');assert.equal((await probe.inspect(scope,policy)).latest.state,'played');
    assert.equal(await probe.finish(scope,reserved.ticket,'played'),false);
    // A failure in the durable receipt callback must roll back memory too.
    const latest=await memory.profile(scope);await assert.rejects(memory.playedInitiative({...scope,text:'Never retained',expectedRevision:latest.revision},async()=>{await new Promise(resolve=>setTimeout(resolve,1));throw Error('receipt failure');}),/receipt failure/);
    assert.deepEqual(await memory.profile(scope),latest);
    await store.db.prepare('UPDATE blackjack_tables SET state=? WHERE player_id=?').run(JSON.stringify({version:1,shoe:null,round:null,paid:false,last:null}),player.id);
    await admin.setStatus({playerId:player.id,status:'closed',actor,reason:'synthetic close'});
    await assert.rejects(admin.setStatus({playerId:player.id,status:'active',actor,reason:'must stay closed'}),/cannot/);
    assert.ok((await store.db.prepare('SELECT COUNT(*) AS n FROM transactions WHERE player_id=?').get(player.id)).n>=2);
  }finally{
    if(partnerKey){for(const table of ['partner_rounds','partner_idem','partner_players'])await store.db.prepare(`DELETE FROM ${table} WHERE key_id=?`).run(partnerKey.id);await store.boDb.prepare('DELETE FROM api_keys WHERE id=?').run(partnerKey.id);}
    if(partnerPlayer){for(const table of ['transactions','blackjack_tables','native_presentations'])await store.db.prepare(`DELETE FROM ${table} WHERE player_id=?`).run(partnerPlayer);await store.db.prepare('DELETE FROM players WHERE id=?').run(partnerPlayer);}
    if(player){
      if(profile){const scope=`${profile.playerRef}:astrid`;for(const table of ['player_probe_attempts','player_probe_sessions','player_probe_sources','player_probe_facts','player_probe_rounds','player_probe_profiles'])await store.db.prepare(`DELETE FROM ${table} WHERE scope=?`).run(scope);for(const table of ['player_chat_memory_profiles','player_chat_memory_requests'])await store.db.prepare(`DELETE FROM ${table} WHERE player_ref=?`).run(profile.playerRef);}
      for(const table of ['player_accounts','player_sessions','craig_player_links','transactions','blackjack_tables','native_presentations','player_admin_events'])await store.db.prepare(`DELETE FROM ${table} WHERE player_id=?`).run(player.id);
      await store.db.prepare('DELETE FROM players WHERE id=?').run(player.id);
    }
    if(operatorId){await store.boDb.prepare('DELETE FROM lab_sessions WHERE craig_user_id=?').run(operatorId);await store.boDb.prepare('DELETE FROM users WHERE id=?').run(operatorId);await store.boDb.prepare('DELETE FROM bo_auth_epochs WHERE user_id=?').run(operatorId);}
    await store.close();
  }
});
