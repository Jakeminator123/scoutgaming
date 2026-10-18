import test from 'node:test';
import assert from 'node:assert/strict';
import {createMovingSpeechSourceSet} from '../services/game/moving-speech-bank.mjs';
import {createMovingBankDownloads,validateMovingBankArtifacts,movingBankStorageOptions} from '../services/game/moving-speech-bank-artifacts.mjs';
const id='11111111-1111-1111-1111-111111111111',hash='a'.repeat(64);
const sourceSet=createMovingSpeechSourceSet({dealerId:'dragan',clips:[{videoId:id,sha256:hash,bytes:20,fps:24,frameCount:24,width:1080,height:1920}],rest:{videoId:id,frame:0}});
const record=(extension,contentType)=>({provider:'vercel-blob',pathname:`croupier/media/dealers/dragan/runtime/moving-bank/${id}/${hash}.${extension}`,sha256:hash,size:20,contentType});
const bank={schemaVersion:1,sourceSet,archive:record('bin','application/octet-stream'),receipt:record('json','application/json')};
test('bank identity cannot cross dealer, source-set or artifact types',()=>{
  assert.equal(validateMovingBankArtifacts(bank).sourceSet.dealerId,'dragan');
  for(const mutate of [v=>v.sourceSet.sourceSetSha256='b'.repeat(64),v=>v.archive.pathname=v.archive.pathname.replace('/dragan/','/paow/'),v=>v.receipt.size=131073]){
    const changed=structuredClone(bank);mutate(changed);assert.throws(()=>validateMovingBankArtifacts(changed));
  }
});
test('short-lived exact-file capability checks auth, expiry, abort and full byte response',async()=>{
  const controller=new AbortController();let at=1000,allowed=true,reads=0;
  const service=createMovingBankDownloads({origin:'https://game.example',bank,now:()=>at,read:async(r)=>{
    reads++;return new Response(new Uint8Array(r.size),{headers:{'content-length':String(r.size)}});}});
  const issued=service.issue({signal:controller.signal,authorize:async()=>{if(!allowed)throw Error('revoked');},ttlMs:1000});
  assert.equal((await service.response(new Request(issued.descriptor.archive.url))).status,200);
  for(const request of [new Request(issued.descriptor.archive.url,{headers:{range:'bytes=0-1'}}),new Request(issued.descriptor.archive.url+'?x=1'),new Request(issued.descriptor.archive.url,{headers:{origin:'https://game.example'}})])assert.equal((await service.response(request)).status,403);
  allowed=false;assert.equal((await service.response(new Request(issued.descriptor.receipt.url))).status,403);
  allowed=true;at=2000;assert.equal((await service.response(new Request(issued.descriptor.receipt.url))).status,403);
  assert.equal(reads,1);
  const second=service.issue({signal:controller.signal,authorize:async()=>{}});controller.abort();
  assert.equal((await service.response(new Request(second.descriptor.archive.url))).status,403);service.close();
});
test('partial, compressed or truncated bank responses never reach worker',async()=>{
  for(const response of [()=>new Response(null,{status:206}),()=>new Response('x',{headers:{'content-length':'1'}}),()=>new Response('x',{headers:{'content-length':'20','content-encoding':'gzip'}})]){
    const controller=new AbortController(),service=createMovingBankDownloads({origin:'https://game.example',bank,read:async()=>response()});
    const issued=service.issue({signal:controller.signal,authorize:async()=>{}});
    assert.equal((await service.response(new Request(issued.descriptor.archive.url))).status,503);controller.abort();service.close();
  }
});

test('abort while read is pending returns denied promptly and cancels a late body',async()=>{
  const job=new AbortController();let release,started,cancelled=false,seenSignal;
  const reading=new Promise(resolve=>started=resolve);
  const service=createMovingBankDownloads({origin:'https://game.example',bank,read:async(_record,request)=>{
    seenSignal=request.signal;started();await new Promise(resolve=>release=resolve);
    return new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-length':'20'}});
  }});
  const capability=service.issue({signal:job.signal,authorize:async()=>{}});
  const pending=service.response(new Request(capability.descriptor.archive.url));await reading;
  job.abort();assert.equal((await pending).status,403);assert.equal(seenSignal.aborted,true);
  release();await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,true);service.close();
});

