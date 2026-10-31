import {EventEmitter} from 'node:events';
import {createServer} from 'node:http';
import {startChildren,waitForChild} from '../ops/cloud/process-group.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {startMovingSpeech,BANK_PREFLIGHT_MS} from '../services/game/speech-startup.mjs';
import {loadMovingBankArtifacts,movingBankStorageOptions} from '../services/game/moving-speech-bank-artifacts.mjs';
import {withVerifiedPrivateMediaFile} from '../services/game/blob-media.mjs';
import {createMovingSpeechSourceSet} from '../services/game/moving-speech-bank.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(t,{dealers=['dragan'],fault,beforeGet,onBodyCancel}={}) {
  const cacheDir=await mkdtemp(join(tmpdir(),'speech-startup-'));
  t.after(()=>rm(cacheDir,{recursive:true,force:true}));
  const files=new Map(),banks={},profiles=[],events=[];
  function record(dealerId,bytes,extension,contentType) {
    const sha256=hash(bytes),pathname=`croupier/media/dealers/${dealerId}/runtime/moving-bank/${randomUUID()}/${sha256}.${extension}`;
    const value={provider:'vercel-blob',pathname,sha256,size:bytes.length,contentType};
    files.set(pathname,{bytes,record:value});return value;
  }
  for (const dealerId of dealers) {
    const videoId=randomUUID(),sourceSet=createMovingSpeechSourceSet({dealerId,
      clips:[{videoId,sha256:hash('source'),bytes:20,fps:24,frameCount:24,width:1080,height:1920}],rest:{videoId,frame:0}});
    const archive=record(dealerId,Buffer.from('synthetic bank'),'bin','application/octet-stream');
    const receipt=record(dealerId,Buffer.from('{"verified":true}'),'json','application/json');
    banks[dealerId]=record(dealerId,Buffer.from(JSON.stringify({schemaVersion:1,sourceSet,archive,receipt})),'json','application/json');
    profiles.push({id:dealerId,label:dealerId,dealerId,endpointId:'endpoint'+dealerId,
      releaseDigest:hash('release'),bankHash:archive.sha256});
  }
  const env={PUBLIC_URL:'https://game.example.test',CROUPIER_MOVING_SPEECH_WORKER_ORIGIN:'https://worker.example.test',
    CROUPIER_MOVING_SPEECH_BANK_RECORDS:JSON.stringify(banks),CROUPIER_STUDIO_MOVING_DRIFT_API:'1',
    CROUPIER_STUDIO_MOVING_DRIFT_PROFILES:JSON.stringify(profiles),CROUPIER_MOVING_SPEECH_RELEASE_SHA256:hash('release')};
  const bankOptions={...movingBankStorageOptions({get:async(pathname,options)=>{
    if(beforeGet)await beforeGet(options);
    events.push('read');
    const entry=files.get(pathname);if(!entry)return null;
    if(fault==='missing'&&entry.record.contentType==='application/octet-stream')return null;
    if(fault==='timeout')throw new DOMException('synthetic private provider timeout','TimeoutError');
    const bytes=fault==='hash'&&entry.record.contentType==='application/octet-stream'?Buffer.alloc(entry.bytes.length):entry.bytes;
    return {statusCode:200,blob:{url:'https://fixture.private.blob.vercel-storage.com/'+pathname,pathname,
      size:entry.record.size,contentType:entry.record.contentType},stream:onBodyCancel
      ? new ReadableStream({start:controller=>controller.enqueue(bytes),cancel:onBodyCancel}) : new Response(bytes).body};
  }}),cacheDir,env:{BLOB_READ_WRITE_TOKEN:'synthetic-token'}};
  const input={env,loadBank:(record,{signal})=>loadMovingBankArtifacts(record,{...bankOptions,signal}),
    verifyFile:(record,{signal})=>withVerifiedPrivateMediaFile(record,async()=>true,{...bankOptions,signal}),
    createLane:async({dealerId})=>{events.push('create:'+dealerId);return {
      sessions:{reconcile:async()=>{events.push('reconcile:'+dealerId);return {unresolved:[]};}},
      start:()=>events.push('start:'+dealerId),close:async()=>events.push('close:'+dealerId)};},
    createService:async()=>{events.push('service');return {cancelDealer(){},close:async()=>events.push('close:service')};}};
  return {input,events,cacheDir,banks,profiles};
}

