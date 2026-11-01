import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechSessionManager, sessionReserveMicroUsd, dailyBudgetMicroUsd, SPEECH_SESSION_POLICY } from '../services/game/generated-speech-session.mjs';
import { createSpeechJournal } from '../services/game/postgres-speech-journal.mjs';
import { speechMemoryPool } from './fixtures/speech-memory-pool.mjs';

const response = value => new Response(JSON.stringify(value), { headers:{'content-type':'application/json'} });
async function fixture(t, options = {}) {
  let time = Date.parse('2026-09-29T08:00:00Z'), connected = false, jobNumber = 0, workerId;
  const pool = speechMemoryPool(() => time), journal = await createSpeechJournal({ pool, environmentId:'isolated-session-fixture', now:() => time });
  await journal.initializeBudgetPolicy({ dailyBudgetMicroUsd:9940000, confirmation:'verified-new-empty-cost-journal' });
  const configuration = { apiKey:'private-api-fixture',endpointId:'fixture-endpoint',workerSecret:'worker-secret-fixture-at-least-32-characters',
    origin:'https://speech.example.test',reserveUsd:'0.50',dailyBudgetUsd:'9.94' };
  const calls = [], jobs = new Map(), managers = [];
  const fetchImpl = async (url, init) => {
    calls.push({url,...init});
    if(url.endsWith('/run')) {
      workerId=JSON.parse(init.body).input.worker_id;
      if(options.submit)return options.submit(url,init);
      const id=`job-${++jobNumber}`;jobs.set(id,'IN_PROGRESS');return response({id,status:'IN_QUEUE'});
    }
    const id=url.split('/').at(-1);
    if(url.includes('/status/')) {
      if(options.status)return options.status(id,init);
      if(jobs.get(id)==='IN_PROGRESS')connected=true;
      return response({id,status:jobs.get(id)});
    }
    if(url.includes('/cancel/')) {jobs.set(id,'CANCELLED');connected=false;return response({id,status:'CANCELLED'});}
    assert.fail('unexpected fixture provider route');
  };
  const dependencies = { journal, now:()=>time, fetchImpl, readyTimeoutMs:1000, idleTimeoutMs:options.idleTimeoutMs??60000,
    workerState:id=>({workers:Number(connected&&(!id||id===workerId)),busy:0,available:Number(connected&&(!id||id===workerId))}),
    stopWorker:id=>{assert.equal(id,workerId);connected=false;for(const job of jobs.keys())jobs.set(job,'COMPLETED');return true;},
    sleep:async(ms,signal)=>{time+=ms;signal?.throwIfAborted();} };
  const create=(configPatch={},dependencyPatch={})=>{const value=createSpeechSessionManager({...configuration,...configPatch},{...dependencies,...dependencyPatch});managers.push(value);return value;};
  t.after(async()=>{
    if(!options.uncertainSubmission){await Promise.all(managers.map(manager=>manager.close()));return;}
    const outcomes=await Promise.allSettled(managers.map(manager=>manager.close()));
    assert.ok(outcomes.some(outcome=>outcome.status==='rejected'));
    for(const outcome of outcomes)if(outcome.status==='rejected')assert.equal(outcome.reason.code,'generated_speech_session_shutdown_incomplete');
    assert.equal([...pool.state.sessions.values()][0].state,'submission_uncertain');
  });
  return {configuration,pool,journal,calls,jobs,create,fetchImpl,input:{beforeCostly:async()=>{}},
    finish(){for(const id of jobs.keys())jobs.set(id,'COMPLETED');connected=false;} };
}
const starts = calls => calls.filter(call=>call.url.endsWith('/run'));

// Startup, UTC reservations, uncertain submissions, restart, dealer binding and
// shutdown also run through this manager in speech-journal-runtime.mjs. The
// retired file-format/lock/bootstrap assertions do not describe this backend.
test('cost amounts are exact micro-USD and missing/unconfirmed configuration fails closed', async t => {
  assert.equal(dailyBudgetMicroUsd('20'),20000000);assert.equal(dailyBudgetMicroUsd('20.000001'),null);
  assert.equal(sessionReserveMicroUsd('20'),null);assert.equal(sessionReserveMicroUsd('0.50'),500000);assert.equal(sessionReserveMicroUsd('9.94'),9940000);
  for(const value of ['',undefined,'0','10.000001','NaN','1e-3','0.0000001','-1'])assert.equal(sessionReserveMicroUsd(value),null);
  const f=await fixture(t);
  for(const patch of [{reserveUsd:''},{dailyBudgetUsd:''},{dailyBudgetUsd:'20.000001'},{reserveUsd:'10',dailyBudgetUsd:'9.94'}])
    assert.throws(()=>f.create(patch),{code:'generated_speech_session_not_configured'});
  assert.throws(()=>createSpeechSessionManager(f.configuration),{code:'generated_speech_journal_unavailable'});
  f.create({dailyBudgetUsd:'20'});assert.equal(f.calls.length,0,'construction does not start a worker');
});

