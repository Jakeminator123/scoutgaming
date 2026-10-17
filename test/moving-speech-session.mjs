import test from 'node:test';
import assert from 'node:assert/strict';
import { createMovingSpeechSession } from '../web/moving-speech-session.mjs';

const sha = digit => digit.repeat(64);
const image = `ghcr.io/jakeminator123/moving-gpu-worker@sha256:${sha('a')}`;
const binding = { releaseSha256:sha('b'),dealerId:'dragan',workerAvatar:'dragan',profileRevision:sha('c'),
  sourceSetSha256:sha('d'),avatarSha256:sha('e'),bankReceiptSha256:sha('f') };
const receipt = () => ({ expectedImage:image,endpoint:{id:'endpointfixture',image},observedAtMs:Date.now(),
  workers:{endpointVersion:0,workers:[]} });
function fixture(overrides={}) {
  const events=[],state={state:null,released:false,cost:0,request:null}, callbacks={};
  const journal=Object.fromEntries(['findRequest','getCompletedPackageById','retireExpiredMissingSession',
    'getBudgetPolicy','claimRequest','reserveSession','listRecoverableSessions'].map(key=>[key,async()=>{}]));
  Object.assign(journal,{
    async listMovingSessions(){return overrides.recoverable??[];},
    async acquireLease(){events.push('lease');return{resource:'stream-session',holderId:'fixture',fence:1};},
    async renewLease({lease}){return lease;},async releaseLease(){events.push('release');state.released=true;},
    async reserveMovingSession(input){events.push('reserve');state.cost+=input.reserveMicroUsd;state.state='reserved';
      state.input=input;return{key:sha('1'),workerId:`croupier-${input.sessionId}`,...input};},
    async assertMovingSession(){if(state.state!=='reserved'&&state.state!=='running')throw Error('inactive');return{};},
    async markRequestSubmissionStarted(){events.push('request-start');state.request='submission_started';},
    async markSubmissionStarted(){events.push('submit-start');state.state='submission_started';},
    async attachJob({jobId}){events.push('attach');if(overrides.attachFailure)throw Error('generated_speech_journal_unavailable');state.state='running';state.jobId=jobId;},
    async markSubmissionUncertain(){events.push('unknown');state.state='submission_uncertain';},
    async failRequest(){state.request='submission_uncertain';},
    async requestCancel(){events.push('cancel-intent');},
    async recordProviderStatus({status}){events.push('terminal');state.terminal=status;},
    async confirmWorkerDrained(){assert.ok(state.terminal);events.push('drained');state.released=true;},
    async completeRequest(){events.push('request-complete');state.request='completed';},
  });
  const provider={async submit(input){events.push('provider-submit');state.post=input;return overrides.submit?overrides.submit(input):{id:'accepted-job'};},
    async cancel(){events.push('provider-cancel');},async status(){events.push('provider-status');return{status:overrides.status??'COMPLETED'};}};
  const create=createMovingSpeechSession({journal,provider,scope:{environment:'qa_moving',workspaceId:'fixture'},
    origin:'https://fixture.example',endpointId:'endpointfixture',release:async()=>receipt(),budgetId:'same-authorized-run',
    totalBudgetMicroUsd:5000000,reserveMicroUsd:250000,currentDailyBudgetMicroUsd:5000000,
    workerState:async()=>({workers:0,busy:0,available:0}),cleanupMs:30,pollMs:1,
    connectionFactory:async options=>{
      callbacks.options=options;await options.authorize({phase:'prepare',signal:options.signal});
      let finish;const closed=new Promise(resolve=>{finish=resolve;});let finalization;
      const finalize=reason=>finalization??=(async()=>{const result=await options.finalize({reason});finish(result);return result;})();
      return{callbackUrl:'wss://fixture.example/private',handleUpgrade:()=>true,closed,
        async ready(){events.push('worker-ready');if(overrides.readyFailure){await finalize('cancelled');throw Error('moving_worker_attestation_mismatch');}
          await options.authorize({phase:'send',signal:options.signal});return{jobId:state.jobId};},
        async dispatch(input,{onChunk}){events.push('dispatch');await options.authorize({phase:'output',signal:options.signal});await onChunk({},Buffer.from([1]),{signal:options.signal});await finalize('complete');return{frames:12};},
        cancel:()=>finalize('cancelled')};
    }});
  const admit=(extra={})=>create.admit({ownerHash:sha('1'),userId:'owner',requestId:'request-1',fingerprint:sha('2'),
    binding,mediaReferences:[{id:'fixture'}],projectRevision:'project-fixture',beforeCostly:async({phase})=>events.push(`guard:${phase}`),...extra});
  return{create,admit,state,events,callbacks};
}

