import { MOVING_SPEECH_LIMITS } from './moving-speech-limits.mjs';
import { verifyMovingWorkerRelease } from './moving-speech-transport.mjs';
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const fail = code => {throw Object.assign(Error(code),{code});};

/** Provider worker records are pods. `desiredStatus` RUNNING is the only state
 * that occupies a billed GPU (cold start, processing or idle-timeout wait).
 * EXITED is a scaled-down slot the provider keeps listed while it caches or
 * pulls the image; it costs nothing and is replaced when outdated. TERMINATED
 * is history. Anything else, including a missing field, is uncertain and is
 * counted as active so it can only refuse admission, never widen it. */
export const MOVING_WORKER_STATES = Object.freeze({RUNNING:'active',EXITED:'scaled-down',TERMINATED:'terminated'});
export function classifyMovingWorkerRecord(record) {
  const status = record?.desiredStatus;
  if (status === undefined) return 'unknown';
  return typeof status === 'string' && Object.hasOwn(MOVING_WORKER_STATES, status.toUpperCase()) ? MOVING_WORKER_STATES[status.toUpperCase()] : 'unknown';
}
const occupiesGpu = state => state === 'active' || state === 'unknown';
// The provider pre-provisions at most this many cached slots beyond the
// configured maximum; more scaled-down records mean we no longer understand
// the endpoint and must not treat the read as capacity evidence.
export const MOVING_SCALED_DOWN_SLOT_ALLOWANCE = 2;

/** Pure: records already bound to the owned endpoint/template by the caller.
 * Returns receipt rows plus counts; throws on uncertain or exceeded capacity.
 * Stale image/version on a RUNNING record fails (a paid worker we do not own
 * the release of); on a scaled-down record it is reported, not fatal, because
 * the provider replaces outdated cached slots itself and bills nothing. */
export function summarizeMovingWorkerRecords(records, {expectedImage, endpointVersion, workersMax}) {
  if (!Array.isArray(records) || !Number.isSafeInteger(workersMax) || workersMax < 0) fail('moving_runpod_workers_unknown');
  const workers = records.map(record => {
    const state = classifyMovingWorkerRecord(record);
    const image = record?.image ?? record?.imageName, version = record?.slsVersion;
    const isStale = image !== expectedImage || version !== endpointVersion;
    return {image,version,isStale,state};
  });
  const active = workers.filter(worker => occupiesGpu(worker.state)).length;
  const scaledDown = workers.filter(worker => worker.state === 'scaled-down').length;
  const terminated = workers.filter(worker => worker.state === 'terminated').length;
  if (active > workersMax) fail('moving_runpod_active_workers_exceeded');
  if (scaledDown > workersMax + MOVING_SCALED_DOWN_SLOT_ALLOWANCE) fail('moving_runpod_workers_unknown');
  return {workers,counts:{active,scaledDown,terminated,total:workers.length}};
}

/** Health counters are the provider's own capacity telemetry. idle,
 * initializing and throttled workers are scaled down and unbilled; running and
 * ready occupy a GPU; unhealthy is uncertain and still blocks paid admission. */
export function summarizeMovingWorkerHealth(health) {
  const workers = health?.workers;
  if (!workers || ['idle','running','initializing','ready','throttled','unhealthy'].some(key =>
    !Number.isSafeInteger(workers[key]) || workers[key] < 0)) fail('moving_runpod_worker_state_unknown');
  return {workers:workers.running+workers.ready+workers.unhealthy,busy:workers.running,available:workers.ready,
    scaledDown:{idle:workers.idle,initializing:workers.initializing,throttled:workers.throttled},unhealthy:workers.unhealthy,
    total:workers.idle+workers.running+workers.initializing+workers.ready+workers.throttled+workers.unhealthy};
}

/** One owned endpoint, one bounded request, no automatic submission retry.
 * Resources/credentials are provisioned separately; this cannot edit Astrid. */
