import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createServer as createHTTPServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WebSocket} from 'ws';

test('actual HTTP and WebSocket routes enforce the public/trusted boundary',{timeout:15000},async()=>{
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const dir=mkdtempSync(join(tmpdir(),'astrid-http-safe-')),base=`http://127.0.0.1:${port}`;
 const designServer=createHTTPServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({schema:1,brand:'scout',revision:'test-published-v1',theme:{primary:'#D6FF3A'}}));});await new Promise(r=>designServer.listen(0,'127.0.0.1',r));
 const child=spawn(process.execPath,['server/server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),BO_DESIGN_URL:`http://127.0.0.1:${designServer.address().port}`,BIND_HOST:'127.0.0.1',TABLE_DB:join(dir,'test.db'),API_TOKEN:'test-only-token',GAME_AUDIT_TOKEN:'audit-test-token',DEALER_LLM_PROVIDER:'gemini',RUNPOD_API_KEY:'local-qa-disabled',RUNPOD_ENDPOINT_ID:'disabled',CARTESIA_API_KEY:'disabled',GEMINI_API_KEY:'disabled',SESSION_URL:''},stdio:'ignore'});
 let ws;
 try{
  let ready=false;for(let i=0;i<60;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,50));}assert.ok(ready);
  const health=await fetch(base+'/api/health');assert.deepEqual(await health.json(),{ok:true,demo:true});assert.ok(health.headers.get('content-security-policy').includes("frame-ancestors 'self'"));
  const themeResponse=await fetch(base+'/api/presentation?brand=scout');assert.equal(themeResponse.status,200);assert.equal((await themeResponse.json()).theme.primary,'#D6FF3A');
  assert.equal((await fetch(base+'/api/presentation?brand=scout',{headers:{'If-None-Match':themeResponse.headers.get('etag')}})).status,304);
  assert.equal((await fetch(base+'/api/presentation?brand=invalid')).status,503);
  for(const route of ['speak','chat','event'])assert.equal((await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Place more bets',id:'win'})})).status,401);
  assert.equal((await fetch(base+'/api/table',{method:'POST',headers:{Origin:'https://evil.test'},body:'{}'})).status,403);
  assert.equal((await fetch(base+'/api/table',{method:'POST',body:JSON.stringify({op:'refill',requestId:'bypass'})})).status,400);
  const state=await fetch(base+'/api/table',{method:'POST',body:JSON.stringify({session:'test',op:'state'})});assert.equal(state.status,200);assert.ok(state.headers.get('set-cookie').includes('astrid_guest='));assert.ok(state.headers.get('set-cookie').includes('HttpOnly'));
  assert.equal((await fetch(base+'/api/internal/game-audit/integration')).status,401);
  const integration=await fetch(base+'/api/internal/game-audit/integration?room=test',{headers:{Authorization:'Bearer audit-test-token'}});
  assert.equal(integration.status,200);const graph=await integration.json();assert.ok(graph.index.nodes.some(n=>n.id==='openclaw'));assert.ok(graph.events.every(e=>!Object.hasOwn(e,'payload')));
  const cookie=state.headers.get('set-cookie').split(';')[0];
  const resumed=await fetch(base+'/api/table',{method:'POST',headers:{Cookie:cookie},body:JSON.stringify({session:'test',op:'state'})});assert.equal(resumed.status,200);assert.equal(resumed.headers.get('set-cookie'),null);
  const malformed=await fetch(base+'/api/table',{method:'POST',headers:{Cookie:'astrid_guest=invalid'},body:JSON.stringify({session:'test',op:'state'})});assert.equal(malformed.status,200);assert.match(malformed.headers.get('set-cookie'),/astrid_guest=[a-f0-9]{64}/);
  assert.equal((await fetch(base+'/answers/.sessioner.json')).status,404);
  assert.equal((await fetch(base+'/api/speak',{method:'POST',headers:{Authorization:'Bearer test-only-token'},body:JSON.stringify({text:'Double your bet'})})).status,503);
  ws=new WebSocket(base.replace('http','ws')+'/?session=test',{headers:{Origin:base}});
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  const notice=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('No rejection notice')),2000);ws.on('message',b=>{const m=JSON.parse(b);if(m.t==='notice'){clearTimeout(timeout);resolve(m);}});});
  ws.send(JSON.stringify({t:'event',id:'win'}));assert.match((await notice).text,/controlled by the game server/);
  assert.equal((await fetch(base+'/demo-information.html')).status,200);
 }finally{await new Promise(r=>designServer.close(r));ws?.terminate();child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!=null)resolve();else child.once('exit',resolve);});rmSync(dir,{recursive:true,force:true});}
});
