import {StudioError} from '../../packages/shared/studio-error.mjs';
import {exactPlatformOrigin} from '../../packages/navigation/server/platform-routing.mjs';
import {movingDriftConfiguration, movingDriftDealerProfile, MOVING_DRIFT_DEALER_ID} from '../../packages/presentation/contracts/moving-drift.mjs';

class SpeechUnavailable extends Error {}
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
export async function startMovingSpeech({env, loadBank, verifyFile, createLane, createService, onRecovery = () => {}}) {
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
    const verified=[];
    for (const [dealerId,record] of Object.entries(records)) {
      const bank=await artifact(()=>loadBank(record));
      const profile=movingDriftDealerProfile(configuration,dealerId);
      if (bank.sourceSet.dealerId!==dealerId || !profile || profile.bankHash!==bank.archive.sha256
        || profile.releaseDigest!==env.CROUPIER_MOVING_SPEECH_RELEASE_SHA256) unavailable();
      await artifact(()=>verifyFile(bank.archive));
      await artifact(()=>verifyFile(bank.receipt));
      verified.push({dealerId,bank,profile});
    }
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
    return {service:null,lanes:[],status:'unavailable',reason:'configuration_or_bank_invalid'};
  }
}
