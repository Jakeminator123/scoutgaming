import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareGatewayOwner, gatewayStartupFailure, runGatewayBootstrap } from './gateway-bootstrap.mjs';

function fixture({ uid=0, gid=0, owner=0, group=1000, directory=true, groups=[0], env={}, failure }={}) {
  const calls=[];let closed=false;
  const record=(name,...args)=>{calls.push([name,...args]);if(failure===name)throw Error('PRIVATE');};
  const filesystem={
    constants:{O_RDONLY:0,O_DIRECTORY:65536,O_NOFOLLOW:131072},
    openSync(path,flags){record('open',path,flags);return 42;},
    fstatSync(fd){record('stat',fd);return {uid:owner,gid:group,isDirectory:()=>directory};},
    fchownSync(fd,nextUid,nextGid){record('chown',fd,nextUid,nextGid);owner=nextUid;group=nextGid;},
    closeSync(fd){record('close',fd);closed=true;},
  };
  const system={platform:'linux',env:{OPENCLAW_STATE_DIR:'/data/openclaw',...env},
    getuid:()=>uid,geteuid:()=>uid,getgid:()=>gid,getegid:()=>gid,getgroups:()=>groups,
    setgroups(value){record('groups',value);groups=value;},
    setgid(value){record('gid',value);gid=value;},
    setuid(value){record('uid',value);uid=value;},
  };
  return {filesystem,system,calls,closed:()=>closed};
}

test('mounted root-owned directory gets exact node ownership before groups/gid/uid are dropped',()=>{
  const f=fixture();prepareGatewayOwner(f);
  assert.deepEqual(f.calls,[['open','/data/openclaw',196608],['stat',42],['chown',42,1000,1000],['stat',42],
    ['close',42],['groups',[]],['gid',1000],['uid',1000]]);
  assert.equal(f.system.getuid(),1000);assert.equal(f.system.getgid(),1000);assert.deepEqual(f.system.getgroups(),[]);
});

test('already node-owned directory is not rewritten; a node runtime remains unprivileged',()=>{
  for(const uid of [0,1000]) {
    const f=fixture({uid,gid:1000,owner:1000,groups:[1000]});prepareGatewayOwner(f);
    assert.equal(f.calls.some(([name])=>name==='chown'),false);
    assert.equal(f.system.getuid(),1000);assert.equal(f.closed(),true);
  }
});

test('root HOME and identity environment are reset only after the verified privilege drop',()=>{
  const f=fixture({env:{HOME:'/root',USER:'root',LOGNAME:'root',OPENCLAW_CONFIG_PATH:'/data/openclaw/openclaw.json',
    OPENCLAW_API_KEY:'test-secret-preserved'}});
  const setuid=f.system.setuid;
  f.system.setuid=(uid)=>{assert.equal(f.system.env.HOME,'/root');setuid(uid);};
  prepareGatewayOwner(f);
  assert.deepEqual(f.system.env,{OPENCLAW_STATE_DIR:'/data/openclaw',HOME:'/home/node',USER:'node',LOGNAME:'node',
    OPENCLAW_CONFIG_PATH:'/data/openclaw/openclaw.json',OPENCLAW_API_KEY:'test-secret-preserved'});
  const failed=fixture({env:{HOME:'/root'},failure:'uid'});
  assert.throws(()=>prepareGatewayOwner(failed));
  assert.equal(failed.system.env.HOME,'/root');
});

test('bootstrap loads the starter after identity/environment setup and gives diagnostics a bounded phase',async()=>{
  const f=fixture({env:{HOME:'/root'}});const output=[];
  const ok=await runGatewayBootstrap({owner:()=>prepareGatewayOwner(f),logger:{info:s=>output.push(s),error:s=>output.push(s)},
    loadStarter:async()=>{
      assert.equal(f.system.getuid(),1000);assert.equal(f.system.env.HOME,'/home/node');
      return {startGateway:async({onPhase})=>{onPhase('config-validate');throw Object.assign(Error('PRIVATE key/path'),{code:'GATEWAY_CONFIG_VALIDATION_FAILED'});}};
    }});
  assert.equal(ok,false);
  assert.equal(output.at(-1),'Gateway startup failed; phase=config-validate code=GATEWAY_CONFIG_VALIDATION_FAILED.');
  assert.equal(output.some(value=>value.includes('PRIVATE')),false);
});

