import test from 'node:test';
import assert from 'node:assert/strict';
import {createMovingSpeechRunPod} from '../web/moving-speech-runpod.mjs';
const image='ghcr.io/jakeminator123/moving-gpu-worker@sha256:'+'a'.repeat(64);
const endpoint={id:'owned123',workersMin:0,workersMax:1,idleTimeout:5,executionTimeoutMs:180000,gpuCount:1,version:0,workers:[],templateId:'template123',template:{id:'template123',imageName:image}};
const create=(fetchImpl)=>createMovingSpeechRunPod({endpointId:'owned123',apiKey:'test-credential',expectedImage:image,fetchImpl});
test('fresh endpoint gates pin owned digest, zero minimum, maximum one and actual worker version',async()=>{
  let data=structuredClone(endpoint);
  const client=create(async(url,opts)=>{assert.ok(url.endsWith('includeWorkers=true') || url==='https://rest.runpod.io/v1/templates/template123');assert.equal(opts.redirect,'error');return Response.json(url.includes('/templates/')?endpoint.template:data);});
  assert.equal((await client.release()).workers.endpointVersion,0);
  data.workers=[{imageName:image,slsVersion:0}];assert.equal((await client.release()).workers.workers[0].isStale,false);
  for(const change of [{workersMin:1},{workersMax:2},{idleTimeout:undefined},{idleTimeout:null},{idleTimeout:-1},{idleTimeout:6},{executionTimeoutMs:600000},{template:{imageName:'other'}},{workers:[{image:image,slsVersion:1}]}]){
    data={...structuredClone(endpoint),...change};await assert.rejects(client.release());
  }
});
test('lost paid submission is not retried; job policy remains bounded',async()=>{
  let calls=0,sent;
  const client=create(async(url,opts)=>{calls++;sent={url,body:JSON.parse(opts.body)};throw Error('lost response');});
  await assert.rejects(client.submit({input:{binding:{}}}));assert.equal(calls,1);
  assert.deepEqual(sent.body.policy,{executionTimeout:180000,ttl:540000});
  assert.equal(sent.url,'https://api.runpod.ai/v2/owned123/run');
});
test('another job cannot release the admitted job, and health failures are not zero workers',async()=>{
  let data={id:'other',status:'COMPLETED'};const client=create(async()=>Response.json(data));
  await assert.rejects(client.status({jobId:'ours'}),/job_mismatch/);await assert.rejects(client.cancel({jobId:'ours'}),/job_mismatch/);
  data={id:'ours',status:'COMPLETED'};assert.equal((await client.status({jobId:'ours'})).status,'COMPLETED');
  data=health();
  assert.deepEqual(await client.workerState(),{workers:0,busy:0,available:0,unhealthy:0,cached:{idle:0,ready:0},
    scaledDown:{idle:0,initializing:0,throttled:0},raw:health()});
  delete data.workers.ready;await assert.rejects(client.workerState(),/state_unknown/);
  data=health();delete data.jobs;await assert.rejects(client.workerState(),/state_unknown/);
  data=health();delete data.jobs.inProgress;await assert.rejects(client.workerState(),/state_unknown/);
});

const health=(workers={},jobs={})=>({workers:{idle:0,running:0,initializing:0,ready:0,throttled:0,unhealthy:0,...workers},
  jobs:{completed:0,failed:0,inProgress:0,inQueue:0,retried:0,...jobs}});
const drained=state=>state.workers===0&&state.busy===0&&state.available===0;

