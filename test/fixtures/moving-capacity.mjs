export function movingCapacityFixture({warm=true, endpointId='endpointfixture', now=Date.now()}={}) {
  const image='ghcr.io/jakeminator123/moving-gpu-worker@sha256:'+'a'.repeat(64);
  const worker={id:'owned-pod',state:'active',image,version:3,isStale:false};
  return {schemaVersion:1,observedAtMs:now,
    release:{expectedImage:image,endpoint:{id:endpointId,image},observedAtMs:now,
      templateCorroboration:{source:'full-template',templateId:'owned-template',observedAtMs:now},
      workers:{endpointVersion:3,workersMax:1,workers:warm?[worker]:[]},
      capacity:{workersMin:0,workersMax:1,idleTimeout:60,templateId:'owned-template',activePods:warm?[worker]:[]}},
    health:{workers:{idle:0,running:warm?1:0,initializing:0,ready:warm?1:0,throttled:0,unhealthy:0},
      jobs:{completed:1,failed:0,inProgress:0,inQueue:0,retried:0}}};
}
