// Browser side of "Skapa bakgrund med AI". The route only proposes images; the
// person's "Använd" registers the chosen one through the existing layer-asset
// upload (prepare, private Blob put, commit), exactly like a manual upload.
import {labUrl} from '../../../lib/lab-url.mjs';
import {uploadCompositionLayer} from '../../../lib/studio-composition.mjs';
import {layerUploadResponseError} from '../../../../../packages/presentation/contracts/layer-upload-errors.mjs';
import {registeredFilmedProfile} from '../../../../../packages/presentation/contracts/filmed-profiles/registry.mjs';
import {AI_IMAGE_ERROR_CODES,AI_IMAGE_MAX_PROPOSALS,AI_IMAGE_PROMPT_LENGTH,AI_IMAGE_REFERENCE_FILE_MAX_BYTES,AI_IMAGE_REFERENCE_MAX_BYTES,AI_IMAGE_REFERENCE_TYPES,aiImageLabel} from '../../../lib/ai-image-contract.mjs';

export const AI_IMAGE_ENDPOINT='/api/layer-assets/generate';
export const AI_IMAGE_MESSAGES=Object.freeze({
  ai_image_unavailable:'Inte anslutet. Bildtjänsten svarar inte eller saknar nyckel på servern. Försök igen senare.',
  ai_image_limit_reached:'Dagens gräns för AI-bilder är nådd. Försök igen i morgon.',
  ai_image_rejected:'Bildtjänstens innehållskontroll stoppade förslaget. Ändra beskrivningen eller referensbilden och försök igen.',
  ai_image_invalid_request:`Kontrollera beskrivningen (${AI_IMAGE_PROMPT_LENGTH.min}–${AI_IMAGE_PROMPT_LENGTH.max} tecken) och referensbilden (PNG, JPEG eller WebP).`,
});
const GENERIC='Förslagen kunde inte skapas. Försök igen.';

export class AiImageRequestError extends Error {
  constructor(code) { super(AI_IMAGE_MESSAGES[code]??GENERIC); this.code=AI_IMAGE_ERROR_CODES.includes(code)?code:null; }
}
// Only fixed codes become text; any other server body is ignored.
export function aiImageErrorMessage(error) {
  if (error?.name==='AbortError') return 'Avbrutet. Inga förslag skapades.';
  return error instanceof AiImageRequestError?error.message:GENERIC;
}
async function readCode(response) {
  try { const body=await response.json(); return typeof body?.code==='string'?body.code:null; } catch { return null; }
}
export async function readAiImageStatus({fetchImpl=fetch,signal}={}) {
  const response=await fetchImpl(labUrl(AI_IMAGE_ENDPOINT),{method:'GET',credentials:'same-origin',signal});
  if (!response.ok) throw new AiImageRequestError(await readCode(response));
  const body=await response.json();
  return {configured:body?.configured===true,dailyLimit:Number(body?.dailyLimit)||0,remaining:Number(body?.remaining)||0};
}
export async function requestAiProposals({role,prompt,preset,count,dealerId,sceneTemplate,reference},{fetchImpl=fetch,signal}={}) {
  const scene=role==='table'&&sceneTemplate?{sceneTemplate:{id:sceneTemplate.id,...(sceneTemplate.composition?{composition:sceneTemplate.composition}:{})}}:{};
  const body={role,prompt,preset,count,...(role==='table'?{dealerId,...scene}:{}),...(reference?{reference}:{})};
  const response=await fetchImpl(labUrl(AI_IMAGE_ENDPOINT),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
  if (!response.ok) throw new AiImageRequestError(await readCode(response));
  const value=await response.json();
  const images=Array.isArray(value?.images)?value.images.filter(image=>typeof image?.id==='string'&&/^data:image\/webp;base64,/.test(image.dataUrl??'')
    &&Number.isSafeInteger(image.width)&&Number.isSafeInteger(image.height)).slice(0,AI_IMAGE_MAX_PROPOSALS):[];
  if (!images.length) throw new AiImageRequestError(null);
  return {images,remaining:Number(value.remaining)||0};
}

// Table graphics follow a filmed profile's landings; other dealers have none.
export function aiTableDealers(dealers) {
  return (dealers??[]).filter(dealer=>typeof dealer?.id==='string'&&registeredFilmedProfile(dealer.id));
}
// A table is drawn for one scene template: those that allow the dealer, first
// one first. Its composition decides where the graphic sits under the cards.
export function aiSceneTemplates(templates,dealerId) {
  return (templates??[]).filter(row=>typeof row?.id==='string'&&Array.isArray(row.dealers)&&row.dealers.includes(dealerId));
}

export function dataUrlFile(dataUrl,name) {
  const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl??'');
  if (!match) throw new Error('Förslaget kunde inte läsas.');
  const binary=atob(match[2]),bytes=new Uint8Array(binary.length);
  for (let index=0;index<binary.length;index++) bytes[index]=binary.charCodeAt(index);
  return new File([bytes],name,{type:match[1]});
}

const uploadPost=fetchImpl=>async (body,signal)=>{
  const response=await fetchImpl(labUrl('/api/layer-assets/upload'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
  const value=await response.json();if(!response.ok)throw layerUploadResponseError(response.status,value);return value;
};
const blobPut=async (pathname,file,options)=>{const {put}=await import('@vercel/blob/client');return put(pathname,file,options);};

// "Använd": the chosen proposal becomes an ordinary material through the
// existing upload, labelled "AI · <short prompt>". Nothing is published.
export async function registerAiProposal(proposal,{role,prompt},{fetchImpl=fetch,put=blobPut,upload=uploadCompositionLayer,signal,onUploadProgress,onCommit}={}) {
  const file=dataUrlFile(proposal?.dataUrl,`ai-${role==='table'?'bordsgrafik':'bakgrund'}.webp`);
  return upload(file,{role,...(role==='table'?{game:'blackjack'}:{}),label:aiImageLabel(prompt),width:proposal.width,height:proposal.height},
    {post:uploadPost(fetchImpl),put,signal:signal??new AbortController().signal,onUploadProgress,onCommit});
}

function fileDataUrl(blob) {
  return blob.arrayBuffer().then(buffer=>{
    const bytes=new Uint8Array(buffer);let binary='';
    for (let index=0;index<bytes.length;index+=0x8000) binary+=String.fromCharCode(...bytes.subarray(index,index+0x8000));
    return `data:${blob.type};base64,${btoa(binary)}`;
  });
}
// The reference photo is only sent along with the request, never stored.
// Larger photos are shrunk in the browser so the request stays within limits.
export async function prepareReferenceImage(file) {
  if (!file||!AI_IMAGE_REFERENCE_TYPES.includes(file.type)) throw new Error('Referensbilden ska vara PNG, JPEG eller WebP.');
  if (file.size<16||file.size>AI_IMAGE_REFERENCE_FILE_MAX_BYTES) throw new Error('Referensbilden får vara högst 8 MB.');
  if (file.size<=AI_IMAGE_REFERENCE_MAX_BYTES) return fileDataUrl(file);
  const bitmap=await createImageBitmap(file),scale=Math.min(1,2048/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  canvas.getContext('2d')?.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const smaller=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));
  if (!smaller||smaller.size>AI_IMAGE_REFERENCE_MAX_BYTES) throw new Error('Referensbilden kunde inte göras mindre. Välj en mindre bild.');
  return fileDataUrl(smaller);
}