test('health classifies scaled-down slots as free capacity and running or unhealthy as occupied',async()=>{
  let data;const client=create(async()=>Response.json(data));
  // Cached/pulling/throttled slots are unbilled and must not block a reservation.
  data=health({idle:1,initializing:1,throttled:1});
  assert.deepEqual(await client.workerState(),{workers:0,busy:0,available:0,unhealthy:0,cached:{idle:1,ready:0},
    scaledDown:{idle:1,initializing:1,throttled:1},raw:data});
  data=health({running:1},{inQueue:1});
  assert.deepEqual(await client.workerState(),{workers:1,busy:1,available:1,unhealthy:0,cached:{idle:0,ready:0},
    scaledDown:{idle:0,initializing:0,throttled:0},raw:data});
  data=health({running:1},{inProgress:1});
  const processing=await client.workerState();assert.equal(processing.busy,1);assert.equal(processing.available,0);assert.equal(drained(processing),false);
  data=health({unhealthy:1});
  const unhealthy=await client.workerState();assert.equal(unhealthy.workers,1);assert.equal(drained(unhealthy),false);
  for(const bad of [{idle:-1},{running:'1'},{ready:1.5}]){data=health(bad);await assert.rejects(client.workerState(),/state_unknown/);}
  for(const bad of [{inProgress:-1},{inQueue:'0'}]){data=health({},bad);await assert.rejects(client.workerState(),/state_unknown/);}
});

test('a cached ready slot left by an earlier session counts as drained so reservation and recovery proceed',async()=>{
  let data;const client=create(async()=>Response.json(data));
  // After a job completes and the worker scales down, the provider keeps the
  // image cached and reports the slot as idle and ready. Nothing is started.
  data=health({idle:1,ready:1});
  const cached=await client.workerState();
  assert.equal(drained(cached),true);assert.deepEqual(cached.cached,{idle:1,ready:1});assert.deepEqual(cached.raw,data);
  // The same slot once started is running again and blocks until it drains.
  data=health({running:1,ready:1});
  const started=await client.workerState();assert.equal(started.busy,1);assert.equal(drained(started),false);
  // A ready counter that exceeds the started workers never blocks on its own.
  data=health({ready:3});assert.equal(drained(await client.workerState()),true);
  // Unhealthy beside a cached slot is still uncertain and blocks.
  data=health({idle:1,ready:1,unhealthy:1});assert.equal(drained(await client.workerState()),false);
});

test('worker records: RUNNING occupies the GPU, EXITED is a free cached slot, unknown status counts as occupied',async()=>{
  const running={id:'w1',imageName:image,slsVersion:0,desiredStatus:'RUNNING'},exited={id:'w2',imageName:image,slsVersion:0,desiredStatus:'EXITED'};
  let data={...structuredClone(endpoint),workers:[running,exited]};
  const client=create(async url=>Response.json(url.includes('/templates/')?endpoint.template:data));
  // The stopped trial on 2026-10-17 saw exactly this shape with max1 and failed on record count.
  let receipt=await client.release();
  assert.deepEqual(receipt.workers.counts,{active:1,scaledDown:1,terminated:0,total:2});
  assert.deepEqual(receipt.workers.workers.map(w=>w.state),['active','scaled-down']);
  data={...structuredClone(endpoint),workers:[running,{...running,id:'w3'}]};
  await assert.rejects(client.release(),/moving_runpod_active_workers_exceeded/);
  data={...structuredClone(endpoint),workers:[exited,{...exited,id:'w3'},{...exited,id:'w4'}]};
  receipt=await client.release();assert.equal(receipt.workers.counts.scaledDown,3);
  data={...structuredClone(endpoint),workers:[exited,{...exited,id:'w3'},{...exited,id:'w4'},{...exited,id:'w5'}]};
  await assert.rejects(client.release(),/moving_runpod_workers_unknown/);
  data={...structuredClone(endpoint),workers:[{...exited,desiredStatus:'PAUSED'},running]};
  await assert.rejects(client.release(),/moving_runpod_active_workers_exceeded/);
  data={...structuredClone(endpoint),workers:[{...exited,desiredStatus:'TERMINATED'},running]};
  receipt=await client.release();assert.deepEqual(receipt.workers.counts,{active:1,scaledDown:0,terminated:1,total:2});
});

