import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareGatewayOwner } from './gateway-bootstrap.mjs';

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
  assert.ok(source.indexOf('prepareGatewayOwner();')<source.indexOf("await import('./start-gateway.mjs')"));
  assert.doesNotMatch(source,/chmod|recursive|readFile|process\.env\./);
  assert.match(source,/O_NOFOLLOW/);
});
