import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareContainerUser, startFailureReason } from '../container-entry.mjs';

// Pure configuration fixtures: no database client, network or provider token is used.
function fixtureGameDatabaseUrl(address, username = 'fixture-user') {
  const url = new URL(address);
  url.username = username;
  url.password = 'fixture-password';
  return url.href;
}

test('container changes only its exact disk root, then drops all supplementary groups and root', async () => {
  const calls = []; let uid = 0, gid = 0;
  const fs = {
    lstat: async path => { assert.equal(path, '/var/data'); return { isDirectory: () => true, isSymbolicLink: () => false }; },
    realpath: async path => path,
    chown: async (...args) => calls.push(['chown', ...args]),
    chmod: async (...args) => calls.push(['chmod', ...args]),
  };
  const proc = { getuid: () => uid, getgid: () => gid,
    setgroups: value => calls.push(['groups', value]),
    setgid: value => { gid = value; calls.push(['gid', value]); },
    setuid: value => { uid = value; calls.push(['uid', value]); } };
  await prepareContainerUser({ CROUPIER_CLOUD_DATA_ROOT: '/var/data' }, { fs, proc });
  assert.deepEqual(calls, [['chown', '/var/data', 1000, 1000], ['chmod', '/var/data', 0o700], ['groups', []], ['gid', 1000], ['uid', 1000]]);
  calls.length = 0;
  await prepareContainerUser({ CROUPIER_CLOUD_DATA_ROOT: '/var/data' }, { fs, proc });
  assert.deepEqual(calls, []);
  for (const path of ['/', '/app', '/var/data/..', undefined]) {
    await assert.rejects(prepareContainerUser({ CROUPIER_CLOUD_DATA_ROOT: path }, { fs, proc }));
  }
  await assert.rejects(prepareContainerUser({ CROUPIER_CLOUD_DATA_ROOT: '/var/data' }, { fs: { ...fs, realpath: async () => '/other' }, proc }));
});

test('mountless Postgres, Neon and private Blob startup drops root without touching a filesystem', async () => {
  const calls=[];let uid=0,gid=0;
  const proc={getuid:()=>uid,getgid:()=>gid,setgroups:value=>calls.push(['groups',value]),
    setgid:value=>{gid=value;calls.push(['gid',value]);},setuid:value=>{uid=value;calls.push(['uid',value]);}};
  const fs=new Proxy({}, {get:()=>async()=>assert.fail('Mountless startup must not touch a disk path.')});
  const env={
    BLOB_READ_WRITE_TOKEN:'fixture-blob-token',
    CROUPIER_GAME_DATABASE_URL:fixtureGameDatabaseUrl("postgresql://game.neon.tech/game?sslmode=verify-full&channel_binding=require")};
  await prepareContainerUser(env,{fs,proc});
  assert.deepEqual(calls,[['groups',[]],['gid',1000],['uid',1000]]);
  calls.length=0;await prepareContainerUser(env,{fs,proc});assert.deepEqual(calls,[]);
  // The game-only image sets the launcher switch; the entry's storage/user rules do not change.
  await prepareContainerUser(env,{fs,proc});assert.deepEqual(calls,[]);
  for(const mode of ['require','verify-ca']) {
    await prepareContainerUser({...env,CROUPIER_GAME_DATABASE_URL:env.CROUPIER_GAME_DATABASE_URL.replace('verify-full',mode)},{fs,proc});
    assert.deepEqual(calls,[]);
  }
  for(const change of [{BLOB_READ_WRITE_TOKEN:''},{CROUPIER_DATA_DIR:'/var/data/players'},
    {CROUPIER_GENERATED_SPEECH_DIR:'/var/data/speech'},
    {CROUPIER_GAME_DATABASE_URL:fixtureGameDatabaseUrl("postgresql://other.example/game?sslmode=require")},
    {CROUPIER_GAME_DATABASE_URL:fixtureGameDatabaseUrl("postgresql://game.neon.tech/game?sslmode=disable")},
    {CROUPIER_GAME_DATABASE_URL:fixtureGameDatabaseUrl("postgresql://game.neon.tech/game?sslmode=prefer")}]) {
    await assert.rejects(prepareContainerUser({...env,...change},{fs,proc}));
  }
});

