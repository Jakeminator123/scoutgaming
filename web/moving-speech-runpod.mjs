import { verifyMovingWorkerRelease } from './moving-speech-transport.mjs';
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const fail = code => {throw Object.assign(Error(code),{code});};

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
        || value.gpuCount !== 1 || !Array.isArray(value.workers)) fail('moving_runpod_limits_changed');
      let template=value.template;
      if (!template && /^[A-Za-z0-9_-]{1,128}$/.test(value.templateId ?? '')) template=await call(`https://rest.runpod.io/v1/templates/${value.templateId}`,{signal});
      const receipt = {expectedImage,observedAtMs:now(),endpoint:{id:value.id,image:template?.imageName},
        workers:{endpointVersion:value.version,workers:value.workers.map(worker=>({
          image:worker.image ?? worker.imageName,version:worker.slsVersion,isStale:worker.slsVersion !== value.version}))}};
      verifyMovingWorkerRelease(receipt,now());
      return receipt;
    },
    async submit({input,signal}) {
      const value = await call(base+'/run',{signal,body:{input,policy:{executionTimeout:180000,ttl:180000}}});
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
      const value=await call(base+'/health',{signal}), workers=value?.workers;
      if (!workers || ['idle','running','initializing','ready','throttled','unhealthy'].some(key=>
        !Number.isSafeInteger(workers[key]) || workers[key] < 0)) fail('moving_runpod_worker_state_unknown');
      return {workers:workers.idle+workers.running+workers.initializing+workers.ready+workers.throttled+workers.unhealthy,
        busy:workers.running,available:workers.idle+workers.ready};
    },
  });
}
