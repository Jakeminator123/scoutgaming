import test from 'node:test';
import assert from 'node:assert/strict';
import { createMovingDriftController } from '../services/game/moving-drift-controller.mjs';

const epoch = Date.parse('2026-10-19T10:00:00Z');
const profiles = [
  { id:'base', label:'Bas', endpointId:'endpoint-base', releaseDigest:'a'.repeat(64), bankHash:'b'.repeat(64) },
  { id:'comparison', label:'Jämförelse', endpointId:'endpoint-comparison', releaseDigest:'c'.repeat(64), bankHash:'b'.repeat(64) },
];
function fixture(options = {}) {
  let time = epoch, row = null, queue = Promise.resolve();
  const store = { transact(fn) {
    const job = queue.then(async () => {
      const result = await fn(structuredClone(row), time);
      row = options.reorderKeys ? JSON.parse(JSON.stringify(result.state),(key,value)=>value&&typeof value==='object'&&!Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).reverse()) : value) : structuredClone(result.state);
      return structuredClone(result.value);
    });
    queue = job.catch(() => {});
    return job;
  }};
  const capabilities = { connected:true, warm:false, ...options.capabilities };
  const make = (extra = {},configuredProfiles=profiles) => createMovingDriftController({store,profiles:configuredProfiles,capabilities:{...capabilities,...extra}});
  const controller = make();
  const observe = async (extra = {}) => {
    const status = await controller.status();
    return controller.observe({ revision:status.revision, operationId:status.operationId,
      observedAtMs:time, observedProfileIds:profiles.map(p=>p.id), applied:null, workers:[], queuedJobs:0, busyJobs:0, ...extra });
  };
  return {controller,make,observe,advance:ms=>{time+=ms;},getTime:()=>time};
}
const command = (mode, extra = {}) => ({expectedRevision:0,commandId:'command-1',mode,
  ...(mode === 'off' ? {} : {profileId:'base'}),...extra});
const rejects = code => error => error.code === code;
const active = (extra = {}) => ({id:'worker-1',profileId:'base',state:'running',gpu:'A40',
  releaseDigest:profiles[0].releaseDigest,bankHash:profiles[0].bankHash,modelReady:false,...extra});
const applied = (status, mode='saving', profileId='base') => ({
  revision:status.revision,operationId:status.operationId,mode,profileId,workersMin:mode==='warm'?1:0,workersMax:1
});

test('construction is inert; no observation is reported as stopped or ready', async () => {
  let calls=0;
  createMovingDriftController({store:{transact(){calls++;}},profiles});
  assert.equal(calls,0);
  const f=fixture(), status=await f.controller.status();
  assert.equal(status.observed.status,'unknown');
  assert.equal(status.admission.allowed,false);
  assert.equal(status.cost.estimatedMicroUsd,null);
  assert.equal(status.serverNowMs,epoch);
});

test('commands use server time, strict fields, known profiles and optimistic concurrency', async () => {
  const f=fixture();
  await assert.rejects(f.controller.command({...command('saving'),endpointId:'foreign'}),rejects('drift_invalid_command'));
  await assert.rejects(f.controller.command(command('saving',{profileId:'unknown'})),rejects('drift_unknown_profile'));
  const outcomes=await Promise.allSettled([f.controller.command(command('saving')),
    f.controller.command(command('saving',{commandId:'command-2'}))]);
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(outcomes.find(x=>x.status==='rejected').reason.code,'drift_revision_conflict');
  const first=outcomes.find(x=>x.status==='fulfilled').value;
  assert.equal(first.revision,1);
  assert.equal(first.admission.allowed,false);
  assert.equal((await f.controller.command(command('saving'))).revision,1);
  await assert.rejects(f.controller.command(command('off')),rejects('drift_command_reused'));
});

test('saving can admit only after exact applied revision and a fresh whole-fleet observation', async () => {
  const f=fixture(), status=await f.controller.command(command('saving'));
  let result=await f.observe();
  assert.equal(result.nextAction.type,'apply');
  result=await f.observe({applied:applied(status)});
  assert.equal(result.observed.status,'off');
  assert.equal(result.admission.allowed,true); // on-demand cold start, not warm model readiness
  assert.equal((await f.controller.authorizeAdmission({revision:1,profileId:'base'})).revision,1);
  f.advance(15001);
  result=await f.controller.status();
  assert.equal(result.observed.status,'unknown');
  await assert.rejects(f.controller.authorizeAdmission({revision:1,profileId:'base'}),rejects('drift_not_admitting'));
});