test('9.94 USD journal budget admits nineteen 0.50 reservations and cannot be raised by configuration', async t => {
  const f=await fixture(t),manager=f.create();
  for(let i=0;i<19;i++){await manager.ensure(f.input);f.finish();}
  await assert.rejects(manager.ensure(f.input),{code:'generated_speech_daily_budget_exhausted',statusCode:429});
  assert.equal(starts(f.calls).length,19);assert.equal(f.pool.state.reservations.size,19);
  await manager.close();
  await assert.rejects(f.create({dailyBudgetUsd:'10'}).ensure(f.input),{code:'generated_speech_daily_budget_exhausted'});
  assert.equal(SPEECH_SESSION_POLICY.dailyMicroUsd,20000000);
});

test('separate managers cannot both reserve and submit while one owns the SQL lease', async t => {
  let release,submitted;
  const started=new Promise(resolve=>{submitted=resolve;}),held=new Promise(resolve=>{release=resolve;});
  const f=await fixture(t,{uncertainSubmission:true,submit:async()=>{submitted();await held;throw Error('synthetic uncertain submit');}});
  const first=f.create().ensure(f.input);
  await started;
  try {await assert.rejects(f.create().ensure(f.input),{code:'generated_speech_lease_busy'});}
  finally {release();}
  await assert.rejects(first);
  assert.equal(starts(f.calls).length,1);assert.equal(f.pool.state.reservations.size,1);
});

test('new verified demand suspends the idle timer while its provider status read is pending', async t => {
  const f=await fixture(t,{idleTimeoutMs:50});let polls=0,release,started;
  const held=new Promise(resolve=>{release=resolve;}),reading=new Promise(resolve=>{started=resolve;});
  const manager=f.create({}, {fetchImpl:async(url,init)=>{
    if(url.includes('/status/')&&++polls===2){started();await held;}return f.fetchImpl(url,init);
  }});
  await manager.ensure(f.input);const second=manager.ensure(f.input);await reading;
  try {await new Promise(resolve=>setTimeout(resolve,80));assert.equal(f.calls.filter(call=>call.url.includes('/cancel/')).length,0);}
  finally {release();}
  await second;assert.equal(starts(f.calls).length,1);
});

test('idle activity belongs to the exact worker and never renews its paid job', async t => {
  const f=await fixture(t,{idleTimeoutMs:100});t.mock.timers.enable({apis:['setTimeout']});
  let stopped;const retired=new Promise(resolve=>{stopped=resolve;});
  const manager=f.create({}, {stopWorker:id=>{f.finish();stopped(id);return true;}});
  await manager.ensure(f.input);const workerId=JSON.parse(starts(f.calls)[0].body).input.worker_id;
  t.mock.timers.tick(90);manager.activity(workerId);t.mock.timers.tick(20);
  assert.equal(f.jobs.get('job-1'),'IN_PROGRESS');manager.activity('unrelated-worker');t.mock.timers.tick(79);
  assert.equal(f.jobs.get('job-1'),'IN_PROGRESS');t.mock.timers.tick(1);
  assert.equal(await retired,workerId);assert.equal(starts(f.calls).length,1);
  assert.equal(JSON.parse(starts(f.calls)[0].body).input.ttl,540);
});

test('provider failures yield fixed diagnostic codes without input or response data', async t => {
  for(const [reply,code] of [
    [()=>new Response('private key in body',{status:403}),'forbidden'],
    [()=>new Response('private invalid JSON'),'invalid_json'],
    [()=>response({id:'wrong-id-private',status:'IN_PROGRESS'}),'job_mismatch'],
    [id=>response({id,status:'PRIVATE_STATUS'}),'invalid_status'],
    [()=>new Response('x'.repeat(9000)),'response_too_large'],
  ]) {
    const f=await fixture(t,{status:reply});
    await assert.rejects(f.create().ensure(f.input),{code:`generated_speech_session_provider_${code}`});
    assert.equal(starts(f.calls).length,1);
  }
});