for (const fault of ['missing','hash','timeout']) test(`real bank reader rejects ${fault} before any provider lane`,async t=>{
  const {input,events,cacheDir}=await fixture(t,{fault});
  const result=await startMovingSpeech(input);
  assert.equal(result.status,'unavailable');assert.equal(result.service,null);
  assert.ok(events.length);assert.ok(events.every(event=>event==='read'));
  assert.equal((await readdir(cacheDir)).some(name=>name.endsWith('.part')),false);
  assert.equal(JSON.stringify(result).includes('synthetic'),false);
});

test('missing map, wrong dealer, bank/profile hash and invalid worker origin deny speech',async t=>{
  for (const mutate of [
    f=>f.input.env.CROUPIER_MOVING_SPEECH_BANK_RECORDS='null',
    f=>f.input.env.CROUPIER_MOVING_SPEECH_BANK_RECORDS=JSON.stringify({paow:f.banks.dragan}),
    f=>{f.profiles[0].bankHash=hash('wrong');f.input.env.CROUPIER_STUDIO_MOVING_DRIFT_PROFILES=JSON.stringify(f.profiles);},
    f=>f.input.env.CROUPIER_MOVING_SPEECH_WORKER_ORIGIN='http://wrong.example.test',
  ]) {
    const f=await fixture(t);mutate(f);const result=await startMovingSpeech(f.input);
    assert.equal(result.status,'unavailable');assert.equal(result.service,null);
    assert.ok(f.events.every(event=>event==='read'));
  }
});

test('all banks verify before journals, reconciliation and listeners; valid startup closes everything',async t=>{
  const {input,events}=await fixture(t,{dealers:['dragan','paow']});
  const result=await startMovingSpeech(input);assert.equal(result.status,'ready');
  assert.deepEqual(events.slice(6),['create:dragan','create:paow','reconcile:dragan','reconcile:paow','service','start:dragan','start:paow']);
  assert.deepEqual(events.slice(0,6),Array(6).fill('read'));
  await result.close();assert.deepEqual(events.slice(-3).sort(),['close:dragan','close:paow','close:service']);
});

test('second journal failure is fatal, closes prior lane, starts no provider work',async t=>{
  const {input,events}=await fixture(t,{dealers:['dragan','paow']});
  const create=input.createLane,failure=Object.assign(Error('synthetic database unavailable'),{code:'42P01'});
  input.createLane=async lane=>{if(lane.dealerId==='paow')throw failure;return create(lane);};
  await assert.rejects(startMovingSpeech(input),error=>error===failure);
  assert.equal(events.at(-1),'close:dragan');assert.ok(!events.some(event=>event.startsWith('reconcile:')||event.startsWith('start:')));
});

test('recovery and late startup failures close every acquired lane and listener',async t=>{
  for(const stage of ['recovery','start']) {
    const {input,events}=await fixture(t,{dealers:['dragan','paow']});
    const create=input.createLane,failure=Error('synthetic '+stage);
    input.createLane=async lane=>{const runtime=await create(lane);if(lane.dealerId==='paow') {
      if(stage==='recovery')runtime.sessions.reconcile=async()=>{throw failure;};
      else runtime.start=()=>{throw failure;};
    }return runtime;};
    await assert.rejects(startMovingSpeech(input),error=>error===failure);
    assert.ok(events.includes('close:dragan'));assert.ok(events.includes('close:paow'));
    assert.equal(events.includes('close:service'),stage==='start');
  }
});

