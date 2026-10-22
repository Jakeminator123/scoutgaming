import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { parseSharedRoomQaArgs, validateSharedRoomQaEnvironment, createSharedRoomQaEnvironment,
  runSharedRoomK04Qa, waitForSharedRoomQaChild, createSharedRoomQaWorkerLifecycle } from '../tools/run-shared-room-k04-qa.mjs';

const launcher = fileURLToPath(new URL('../tools/run-shared-room-k04-qa.mjs', import.meta.url));
const args = () => ['--postgres-port', '35432', '--database', 'croupier_qa_k04', '--role', 'studio_qa',
  '--system-id', '7561234567890123456', '--http-port', '34173', '--fixture', './fixture.mjs', '--media-root', './media'];
const options = () => parseSharedRoomQaArgs(args());
const osEnv = () => Object.fromEntries(Object.entries(process.env).filter(([name]) =>
  ['PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','TMPDIR','HOME','USERPROFILE','APPDATA','LOCALAPPDATA'].includes(name.toUpperCase())));
const denied = (work, code) => assert.throws(work, { code });
function changed(flag, value) {
  const result = args(), at = result.indexOf(flag);
  result[at + 1] = value; return result;
}

test('explicit QA target parses without host, connection-string or implicit port defaults', () => {
  const value = options();
  assert.equal(value.postgresPort, 35432); assert.equal(value.httpPort, 34173);
  assert.equal(value.database, 'croupier_qa_k04'); assert.equal(value.role, 'studio_qa');
  assert.equal(value.systemId, '7561234567890123456'); assert.ok(Object.isFrozen(value));
  assert.equal(parseSharedRoomQaArgs(changed('--role', 'croupier_qa_k04')).role, 'croupier_qa_k04');
});

test('missing, duplicate, unknown, prototype and malformed CLI flags fail closed', () => {
  for (let i = 0; i < args().length; i += 2) denied(() => parseSharedRoomQaArgs(args().filter((_, n) => n !== i && n !== i + 1)), 'shared_room_qa_arguments_invalid');
  for (const extra of [['--database','croupier_qa_other'],['--host','remote.neon.tech'],['--connection-string','secret'],
    ['--constructor','x'],['--__proto__','x'],['--help'],['--role=studio_qa']])
    denied(() => parseSharedRoomQaArgs([...args(), ...extra]), 'shared_room_qa_arguments_invalid');
});

test('production names, malformed identities, ambiguous ports and remote fixture paths are refused', () => {
  for (const [flag, value] of [['--database','postgres'],['--database','croupier_game'],['--database','croupier_qa_'],
    ['--role','croupier_game'],['--system-id','123'],['--system-id','07561234567890123456']])
    denied(() => parseSharedRoomQaArgs(changed(flag,value)), 'shared_room_qa_target_invalid');
  for (const value of ['0','1023','65536','034173','34173x','3e4','34173.0','+34173',' 34173'])
    denied(() => parseSharedRoomQaArgs(changed('--postgres-port',value)), 'shared_room_qa_ports_invalid');
  denied(() => parseSharedRoomQaArgs(changed('--postgres-port','34173')), 'shared_room_qa_ports_invalid');
  for (const path of ['https://fixture.invalid/a.mjs','file:///tmp/a.mjs','//server/share/a.mjs','\\\\server\\share\\a.mjs','bad\nfile.mjs','fixture.js'])
    denied(() => parseSharedRoomQaArgs(changed('--fixture',path)), 'shared_room_qa_paths_invalid');
});

