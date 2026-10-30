// Browser side of "Skapa bakgrund med AI". The route only proposes images; the
// person's "Använd" registers the chosen one through the existing layer-asset
// upload (prepare, private Blob put, commit), exactly like a manual upload.
import {labUrl} from '../../../lib/lab-url.mjs';
import {uploadCompositionLayer} from '../../../lib/studio-composition.mjs';
import {layerUploadResponseError} from '../../../../../packages/presentation/contracts/layer-upload-errors.mjs';
import {registeredFilmedProfile} from '../../../../../packages/presentation/contracts/filmed-profiles/registry.mjs';
import {AI_IMAGE_ERROR_CODES,AI_IMAGE_MAX_PROPOSALS,AI_IMAGE_PROMPT_LENGTH,AI_IMAGE_REFERENCE_FILE_MAX_BYTES,AI_IMAGE_REFERENCE_MAX_BYTES,AI_IMAGE_REFERENCE_MAX_EDGE,
  AI_IMAGE_REFERENCE_TYPES,aiImageLabel} from '../../../lib/ai-image-contract.mjs';
// The fit guard lives in the shared contract so publication runs the same check.
export {AI_TABLE_MISFIT,aiTableFitsTemplate,aiTableMisfits,aiTableMisfitMessage} from '../../../lib/ai-image-contract.mjs';
import {aiTableMisfits} from '../../../lib/ai-image-contract.mjs';
import {AI_TABLE_FILL,filmedTableFit,filmedTableSvg,filmedTableTemplate} from '../../../lib/filmed-table-template.mjs';
import {aiTableStyle} from '../../../lib/ai-table-style.mjs';
import {materialLabel} from '../../../../../packages/presentation/contracts/material-catalog.mjs';
import {AI_ADOPT_ACTION,adoptLayerAssets} from '../../../lib/ai-material-adoption.mjs';
import {ROOM_RELEASE_PUBLISH_PATH,roomReleaseFailure} from './room-release.mjs';

