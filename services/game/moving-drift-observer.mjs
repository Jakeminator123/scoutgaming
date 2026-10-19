import {verifyMovingWorkerRelease} from './moving-speech-transport.mjs';
import {driftError,MOVING_DRIFT_OBSERVATION_MAX_AGE_MS as MAX_AGE} from '../../packages/presentation/contracts/moving-drift.mjs';

const WORKERS=['idle','running','initializing','ready','throttled','unhealthy'];
const JOBS=['completed','failed','inProgress','inQueue','retried'];
const counter=value=>Number.isSafeInteger(value)&&value>=0;
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const fresh=(stamp,now)=>counter(stamp)&&counter(now)&&stamp<=now&&now-stamp<=MAX_AGE;
const occupies=worker=>worker.state===undefined||worker.state==='active'||worker.state==='unknown';
const requireEvidence=condition=>{if(!condition)throw driftError('drift_observation_unverified',503);};

/** Trusted GET observations only. Endpoint deployment identity is not a running
 * model/bank attestation; the executor separately binds revision and operation. */
export function createMovingDriftObserver({profile,provider,now=Date.now}={}) {
  if(!profile||!/^[a-z][a-z0-9-]{0,31}$/.test(profile.id??'')
    ||!/^[a-z0-9]{6,64}$/.test(profile.endpointId??'')
    ||typeof provider?.release!=='function'||typeof provider?.workerState!=='function'||typeof now!=='function') {
    throw driftError('drift_invalid_configuration',422);
  }
  const profileId=profile.id,endpointId=profile.endpointId;
  return Object.freeze({async observe() {
    try {
      const startedAt=now();requireEvidence(counter(startedAt));
      const [receipt,health]=await Promise.all([provider.release(),provider.workerState()]);
      const observedAtMs=now();
      requireEvidence(fresh(startedAt,observedAtMs));
      const release=verifyMovingWorkerRelease(receipt,observedAtMs),limits=receipt.capacity;
      requireEvidence(release.endpointId===endpointId&&fresh(release.observedAtMs,observedAtMs)
        &&limits?.workersMin===0&&limits.workersMax===1&&receipt.workers.workersMax===1
        &&Number.isInteger(limits.idleTimeout)&&limits.idleTimeout>=0&&limits.idleTimeout<=60
        &&id(limits.templateId)&&receipt.templateCorroboration?.source==='full-template'
        &&receipt.templateCorroboration.templateId===limits.templateId
        &&fresh(receipt.templateCorroboration.observedAtMs,observedAtMs));
      const raw=health?.raw,workers=raw?.workers,jobs=raw?.jobs;
      requireEvidence(workers&&jobs&&WORKERS.every(key=>counter(workers[key]))&&JOBS.every(key=>counter(jobs[key])));
      // The aggregate busy count includes an idle running GPU. Public job counts
      // must come from jobs, while aggregates still corroborate this same read.
      requireEvidence(health.workers===workers.running+workers.unhealthy
        &&health.busy===Math.max(workers.running,jobs.inProgress)+jobs.inQueue
        &&health.available===Math.max(0,workers.running-jobs.inProgress));
      const pods=limits.activePods,occupied=receipt.workers.workers.filter(occupies);
      requireEvidence(Array.isArray(pods)&&pods.length===release.activeWorkers&&pods.length===occupied.length
        &&pods.length<=1&&new Set(pods.map(pod=>pod?.id)).size===pods.length);
      const occupiedHealth=workers.running+workers.initializing+workers.unhealthy+workers.throttled;
      // Cache/ready counts do not occupy a GPU. In contrast an unexplained
      // initializing/unhealthy pod can never be collapsed into an empty Off read.
      requireEvidence(occupiedHealth===pods.length&&(jobs.inProgress===0||pods.length>0));
      const observedWorkers=pods.map((pod,index)=>{
        const entry=occupied[index],state=pod?.state??'unknown',entryState=entry.state??'unknown';
        requireEvidence(pod&&id(pod.id)&&(entry.id===undefined||entry.id===pod.id)&&state===entryState&&occupies(pod)
          &&pod.image===release.image&&pod.version===release.endpointVersion&&pod.isStale===false);
        return {id:pod.id,profileId,state:state==='unknown'||workers.unhealthy>0||workers.throttled>0?'unknown':
          workers.initializing>0?'initializing':'running',gpu:'',releaseDigest:null,bankHash:null,modelReady:false};
      });
      return {observedAtMs,workers:observedWorkers,busyJobs:jobs.inProgress,queuedJobs:jobs.inQueue,
        workersMin:0,workersMax:1};
    } catch {
      // Never turn provider errors, partial reads or contradictory receipts into
      // an empty fleet. No provider diagnostics/credentials enter the public error.
      throw driftError('drift_observation_unverified',503);
    }
  }});
}