test('unexpected artifact programming error and mandatory public origin remain fatal',async t=>{
  const {input}=await fixture(t),failure=new TypeError('synthetic programming failure');
  input.loadBank=async()=>{throw failure;};
  await assert.rejects(startMovingSpeech(input),error=>error===failure);
  input.env.PUBLIC_URL='invalid';await assert.rejects(startMovingSpeech(input),/PUBLIC_URL/);
});


test('hanging real Blob read degrades within one bank budget and cannot create late provider resources', {timeout:10000}, async t=>{
  let release,started,seenSignal,bodyCancelled=false;
  const began=new Promise(resolve=>started=resolve),hold=new Promise(resolve=>release=resolve);
  const f=await fixture(t,{beforeGet:async({abortSignal})=>{seenSignal=abortSignal;started();await hold;},onBodyCancel:()=>{bodyCancelled=true;}});
  let settled;const readFinished=new Promise(resolve=>settled=resolve);
  const load=f.input.loadBank;f.input.loadBank=(...args)=>load(...args).finally(settled);
  const pending=startMovingSpeech({...f.input,bankTimeoutMs:100});
  await began;
  const result=await pending;
  assert.equal(result.reason,'bank_preflight_timeout');assert.equal(result.service,null);
  assert.equal(seenSignal.aborted,true);
  release();
  // Observe the real reader finishing after cancellation, including its late body cleanup.
  await readFinished;
  assert.deepEqual(f.events,['read']);assert.equal(bodyCancelled,true);
  assert.deepEqual(await readdir(f.cacheDir),[]);
});

test('deadline is shared by manifest, archive and receipt, not restarted for every read', {timeout:10000},async t=>{
  const f=await fixture(t);let calls=0;
  const load=f.input.loadBank,verify=f.input.verifyFile;
  f.input.loadBank=async(...args)=>{calls++;await new Promise(resolve=>setTimeout(resolve,60));return load(...args);};
  f.input.verifyFile=async(...args)=>{calls++;await new Promise(resolve=>setTimeout(resolve,60));return verify(...args);};
  const result=await startMovingSpeech({...f.input,bankTimeoutMs:100});
  assert.equal(result.reason,'bank_preflight_timeout');assert.ok(calls<=2);
  await new Promise(resolve=>setTimeout(resolve,100));
  assert.ok(f.events.every(event=>event==='read'));
});

test('production bank deadline leaves margin to actual supervisor readiness and hanging work cannot stop game admission', {timeout:15000},async t=>{
  const f=await fixture(t);let signal,release;
  const held=new Promise(resolve=>release=resolve);
  f.input.loadBank=async(_record,options)=>{signal=options.signal;await held;return {};};
  const child=new EventEmitter();child.pid=42;child.exitCode=null;child.signalCode=null;
  child.kill=()=>{child.signalCode='SIGTERM';queueMicrotask(()=>child.emit('close'));};
  let ready=false,budget;
  const server=createServer((_request,response)=>{response.writeHead(ready?200:503);response.end();});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{release();server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
  const began=performance.now();
  const initialized=startMovingSpeech(f.input).then(result=>{assert.equal(result.reason,'bank_preflight_timeout');ready=true;return result;});
  const group=await startChildren({web:{command:'synthetic',args:[],env:{}}},{
    portCheck:async()=>{},spawnProcess:()=>child,
    wait:async(process,_url,accept,timeoutMs)=>{
      budget=timeoutMs;
      assert.ok(BANK_PREFLIGHT_MS<=timeoutMs/6,'one complete bank preflight consumes at most one sixth of supervisor budget');
      await waitForChild(process,`http://127.0.0.1:${server.address().port}/api/auth/access`,accept,timeoutMs);
    },
  });
  await initialized;
  assert.equal(budget,30000);assert.ok(performance.now()-began<budget/2);
  assert.equal(signal.aborted,true);assert.deepEqual(f.events,[]);
  release();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(f.events,[]);await group.stop();
});
