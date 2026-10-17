import { Worker } from 'node:worker_threads';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { StudioStorageError } from '../../packages/studio-registry/server/document-contract.mjs';
import { MAX_LAYER_ASSET_BYTES } from '../../packages/presentation/contracts/layer-asset-contract.mjs';
import { withVerifiedPrivateMediaFile } from './cloud-media-store.mjs';

export const LAYER_INSPECTION_LIMITS=Object.freeze({fileBytes:MAX_LAYER_ASSET_BYTES,pixels:64_000_000,
  videoReadBytes:16*1024*1024,readBytes:4*1024*1024,reads:4096,timeoutMs:5000});
const fail=(code,status=422)=>{throw new StudioStorageError(code,status);};
let active=0;
let pending=null;

// The source worker is explicitly traced by Next. Its own module resolution must
// reach the packaged Sharp/Mediabunny dependencies, not a webpack route chunk.
function workerPath() {
  const direct=join(process.cwd(),'lib','layer-media-inspection-worker.mjs');
  return existsSync(direct)?direct:join(process.cwd(),'lab','lib','layer-media-inspection-worker.mjs');
}

export async function inspectVerifiedLayerFile(handle,record,{signal,timeoutMs=LAYER_INSPECTION_LIMITS.timeoutMs}={}) {
  if(!Number.isSafeInteger(record.size)||record.size<16||record.size>LAYER_INSPECTION_LIMITS.fileBytes)fail('studio_media_inspection_limit');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>LAYER_INSPECTION_LIMITS.timeoutMs)fail('studio_media_inspection_configuration',503);
  if(signal?.aborted)fail('studio_media_inspection_cancelled',408);
  // Sharp uses native/external memory outside worker resourceLimits. One active
  // decode per instance plus the byte/pixel limits bounds that cost; no wait queue.
  if(active)fail('studio_media_inspection_busy',503);
  active++;
  let worker,timer;
  try {
    worker=new Worker(workerPath(),{workerData:{fd:handle.fd,size:record.size,contentType:record.contentType,limits:LAYER_INSPECTION_LIMITS},stdout:true,stderr:true,
      resourceLimits:{maxOldGenerationSizeMb:96,maxYoungGenerationSizeMb:16,stackSizeMb:4}});
    worker.stdout.resume();worker.stderr.resume(); // Parser diagnostics never expose uploaded metadata.
    return await new Promise((resolve,reject)=>{
      let result,error;
      const stop=(code,status)=>{error??=new StudioStorageError(code,status);void worker.terminate();};
      const abort=()=>stop('studio_media_inspection_cancelled',408);
      signal?.addEventListener('abort',abort,{once:true});
      timer=setTimeout(()=>stop('studio_media_inspection_timeout',422),timeoutMs);
      worker.once('message',message=>{
        if(message?.ok===true)result=message.value;
        else error=new StudioStorageError(message?.code==='studio_media_inspection_limit'?message.code:'studio_invalid_media_format',422);
      });
      worker.once('error',()=>{error??=new StudioStorageError('studio_media_inspection_failed',503);});
      // Do not release the descriptor or concurrency slot until the thread exits.
      worker.once('exit',code=>{
        clearTimeout(timer);signal?.removeEventListener('abort',abort);
        if(error)reject(error);
        else if(code!==0||!result)reject(new StudioStorageError('studio_media_inspection_failed',503));
        else resolve(result);
      });
      if(signal?.aborted)abort();
    });
  } finally {clearTimeout(timer);active--;}
}

export async function inspectLayerMedia(record,options={}) {
  const key=JSON.stringify([record.pathname,record.sha256,record.size,record.contentType]);
  if(pending){if(pending.key===key)return pending.promise;fail('studio_media_inspection_busy',503);}
  const promise=withVerifiedPrivateMediaFile(record,handle=>inspectVerifiedLayerFile(handle,record,{signal:options.signal}),options);
  pending={key,promise};
  try{return await promise;}finally{pending=null;}
}