test('stop and profile changes close admission before drain; unknown capacity never permits apply', async () => {
  const f=fixture(), first=await f.controller.command(command('saving'));
  await f.observe({applied:applied(first),workers:[active()],busyJobs:1});
  let result=await f.controller.command(command('saving',{expectedRevision:1,commandId:'command-2',profileId:'comparison'}));
  assert.equal(result.admission.allowed,false);
  assert.equal(result.nextAction.type,'drain');
  await assert.rejects(f.controller.authorizeAdmission({revision:1,profileId:'base'}),rejects('drift_revision_conflict'));
  result=await f.observe({applied:applied(first),workers:[active()]});
  assert.equal(result.nextAction.type,'stop');
  result=await f.observe({applied:applied(first),workers:[active({state:'unknown'})]});
  assert.equal(result.nextAction.type,'inspect');
  assert.equal(result.observed.status,'error');
  result=await f.observe({applied:applied(first)});
  assert.equal(result.nextAction.type,'apply');
  assert.equal(result.nextAction.profileId,'comparison');
  result=await f.controller.command(command('off',{expectedRevision:2,commandId:'command-3'}));
  assert.equal(result.desired.mode,'off');
  assert.equal(result.admission.allowed,false);
});

test('cached EXITED records are not a running GPU, and two running GPUs fail closed', async () => {
  const f=fixture(), status=await f.controller.command(command('saving'));
  let result=await f.observe({applied:applied(status),workers:[active({state:'exited',modelReady:true})]});
  assert.equal(result.admission.allowed,true);
  assert.equal(result.observed.status,'off');
  assert.equal(result.readiness.modelReady,false);
  result=await f.observe({applied:applied(status),workers:[active(),active({id:'worker-2',profileId:'comparison'})]});
  assert.equal(result.admission.allowed,false);
  assert.equal(result.observed.reasonCode,'drift_capacity_exceeded');
});

test('disabled adapter, unavailable warm and unpriced warm cannot be activated', async () => {
  const disabled=fixture({capabilities:{connected:false}});
  await assert.rejects(disabled.controller.command(command('saving')),rejects('drift_runtime_unavailable'));
  await disabled.controller.command(command('off'));
  const f=fixture();
  await assert.rejects(f.controller.command(command('warm',{durationSeconds:1800})),rejects('drift_warm_unavailable'));
  const warm=fixture({capabilities:{warm:true,independentDeadline:true}});
  await assert.rejects(warm.controller.command(command('warm',{durationSeconds:1800})),rejects('drift_warm_budget_unavailable'));
});

function warmFixture() {
  return fixture({capabilities:{warm:true,independentDeadline:true,
    warmBudget:{commandId:'command-1',expectedRevision:0,profileId:'base',reservationId:'reserved-fixture-1',limitMicroUsd:2000000,coveredUntilMs:epoch+2*3600000,rateMicroUsdPerHour:1000000,
      source:'fixture-price',quotedAtMs:epoch,maxQuoteAgeMs:60000,shutdownTailMs:60000}}});
}
test('warm deadline and full cost including shutdown tail are server-owned and restart-safe', async () => {
  const f=warmFixture();
  let status=await f.controller.command(command('warm',{durationSeconds:1800}));
  assert.equal(status.desired.endsAtMs,epoch+1800000);
  assert.equal(status.cost.estimatedMicroUsd,516667);
  assert.equal(status.cost.source,'fixture-price');
  assert.equal(status.cost.quotedAtMs,epoch);
  const restarted=f.make();
  assert.equal((await restarted.status()).desired.endsAtMs,status.desired.endsAtMs);
  f.advance(1800001);
  status=await restarted.status();
  assert.equal(status.desired.mode,'off');
  assert.equal(status.revision,2);
  assert.equal(status.admission.allowed,false);
  assert.equal(status.observed.status,'unknown');
  await assert.rejects(restarted.command(command('warm',{durationSeconds:1800})),rejects('drift_revision_conflict'));
});

