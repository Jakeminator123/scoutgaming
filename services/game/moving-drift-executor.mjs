import {randomUUID} from 'node:crypto';
import {createMovingDriftController} from './moving-drift-controller.mjs';
import {createPostgresMovingDriftStore} from './postgres-moving-drift.mjs';
import {createSpeechJournal} from './postgres-speech-journal.mjs';
import {createMovingSpeechSession} from './moving-speech-session.mjs';
import {createMovingDriftObserver} from './moving-drift-observer.mjs';
import {validateStudioScope} from '../../packages/studio-registry/server/document-contract.mjs';
import {driftError} from '../../packages/presentation/contracts/moving-drift.mjs';

/**
 * One existing min0/max1 endpoint, read-only control plane. Off closes admission
 * through the shared row before cancelling owned sessions. Provider cancel ACKs
 * never prove shutdown: both durable sessions and a fresh provider read must drain.
 * No endpoint creation, PATCH, warm keepalive, refund or automatic paid retry.
 */
export function createMovingDriftExecutor({controller,profile,observer,sessions,cancelActive,readOpenSessions,
  holderId,intervalMs=2000,onError=()=>{}}={}) {
  if(['claimExecution','observe','status'].some(key=>typeof controller?.[key]!=='function')
    ||typeof observer?.observe!=='function'||typeof sessions?.reconcile!=='function'
    ||typeof cancelActive!=='function'||typeof readOpenSessions!=='function'
    ||typeof profile?.id!=='string'||typeof holderId!=='string'
    ||!Number.isSafeInteger(intervalMs)||intervalMs<1000||intervalMs>10000) throw driftError('drift_invalid_configuration',422);
  let pending=null,timer=null,stopped=false;
  const tick=()=>{
    if(pending) return pending;
    let execution;
    pending=(async()=>{
      execution=await controller.claimExecution({holderId,profileId:profile.id,leaseMs:60000});
      if(!['off','saving'].includes(execution.desired.mode)
        ||execution.desired.mode==='saving'&&execution.desired.profileId!==profile.id) throw driftError('drift_profile_unavailable');
      if(execution.desired.mode==='off'||execution.drainRequired) {
        await cancelActive();
        // Unknown/in-flight submissions remain journal-owned. Recovery never
        // guesses a job ID and never converts a timeout into an unused budget.
        await sessions.reconcile();
      }
      const snapshot=await observer.observe();
      const open=await readOpenSessions();
      if(!Array.isArray(open)||open.length>10000) throw driftError('drift_invalid_observation',422);
      const busyJobs=Math.max(snapshot.busyJobs,open.length);
      return controller.observe({revision:execution.revision,operationId:execution.operationId,execution,
        observedProfileIds:[profile.id],observedAtMs:snapshot.observedAtMs,workers:snapshot.workers,
        busyJobs,queuedJobs:snapshot.queuedJobs,
        applied:{revision:execution.revision,operationId:execution.operationId,mode:execution.desired.mode,
          profileId:execution.desired.profileId,workersMin:snapshot.workersMin,workersMax:snapshot.workersMax}});
    })().catch(async error=>{
      if(execution) try {await controller.invalidateExecution(execution);} catch {}
      throw error;
    }).finally(()=>{pending=null;});
    return pending;
  };
  const loop=async()=>{
    try {await tick();} catch(error) {try {onError(error);} catch {}}
    if(!stopped) {timer=setTimeout(loop,intervalMs);timer.unref?.();}
  };
  return Object.freeze({
    tick,
    start(){if(timer||stopped||pending) return;timer=setTimeout(loop,0);timer.unref?.();},
    async close(){stopped=true;clearTimeout(timer);timer=null;await pending?.catch(()=>{});},
  });
}

/** Server-only factory. This does not start a loop or make a provider call.
 * The original Astrid journal remains untouched; only this moving journal has
 * the SQL drift guard. Runtime hashes bind the single configured immutable bank.
 */
export async function createMovingDriftRuntime({pool,scope,configuration,endpointId,releaseDigest,bankHash,
  provider,sessionOptions={},holderId=randomUUID(),journalFactory=createSpeechJournal,
  sessionFactory=createMovingSpeechSession,storeFactory=createPostgresMovingDriftStore,
  observerFactory=createMovingDriftObserver}={}) {
  scope=validateStudioScope(scope);
  const profiles=configuration?.profiles;
  if(!Array.isArray(profiles)||profiles.length!==1
    ||profiles[0].endpointId!==endpointId||profiles[0].releaseDigest!==releaseDigest||profiles[0].bankHash!==bankHash) {
    throw driftError('drift_invalid_configuration',422);
  }
  const profile=profiles[0],caps={connected:true,requireExecutor:true};
  const make=store=>createMovingDriftController({store,profiles,capabilities:caps});
  const controller=make(storeFactory({pool,environmentId:scope.environment}));
  const pin=async({endpointId:requested,signal}={})=>{
    signal?.throwIfAborted();
    if(requested!==profile.endpointId) throw driftError('drift_not_admitting');
    const status=await controller.status();
    const admission=await controller.authorizeAdmission({revision:status.revision,profileId:profile.id});
    signal?.throwIfAborted();
    return Object.freeze(admission);
  };
  const journal=await journalFactory({pool,environmentId:scope.environment,driftControl:{scope,
    guard:({client,...input})=>make(storeFactory({environmentId:scope.environment,
      transaction:work=>work(client)})).guardAdmission(input)}});
  const sessions=sessionFactory({...sessionOptions,journal,scope,endpointId,provider,
    release:provider.release,workerState:provider.workerState,driftControl:{pin}});
  let cancelActive=async()=>{};
  const executor=createMovingDriftExecutor({controller,profile,holderId,sessions,
    observer:observerFactory({profile,provider}),cancelActive:()=>cancelActive(),
    readOpenSessions:()=>journal.listMovingSessions({scope}),
    onError:error=>console.warn(JSON.stringify({event:'moving_drift_readback_failed',
      code:/^drift_[a-z_]+$/.test(error?.code??'')?error.code:'drift_observation_unverified'}))});
  return Object.freeze({controller,sessions,assertAvailable:()=>pin({endpointId}),
    start(cancel){if(typeof cancel!=='function') throw driftError('drift_invalid_configuration',422);cancelActive=cancel;executor.start();},
    tick:executor.tick,close:executor.close});
}
