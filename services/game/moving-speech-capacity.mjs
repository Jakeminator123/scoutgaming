import { MOVING_SPEECH_LIMITS } from './moving-speech-limits.mjs';
import { verifyMovingWorkerRelease } from './moving-speech-transport.mjs';

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const OWN_IMAGE = /^ghcr\.io\/jakeminator123\/moving-gpu-worker@sha256:[a-f0-9]{64}$/;
const WORKERS = ['idle','running','initializing','ready','throttled','unhealthy'];
const JOBS = ['completed','failed','inProgress','inQueue','retried'];
const fail = () => { throw Object.assign(Error('generated_speech_moving_capacity_unverified'), { code:'generated_speech_moving_capacity_unverified', statusCode:409 }); };
const fresh = (stamp, now) => Number.isSafeInteger(stamp) && stamp <= now && now-stamp <= 15000;
const counter = value => Number.isSafeInteger(value) && value >= 0;

/** Trusted server observations only, never browser input. This proves an owned
 * endpoint can receive ONE journal-fenced job; it does not claim the GPU is
 * stopped or free of cost. Recovery and legacy session drain remain separate.
 * RunPod GET/POST is not atomic: an external API submitter cannot be excluded
 * by these observations. This endpoint must be exclusive to this journal.
 * `ready` is independent Flashboot/cache capacity, not a lower bound for
 * running workers. A warm-capacity receipt does not prove a hot model. */
export function verifyMovingCapacity(proof, {endpointId, now=Date.now()}={}) {
  const {release, health, observedAtMs} = proof ?? {};
  if (proof?.schemaVersion !== 1 || !fresh(observedAtMs,now) || !fresh(release?.observedAtMs,now)
    || !OWN_IMAGE.test(release?.expectedImage ?? '')) fail();
  let verified;
  try { verified=verifyMovingWorkerRelease(release,now); } catch { fail(); }
  const limits=release.capacity, workers=health?.workers, jobs=health?.jobs;
  if (verified.endpointId !== endpointId || !limits || limits.workersMin !== 0 || limits.workersMax !== 1
    || !ID.test(limits.templateId ?? '') || !Number.isInteger(limits.idleTimeout)
    || release.templateCorroboration?.source !== 'full-template'
    || release.templateCorroboration.templateId !== limits.templateId || !fresh(release.templateCorroboration.observedAtMs,now)
    || limits.idleTimeout < 0 || limits.idleTimeout*1000 > MOVING_SPEECH_LIMITS.providerIdleMs
    || !workers || !jobs || WORKERS.some(key=>!counter(workers[key])) || JOBS.some(key=>!counter(jobs[key]))
    || jobs.inProgress !== 0 || jobs.inQueue !== 0 || workers.unhealthy !== 0
    || workers.initializing !== 0 || workers.throttled !== 0 || workers.running > 1
    || verified.activeWorkers !== workers.running
    || release.workers.workers.some(worker=>worker.state === undefined || worker.state === 'unknown')
    || !Array.isArray(limits.activePods) || limits.activePods.length !== workers.running) fail();
  for (const pod of limits.activePods) {
    if (!ID.test(pod?.id ?? '') || pod.state !== 'active' || pod.image !== verified.image
      || pod.version !== verified.endpointVersion) fail();
  }
  return Object.freeze({mode:workers.running === 1 ? 'warm':'cold', endpointId,
    image:verified.image, endpointVersion:verified.endpointVersion,
    workerId:limits.activePods[0]?.id ?? null, idleTailMs:limits.idleTimeout*1000, observedAtMs});
}
