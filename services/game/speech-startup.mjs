import {StudioError} from '../../packages/shared/studio-error.mjs';
import {exactPlatformOrigin} from '../../packages/navigation/server/platform-routing.mjs';
import {movingDriftConfiguration, movingDriftDealerProfile, MOVING_DRIFT_DEALER_ID} from '../../packages/presentation/contracts/moving-drift.mjs';

// One budget for the complete optional bank set, leaving 25 s of the existing
// 30 s child readiness window for mandatory game startup. Never extend that window.
export const BANK_PREFLIGHT_MS = 5000;
class SpeechUnavailable extends Error {
  constructor(reason='configuration_or_bank_invalid') { super(reason); this.reason=reason; }
}
async function bankPreflight(work, timeoutMs) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs<1 || timeoutMs>BANK_PREFLIGHT_MS) throw new RangeError('invalid_bank_preflight_budget');
  const controller=new AbortController();
  let timer;
  const deadline=new Promise((_,reject)=>{
    timer=setTimeout(()=>{
      const error=new SpeechUnavailable('bank_preflight_timeout');
      controller.abort(error); reject(error);
    },timeoutMs);
  });
  // Only bank validation runs in this race. Its late completion cannot create
  // a lane, reconcile a job, or install a listener after the deadline wins.
  try { return await Promise.race([Promise.resolve().then(()=>work(controller.signal)),deadline]); }
  finally { clearTimeout(timer); }
}
const unavailable = () => { throw new SpeechUnavailable(); };
const bankCodes = new Set(['moving_bank_artifacts_invalid','moving_bank_invalid_sources',
  'moving_bank_invalid_source','moving_bank_invalid_rest','moving_bank_sources_changed']);

// No provider, journal or listener exists during this stage. Only artifact/data
// errors are optional; programming, filesystem and database failures propagate.
async function artifact(work) {
  try { return await work(); }
  catch (error) {
    if (error instanceof StudioError || error instanceof SyntaxError
      || ['AbortError','TimeoutError'].includes(error?.name) || bankCodes.has(error?.message)) unavailable();
    throw error;
  }
}

/** Validate every immutable bank before creating any lane. Lane factories may
 * check SQL readiness: those errors must remain fatal. Acquired resources are
 * registered before reconciliation, and closed on every subsequent failure. */
export async function startMovingSpeech({env, loadBank, verifyFile, createLane, createService, onRecovery = () => {}, bankTimeoutMs = BANK_PREFLIGHT_MS}) {
  // Public game identity is mandatory, not an optional speech failure.
  exactPlatformOrigin(env.PUBLIC_URL, 'PUBLIC_URL');
  let configuration, records, workerOrigin;
  try {
    try {
      workerOrigin=exactPlatformOrigin(env.CROUPIER_MOVING_SPEECH_WORKER_ORIGIN, 'CROUPIER_MOVING_SPEECH_WORKER_ORIGIN');
      configuration=movingDriftConfiguration(env);
      records=JSON.parse(env.CROUPIER_MOVING_SPEECH_BANK_RECORDS ?? 'null');
      if (!configuration || !records || typeof records!=='object' || Array.isArray(records)
        || Object.keys(records).length<1 || Object.keys(records).length>8
        || Object.keys(records).some(id=>!MOVING_DRIFT_DEALER_ID.test(id))) unavailable();
      if (configuration.profiles.length!==Object.keys(records).length) unavailable();
    } catch { unavailable(); }
    const verified=await bankPreflight(async signal=>{
      const banks=[];
      for (const [dealerId,record] of Object.entries(records)) {
        signal.throwIfAborted();
        const bank=await artifact(()=>loadBank(record,{signal}));
        signal.throwIfAborted();
        const profile=movingDriftDealerProfile(configuration,dealerId);
        if (bank.sourceSet.dealerId!==dealerId || !profile || profile.bankHash!==bank.archive.sha256
          || profile.releaseDigest!==env.CROUPIER_MOVING_SPEECH_RELEASE_SHA256) unavailable();
        await artifact(()=>verifyFile(bank.archive,{signal}));
        signal.throwIfAborted();
        await artifact(()=>verifyFile(bank.receipt,{signal}));
        signal.throwIfAborted();
        banks.push({dealerId,bank,profile});
      }
      return banks;
    },bankTimeoutMs);
    const lanes=[];
    let service;
    const close=async()=>{
      const results=await Promise.allSettled([()=>service?.close(), ...lanes.map(lane=>()=>lane.driftRuntime.close())]
        .map(work=>Promise.resolve().then(work)));
      const failures=results.filter(result=>result.status==='rejected');
      if (failures.length) throw new AggregateError(failures.map(result=>result.reason), 'speech_startup_cleanup_failed');
    };
    try {
      for (const lane of verified) {
        const driftRuntime=await createLane({...lane,configuration,workerOrigin});
        lanes.push({...lane,driftRuntime});
      }
      // Readiness of all journals precedes recovery and executor/provider work.
      for (const {dealerId,driftRuntime} of lanes) {
        const recovery=await driftRuntime.sessions.reconcile();
        if (recovery.unresolved.length) onRecovery({dealerId,unresolved:recovery.unresolved.length});
      }
      service=await createService(lanes);
      for (const {dealerId,driftRuntime} of lanes) driftRuntime.start(()=>service.cancelDealer(dealerId));
      return {service,lanes,close,status:'ready'};
    } catch (error) {
      try { await close(); } catch (cleanup) { throw new AggregateError([error,cleanup], 'speech_startup_failed'); }
      throw error;
    }
  } catch (error) {
    if (!(error instanceof SpeechUnavailable)) throw error;
    return {service:null,lanes:[],status:'unavailable',reason:error.reason};
  }
}