test('warm accepts only exact attestation and bounded provider/budget deadline; health counters cannot claim ready', async () => {
  const f=warmFixture(), status=await f.controller.command(command('warm',{durationSeconds:1800}));
  let result=await f.observe({applied:applied(status,'warm'),workers:[active()]});
  assert.equal(result.observed.status,'loading');
  assert.equal(result.admission.allowed,false);
  const coverage={providerDeadlineMs:status.desired.endsAtMs,budgetCoveredUntilMs:status.desired.endsAtMs+60000};
  result=await f.observe({applied:applied(status,'warm'),workers:[active({modelReady:true})],...coverage});
  assert.equal(result.observed.status,'ready');
  assert.equal(result.admission.allowed,true);
  result=await f.observe({applied:applied(status,'warm'),workers:[active({modelReady:true,bankHash:'d'.repeat(64)})],...coverage});
  assert.equal(result.admission.allowed,false);
  assert.equal(result.observed.reasonCode,'drift_release_mismatch');
  result=await f.observe({applied:applied(status,'warm'),workers:[active({modelReady:true})],...coverage,
    providerDeadlineMs:status.desired.endsAtMs+1});
  assert.equal(result.admission.allowed,false);
});

test('old observations, wrong operations and invalid counters never overwrite newer state', async () => {
  const f=fixture(), status=await f.controller.command(command('saving'));
  await f.observe({applied:applied(status)});
  await assert.rejects(f.observe({revision:0}),rejects('drift_revision_conflict'));
  await assert.rejects(f.observe({operationId:'wrong'}),rejects('drift_revision_conflict'));
  await assert.rejects(f.observe({queuedJobs:-1}),rejects('drift_invalid_observation'));
  f.advance(100);
  await f.observe({applied:applied(status)});
  await assert.rejects(f.observe({observedAtMs:epoch}),rejects('drift_stale_observation'));
  assert.equal((await f.controller.status()).admission.allowed,true);
});

test('warm budget, quote age, unsupported durations and arbitrary deadlines are refused', async () => {
  const f=warmFixture();
  await assert.rejects(f.controller.command(command('warm',{durationSeconds:86400})),rejects('drift_warm_budget_unavailable'));
  await assert.rejects(f.controller.command(command('warm',{durationSeconds:10})),rejects('drift_invalid_command'));
  await assert.rejects(f.controller.command({...command('warm',{durationSeconds:1800}),endsAtMs:epoch+100000}),rejects('drift_invalid_command'));
  f.advance(60001);
  await assert.rejects(f.controller.command(command('warm',{durationSeconds:1800})),rejects('drift_warm_budget_unavailable'));
});

test('partial fleet coverage cannot enable another profile or admit a job',async()=>{
  const f=fixture(),status=await f.controller.command(command('saving'));
  await assert.rejects(f.observe({applied:applied(status),observedProfileIds:['base']}),rejects('drift_invalid_observation'));
  await assert.rejects(f.observe({applied:applied(status),observedProfileIds:['base','base']}),rejects('drift_invalid_observation'));
  assert.equal((await f.controller.status()).admission.allowed,false);
});
test('revoked runtime capability after restart never proposes activation',async()=>{
  const f=fixture(),status=await f.controller.command(command('saving'));
  await f.observe({applied:applied(status)});
  let result=await f.make({connected:false}).status();
  assert.equal(result.admission.allowed,false);
  assert.equal(result.nextAction.type,'inspect');
  const warm=warmFixture();
  await warm.controller.command(command('warm',{durationSeconds:1800}));
  await warm.observe();
  result=await warm.make({warm:false}).status();
  assert.equal(result.nextAction.type,'inspect');
  assert.equal(result.observed.reasonCode,'drift_warm_unavailable');
});
test('a warm reservation is bound to its command/revision/profile and cannot fund a new period',async()=>{
  const f=warmFixture();
  await f.controller.command(command('warm',{durationSeconds:1800}));
  await f.controller.command(command('off',{expectedRevision:1,commandId:'stop'}));
  await assert.rejects(f.controller.command(command('warm',{expectedRevision:2,durationSeconds:1800})),rejects('drift_warm_budget_unavailable'));
  await assert.rejects(f.controller.command(command('saving',{expectedRevision:2,commandId:123})),rejects('drift_invalid_command'));
});