export function createMovingSpeechRunPod({endpointId, apiKey, expectedImage, fetchImpl = fetch, now = Date.now} = {}) {
  if (!/^[a-z0-9]{6,64}$/.test(endpointId ?? '') || typeof apiKey !== 'string' || !apiKey || /\s/.test(apiKey)
    || !/^ghcr\.io\/jakeminator123\/moving-gpu-worker@sha256:[a-f0-9]{64}$/.test(expectedImage ?? '')) fail('moving_runpod_configuration');
  async function call(url,{body,signal}={}) {
    const timeout = AbortSignal.timeout(15000);
    const response = await fetchImpl(url,{method:body ? 'POST':'GET',redirect:'error',
      headers:{authorization:`Bearer ${apiKey}`,...(body ? {'content-type':'application/json'} : {})},
      ...(body ? {body:JSON.stringify(body)} : {}),signal:signal ? AbortSignal.any([signal,timeout]):timeout});
    if (!response.ok) {await response.body?.cancel(); fail('moving_runpod_unavailable');}
    const raw = await response.text();
    if (raw.length > 1024 * 1024) fail('moving_runpod_response_invalid');
    try {return JSON.parse(raw);} catch {fail('moving_runpod_response_invalid');}
  }
  const base = `https://api.runpod.ai/v2/${endpointId}`;
  return Object.freeze({
    async release({signal}={}) {
      const value = await call(`https://rest.runpod.io/v1/endpoints/${endpointId}?includeTemplate=true&includeWorkers=true`,{signal});
      if (value.id !== endpointId || value.workersMin !== 0 || value.workersMax !== 1
        || !Number.isInteger(value.idleTimeout) || value.idleTimeout < 0 || value.idleTimeout > 5
        || !Number.isInteger(value.executionTimeoutMs) || value.executionTimeoutMs < 1000 || value.executionTimeoutMs > 180000
        || value.gpuCount !== 1 || Object.hasOwn(value,'workers') && !Array.isArray(value.workers)) fail('moving_runpod_limits_changed');
      if (!Number.isSafeInteger(value.version) || value.version < 0) fail('moving_runpod_workers_unknown');
      let records=value.workers,workersCorroboration;
      if (!Object.hasOwn(value,'workers')) {
        // A filter alone does not prove ownership. Bind each returned live pod
        // to this endpoint/template, then retain the full release verification.
        const pods=await call(`https://rest.runpod.io/v1/pods?endpointId=${endpointId}&includeWorkers=true`,{signal});
        if (!Array.isArray(pods)) fail('moving_runpod_workers_unknown');
        for (const pod of pods) {
          if (!pod || typeof pod !== 'object' || Array.isArray(pod) || typeof pod.id !== 'string' || !ID.test(pod.id)
            || pod.endpointId !== endpointId || pod.templateId !== value.templateId) fail('moving_runpod_workers_unknown');
          const imageFields=['image','imageName'].filter(key=>Object.hasOwn(pod,key));
          if (!imageFields.length || !Number.isSafeInteger(pod.slsVersion) || pod.slsVersion < 0) fail('moving_worker_release_mismatch');
          // A paid (or uncertain) worker must run exactly our release.
          if (occupiesGpu(classifyMovingWorkerRecord(pod))
            && (imageFields.some(key=>pod[key] !== expectedImage) || pod.slsVersion !== value.version)) fail('moving_worker_release_mismatch');
        }
        records=pods;
        workersCorroboration={source:'owned-endpoint-pods',endpointId,observedAtMs:now(),count:pods.length};
      }
      const summary=summarizeMovingWorkerRecords(records,{expectedImage,endpointVersion:value.version,workersMax:value.workersMax});
      if (!ID.test(value.templateId ?? '')) fail('moving_runpod_template_unverified');
      const template=await call(`https://rest.runpod.io/v1/templates/${value.templateId}`,{signal});
      if (template?.id !== value.templateId || template.imageName !== expectedImage) fail('moving_runpod_template_unverified');
      // Embedded templates are partial. Full GET binds the image to the exact
      // templateId; any presented embedded identity/image must still agree.
      if (Object.hasOwn(value,'template')) {
        const embedded=value.template;
        if (!embedded || typeof embedded !== 'object' || Array.isArray(embedded)
          || ['id','imageName'].some(key=>Object.hasOwn(embedded,key) && embedded[key] !== template[key])) fail('moving_runpod_template_unverified');
      }
      const receipt = {expectedImage,observedAtMs:now(),endpoint:{id:value.id,image:template.imageName},
        templateCorroboration:{source:'full-template',templateId:template.id,observedAtMs:now()},
        workers:{endpointVersion:value.version,workersMax:value.workersMax,counts:summary.counts,workers:summary.workers},
        ...(workersCorroboration ? {workersCorroboration} : {})};
      verifyMovingWorkerRelease(receipt,now());
      return receipt;
    },
    async submit({input,signal}) {
      const value = await call(base+'/run',{signal,body:{input,policy:{executionTimeout:MOVING_SPEECH_LIMITS.executionMs,ttl:MOVING_SPEECH_LIMITS.jobTtlMs}}});
      if (!ID.test(value?.id ?? '')) fail('moving_runpod_submission_uncertain');
      return {id:value.id,jobId:value.id,status:value.status};
    },
    async cancel({jobId,signal}) {
      if (!ID.test(jobId ?? '')) fail('moving_runpod_job_invalid');
      const value = await call(base+'/cancel/'+encodeURIComponent(jobId),{signal,body:{}});
      if (value.id !== jobId) fail('moving_runpod_job_mismatch');
      return {id:value.id,status:value.status};
    },
    async status({jobId,signal}) {
      if (!ID.test(jobId ?? '')) fail('moving_runpod_job_invalid');
      const value = await call(base+'/status/'+encodeURIComponent(jobId),{signal});
      if (value.id !== jobId) fail('moving_runpod_job_mismatch');
      return {id:value.id,status:value.status};
    },
    async workerState({signal}={}) {
      return summarizeMovingWorkerHealth(await call(base+'/health',{signal}));
    },
  });
}
