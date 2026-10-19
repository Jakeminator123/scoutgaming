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
      const finishedAt=now();
      requireEvidence(fresh(startedAt,finishedAt));
      const release=verifyMovingWorkerRelease(receipt,finishedAt),limits=receipt.capacity;
      requireEvidence(release.endpointId===endpointId&&fresh(release.observedAtMs,finishedAt)
        &&limits?.workersMin===0&&limits.workersMax===1&&receipt.workers.workersMax===1
        &&Number.isInteger(limits.idleTimeout)&&limits.idleTimeout>=0&&limits.idleTimeout<=60
        &&id(limits.templateId)&&receipt.templateCorroboration?.source==='full-template'
        &&receipt.templateCorroboration.templateId===limits.templateId
        &&fresh(receipt.templateCorroboration.observedAtMs,finishedAt));
      // Preserve the earliest evidence time; completing a slow GET must not renew it.
      const observedAtMs=Math.min(startedAt,release.observedAtMs,receipt.templateCorroboration.observedAtMs);
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
      const occupiedHealth=workers.running+workers.unhealthy+workers.throttled;
      // Live pods the health counters do not yet count as running. Observed on
      // 19 October 2026 with real provider reads: a job dispatched to a cached
      // idle slot shows the pod RUNNING with jobs.inProgress=1 for about twelve
      // seconds while health still reports idle=1, running=0, initializing=0.
      // Such a pod is starting, so it may be explained by `initializing` or by
      // the cached `idle` slot it is warming from; it is never ready or hidden.
      const startingPods=pods.length-occupiedHealth;
      // The mirror lag at shutdown, read live on 19 October 2026 (16:53:04–:24
      // and 17:04:44–17:05:01 UTC): about sixty seconds after a job the pod
      // record is already EXITED while health still counts running=1 for some
      // twenty seconds. A single such unlisted healthy worker with no job in
      // progress is reported as one busy job, so the executor keeps draining
      // semantics instead of refusing every admission in that window. Two
      // unlisted workers, an unhealthy/throttled count or a job in progress
      // without a pod remain contradictions.
      const unlistedRunning=pods.length===0&&workers.running===1&&workers.unhealthy===0&&workers.throttled===0
        &&jobs.inProgress===0?1:0;
      requireEvidence((startingPods>=0||unlistedRunning===1)
        &&startingPods<=workers.initializing+workers.idle&&(jobs.inProgress===0||pods.length>0));
      // Initializing may include an unbilled cache slot (also recognized by the
      // admission capacity contract). Subtract only fresh matching EXITED rows;
      // never hide missing live pods, unhealthy capacity or unmatched counters.
      const currentCache=receipt.workers.workers.filter(worker=>worker.state==='scaled-down'
        &&worker.image===release.image&&worker.version===release.endpointVersion&&worker.isStale===false).length;
      const initializingPods=Math.max(0,Math.min(startingPods,workers.initializing));
      const cachedInitializing=workers.initializing-initializingPods;
      requireEvidence(cachedInitializing<=currentCache);
      const observedWorkers=pods.map((pod,index)=>{
        const entry=occupied[index],state=pod?.state??'unknown',entryState=entry.state??'unknown';
        requireEvidence(pod&&id(pod.id)&&(entry.id===undefined||entry.id===pod.id)&&state===entryState&&occupies(pod)
          &&pod.image===release.image&&pod.version===release.endpointVersion&&pod.isStale===false);
        return {id:pod.id,profileId,state:state==='unknown'||workers.unhealthy>0||workers.throttled>0?'unknown':
          startingPods>0?'initializing':'running',gpu:'',releaseDigest:null,bankHash:null,modelReady:false};
      });
      return {observedAtMs,workers:observedWorkers,busyJobs:jobs.inProgress+unlistedRunning,queuedJobs:jobs.inQueue,
        workersMin:0,workersMax:1};
    } catch {
      // Never turn provider errors, partial reads or contradictory receipts into
      // an empty fleet. No provider diagnostics/credentials enter the public error.
      throw driftError('drift_observation_unverified',503);
    }
  }});
}