export const AI_IMAGE_ENDPOINT='/api/layer-assets/generate';
export const AI_IMAGE_MESSAGES=Object.freeze({
  ai_image_disabled:'Inte påslaget. AI-bilder är avstängda på den här servern.',
  ai_image_misconfigured:'AI-inställningen är ogiltig. Kontakta den som driftar Scoutgaming.',
  ai_image_unavailable:'Inte anslutet. Bildtjänsten svarar inte eller saknar nyckel på servern. Försök igen senare.',
  ai_image_limit_reached:'Dagens gräns för AI-bilder på den här servern är nådd. Försök igen i morgon.',
  ai_image_budget_exhausted:'AI-budgeten är slut. Kontakta den som äger OpenAI-kontot.',
  ai_image_rejected:'Bildtjänstens innehållskontroll stoppade förslaget. Ändra beskrivningen eller inspirationsbilden och försök igen.',
  ai_image_invalid_request:`Kontrollera beskrivningen (${AI_IMAGE_PROMPT_LENGTH.min}–${AI_IMAGE_PROMPT_LENGTH.max} tecken) och inspirationsbilden (PNG, JPEG eller WebP).`,
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
  const problem=['missing_key','invalid_setting'].includes(body?.problem)?body.problem:null;
  return {enabled:body?.enabled===true,configured:body?.configured===true,problem,dailyLimit:Number(body?.dailyLimit)||0,remaining:Number(body?.remaining)||0};
}
const validFit=fit=>/^[a-z0-9-]{1,40}$/.test(fit?.dealerId??'')&&/^[a-f0-9]{8}$/.test(fit?.placement??'');
export async function requestAiProposals({role,prompt,preset,count,dealerId,sceneTemplate,reference},{fetchImpl=fetch,signal}={}) {
  const scene=role==='table'&&sceneTemplate?{sceneTemplate:{id:sceneTemplate.id,...(sceneTemplate.composition?{composition:sceneTemplate.composition}:{})}}:{};
  const body={role,prompt,preset,count,...(role==='table'?{dealerId,...scene}:{}),...(reference?{reference}:{})};
  const response=await fetchImpl(labUrl(AI_IMAGE_ENDPOINT),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
  if (!response.ok) throw new AiImageRequestError(await readCode(response));
  const value=await response.json();
  const images=Array.isArray(value?.images)?value.images.filter(image=>typeof image?.id==='string'&&/^data:image\/webp;base64,/.test(image.dataUrl??'')
    &&Number.isSafeInteger(image.width)&&Number.isSafeInteger(image.height)).slice(0,AI_IMAGE_MAX_PROPOSALS):[];
  // A table graphic must know which dealer and placement it was drawn for.
  const fit=role==='table'&&validFit(value?.fit)?{dealerId:value.fit.dealerId,placement:value.fit.placement}:null;
  if (!images.length||role==='table'&&!fit) throw new AiImageRequestError(null);
  return {images,remaining:Number(value.remaining)||0,fit};
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

// The same geometry and style as the server's edit source, before spending an
// image request. This is a shape preview, never a generated or savable proposal.
export function aiTableShapePreview(dealerId,composition,preset) {
  try {
    const template=filmedTableTemplate(dealerId,composition?{composition}:{});
    if (!template) return null;
    const {width,height}=template.canvas;
    const reference=filmedTableSvg(template,'reference',{look:aiTableStyle(preset).look??undefined});
    const mask=filmedTableSvg(template,'mask');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><mask id="table-shape" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">${mask}</mask></defs><g mask="url(#table-shape)">${reference}</g></svg>`;
    return {id:'table-shape-preview',dataUrl:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg),...template.canvas};
  } catch { return null; }
}

const assetId=id=>typeof id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
// Only registered image bytes, accessed through the existing authenticated
// route. Catalogue labels identify Oak and Purple Rain separately by hash.
export function aiReferenceMaterials(assets,role) {
  return (assets??[]).filter(asset=>assetId(asset?.id)&&asset.role===role&&AI_IMAGE_REFERENCE_TYPES.includes(asset.contentType)
    &&asset.size>=16&&asset.size<=AI_IMAGE_REFERENCE_FILE_MAX_BYTES)
    .map(asset=>({id:asset.id,label:materialLabel(asset),url:labUrl('/api/layer-assets/'+asset.id)}));
}

export async function prepareMaterialReference(id,{fetchImpl=fetch,signal,prepare=prepareReferenceImage}={}) {
  if (!assetId(id)) throw new Error('Välj en bild från materialbiblioteket.');
  const response=await fetchImpl(labUrl('/api/layer-assets/'+id),{method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',signal});
  const contentType=response.headers.get('content-type')?.split(';')[0];
  if (!response.ok||!AI_IMAGE_REFERENCE_TYPES.includes(contentType)) throw new Error('Bilden kunde inte hämtas från materialbiblioteket.');
  const reader=response.body?.getReader();
  if (!reader) throw new Error('Bilden kunde inte läsas.');
  const chunks=[];let size=0;
  try {
    for (;;) {
      signal?.throwIfAborted();
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;
      if (size>AI_IMAGE_REFERENCE_FILE_MAX_BYTES) { await reader.cancel();throw new Error('Inspirationsbilden får vara högst 8 MB.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  signal?.throwIfAborted();
  return prepare(new File(chunks,'material',{type:contentType}));
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
// existing upload, labelled "AI · <short prompt>" (a table graphic also
// "· <dealer> · <placement>"). Nothing is published.
export async function registerAiProposal(proposal,{role,prompt,fit=null},{fetchImpl=fetch,put=blobPut,upload=uploadCompositionLayer,signal,onUploadProgress,onCommit}={}) {
  if (role==='table'&&!validFit(fit)) throw new Error('Bordsgrafiken saknar uppgift om dealer och placering. Skapa nya förslag.');
  const file=dataUrlFile(proposal?.dataUrl,`ai-${role==='table'?'bordsgrafik':'bakgrund'}.webp`);
  return upload(file,{role,...(role==='table'?{game:'blackjack'}:{}),label:aiImageLabel(prompt,role==='table'?fit:null),width:proposal.width,height:proposal.height},
    {post:uploadPost(fetchImpl),put,signal:signal??new AbortController().signal,onUploadProgress,onCommit});
}

function fileDataUrl(blob) {
  return blob.arrayBuffer().then(buffer=>{
    const bytes=new Uint8Array(buffer);let binary='';
    for (let index=0;index<bytes.length;index+=0x8000) binary+=String.fromCharCode(...bytes.subarray(index,index+0x8000));
    return `data:${blob.type};base64,${btoa(binary)}`;
  });
}
const browserMeasure=async file=>{const bitmap=await createImageBitmap(file);const size={width:bitmap.width,height:bitmap.height};bitmap.close();return size;};
async function browserShrink(file,{width,height},quality) {
  const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;canvas.getContext('2d')?.drawImage(bitmap,0,0,width,height);bitmap.close();
  return new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
}
// Inspirationsbild: sent along with the request only, never stored. Shrunk in
// the browser to at most 1536 px and under 2 MB; the server checks it again.
export async function prepareReferenceImage(file,{measure=browserMeasure,shrink=browserShrink}={}) {
  if (!file||!AI_IMAGE_REFERENCE_TYPES.includes(file.type)) throw new Error('Inspirationsbilden ska vara PNG, JPEG eller WebP.');
  if (file.size<16||file.size>AI_IMAGE_REFERENCE_FILE_MAX_BYTES) throw new Error('Inspirationsbilden får vara högst 8 MB.');
  const size=await measure(file);
  if (!Number.isSafeInteger(size?.width)||!Number.isSafeInteger(size?.height)||Math.min(size.width,size.height)<16) throw new Error('Inspirationsbilden kunde inte läsas.');
  if (Math.max(size.width,size.height)<=AI_IMAGE_REFERENCE_MAX_EDGE&&file.size<AI_IMAGE_REFERENCE_MAX_BYTES) return fileDataUrl(file);
  const scale=Math.min(1,AI_IMAGE_REFERENCE_MAX_EDGE/Math.max(size.width,size.height));
  const target={width:Math.max(16,Math.floor(size.width*scale)),height:Math.max(16,Math.floor(size.height*scale))};
  for (const quality of [.88,.75,.6]) {
    const smaller=await shrink(file,target,quality);
    if (smaller&&smaller.size<AI_IMAGE_REFERENCE_MAX_BYTES) return fileDataUrl(smaller);
  }
  throw new Error('Inspirationsbilden kunde inte göras mindre än 2 MB. Välj en annan bild.');
}

// Before a company package is published: the saved project's chosen scene
// templates, checked as the server checks them. Only a found misfit stops the
// publish; an unreadable project leaves the decision to the server, which
// refuses a misfit anyway (422 ai_table_misfit).
export async function aiPackageMisfit({endpoint,lanes,fetchImpl=fetch,signal}) {
  try {
    const response=await fetchImpl(endpoint,{method:'GET',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},signal});
    if (!response.ok) return null;
    const project=(await response.json())?.project;
    if (!Array.isArray(project?.lanes)) return null;
    const chosen=new Set(lanes);
    return aiTableMisfits(project.lanes.filter(lane=>chosen.has(lane?.id)),project.layerAssets)[0]??null;
  } catch { return null; }
}

const percent=value=>Math.round(value*1000)/10;
/**
 * Bordsbredd for a table drawn after the dealer's reach (filmed-table-template.mjs):
 * the scene template's composition (or the defaults) and the suggested one, with
 * the boxes' share of the table and both layouts' Bordsbredd % for the dialog.
 * Null without a filmed profile or a valid placement.
 */
export function aiTableWidthSuggestion(dealerId,composition) {
  const fit=filmedTableFit(dealerId,composition??undefined);
  if (!fit) return null;
  const widths=value=>({desktop:percent(value.desktop.table.width),mobile:percent(value.mobile.table.width)});
  return {changed:fit.changed,range:AI_TABLE_FILL,current:{share:fit.current.share,percent:widths(fit.current.composition)},
    suggested:{share:fit.suggested.share,percent:widths(fit.suggested.composition),composition:fit.suggested.composition,
      tableWidth:{mobile:fit.suggested.composition.mobile.table.width,desktop:fit.suggested.composition.desktop.table.width}}};
}

/**
 * "Använd i miljön" without a spelbord: the materials are allowed in the scene
 * template and become its defaults (with the fitted table width) in the saved
 * project draft. Nothing is published; the template's rooms show it after Publicera.
 */
export async function adoptInTemplate({project,compositionId,materials,tableWidth=null},{save,signal}) {
  return save(adoptLayerAssets(project,{compositionId,materials,tableWidth}),signal);
}

const receiptOk=(value,input)=>value&&typeof value==='object'&&value.ok===true&&value.operatorId===input.operatorId&&value.roomId===input.roomId
  &&Number.isSafeInteger(value.packageRevision)&&value.packageRevision===value.previousPackageRevision+1&&typeof value.projectRevision==='string'
  &&typeof value.configVersion==='string'&&typeof value.publishedAt==='string'&&Number.isFinite(Date.parse(value.publishedAt));
/**
 * "Använd i miljön och i spelbordet": POST operator-package {action:'adopt-room-material'}.
 * The server allows the materials in the room's scene template, makes them its
 * defaults and publishes the room (steg D) in one transaction; any other saved
 * but unpublished change stops it. One call per click, never retried.
 */
export async function adoptInRoom({operatorId,roomId,compositionId,materials,tableWidth=null,expectedProjectRevision},{fetchImpl=fetch}={}) {
  const body={action:AI_ADOPT_ACTION,operatorId,roomId,compositionId,materials,tableWidth,expectedProjectRevision};
  let response;
  try {
    response=await fetchImpl(labUrl(ROOM_RELEASE_PUBLISH_PATH),{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
      headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(body)});
  } catch { return {ok:false,status:0,error:'Svaret kom inte fram. Läs in spelbordet igen för att se om publiceringen gick igenom.'}; }
  if (!response.ok) return roomReleaseFailure(response,'publish');
  let value=null;
  try { value=await response.json(); } catch { value=null; }
  if (!receiptOk(value,{operatorId,roomId})) return {ok:false,status:response.status,error:'Publiceringskvittot kunde inte bekräftas. Läs in spelbordet igen innan du fortsätter.'};
  return {ok:true,receipt:value};
}