test('durable admission and accepted job precede worker readiness, paid voice and awaited chunk delivery',async()=>{
  const f=fixture(),attempt=await f.admit({bankDownload:async({binding,callbackUrl})=>{
    assert.equal(binding.sessionId,attempt.sessionId);assert.match(callbackUrl,/private/);return{schemaVersion:1};}});
  assert.equal(f.state.cost,250000);assert.equal(f.events.includes('provider-submit'),false);
  assert.match(attempt.sessionId,/^[a-f0-9]{32}$/);assert.notEqual(attempt.binding.nonce,binding.nonce);
  assert.deepEqual(await attempt.submit(),{jobId:'accepted-job',sessionId:attempt.sessionId});
  await attempt.ready(); f.events.push('paid-voice');
  let consumed=false;
  const done=await attempt.dispatch({cancel(){}},{onChunk:async()=>{await Promise.resolve();consumed=true;}});
  assert.equal(done.frames,12);assert.equal(consumed,true);
  assert.ok(f.events.indexOf('reserve')<f.events.indexOf('provider-submit'));
  assert.ok(f.events.indexOf('attach')<f.events.indexOf('worker-ready'));
  assert.ok(f.events.indexOf('worker-ready')<f.events.indexOf('paid-voice'));
  assert.equal(f.state.post.input.ttlSeconds,180);assert.equal(f.state.post.input.binding,attempt.binding);
  assert.equal(f.state.released,true);assert.equal(f.state.request,'completed');assert.equal(f.state.cost,250000);
  assert.equal((await attempt.closed).released,true);
});

test('duplicate submit shares one accepted request and never creates another paid POST',async()=>{
  const f=fixture(),attempt=await f.admit();
  const result=await Promise.all([attempt.submit(),attempt.submit(),attempt.ready()]);
  assert.equal(result[0].jobId,result[1].jobId);assert.equal(f.events.filter(x=>x==='provider-submit').length,1);
  await attempt.cancel();assert.equal(f.events.filter(x=>x==='provider-cancel').length,1);
});

test('lost provider response stays uncertain, pinned and charged; raw provider diagnostics do not escape',async()=>{
  const f=fixture({submit:async()=>{throw Error('private provider diagnostic');}}),attempt=await f.admit();
  await assert.rejects(attempt.ready(),{message:'generated_speech_moving_submission_unknown'});
  await assert.rejects(attempt.submit(),{message:'generated_speech_moving_submission_unknown'});
  assert.equal(f.state.state,'submission_uncertain');assert.equal(f.state.released,false);assert.equal(f.state.cost,250000);
  assert.equal(f.events.filter(x=>x==='provider-submit').length,1);assert.equal(f.events.includes('worker-ready'),false);
  assert.equal((await attempt.closed).released,false);
});

test('lost attach COMMIT cancels the observed exact job but never treats its outcome as released',async()=>{
  const f=fixture({attachFailure:true}),attempt=await f.admit();
  await assert.rejects(attempt.submit(),/journal_unavailable/);
  assert.equal(f.events.includes('provider-cancel'),true);assert.equal(f.state.released,false);
  assert.equal(f.events.includes('worker-ready'),false);assert.equal(f.state.cost,250000);
});

test('wrong worker attestation prevents voice and keeps reservations until provider terminal plus drain',async()=>{
  const f=fixture({readyFailure:true,status:'IN_PROGRESS'}),attempt=await f.admit();let voice=0;
  await assert.rejects((async()=>{await attempt.ready();voice++;})(),/attestation_mismatch/);
  assert.equal(voice,0);assert.equal(f.state.released,false);assert.equal(f.state.cost,250000);
  assert.equal((await attempt.closed).reason,'provider_not_terminal');
});

test('aborted admission performs no provider submit and a later attempt can acquire the factory',async()=>{
  const f=fixture();await assert.rejects(f.admit({signal:AbortSignal.abort()}),/admission_timeout/);
  assert.equal(f.events.includes('reserve'),false);assert.equal(f.events.includes('provider-submit'),false);
  const next=await f.admit();await next.cancel();assert.equal(f.state.released,false);
});

test('configuration cannot exceed five dollars or a three-minute worker lifetime',()=>{
  assert.throws(()=>createMovingSpeechSession({totalBudgetMicroUsd:5000001}),/configuration/);
  assert.throws(()=>createMovingSpeechSession({lifetimeMs:180001}),/configuration/);
});

test('restart recovery cancels only the exact known owned job and requires terminal plus empty worker',async()=>{
  const saved={sessionId:'1'.repeat(32),endpointId:'endpointfixture',jobId:'prior-job',workerId:'prior-worker'};
  const f=fixture({recoverable:[saved]});
  assert.deepEqual(await f.create.reconcile(),{recovered:[saved.sessionId],unresolved:[]});
  assert.equal(f.state.released,true);assert.equal(f.events.includes('provider-submit'),false);
  const unknown=fixture({recoverable:[{...saved,jobId:null}]});
  assert.deepEqual(await unknown.create.reconcile(),{recovered:[],unresolved:[{sessionId:saved.sessionId,reason:'submission_unresolved'}]});
  assert.equal(unknown.events.includes('lease'),false);assert.equal(unknown.state.released,false);
  const running=fixture({recoverable:[saved],status:'IN_PROGRESS'});
  assert.deepEqual(await running.create.reconcile(),{recovered:[],unresolved:[{sessionId:saved.sessionId,reason:'provider_not_terminal'}]});
  assert.equal(running.events.includes('provider-cancel'),true);assert.equal(running.state.released,false);
});