test('outdated image or version fails only for records that occupy a GPU',async()=>{
  let data;const client=create(async url=>Response.json(url.includes('/templates/')?endpoint.template:data));
  data={...structuredClone(endpoint),version:3,workers:[{id:'old',imageName:image,slsVersion:2,desiredStatus:'EXITED'}]};
  const receipt=await client.release();
  assert.deepEqual(receipt.workers.workers,[{image,version:2,isStale:true,state:'scaled-down'}]);
  data={...structuredClone(endpoint),version:3,workers:[{id:'old',imageName:image,slsVersion:2,desiredStatus:'RUNNING'}]};
  await assert.rejects(client.release(),/moving_worker_release_mismatch/);
  data={...structuredClone(endpoint),version:3,workers:[{id:'old',imageName:'foreign-image',slsVersion:3,desiredStatus:'RUNNING'}]};
  await assert.rejects(client.release(),/moving_worker_release_mismatch/);
  data={...structuredClone(endpoint),version:3,workers:[{id:'old',imageName:'foreign-image',slsVersion:3,desiredStatus:'EXITED'}]};
  assert.equal((await client.release()).workers.workers[0].isStale,true);
  for(const version of [undefined,null,-1,'0']){data={...structuredClone(endpoint),version,workers:[]};await assert.rejects(client.release(),/moving_runpod_workers_unknown/);}
});


test('omitted workers needs a fresh empty pods read scoped to the exact endpoint on every release',async()=>{
  const data=structuredClone(endpoint);delete data.workers;
  const calls=[];const client=create(async(url,opts)=>{
    calls.push(url);assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');
    if(url.includes('/endpoints/'))return Response.json(data);
    if(url==='https://rest.runpod.io/v1/templates/template123')return Response.json(endpoint.template);
    assert.equal(url,'https://rest.runpod.io/v1/pods?endpointId=owned123&includeWorkers=true');return Response.json([]);
  });
  for(let i=0;i<2;i++){
    const receipt=await client.release();assert.deepEqual(receipt.workers.workers,[]);
    assert.equal(receipt.workersCorroboration.source,'owned-endpoint-pods');assert.equal(receipt.workersCorroboration.endpointId,'owned123');
    assert.equal(receipt.workersCorroboration.count,0);assert.ok(Number.isSafeInteger(receipt.workersCorroboration.observedAtMs));
    assert.equal(calls.length,(i+1)*3);
  }
  assert.equal(Object.hasOwn(data,'workers'),false);
});

test('omitted workers with live malformed or failed pods never produces a release receipt',async()=>{
  const data=structuredClone(endpoint);delete data.workers;
  for(const pods of [[{id:'some-worker'}],null,{},'unknown']){
    let calls=0;const client=create(async url=>{calls++;return Response.json(url.includes('/endpoints/')?data:pods);});
    await assert.rejects(client.release(),/moving_runpod_workers_unknown/);assert.equal(calls,2);
  }
  for(const failure of ['network','http','invalid-json']){
    let calls=0;const client=create(async url=>{
      calls++;if(url.includes('/endpoints/'))return Response.json(data);
      if(failure==='network')throw Error('network unavailable');
      return new Response(failure==='invalid-json'?'not-json':null,{status:failure==='http'?503:200});
    });
    await assert.rejects(client.release());assert.equal(calls,2);
  }
});

test('explicit null or malformed workers and wrong endpoint identity never trigger the fallback',async()=>{
  for(const change of [{workers:null},{workers:{}},{workers:'unknown'},{id:'other123',workers:undefined}]){
    let calls=0;const data={...structuredClone(endpoint),...change};
    const client=create(async url=>{calls++;assert.ok(url.includes('/endpoints/'));return Response.json(data);});
    await assert.rejects(client.release(),/moving_runpod_limits_changed/);assert.equal(calls,1);
  }
  let calls=0;const client=create(async url=>{calls++;return Response.json(url.includes('/templates/')?endpoint.template:endpoint);});
  const receipt=await client.release();assert.equal(calls,2);assert.equal(receipt.workersCorroboration,undefined);
});