test('production, provider and credential environments are rejected without reflecting secret values', () => {
  const cases = [
    ['NODE_ENV','production','shared_room_qa_production_process'],
    ['CROUPIER_STUDIO_ENVIRONMENT_ID','production','shared_room_qa_production_process'],
    ['RENDER','1','shared_room_qa_provider_process'],['vercel_env','preview','shared_room_qa_provider_process'],
    ['DATABASE_URL','postgres://unprinted-secret','shared_room_qa_cloud_credentials'],
    ['PGHOST','remote.neon.tech','shared_room_qa_cloud_credentials'],
    ['PGOPTIONS','-c search_path=public','shared_room_qa_cloud_credentials'],
    ['BLOB_READ_WRITE_TOKEN','unprinted-secret','shared_room_qa_cloud_credentials'],
    ['OPENAI_API_KEY','unprinted-secret','shared_room_qa_cloud_credentials'],
    ['AUTH_SECRET','unprinted-secret','shared_room_qa_cloud_credentials'],
    ['CROUPIER_CLOUD_RUNTIME','1','shared_room_qa_environment_invalid'],
    ['CROUPIER_MOVING_SPEECH_ENABLED','1','shared_room_qa_environment_invalid'],
    ['NODE_OPTIONS','--import=fixture.mjs','shared_room_qa_environment_invalid'],
    ['HTTPS_PROXY','http://remote.invalid','shared_room_qa_environment_invalid'],
  ];
  for (const [key,value,code] of cases) {
    denied(() => validateSharedRoomQaEnvironment({[key]:value}), code);
    try { validateSharedRoomQaEnvironment({[key]:value}); } catch (error) { assert.ok(!String(error).includes('unprinted-secret')); }
  }
});

test('child environment includes only OS essentials and fixed matching loopback settings', () => {
  const env = createSharedRoomQaEnvironment({PATH:'/safe/bin',HOME:'/isolated/home',UNRELATED_FLAG:'not-forwarded',
    HOST:'0.0.0.0',PORT:'9999',PUBLIC_URL:'https://unrelated.invalid'}, options());
  assert.equal(env.HOST,'127.0.0.1'); assert.equal(env.PORT,'34173'); assert.equal(env.NODE_ENV,'test');
  for (const key of ['PUBLIC_URL','CROUPIER_PUBLIC_ORIGIN','BO_URL','LAB_PUBLIC_URL']) assert.equal(env[key],'http://127.0.0.1:34173');
  assert.equal(env.CROUPIER_STUDIO_ENVIRONMENT_ID,'test'); assert.equal(env.CROUPIER_STUDIO_WORKSPACE_ID,'shared-qa-k04');
  assert.equal(env.CROUPIER_CLOUD_LAYOUT,'single-origin'); assert.equal(env.CROUPIER_DATABASE,'postgres');
  assert.equal(env.CROUPIER_STUDIO_NEON_POLICY,'1'); assert.equal(env.CROUPIER_SHARED_TABLE_ENABLED,'1');
  assert.equal(env.CROUPIER_PLAYER_ACCOUNTS,'1'); assert.equal(env.UNRELATED_FLAG,undefined);
  assert.equal(env.CROUPIER_GAME_DATABASE_URL,undefined); assert.equal(env.PGHOST,undefined);
  assert.equal(env.PATH,'/safe/bin'); assert.equal(env.HOME,'/isolated/home');
});

test('module import is inert without target configuration, including unsafe caller environment', () => {
  const child = spawnSync(process.execPath, ['--input-type=module','--eval',
    'const m=await import('+JSON.stringify(new URL('../tools/run-shared-room-k04-qa.mjs',import.meta.url).href)+');console.log(typeof m.runSharedRoomK04Qa)'],
    {env:{...osEnv(),NODE_ENV:'production',DATABASE_URL:'unprinted-secret'},encoding:'utf8',timeout:5000,windowsHide:true});
  assert.equal(child.status,0,child.stderr); assert.equal(child.stdout.trim(),'function'); assert.equal(child.stderr,'');
});

test('CLI rejects unsafe environment and invalid target before importing any local fixture', async t => {
  const dir = await mkdtemp(join(tmpdir(),'croupier-k04-launch-'));
  t.after(() => rm(dir,{recursive:true,force:true}));
  const fixture = join(dir,'fixture.mjs'), marker = join(dir,'should-not-run'), mediaRoot = join(dir,'media');
  await mkdir(mediaRoot);
  await writeFile(fixture,'import {writeFileSync} from "node:fs";writeFileSync('+JSON.stringify(marker)+',"unexpected fixture import");export function createQaFixture(){throw Error("unprinted-secret");}');
  const argv = changed('--fixture',fixture); argv[argv.indexOf('--media-root')+1] = mediaRoot;
  for (const [env, command, code] of [
    [{NODE_ENV:'production'},argv,'shared_room_qa_production_process'],
    [{CROUPIER_CLOUD_RUNTIME:'1'},argv,'shared_room_qa_environment_invalid'],
    [{DATABASE_URL:'unprinted-secret'},argv,'shared_room_qa_cloud_credentials'],
    [{},argv.map((v,i)=>i===argv.indexOf('--database')+1?'croupier_game':v),'shared_room_qa_target_invalid'],
  ]) {
    const child = spawnSync(process.execPath,[launcher,...command],{env:{...osEnv(),...env},encoding:'utf8',timeout:5000,windowsHide:true});
    assert.equal(child.status,1,child.stderr); assert.equal(child.stdout,''); assert.equal(child.stderr.trim(),code);
    assert.ok(!child.stderr.includes('unprinted-secret')); await assert.rejects(access(marker),{code:'ENOENT'});
  }
});

