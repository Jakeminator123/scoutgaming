import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { issueDashboardHandoff } from './dashboard-handoff.mjs';
import { createSearchServer } from './companion-search-server.mjs';
const token='synthetic-bootstrap-token-'.repeat(2), now=Date.now();
const native = (extra={}) => ({ok:true,browserUrl:'http://127.0.0.1:18789/openclaw/#'+new URLSearchParams({bootstrapToken:token,bootstrapProfile:'owner',gatewayUrl:'ws://127.0.0.1:18789/openclaw'}),browserBootstrapExpiresAtMs:now+600000,gatewayPassword:'PRIVATE',url:'http://127.0.0.1/#token=PRIVATE',...extra});
const env={OPENCLAW_DASHBOARD_ORIGIN:'https://croupier-lab-director.onrender.com'};
test('only the official host-issued bootstrap reaches the client; legacy CLI secrets are discarded',async()=>{
 const result=await issueDashboardHandoff(env,{now:()=>now,execute:async(executable,args,options)=>{
  assert.equal(executable,process.execPath);assert.deepEqual(args,['/app/openclaw.mjs','dashboard','--json','--no-open']);
  assert.equal(options.env,env);assert.equal(options.timeout,20000);assert.equal(options.maxBuffer,32768);
  return {stdout:JSON.stringify(native())};
 }});
 assert.deepEqual(result,{bootstrapToken:token,expiresAtMs:now+600000});
});
test('failed, stale, foreign and malformed native output cannot expose secret stdout or stderr',async()=>{
 for(const value of [{ok:false},{browserBootstrapExpiresAtMs:now-1},{browserBootstrapExpiresAtMs:now+600001},{browserUrl:'https://foreign.invalid/#token=PRIVATE'}, {browserUrl:native().browserUrl+'&token=PRIVATE'}]) {
  await assert.rejects(issueDashboardHandoff(env,{now:()=>now,execute:async()=>({stdout:JSON.stringify(native(value))})}),/^Error: openclaw_dashboard_unavailable$/);
 }
 await assert.rejects(issueDashboardHandoff(env,{execute:async()=>{throw Error('PRIVATE_STDOUT_AND_STDERR');}}),/^Error: openclaw_dashboard_unavailable$/);
 await assert.rejects(issueDashboardHandoff({...env,OPENCLAW_DASHBOARD_ORIGIN:'https://foreign.invalid'}),/^Error: openclaw_dashboard_unavailable$/);
});
test('existing private helper requires credential, no browser origin, empty body and serial bounded issuance',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'dashboard-handoff-'));let calls=0,resolve;
 const server=createSearchServer({directory,key:'',token:'server-key',dashboardHandoff:async()=>{calls++;return calls===1?new Promise(r=>{resolve=r;}):{bootstrapToken:token,expiresAtMs:now+600000};}});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port+'/dashboard';
 const req=(headers={},body)=>fetch(url,{method:'POST',headers:{Authorization:'Bearer server-key',...headers},...(body?{body}:{})});
 assert.equal((await req({Authorization:'Bearer wrong'})).status,401);
 assert.equal((await req({origin:'https://site.invalid'})).status,400);
 assert.equal((await req({},'{}')).status,400);assert.equal(calls,0);
 const pending=req();while(!resolve)await new Promise(r=>setImmediate(r));
 assert.equal((await req()).status,429);assert.equal(calls,1);
 resolve({bootstrapToken:token,expiresAtMs:now+600000});assert.equal((await pending).status,200);
 for(let i=0;i<5;i++)assert.equal((await req()).status,200);
 assert.equal((await req()).status,429);
});
