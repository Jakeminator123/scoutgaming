import {createHash,randomUUID} from 'node:crypto';
import {driftError,parseMovingDriftCommand,MOVING_DRIFT_OBSERVATION_MAX_AGE_MS as MAX_AGE} from '../../packages/presentation/contracts/moving-drift.mjs';

const fail=(code,status)=>{throw driftError(code,status);};
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const clone=value=>structuredClone(value);
const emptyCost=()=>({estimatedMicroUsd:null,source:null,quotedAtMs:null,shutdownTailMs:null});
const initial=now=>({schemaVersion:1,revision:0,operationId:null,desired:{mode:'off',profileId:null,endsAtMs:null},
  observation:null,updatedAtMs:now,lastCommand:null,cost:emptyCost()});

/**
 * Control-plane only: no provider, env, network, scheduler or budget-journal writes.
 * store.transact serializes one environment-wide row and supplies authoritative DB
 * time. Its callback must commit atomically and must NOT perform external effects.
 * nextAction is a proposal for a future fenced executor, never an execution receipt.
 * Production wiring is deliberately absent until independent shutdown, reserved
 * idle cost and verified prepare/release adapters are available.
 */
export function createMovingDriftController({store,profiles,capabilities={}}={}) {
  if(typeof store?.transact!=='function'||!Array.isArray(profiles)||!profiles.length) fail('drift_invalid_configuration',422);
  const catalogue=new Map(profiles.map(profile=>[profile.id,clone(profile)]));
  if(catalogue.size!==profiles.length||new Set(profiles.map(p=>p.endpointId)).size!==profiles.length
    || profiles.some(p=>!/^[a-z][a-z0-9-]{0,31}$/.test(p.id??'')||!id(p.endpointId)
      || typeof p.label!=='string'||!p.label.trim()||p.label.length>80||!hash(p.releaseDigest)||!hash(p.bankHash))) {
    fail('drift_invalid_configuration',422);
  }
  // Persist the exact fleet identity with each observation. Display labels and
  // input order do not change identity; endpoint/release/bank changes do.
  const catalogueFingerprint=createHash('sha256').update(JSON.stringify([...catalogue.values()]
    .map(p=>[p.id,p.endpointId,p.releaseDigest,p.bankHash]).sort((a,b)=>a[0]<b[0]?-1:1))).digest('hex');
  const caps=clone(capabilities);
  const connected=caps.connected===true;
  const warmAvailable=connected&&caps.warm===true&&caps.independentDeadline===true;
  const publicCapabilities={connected,allowedModes:connected?['off','saving',...(warmAvailable?['warm']:[])]:['off'],
    reasonCode:!connected?'drift_runtime_unavailable':!warmAvailable?'drift_warm_unavailable':null};
  function expire(state,now) {
    if(state.desired.mode==='warm'&&now>=state.desired.endsAtMs) {
      state.revision++;state.operationId=randomUUID();state.updatedAtMs=now;
      state.desired={mode:'off',profileId:null,endsAtMs:null};
      // The old expected revision is now stale; a retry cannot restart this period.
      state.lastCommand=null;
    }
    return state;
  }
  const transact=work=>store.transact((saved,now)=>{
    if(!integer(now)) fail('drift_invalid_clock',503);
    if(saved&&(saved.schemaVersion!==1||!integer(saved.revision)||!saved.desired)) fail('drift_invalid_state',503);
    const state=expire(saved??initial(now),now);
    return {state,value:work(state,now)};
  });
  function view(state,now) {
    const obs=state.observation, selected=catalogue.get(state.desired.profileId);
    const fresh=obs&&obs.observedAtMs<=now&&now-obs.observedAtMs<=MAX_AGE;
    const result={schemaVersion:1,revision:state.revision,operationId:state.operationId,serverNowMs:now,
      desired:clone(state.desired),observed:{status:'unknown',atMs:obs?.observedAtMs??null,reasonCode:'drift_observation_missing'},
      profiles:[...catalogue.values()].map(({id,label})=>({id,label})),selectedProfileId:state.desired.profileId,
      actual:{profileId:null,gpu:null,workerId:null},readiness:{modelReady:false,releaseMatches:false,bankMatches:false},
      admission:{allowed:false,reasonCode:'drift_not_admitting'},capabilities:clone(publicCapabilities),cost:clone(state.cost),
      nextAction:{type:'inspect',revision:state.revision,operationId:state.operationId}};
    const action=(type,extra={})=>{result.nextAction={type,revision:state.revision,operationId:state.operationId,...extra};};
    const error=code=>{result.observed.status='error';result.observed.reasonCode=code;return result;};
    const sameCatalogue=obs?.catalogueFingerprint===catalogueFingerprint&&Array.isArray(obs.observedProfileIds)
      &&obs.observedProfileIds.length===catalogue.size&&new Set(obs.observedProfileIds).size===catalogue.size
      &&obs.observedProfileIds.every(profileId=>catalogue.has(profileId));
    if(obs&&!sameCatalogue){result.observed.reasonCode='drift_catalogue_changed';return result;}
    if(!fresh){result.observed.reasonCode=obs?'drift_observation_stale':'drift_observation_missing';return result;}
    const occupied=obs.workers.filter(w=>!['exited','terminated'].includes(w.state));
    if(occupied.length>1) return error('drift_capacity_exceeded');
    if(occupied.some(w=>w.state==='unknown')) return error('drift_worker_unknown');
    const worker=occupied[0];
    if(worker) {
      result.actual={profileId:worker.profileId,gpu:worker.gpu,workerId:worker.id};
      const expected=catalogue.get(worker.profileId);
      result.readiness={modelReady:worker.modelReady===true&&worker.state==='running',
        releaseMatches:worker.releaseDigest===expected.releaseDigest,bankMatches:worker.bankHash===expected.bankHash};
      if(!result.readiness.releaseMatches||!result.readiness.bankMatches) return error('drift_release_mismatch');
    }
    const configurationMatches=obs.applied?.revision===state.revision&&obs.applied?.operationId===state.operationId
      &&obs.applied?.profileId===state.desired.profileId&&obs.applied?.mode===state.desired.mode
      &&obs.applied?.workersMin===(state.desired.mode==='warm'?1:0)&&obs.applied?.workersMax===1;
    const busy=obs.busyJobs+obs.queuedJobs>0;
    if(state.desired.mode!=='off' && (!connected || state.desired.mode==='warm'&&!warmAvailable)) {
      if(occupied.length) action(busy?'drain':'stop');
      return error(!connected?'drift_runtime_unavailable':'drift_warm_unavailable');
    }
    if(!configurationMatches || state.desired.mode==='off') {
      result.observed={status:'stopping',atMs:obs.observedAtMs,reasonCode:null};
      if(busy) action('drain');
      else if(occupied.length) action('stop');
      else if(!configurationMatches) action('apply',{mode:state.desired.mode,profileId:state.desired.profileId,endsAtMs:state.desired.endsAtMs});
      else {result.observed.status='off';action('none');}
      return result;
    }
    if(worker&&worker.profileId!==selected.id) return error('drift_profile_mismatch');
    result.observed={status:worker?(worker.state==='initializing'?'starting':result.readiness.modelReady?'ready':'loading'):'off',
      atMs:obs.observedAtMs,reasonCode:null};
    action('none');
    if(state.desired.mode==='warm') {
      const coverage=integer(obs.providerDeadlineMs)&&obs.providerDeadlineMs>now&&obs.providerDeadlineMs<=state.desired.endsAtMs
        &&integer(obs.budgetCoveredUntilMs)&&obs.budgetCoveredUntilMs>=state.desired.endsAtMs+state.cost.shutdownTailMs;
      if(!coverage) {
        result.observed.reasonCode='drift_warm_coverage_missing';
        if(worker) action(busy?'drain':'stop');
        else action('inspect');
        return result;
      }
      if(!worker||!result.readiness.modelReady) {action('prepare',{profileId:selected.id});return result;}
      if(!warmAvailable) return error('drift_warm_unavailable');
    }
    if(!connected) return error('drift_runtime_unavailable');
    if(worker?.state==='initializing'||busy) {result.admission.reasonCode='drift_busy';return result;}
    result.admission={allowed:true,reasonCode:null};
    return result;
  }
  function warmCost(cmd,now) {
    const duration=cmd.durationSeconds;
    const grant=caps.warmBudget,endsAtMs=now+duration*1000;
    if(!grant||grant.commandId!==cmd.commandId||grant.expectedRevision!==cmd.expectedRevision||grant.profileId!==cmd.profileId
      ||!id(grant.reservationId)||!integer(grant.limitMicroUsd)||grant.limitMicroUsd<1||!integer(grant.coveredUntilMs)
      ||!integer(grant.rateMicroUsdPerHour)||grant.rateMicroUsdPerHour<1||!integer(grant.quotedAtMs)
      ||!integer(grant.maxQuoteAgeMs)||grant.maxQuoteAgeMs>86400000||!integer(grant.shutdownTailMs)
      ||grant.shutdownTailMs<1||grant.shutdownTailMs>60000||!id(grant.source)
      ||now<grant.quotedAtMs||now-grant.quotedAtMs>grant.maxQuoteAgeMs) fail('drift_warm_budget_unavailable');
    const estimatedMicroUsd=Math.ceil((duration*1000+grant.shutdownTailMs)*grant.rateMicroUsdPerHour/3600000);
    if(!integer(estimatedMicroUsd)||estimatedMicroUsd>grant.limitMicroUsd||endsAtMs+grant.shutdownTailMs>grant.coveredUntilMs) {
      fail('drift_warm_budget_unavailable');
    }
    return {estimatedMicroUsd,source:grant.source,quotedAtMs:grant.quotedAtMs,shutdownTailMs:grant.shutdownTailMs};
  }
  return Object.freeze({
    status:()=>transact(view),
    command:async input=>{
      const cmd=parseMovingDriftCommand(input);
      return transact((state,now)=>{
        if(state.lastCommand?.input?.commandId===cmd.commandId) {
          const previous=state.lastCommand.input;
          // The command is a strict flat scalar DTO; JSONB key order is irrelevant.
          if(Object.keys(cmd).length!==Object.keys(previous).length
            ||Object.keys(cmd).some(key=>!Object.hasOwn(previous,key)||cmd[key]!==previous[key])) fail('drift_command_reused');
          return view(state,now);
        }
        if(cmd.expectedRevision!==state.revision) fail('drift_revision_conflict');
        if(cmd.mode!=='off'&&!catalogue.has(cmd.profileId)) fail('drift_unknown_profile',422);
        if(cmd.mode!=='off'&&!connected) fail('drift_runtime_unavailable',503);
        if(cmd.mode==='warm'&&!warmAvailable) fail('drift_warm_unavailable');
        const cost=cmd.mode==='warm'?warmCost(cmd,now):emptyCost();
        state.revision++;state.operationId=randomUUID();state.updatedAtMs=now;state.cost=cost;
        state.desired={mode:cmd.mode,profileId:cmd.profileId??null,endsAtMs:cmd.mode==='warm'?now+cmd.durationSeconds*1000:null};
        state.lastCommand={input:cmd};
        return view(state,now);
      });
    },
    // Internal executor input only. Never expose this method as a browser write.
    observe:async input=>transact((state,now)=>{
      if(input?.revision!==state.revision||input?.operationId!==state.operationId) fail('drift_revision_conflict');
      if(!integer(input.observedAtMs)||input.observedAtMs>now||now-input.observedAtMs>MAX_AGE
        ||!integer(input.busyJobs)||!integer(input.queuedJobs)||!Array.isArray(input.workers)||input.workers.length>8
        ||!Array.isArray(input.observedProfileIds)||input.observedProfileIds.length!==catalogue.size
        ||new Set(input.observedProfileIds).size!==catalogue.size||input.observedProfileIds.some(id=>!catalogue.has(id))) {
        fail('drift_invalid_observation',422);
      }
      if(state.observation&&input.observedAtMs<state.observation.observedAtMs) fail('drift_stale_observation');
      const workerIds=new Set();
      const workers=input.workers.map(w=>{
        if(!id(w?.id)||workerIds.has(w.id)||!catalogue.has(w.profileId)
          ||!['running','initializing','exited','terminated','unknown'].includes(w.state)
          ||typeof w.gpu!=='string'||w.gpu.length>80||!hash(w.releaseDigest)||!hash(w.bankHash)||typeof w.modelReady!=='boolean') {
          fail('drift_invalid_observation',422);
        }
        workerIds.add(w.id);
        return {id:w.id,profileId:w.profileId,state:w.state,gpu:w.gpu,releaseDigest:w.releaseDigest,bankHash:w.bankHash,modelReady:w.modelReady};
      });
      let applied=null;
      if(input.applied) {
        const a=input.applied;
        // Null is a receipt for the pristine off state only, never an activation fence.
        const initialOff=state.revision===0&&state.operationId===null&&state.desired.mode==='off'
          &&a.revision===0&&a.operationId===null&&a.mode==='off'&&a.profileId===null&&a.workersMin===0&&a.workersMax===1;
        if(!integer(a.revision)||a.revision>state.revision||!id(a.operationId)&&!initialOff
          ||!['off','saving','warm'].includes(a.mode)||!(a.profileId===null&&a.mode==='off'||catalogue.has(a.profileId))
          ||!integer(a.workersMin)||!integer(a.workersMax)) fail('drift_invalid_observation',422);
        applied={revision:a.revision,operationId:a.operationId,mode:a.mode,profileId:a.profileId,workersMin:a.workersMin,workersMax:a.workersMax};
      }
      for(const key of ['providerDeadlineMs','budgetCoveredUntilMs']) {
        if(input[key]!==undefined&&!integer(input[key])) fail('drift_invalid_observation',422);
      }
      state.observation={catalogueFingerprint,observedAtMs:input.observedAtMs,observedProfileIds:[...input.observedProfileIds],workers,busyJobs:input.busyJobs,queuedJobs:input.queuedJobs,applied,
        providerDeadlineMs:input.providerDeadlineMs??null,budgetCoveredUntilMs:input.budgetCoveredUntilMs??null};
      return view(state,now);
    }),
    // Additional admission gate, not a replacement for the existing journal,
    // release/capacity proofs, budget reservation or final beforeCostly recheck.
    authorizeAdmission:async ({revision,profileId}={})=>transact((state,now)=>{
      if(revision!==state.revision) fail('drift_revision_conflict');
      const status=view(state,now);
      if(profileId!==state.desired.profileId||!status.admission.allowed) fail('drift_not_admitting');
      return {revision:state.revision,operationId:state.operationId,profileId,
        endpointId:catalogue.get(profileId).endpointId,endsAtMs:state.desired.endsAtMs};
    })
  });
}