test('worker rejects a missing local fixture before any PostgreSQL or product startup', async t => {
  const previous = process.env, dir = await mkdtemp(join(tmpdir(),'croupier-k04-missing-'));
  process.env = createSharedRoomQaEnvironment(osEnv(),options());
  t.after(async () => { process.env = previous; await rm(dir,{recursive:true,force:true}); });
  await assert.rejects(runSharedRoomK04Qa({...options(),fixture:join(dir,'missing.mjs')}),
    {code:'shared_room_qa_paths_invalid'});
});

test('actual CLI worker reports a missing local fixture without starting the product', async t => {
  const dir=await mkdtemp(join(tmpdir(),'croupier-k04-worker-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const argv=changed('--fixture',join(dir,'missing.mjs'));argv[argv.indexOf('--media-root')+1]=dir;
  const child=spawnSync(process.execPath,[launcher,...argv],{env:osEnv(),encoding:'utf8',timeout:5000,windowsHide:true});
  assert.equal(child.status,1,child.stderr);assert.equal(child.stdout,'');
  assert.equal(child.stderr.trim(),'shared_room_qa_paths_invalid');
});

test('identity mismatch closes the owned pool before importing an otherwise valid local fixture', async t => {
  const dir=await mkdtemp(join(tmpdir(),'croupier-k04-identity-'));
  const fixture=join(dir,'fixture.mjs'),marker=join(dir,'should-not-run');
  await writeFile(fixture,'import {writeFileSync} from "node:fs";writeFileSync('+JSON.stringify(marker)+',"unexpected fixture import");');
  const previous=process.env,pg=createRequire(new URL('../services/game/package.json',import.meta.url))('pg'),originalPool=pg.Pool;
  let ended=0,created=0,queried=0;
  const value={...options(),fixture,mediaRoot:dir};
  process.env=createSharedRoomQaEnvironment(osEnv(),value);
  t.after(async()=>{process.env=previous;pg.Pool=originalPool;await rm(dir,{recursive:true,force:true});});
  pg.Pool=class {
    constructor(poolOptions){
      created++;this.options=poolOptions;
      assert.equal(poolOptions.host,'127.0.0.1');assert.equal(poolOptions.port,35432);
      assert.equal(poolOptions.database,'croupier_qa_k04');assert.equal(poolOptions.user,'studio_qa');
      assert.equal(poolOptions.connectionString,undefined);assert.equal(poolOptions.ssl,false);
      assert.equal(poolOptions.password(),undefined);assert.ok(poolOptions.connectionTimeoutMillis>0&&poolOptions.connectionTimeoutMillis<=10000);
    }
    connect(){assert.fail('identity needs only its explicit readonly query');}
    async query(){queried++;return {rows:[{address:'127.0.0.1',port:35432,database:'croupier_game',
      role:'studio_qa',session_role:'studio_qa',listeners:'127.0.0.1',system_identifier:'7561234567890123456'}]};}
    async end(){ended++;}
  };
  await assert.rejects(runSharedRoomK04Qa(value),{code:'shared_room_qa_identity_mismatch'});
  assert.deepEqual({created,queried,ended},{created:1,queried:1,ended:1});
  await assert.rejects(access(marker),{code:'ENOENT'});
});

function fakeProcess() {
  const target=new EventEmitter();target.connected=true;target.errors=[];target.exits=[];
  target.stderr={write:text=>target.errors.push(text)};
  target.exit=code=>target.exits.push(code);
  target.disconnect=()=>{target.connected=false;target.emit('disconnect');};
  return target;
}
class OwnedChild extends EventEmitter {
  connected=true;kills=[];messages=[];
  send(message,callback){this.messages.push(message);callback?.();}
  kill(signal){this.kills.push(signal);queueMicrotask(()=>this.emit('exit',null,signal));return true;}
}
test('gracefully completed owned child exits zero without force or cleanup error', async () => {
  const target=fakeProcess(),child=new OwnedChild();
  const exit=waitForSharedRoomQaChild(child,{processTarget:target,forceAfterMs:20});
  target.emit('SIGTERM');assert.deepEqual(child.messages,[{type:'shared_room_qa_shutdown'}]);
  child.emit('exit',0,null);
  assert.equal(await exit,0);assert.deepEqual(child.kills,[]);assert.deepEqual(target.errors,[]);
  assert.equal(target.listenerCount('SIGTERM'),0);assert.equal(child.listenerCount('exit'),0);
});
test('forced owned child exit is nonzero with fixed cleanup failure, even if exit reports zero', async () => {
  for (const reportsZero of [false,true]) {
    const target=fakeProcess(),child=new OwnedChild();
    if(reportsZero)child.kill=signal=>{child.kills.push(signal);queueMicrotask(()=>child.emit('exit',0,null));return true;};
    const exit=waitForSharedRoomQaChild(child,{processTarget:target,forceAfterMs:5});
    target.emit('SIGTERM');
    assert.equal(await exit,1);assert.deepEqual(child.kills,['SIGKILL']);
    assert.deepEqual(target.errors,['shared_room_qa_cleanup_failed\n']);
  }
});
test('signal exit never masquerades as graceful completion, including after requested stop', async () => {
  for(const requested of [false,true]){
    const target=fakeProcess(),child=new OwnedChild();
    const exit=waitForSharedRoomQaChild(child,{processTarget:target,forceAfterMs:20});
    if(requested)target.emit('SIGINT');child.emit('exit',null,'SIGTERM');
    assert.equal(await exit,1);assert.deepEqual(target.errors,['shared_room_qa_cleanup_failed\n']);
    assert.deepEqual(child.kills,[]);
  }
});
test('worker closes its runtime when the parent IPC disconnects and removes its own handlers', async () => {
  const target=fakeProcess(),lifetime=createSharedRoomQaWorkerLifecycle({processTarget:target,forceAfterMs:20});
  let closed=0;lifetime.attach({async close(){closed++;return {completed:true};}});
  target.disconnect();assert.deepEqual(await lifetime.stopped,{completed:true});
  assert.equal(closed,1);assert.deepEqual(target.exits,[]);assert.deepEqual(target.errors,[]);
  for(const name of ['SIGINT','SIGTERM','message','disconnect'])assert.equal(target.listenerCount(name),0);
});
test('worker has its own nonzero cleanup deadline during hung bootstrap or hung runtime drain', async () => {
  for(const hasRuntime of [false,true]){
    const target=fakeProcess(),lifetime=createSharedRoomQaWorkerLifecycle({processTarget:target,forceAfterMs:5});
    let closed=0;if(hasRuntime)lifetime.attach({close(){closed++;return new Promise(()=>{});}});
    target.disconnect();assert.deepEqual(await lifetime.stopped,{completed:false});
    assert.equal(closed,Number(hasRuntime));assert.deepEqual(target.exits,[1]);
    assert.deepEqual(target.errors,['shared_room_qa_cleanup_failed\n']);
  }
});
test('lifecycle test budgets remain finite and cannot lengthen the production cleanup ceiling', () => {
  for(const forceAfterMs of [0,-1,85001,Infinity,NaN,'5']){
    denied(()=>waitForSharedRoomQaChild(new OwnedChild(),{forceAfterMs}),'shared_room_qa_cleanup_budget_invalid');
    denied(()=>createSharedRoomQaWorkerLifecycle({forceAfterMs}),'shared_room_qa_cleanup_budget_invalid');
  }
});

test('worker also bounds cleanup when IPC was already lost before its handlers were attached', async () => {
  const target=fakeProcess();target.connected=false;
  const lifetime=createSharedRoomQaWorkerLifecycle({processTarget:target,forceAfterMs:5});
  assert.equal(lifetime.stopping,true);assert.deepEqual(await lifetime.stopped,{completed:false});
  assert.deepEqual(target.exits,[1]);assert.deepEqual(target.errors,['shared_room_qa_cleanup_failed\n']);
});
