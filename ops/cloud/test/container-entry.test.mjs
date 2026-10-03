import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareContainerUser } from '../container-entry.mjs';

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

const qaEnv={CROUPIER_CLOUD_DATA_ROOT:'/var/data/native-studio-qa/abc92154cb15',CROUPIER_DATABASE:'postgres',
  CROUPIER_STUDIO_NEON_POLICY:'1',CROUPIER_STUDIO_ENVIRONMENT_ID:'qa_native_abc92154cb15',CROUPIER_STUDIO_WORKSPACE_ID:'croupier',
  CROUPIER_GAME_DATABASE_URL:'postgresql://croupier_studio_qa_abc92154cb15:fixture@fixture.neon.tech/croupier_studio_qa_abc92154cb15?sslmode=require'};
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
    {CROUPIER_STUDIO_NEON_POLICY:'0'},{CROUPIER_STUDIO_ENVIRONMENT_ID:'production'},
    {CROUPIER_CLOUD_DATA_ROOT:'/var/data/native-studio-qa/abc92154cb15/..'},
    {CROUPIER_CLOUD_DATA_ROOT:'/var/data/players'},{CROUPIER_DATABASE:'sqlite'}]) {
    calls.length=0;await assert.rejects(prepareContainerUser({...qaEnv,...change},{fs,proc}));assert.deepEqual(calls,[]);
  }
  await assert.rejects(prepareContainerUser(qaEnv,{fs:{...fs,realpath:async path=>path.endsWith('abc92154cb15')?'/other':path},proc}));
});