test('abort, explicit revoke, close and request disconnect cancel an already streaming body',async()=>{
  for(const mode of ['job','revoke','close','request']){
    const job=new AbortController(),request=new AbortController();let source,cancelled=false;
    const service=createMovingBankDownloads({origin:'https://game.example',bank,read:async()=>new Response(new ReadableStream({
      start(controller){source=controller;},cancel(){cancelled=true;},
    }),{headers:{'content-length':'20'}})});
    const capability=service.issue({signal:job.signal,authorize:async()=>{}});
    const response=await service.response(new Request(capability.descriptor.archive.url,{signal:request.signal}));
    const reader=response.body.getReader();source.enqueue(new Uint8Array(10));assert.equal((await reader.read()).value.length,10);
    const next=reader.read();
    if(mode==='job')job.abort();else if(mode==='revoke')capability.revoke();else if(mode==='close')service.close();else request.abort();
    await assert.rejects(next);assert.equal(cancelled,true,mode);service.close();
  }
});

test('capability deadline cancels a stalled response body without waiting for another chunk',{timeout:2500},async()=>{
  const job=new AbortController();let cancelled=false;
  const service=createMovingBankDownloads({origin:'https://game.example',bank,read:async()=>new Response(new ReadableStream({
    cancel(){cancelled=true;},
  }),{headers:{'content-length':'20'}})});
  const capability=service.issue({signal:job.signal,authorize:async()=>{},ttlMs:1000});
  const response=await service.response(new Request(capability.descriptor.archive.url));
  try {await assert.rejects(response.arrayBuffer());assert.equal(cancelled,true);
    assert.equal((await service.response(new Request(capability.descriptor.receipt.url))).status,403);
  }finally{service.close();}
});

test('streamed byte count must equal the announced immutable artifact size',async()=>{
  for(const size of [19,21]){
    const job=new AbortController(),service=createMovingBankDownloads({origin:'https://game.example',bank,
      read:async()=>new Response(new Uint8Array(size),{headers:{'content-length':'20'}})});
    const capability=service.issue({signal:job.signal,authorize:async()=>{}});
    const response=await service.response(new Request(capability.descriptor.archive.url));
    await assert.rejects(response.arrayBuffer(),/moving_bank_artifacts_invalid/);service.close();
  }
});

test('moving-bank storage requests identity without changing the shared client or caller options',async()=>{
  const abort=new AbortController(),result={stream:'unchanged'},head=()=>{};
  let captured;
  const get=function(pathname,options){assert.equal(this,client);captured={pathname,options};return Promise.resolve(result);};
  const client=Object.freeze({get,head}),storage=movingBankStorageOptions(client);
  assert.notEqual(storage.blobClient,client);assert.equal(client.get,get);assert.equal(storage.blobClient.head,head);
  for(const headers of [Object.freeze({'Accept-Encoding':'br','X-Bank-Probe':'kept'}),
    new Headers({'accept-encoding':'br','x-bank-probe':'kept'}),
    Object.freeze([['Accept-Encoding','br'],['X-Bank-Probe','kept']])]){
    const options=Object.freeze({access:'private',token:'test-only-token',abortSignal:abort.signal,useCache:false,ifNoneMatch:'etag',headers});
    assert.equal(await storage.blobClient.get(bank.archive.pathname,options),result);
    assert.equal(captured.pathname,bank.archive.pathname);
    assert.deepEqual({...captured.options,headers},options);
    assert.equal(captured.options.abortSignal,abort.signal);
    assert.equal(captured.options.headers['accept-encoding'],'identity');
    assert.equal(captured.options.headers['x-bank-probe'],'kept');
    assert.equal(new Headers(headers).get('accept-encoding'),'br');
    assert.equal(client.get,get);
  }
  abort.abort();assert.equal(captured.options.abortSignal.aborted,true);
});


test('bank transfer survives the measured cold start, then expires or revokes without extending its deadline',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1000000});
  const abort=new AbortController();let reads=0;
  const service=createMovingBankDownloads({origin:'https://game.example',bank,read:async r=>{
    reads++;return new Response(new Uint8Array(r.size),{headers:{'content-length':String(r.size)}});}});
  t.after(()=>service.close());
  const issued=service.issue({signal:abort.signal,authorize:async()=>{}});
  t.mock.timers.tick(296000);
  const late=await service.response(new Request(issued.descriptor.archive.url));assert.equal(late.status,200);await late.arrayBuffer();
  t.mock.timers.tick(184000);
  assert.equal((await service.response(new Request(issued.descriptor.receipt.url))).status,403);assert.equal(reads,1);
  const next=service.issue({signal:abort.signal,authorize:async()=>{}});abort.abort();
  assert.equal((await service.response(new Request(next.descriptor.archive.url))).status,403);
});