test('cancellation propagates to the omitted-workers corroboration request',async()=>{
  const data=structuredClone(endpoint);delete data.workers;
  const abort=new AbortController();let calls=0;
  const client=create(async(url,opts)=>{
    calls++;if(url.includes('/endpoints/'))return Response.json(data);
    abort.abort();assert.equal(opts.signal.aborted,true);opts.signal.throwIfAborted();
  });
  await assert.rejects(client.release({signal:abort.signal}),error=>error.name==='AbortError');assert.equal(calls,2);
});


test('partial embedded template uses a fresh full GET with exact template ID and image',async()=>{
  for(const embedded of [undefined,{}, {id:'template123'}, {imageName:image}]){
    const data=structuredClone(endpoint);if(embedded===undefined)delete data.template;else data.template=embedded;
    let reads=0;const client=create(async(url,opts)=>{
      assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');
      if(url.includes('/endpoints/'))return Response.json(data);
      assert.equal(url,'https://rest.runpod.io/v1/templates/template123');reads++;return Response.json(endpoint.template);
    });
    const result=await client.release();await client.release();assert.equal(reads,2);
    assert.equal(result.endpoint.image,image);assert.equal(result.templateCorroboration.templateId,'template123');
    assert.equal(result.templateCorroboration.source,'full-template');
  }
});

test('partial template handling never hides explicit conflicts or missing full template proof',async()=>{
  for(const [embedded,full] of [[{id:'foreign-template'},endpoint.template],[{imageName:'untrusted:latest'},endpoint.template],
    [null,endpoint.template],[[],endpoint.template],[{},{}],[{},null],[{},{id:'foreign-template',imageName:image}],
    [{},{id:'template123',imageName:'untrusted:latest'}]]){
    const data={...structuredClone(endpoint),template:embedded};
    const client=create(async url=>Response.json(url.includes('/endpoints/')?data:full));
    await assert.rejects(client.release(),/moving_runpod_template_unverified/);
  }
  for(const templateId of [undefined,null,'../foreign']){
    let calls=0;const client=create(async()=>{calls++;return Response.json({...endpoint,templateId});});
    await assert.rejects(client.release(),/moving_runpod_template_unverified/);assert.equal(calls,1);
  }
});

test('failure or cancellation of full template read cannot produce a release receipt',async()=>{
  for(const kind of ['http','network','abort']){
    const abort=new AbortController();let calls=0;
    const client=create(async(url,opts)=>{
      calls++;if(url.includes('/endpoints/'))return Response.json(endpoint);
      if(kind==='http')return new Response(null,{status:503});
      if(kind==='abort'){abort.abort();assert.equal(opts.signal.aborted,true);opts.signal.throwIfAborted();}
      throw Error('unavailable');
    });
    await assert.rejects(client.release({signal:abort.signal}));assert.equal(calls,2);
  }
});

