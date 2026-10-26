import { createHash } from 'node:crypto';
import {studioRoots} from './studio-roots.mjs';
import { Worker } from 'node:worker_threads';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { StudioStorageError } from '../../../packages/studio-registry/server/document-contract.mjs';
import { MAX_LAYER_ASSET_BYTES } from '../../../packages/presentation/contracts/layer-asset-contract.mjs';
import { withVerifiedPrivateMediaFile } from './cloud-media-store.mjs';
import { normalizeMediaTiming,mediaTimingSpeechIdentity } from '../../../packages/presentation/contracts/media-timing.mjs';

export const LAYER_INSPECTION_LIMITS=Object.freeze({fileBytes:MAX_LAYER_ASSET_BYTES,pixels:64_000_000,
  videoReadBytes:16*1024*1024,readBytes:4*1024*1024,reads:4096,timeoutMs:5000});
const fail=(code,status=422)=>{throw new StudioStorageError(code,status);};
let active=0;
let pending=null;

// The source worker is explicitly traced by Next. Its own module resolution must
// reach the packaged Sharp/Mediabunny dependencies, not a webpack route chunk.
function workerPath() {
  const direct=join(process.cwd(),'lib','layer-media-inspection-worker.mjs');
  return existsSync(direct)?direct:join(studioRoots().appRoot,'lib','layer-media-inspection-worker.mjs');
}

export async function inspectVerifiedLayerFile(handle,record,{signal,timeoutMs=LAYER_INSPECTION_LIMITS.timeoutMs,timing=false}={}) {
  if(!Number.isSafeInteger(record.size)||record.size<16||record.size>LAYER_INSPECTION_LIMITS.fileBytes)fail('studio_media_inspection_limit');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>LAYER_INSPECTION_LIMITS.timeoutMs)fail('studio_media_inspection_configuration',503);
  if(signal?.aborted)fail('studio_media_inspection_cancelled',408);
  // Sharp uses native/external memory outside worker resourceLimits. One active
  // decode per instance plus the byte/pixel limits bounds that cost; no wait queue.
  if(active)fail('studio_media_inspection_busy',503);
  active++;
  let worker,timer;
  try {
    worker=new Worker(workerPath(),{workerData:{fd:handle.fd,size:record.size,contentType:record.contentType,limits:LAYER_INSPECTION_LIMITS,timing},stdout:true,stderr:true,
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
        else error=new StudioStorageError(['studio_media_inspection_limit','studio_media_timing_unsupported'].includes(message?.code)?message.code:'studio_invalid_media_format',422);
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


// Caller resolves an authorized scoped record. This only measures its immutable
// bytes; persistence must recheck that record and the document revision.
export async function inspectMediaTiming(record,options={}) {
  if(record.contentType!=='video/mp4')fail('studio_media_timing_unsupported');
  if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(record.id??''))fail('studio_invalid_media');
  if(record.provider!==undefined && record.provider!=='vercel-blob')fail('studio_invalid_media');
  const mediaId=record.id,source={provider:'vercel-blob',pathname:record.pathname,sha256:record.sha256,size:record.size,contentType:record.contentType};
  const stored=record.classification?.recordedSpeech??record.recordedSpeech??null;
  const speech=options.recordedSpeech??stored;
  const identityText=speech==null?null:mediaTimingSpeechIdentity(speech);
  const identityHash=identityText===null?null:createHash('sha256').update(identityText).digest('hex');
  if(stored && mediaTimingSpeechIdentity(stored)!==identityText)fail('studio_media_timing_mismatch');
  const key=JSON.stringify(['timing',mediaId,source.pathname,source.sha256,source.size,source.contentType,identityHash]);
  if(pending){if(pending.key===key)return pending.promise;fail('studio_media_inspection_busy',503);}
  const promise=withVerifiedPrivateMediaFile(source,async handle=>{
    const measured=await inspectVerifiedLayerFile(handle,source,{signal:options.signal,timing:true});
    try {
      if(identityText!==null) {
        const identity=JSON.parse(identityText);
        if(identity.videoSha256!==source.sha256 || identity.frameCount!==measured.video.frameCount || Math.abs(identity.fps-measured.video.fps)>1e-9)fail('studio_media_timing_mismatch');
      }
      return normalizeMediaTiming({schemaVersion:1,mediaId,sha256:source.sha256,size:source.size,
        recordedSpeechIdentitySha256:identityHash,...measured},
        {mediaId,sha256:source.sha256,size:source.size,recordedSpeechIdentitySha256:identityHash});
    } catch {fail('studio_media_timing_mismatch');}
  },options);
  pending={key,promise};
  try{return await promise;}finally{pending=null;}
}
