import test from 'node:test';
import assert from 'node:assert/strict';
import {createMovingSpeechRunPod} from '../web/moving-speech-runpod.mjs';
const image='ghcr.io/jakeminator123/moving-gpu-worker@sha256:'+'a'.repeat(64);
const endpoint={id:'owned123',workersMin:0,workersMax:1,idleTimeout:5,executionTimeoutMs:180000,gpuCount:1,version:0,workers:[],template:{imageName:image}};
const create=(fetchImpl)=>createMovingSpeechRunPod({endpointId:'owned123',apiKey:'test-credential',expectedImage:image,fetchImpl});
test('fresh endpoint gates pin owned digest, zero minimum, maximum one and actual worker version',async()=>{
  let data=structuredClone(endpoint);
  const client=create(async(url,opts)=>{assert.match(url,/includeWorkers=true$/);assert.equal(opts.redirect,'error');return Response.json(data);});
  assert.equal((await client.release()).workers.endpointVersion,0);
  data.workers=[{imageName:image,slsVersion:0}];assert.equal((await client.release()).workers.workers[0].isStale,false);
  for(const change of [{workersMin:1},{workersMax:2},{idleTimeout:undefined},{idleTimeout:null},{idleTimeout:-1},{idleTimeout:6},{executionTimeoutMs:600000},{template:{imageName:'other'}},{workers:[{image:image,slsVersion:1}]}]){
    data={...structuredClone(endpoint),...change};await assert.rejects(client.release());
  }
});
test('lost paid submission is not retried; job policy remains bounded',async()=>{
  let calls=0;
  const client=create(async(url,opts)=>{calls++;const body=JSON.parse(opts.body);assert.equal(body.policy.executionTimeout,180000);assert.equal(body.policy.ttl,180000);assert.equal(url,'https://api.runpod.ai/v2/owned123/run');throw Error('lost response');});
  await assert.rejects(client.submit({input:{binding:{}}}));assert.equal(calls,1);
});
test('another job cannot release the admitted job, and health failures are not zero workers',async()=>{
  let data={id:'other',status:'COMPLETED'};const client=create(async()=>Response.json(data));
  await assert.rejects(client.status({jobId:'ours'}),/job_mismatch/);await assert.rejects(client.cancel({jobId:'ours'}),/job_mismatch/);
  data={id:'ours',status:'COMPLETED'};assert.equal((await client.status({jobId:'ours'})).status,'COMPLETED');
  data={workers:{idle:0,running:0,initializing:0,ready:0,throttled:0,unhealthy:0}};assert.deepEqual(await client.workerState(),{workers:0,busy:0,available:0});
  delete data.workers.ready;await assert.rejects(client.workerState(),/state_unknown/);
});