const qaEnv={CROUPIER_CLOUD_DATA_ROOT:'/var/data/native-studio-qa/abc92154cb15',  CROUPIER_STUDIO_ENVIRONMENT_ID:'qa_native_abc92154cb15',CROUPIER_STUDIO_WORKSPACE_ID:'croupier',
  CROUPIER_GAME_DATABASE_URL:fixtureGameDatabaseUrl("postgresql://fixture.neon.tech/croupier_studio_qa_abc92154cb15?sslmode=require", "croupier_studio_qa_abc92154cb15")};
test('QA scratch is bounded to its own database and created after privilege drop without changing old files',async()=>{
  let uid=0,gid=0;const calls=[];
  const proc={getuid:()=>uid,getgid:()=>gid,setgroups:()=>{},setuid:n=>{uid=n;},setgid:n=>{gid=n;}};
  const fs={lstat:async()=>({isDirectory:()=>true,isSymbolicLink:()=>false}),realpath:async path=>path,
    chown:async(...args)=>calls.push(['chown',...args]),chmod:async(...args)=>calls.push(['chmod',...args]),
    mkdir:async(path,options)=>{assert.equal(uid,1000);assert.equal(gid,1000);calls.push(['mkdir',path,options]);}};
  await prepareContainerUser(qaEnv,{fs,proc});
  assert.deepEqual(calls,[['chown','/var/data',1000,1000],['chmod','/var/data',0o700],
    ['mkdir','/var/data/native-studio-qa',{mode:0o700}],['mkdir',qaEnv.CROUPIER_CLOUD_DATA_ROOT,{mode:0o700}]]);
  for(const change of [{CROUPIER_GAME_DATABASE_URL:qaEnv.CROUPIER_GAME_DATABASE_URL.replace('/croupier_studio_qa_abc92154cb15?','/croupier_game?')},
    {CROUPIER_STUDIO_ENVIRONMENT_ID:'production'},
    {CROUPIER_CLOUD_DATA_ROOT:'/var/data/native-studio-qa/abc92154cb15/..'},
    {CROUPIER_CLOUD_DATA_ROOT:'/var/data/players'}]) {
    calls.length=0;await assert.rejects(prepareContainerUser({...qaEnv,...change},{fs,proc}));assert.deepEqual(calls,[]);
  }
  await assert.rejects(prepareContainerUser(qaEnv,{fs:{...fs,realpath:async path=>path.endsWith('abc92154cb15')?'/other':path},proc}));
});

test('start failure reason is one bounded line with codes preferred and every URL masked', () => {
  assert.equal(startFailureReason(Object.assign(new Error('listen EADDRINUSE 0.0.0.0:10000'), { code: 'EADDRINUSE' })), 'EADDRINUSE');
  assert.equal(startFailureReason(Object.assign(new Error('password authentication failed for user "game"'), { code: '28P01' })), '28P01');
  assert.equal(startFailureReason(new Error('Invalid or missing CROUPIER_PUBLIC_ORIGIN.')), 'Invalid or missing CROUPIER_PUBLIC_ORIGIN.');
  assert.equal(startFailureReason(new Error('A cloud child exited before readiness.')), 'A cloud child exited before readiness.');
  const leaked = startFailureReason(new Error('cannot reach postgresql://game:secret@game.neon.tech/game?sslmode=require\nor https://example.vercel.app/x'));
  assert.equal(leaked, 'cannot reach [url] or [url]');
  assert.doesNotMatch(leaked, /secret|neon\.tech|vercel/);
  // An unsafe code (spaces/URL) never wins over the redacted message.
  assert.equal(startFailureReason(Object.assign(new Error('bad https://x.test'), { code: 'see https://x.test' })), 'bad [url]');
  const long = startFailureReason(new Error('x'.repeat(500) + ' https://secret.example.test'));
  assert.equal(long.length, 200); assert.doesNotMatch(long, /secret|\[url/);
  assert.doesNotMatch(startFailureReason(new Error('y'.repeat(195) + ' https://secret.example.test')), /secret/);
  for (const value of [undefined, null, '', new Error('')]) assert.equal(startFailureReason(value), 'unknown');
});