test('identical command retry survives reordered stored JSON keys and a new controller',async()=>{
  const f=fixture({reorderKeys:true}),cmd=command('saving');
  const first=await f.controller.command(cmd);
  for(const controller of [f.controller,f.make()]) {
    const retried=await controller.command({...cmd});
    assert.equal(retried.revision,first.revision);
    assert.equal(retried.operationId,first.operationId);
    assert.deepEqual(retried.desired,first.desired);
  }
  await assert.rejects(f.make().command(command('saving',{profileId:'comparison'})),rejects('drift_command_reused'));
});

test('revision-zero off can be attested without a command, but null never fences activation or later off',async()=>{
  const f=fixture(),initial=await f.controller.status();
  const off=applied(initial,'off',null);
  let result=await f.observe({applied:off});
  assert.equal(result.revision,0);
  assert.equal(result.operationId,null);
  assert.equal(result.observed.status,'off');
  assert.equal(result.nextAction.type,'none');
  assert.equal(result.admission.allowed,false);
  for(const invalid of [{...off,mode:'saving',profileId:'base'},{...off,workersMin:1},{...off,workersMax:2}]) {
    await assert.rejects(f.observe({applied:invalid}),rejects('drift_invalid_observation'));
  }
  result=await f.observe({applied:off,workers:[active()]});
  assert.equal(result.observed.status,'stopping');
  assert.equal(result.nextAction.type,'stop');
  const saving=await f.controller.command(command('saving'));
  await assert.rejects(f.observe({applied:{...applied(saving),operationId:null}}),rejects('drift_invalid_observation'));
  await assert.rejects(f.observe({applied:off}),rejects('drift_invalid_observation'));
  const stopped=await f.controller.command(command('off',{expectedRevision:1,commandId:'stop'}));
  await assert.rejects(f.observe({applied:{...applied(stopped,'off',null),operationId:null}}),rejects('drift_invalid_observation'));
});

test('restart invalidates cached fleet proof for changed IDs, endpoints, releases or banks',async()=>{
  const f=fixture(),saved=await f.controller.command(command('saving'));
  await f.observe({applied:applied(saved)});
  const changes=[
    [profiles[0],{...profiles[1],id:'new-comparison'}],
    [profiles[0]],
    [...profiles,{...profiles[1],id:'extra',endpointId:'endpoint-extra'}],
    [{...profiles[0],endpointId:'new-endpoint-base'},profiles[1]],
    [profiles[0],{...profiles[1],endpointId:'new-endpoint-comparison'}],
    [profiles[0],{...profiles[1],releaseDigest:'d'.repeat(64)}],
    [profiles[0],{...profiles[1],bankHash:'e'.repeat(64)}],
  ];
  for(const changed of changes) {
    const controller=f.make({},changed),status=await controller.status();
    assert.equal(status.observed.status,'unknown');
    assert.equal(status.observed.reasonCode,'drift_catalogue_changed');
    assert.equal(status.nextAction.type,'inspect');
    assert.equal(status.admission.allowed,false);
    await assert.rejects(controller.authorizeAdmission({revision:saved.revision,profileId:'base'}),rejects('drift_not_admitting'));
  }
  const unchanged=f.make({},[...profiles].reverse().map(p=>({...p,label:'New label'})));
  assert.equal((await unchanged.status()).admission.allowed,true,'order and display labels are not fleet identity');
  const changed=changes[0],controller=f.make({},changed);
  const renewed=await controller.observe({revision:saved.revision,operationId:saved.operationId,
    observedAtMs:f.getTime(),observedProfileIds:changed.map(p=>p.id),applied:applied(saved),workers:[],queuedJobs:0,busyJobs:0});
  assert.equal(renewed.admission.allowed,true,'only a new complete observation restores admission');
  assert.equal((await f.controller.status()).admission.allowed,false,'old configured instance cannot reuse the replacement fleet proof');
});
