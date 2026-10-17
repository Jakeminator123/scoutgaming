import { MOVING_SPEECH_LIMITS } from './moving-speech-limits.mjs';
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
        || value.gpuCount !== 1 || Object.hasOwn(value,'workers') && !Array.isArray(value.workers)) fail('moving_runpod_limits_changed');
      let workers=value.workers,workersCorroboration;
      if (!Object.hasOwn(value,'workers')) {
        // A filter alone does not prove ownership. Bind each returned live pod
        // to this endpoint/template, then retain the full release verification.
        const pods=await call(`https://rest.runpod.io/v1/pods?endpointId=${endpointId}&includeWorkers=true`,{signal});
        if (!Array.isArray(pods) || pods.length > value.workersMax) fail('moving_runpod_workers_unknown');
        for (const pod of pods) {
          if (!pod || typeof pod !== 'object' || Array.isArray(pod) || typeof pod.id !== 'string' || !ID.test(pod.id)
            || pod.endpointId !== endpointId || pod.templateId !== value.templateId) fail('moving_runpod_workers_unknown');
          const imageFields=['image','imageName'].filter(key=>Object.hasOwn(pod,key));
          if (!imageFields.length || imageFields.some(key=>pod[key] !== expectedImage)
            || !Number.isSafeInteger(pod.slsVersion) || pod.slsVersion < 0 || pod.slsVersion !== value.version) fail('moving_worker_release_mismatch');
        }
        workers=pods;
        workersCorroboration={source:'owned-endpoint-pods',endpointId,observedAtMs:now(),count:pods.length};
      }
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
        workers:{endpointVersion:value.version,workers:workers.map(worker=>({
          image:worker.image ?? worker.imageName,version:worker.slsVersion,isStale:worker.slsVersion !== value.version}))},
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
      const value=await call(base+'/health',{signal}), workers=value?.workers;
      if (!workers || ['idle','running','initializing','ready','throttled','unhealthy'].some(key=>
        !Number.isSafeInteger(workers[key]) || workers[key] < 0)) fail('moving_runpod_worker_state_unknown');
      return {workers:workers.idle+workers.running+workers.initializing+workers.ready+workers.throttled+workers.unhealthy,
        busy:workers.running,available:workers.idle+workers.ready};
    },
  });
}
