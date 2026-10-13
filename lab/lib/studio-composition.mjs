import {defaultCompositionSettings} from '../../web/public/composition-settings.mjs';
import {LAYER_ASSET_TYPES,MAX_LAYER_ASSET_BYTES,layerAssetPath} from '../../web/presentation-layers.mjs';
import {validateProject} from './studio-model.mjs';
import {rebaseProjectDraft} from './project-rebase.mjs';

export function compositionPreviewLayers(show,compositing,hasDealer=true) {
  // Dealer keying is mandatory; legacy classification cannot hide the chosen
  // room/table planes. The compositor, not this layout helper, validates pixels.
  return {...show};
}

// Registration changes the server revision independently of the editor. Rebase
// against its saved baseline before selecting the asset in the latest draft.
export function registerCompositionLayer(base,draft,remote,{id,role,laneId}) {
  validateProject(remote);
  const asset=remote.layerAssets?.find(row=>row.id===id&&row.role===role);
  if(!asset)throw new Error('Lagerfilens registrering kunde inte verifieras.');
  const result=rebaseProjectDraft(base,draft,remote);
  const project=result.project;
  const existing=project.layerAssets?.find(row=>row.id===id);
  if(existing&&JSON.stringify(existing)!==JSON.stringify(asset))throw new Error('Lagerfilens registrering krockar med utkastet.');
  if(!existing)project.layerAssets=[...(project.layerAssets??[]),structuredClone(asset)];
  const lanes=project.lanes??[];
  const lane=lanes.find(row=>row.id===laneId);
  if(!lane)throw new Error('Filen är registrerad men den valda sammansättningen finns inte längre. Utkastet har behållits.');
  const layer=lane.layers[role];
  layer.default=id;layer.enabled=true;
  if(!layer.allowed.includes(id))layer.allowed.push(id);
  if(role==='background')layer.mode=asset.contentType.startsWith('video/')?'video':'image';
  lane.renderer='layered';lane.composition??=defaultCompositionSettings();project.lanes=lanes;
  validateProject(project);
  return {project,conflicts:result.conflicts};
}

// The immutable upload grant is verified at both ends; abort never proceeds to
// registration. A commit error retains the local editor draft for recovery.
export async function uploadCompositionLayer(file,{role,game,label,width,height},{post,put,signal,onUploadProgress,onCommit}) {
  if(!LAYER_ASSET_TYPES[file.type]||file.size<16||file.size>MAX_LAYER_ASSET_BYTES)throw new Error('Välj PNG, JPEG, WebP, MP4 eller WebM, högst 128 MB.');
  if(game!==undefined&&(role!=='table'||!['blackjack','roulette'].includes(game)))throw new Error('Välj spelet som bordet tillhör.');
  signal.throwIfAborted();
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()));
  signal.throwIfAborted();
  const sha256=[...hash].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const grant=await post({operation:'prepare',role,label,sha256,size:file.size,contentType:file.type,width,height,...(game===undefined?{}:{game})},signal);
  signal.throwIfAborted();
  if(grant.pathname!==layerAssetPath({id:grant.id,role,sha256,contentType:file.type})||!grant.clientToken||!grant.ticket)throw new Error('Uppladdningens mål kunde inte verifieras.');
  const stored=await put(grant.pathname,file,{access:'private',token:grant.clientToken,contentType:file.type,multipart:file.size>5*1024*1024,abortSignal:signal,onUploadProgress});
  signal.throwIfAborted();
  if(stored.pathname!==grant.pathname)throw new Error('Uppladdningens mål kunde inte verifieras.');
  onCommit?.();
  const result=await post({operation:'commit',ticket:grant.ticket},signal);
  if(result.id!==grant.id||!result.project?.layerAssets?.some(asset=>asset.id===grant.id&&asset.pathname===grant.pathname&&asset.role===role&&asset.sha256===sha256&&asset.game===game&&asset.contentType===file.type&&asset.size===file.size&&asset.width===width&&asset.height===height))throw new Error('Filen är överförd men registreringen kunde inte verifieras. Utkastet har behållits.');
  return {id:result.id,project:result.project};
}
