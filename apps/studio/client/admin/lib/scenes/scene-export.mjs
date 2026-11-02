// The browser half of "Exportera miljöbild". The server renders the saved environment with sharp; this
// side only grabs one frame of the dealer's idle clip, because the server has no video decoder. The frame
// is sent as it is filmed (the server applies the clip's framing and keying), WebP when the browser can
// encode it, else PNG, and made smaller until it fits the request limit.
export const SCENE_EXPORT_PATH='/studio/api/layer-assets/scene-export';
const FRAME_LIMIT=3_000_000,FRAME_TIMEOUT_MS=20_000;

const MESSAGES=Object.freeze({
  scene_export_stale:'Miljön har sparats om sedan du öppnade den. Läs in den igen och exportera.',
  scene_export_lane_missing:'Miljön finns inte längre i det sparade projektet.',
  scene_export_dealer_invalid:'Dealerns viloklipp kan inte användas i miljöbilden.',
  scene_export_empty:'Miljön har ingen bakgrund, bordsgrafik eller dealer att visa.',
  scene_export_invalid_request:'Bilden kunde inte skickas. Försök igen.',
  scene_export_unavailable:'Miljöbilden kunde inte skapas just nu. Försök igen.',
  studio_presentation_runtime_update_required:'Spelservern behöver uppdateras innan miljöbilder kan sparas. Utkastet är kvar.',
  studio_request_rejected:'Du saknar behörighet att spara material.',
  studio_login_required:'Din session har gått ut. Logga in igen.',
});
/** A short Swedish message for a fixed server code; unknown codes get a general one. */
export function sceneExportMessage(code) {
  return Object.hasOwn(MESSAGES,code??'')?MESSAGES[code]:'Miljöbilden kunde inte sparas. Försök igen.';
}

/** The exact request body: the saved environment, its revision and, when there is one, the dealer's frame. */
export function sceneExportBody({laneId,expectedRevision,dealer=null}) {
  return {laneId,expectedRevision,...(dealer?{dealer:{videoId:dealer.videoId,frame:dealer.frame}}:{})};
}

const blobOf=(canvas,type,quality)=>new Promise(resolve=>canvas.toBlob(resolve,type,quality));
const dataUrlOf=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});

/** One frame of a same-origin video (half a second in, or its middle) as a data URL within the request limit. */
export async function captureVideoFrame(url,{signal,maxEdge=1920}={}) {
  const deadline=AbortSignal.any([AbortSignal.timeout(FRAME_TIMEOUT_MS),...(signal?[signal]:[])]);
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';
  const next=event=>new Promise((resolve,reject)=>{
    const done=()=>{video.removeEventListener(event,ok);video.removeEventListener('error',failed);deadline.removeEventListener('abort',aborted);};
    const ok=()=>{done();resolve();},failed=()=>{done();reject(Error('video_unreadable'));},aborted=()=>{done();reject(deadline.reason??Error('aborted'));};
    video.addEventListener(event,ok,{once:true});video.addEventListener('error',failed,{once:true});deadline.addEventListener('abort',aborted,{once:true});
  });
  try {
    deadline.throwIfAborted();
    const loaded=next('loadeddata');video.src=url;video.load();await loaded;
    const seeked=next('seeked');video.currentTime=Math.min(.5,(Number.isFinite(video.duration)&&video.duration>0?video.duration:1)/2);await seeked;
    if (!video.videoWidth||!video.videoHeight) throw Error('video_unreadable');
    let scale=Math.min(1,maxEdge/Math.max(video.videoWidth,video.videoHeight));
    for (let attempt=0;attempt<4;attempt++,scale*=.75) {
      const canvas=document.createElement('canvas');canvas.width=Math.max(16,Math.round(video.videoWidth*scale));canvas.height=Math.max(16,Math.round(video.videoHeight*scale));
      canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
      let blob=await blobOf(canvas,'image/webp',.92);
      if (!blob||blob.type!=='image/webp') blob=await blobOf(canvas,'image/png');
      if (blob&&blob.size<=FRAME_LIMIT) return await dataUrlOf(blob);
    }
    throw Error('frame_too_large');
  } finally { video.removeAttribute('src');video.load(); }
}

/** Export the saved environment. `video` is the dealer's idle clip ({id, previewUrl}) or null. The dealer is left
 * out, and `dealer` says so, when the clip cannot be read in this browser; the picture is still made and saved. */
export async function exportSceneIllustration({laneId,expectedRevision,video=null,signal,fetchImpl=fetch,capture=captureVideoFrame}) {
  let dealer=null,dealerState=video?'missing':'none';
  if (video) {
    try { dealer={videoId:video.id,frame:await capture(video.previewUrl,{signal})};dealerState='included'; }
    catch (cause) { if (signal?.aborted) throw cause; }
  }
  const response=await fetchImpl(SCENE_EXPORT_PATH,{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',signal,
    headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(sceneExportBody({laneId,expectedRevision,dealer}))});
  let body=null;try { body=await response.json(); } catch { body=null; }
  if (!response.ok||body?.ok!==true||typeof body.id!=='string'||!body.project) throw Object.assign(Error(sceneExportMessage(body?.code??body?.error)),{code:body?.code??body?.error??null});
  return {id:body.id,label:body.label,project:body.project,skipped:Array.isArray(body.skipped)?body.skipped:[],dealer:dealerState};
}