const fallbackPod=(changes={})=>({id:'worker123',endpointId:'owned123',templateId:'template123',image,slsVersion:0,...changes});
function fallbackClient({pods=[fallbackPod()],change={},full=endpoint.template}={}) {
  const data={...structuredClone(endpoint),...change};delete data.workers;
  const calls=[];const client=create(async(url,options)=>{
    calls.push(url);assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
    if(url==='https://rest.runpod.io/v1/endpoints/owned123?includeTemplate=true&includeWorkers=true')return Response.json(data);
    if(url==='https://rest.runpod.io/v1/templates/template123')return Response.json(full);
    assert.equal(url,'https://rest.runpod.io/v1/pods?endpointId=owned123&includeWorkers=true');return Response.json(pods);
  });
  return {client,calls,data,pods};
}
test('omitted workers accepts a fresh owned live pod without submitting a job',async()=>{
  const f=fallbackClient();
  for(let i=0;i<2;i++){
    const receipt=await f.client.release();
    assert.deepEqual(receipt.workers.workers,[{image,version:0,isStale:false,state:'unknown'}]);
    assert.equal(receipt.workersCorroboration.count,1);assert.equal(f.calls.length,(i+1)*3);
  }
  f.pods[0].slsVersion=1;await assert.rejects(f.client.release(),/moving_worker_release_mismatch/);
});
test('live fallback refuses unknown foreign or malformed pod ownership',async()=>{
  for(const pod of [null,[],{},fallbackPod({id:123456}),fallbackPod({endpointId:undefined}),fallbackPod({endpointId:'foreign123'}),
    fallbackPod({templateId:undefined}),fallbackPod({templateId:'foreign123'})]){
    const f=fallbackClient({pods:[pod]});await assert.rejects(f.client.release(),/moving_runpod_workers_unknown/);
  }
});
test('live fallback retains exact image version and full template release gates',async()=>{
  for(const pod of [fallbackPod({image:undefined}),fallbackPod({image:'foreign-image'}),fallbackPod({image:null,imageName:image}),
    fallbackPod({imageName:'foreign-image'}),fallbackPod({slsVersion:null}),fallbackPod({slsVersion:'0'}),fallbackPod({slsVersion:1})]){
    await assert.rejects(fallbackClient({pods:[pod]}).client.release(),/moving_worker_release_mismatch/);
  }
  for(const change of [{version:null},{version:'0'},{version:-1}])await assert.rejects(fallbackClient({change}).client.release());
  for(const full of [null,{}, {id:'foreign123',imageName:image},{id:'template123',imageName:'foreign-image'}]){
    await assert.rejects(fallbackClient({full}).client.release(),/moving_runpod_template_unverified/);
  }
  const pod=fallbackPod({imageName:image});delete pod.image;
  assert.equal((await fallbackClient({pods:[pod]}).client.release()).workers.workers.length,1);
});
test('fallback cannot admit a stopped endpoint or multiple workers beyond max1',async()=>{
  for(const pods of [[],[fallbackPod()]]){
    const f=fallbackClient({pods,change:{workersMax:0}});await assert.rejects(f.client.release(),/moving_runpod_limits_changed/);
    assert.equal(f.calls.length,1);
  }
  await assert.rejects(fallbackClient({pods:[fallbackPod(),fallbackPod({id:'worker456'})]}).client.release(),/moving_runpod_active_workers_exceeded/);
});
test('live fallback keeps one running worker admissible beside a cached scaled-down slot',async()=>{
  const f=fallbackClient({pods:[fallbackPod({desiredStatus:'RUNNING'}),fallbackPod({id:'worker456',desiredStatus:'EXITED'})]});
  const receipt=await f.client.release();
  assert.deepEqual(receipt.workers.counts,{active:1,scaledDown:1,terminated:0,total:2});assert.equal(receipt.workersCorroboration.count,2);
  // An outdated cached slot is tolerated; an outdated running worker is not.
  assert.equal((await fallbackClient({pods:[fallbackPod({id:'worker456',desiredStatus:'EXITED',slsVersion:0}),fallbackPod({desiredStatus:'RUNNING'})],change:{version:0}}).client.release()).workers.counts.active,1);
  const stale=fallbackClient({pods:[fallbackPod({id:'worker456',desiredStatus:'EXITED',slsVersion:4})]});
  assert.equal((await stale.client.release()).workers.workers[0].isStale,true);
  await assert.rejects(fallbackClient({pods:[fallbackPod({desiredStatus:'RUNNING',slsVersion:4})]}).client.release(),/moving_worker_release_mismatch/);
  // Ownership and a numeric version are still required for every record.
  await assert.rejects(fallbackClient({pods:[fallbackPod({desiredStatus:'EXITED',endpointId:'foreign123'})]}).client.release(),/moving_runpod_workers_unknown/);
  await assert.rejects(fallbackClient({pods:[fallbackPod({desiredStatus:'EXITED',slsVersion:null})]}).client.release(),/moving_worker_release_mismatch/);
});