test('bootstrap stops before importing on owner failure and reports import failures without private text',async()=>{
  for(const failure of ['owner','import']) {
    let imported=false;const errors=[];
    const ok=await runGatewayBootstrap({owner:()=>{if(failure==='owner')throw Error('PRIVATE');},
      loadStarter:async()=>{imported=true;throw Object.assign(Error('PRIVATE'),{code:'EACCES'});},
      logger:{info:()=>{},error:value=>errors.push(value)}});
    assert.equal(ok,false);assert.equal(imported,failure==='import');
    assert.deepEqual(errors,[`Gateway startup failed; phase=${failure==='owner'?'mount-owner':'starter-import'} code=${failure==='owner'?'UNAVAILABLE':'EACCES'}.`]);
  }
  assert.equal(gatewayStartupFailure({message:'PRIVATE',code:'SECRET_TOKEN'},'PRIVATE'),
    'Gateway startup failed; phase=runtime-start code=UNAVAILABLE.');
  assert.equal(await runGatewayBootstrap({owner:()=>{},loadStarter:async()=>({startGateway:async()=>{}}),
    logger:{info:()=>{},error:()=>assert.fail('unexpected failure')}}),true);
});

test('unknown owners, non-directories, alternate mounts and unexpected runtime identities fail closed',()=>{
  for(const options of [{owner:77},{directory:false},{uid:77},{env:{OPENCLAW_STATE_DIR:'/other'}},
    {uid:1000,gid:1000,owner:0,groups:[1000]},{uid:1000,gid:1000,owner:1000,groups:[0]}]) {
    const f=fixture(options);assert.throws(()=>prepareGatewayOwner(f),/gateway_mount_owner_unavailable/);
    assert.equal(f.calls.some(([name])=>name==='chown'),false);
    if(f.calls.some(([name])=>name==='open'))assert.equal(f.closed(),true);
  }
});

test('ownership failures close the descriptor and privilege-drop failures stop startup',()=>{
  for(const failure of ['stat','chown','groups','gid','uid']) {
    const f=fixture({failure});assert.throws(()=>prepareGatewayOwner(f),/PRIVATE/);
    assert.equal(f.closed(),true);
    if(['stat','chown'].includes(failure))assert.equal(f.calls.some(([name])=>name==='uid'),false);
  }
  const f=fixture();f.system.setuid=()=>{};assert.throws(()=>prepareGatewayOwner(f),/gateway_mount_owner_unavailable/);
});

test('Docker runs a root-owned bootstrap and imports the existing starter only after privilege drop',()=>{
  const docker=readFileSync(new URL('./Dockerfile.gateway',import.meta.url),'utf8');
  const source=readFileSync(new URL('./gateway-bootstrap.mjs',import.meta.url),'utf8');
  assert.match(docker,/COPY --chown=root:root --chmod=0444 deploy\/gateway-bootstrap\.mjs/);
  assert.match(docker,/RUN mkdir -p \/data\/openclaw \/opt\/croupier-gateway && chown node:node \/data\/openclaw\r?\n/);
  assert.match(docker,/RUN chown root:root \/opt\/croupier-gateway && chmod 0755 \/opt\/croupier-gateway/);
  assert.doesNotMatch(docker,/chown -R|chown node:node \/opt/);
  assert.deepEqual(JSON.parse(docker.match(/^CMD (.+)$/m)[1]),['node','/opt/croupier-gateway/gateway-bootstrap.mjs']);
  assert.ok(source.indexOf('owner();')<source.indexOf('await loadStarter();'));
  assert.doesNotMatch(source,/chmod|recursive|readFile|process\.env\./);
  assert.match(source,/O_NOFOLLOW/);
});
