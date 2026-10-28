import {validateProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {retainBlackjackTableGeometry,validateCompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {sceneLayoutPublication} from '../../../packages/presentation/contracts/scene-layout-publication.mjs';
import {appearanceReceipt} from '../components/partner-appearance-state.mjs';
import {AI_TABLE_MISFIT_CODE,aiTableMisfits,aiTableMisfitMessage} from './ai-image-contract.mjs';

// A server refusal of an AI table graphic, as the same text the client check gives.
export function aiTableMisfitError(payload,assets){
  if(payload?.code!==AI_TABLE_MISFIT_CODE)return null;
  const label=(assets??[]).find(row=>row?.id===payload.assetId)?.label;
  return Error(aiTableMisfitMessage({label,code:payload.reason}));
}

const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'
  ?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,ordered(item)])):value;
export const sameSceneValue=(a,b)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b));

// Recovery copies geometry only. Other board profiles and every material/media
// choice remain in the shared project, including other dealers' active work.
export function importPublishedSceneLayout(project,compositionId,presentation){
  const source=presentation?.lanes.find(row=>row.id===compositionId),target=project.lanes.find(row=>row.id===compositionId);
  if(!source?.composition||!target)throw Error('Den publicerade scenen saknas.');
  const composition=structuredClone(source.composition);
  const incoming=new Set((composition.blackjackTables??[]).map(row=>row.tableId));
  const rows=[...(target.composition?.blackjackTables??[]).filter(row=>!incoming.has(row.tableId)),...(composition.blackjackTables??[])];
  if(rows.length)composition.blackjackTables=rows;
  retainBlackjackTableGeometry(composition,target.layers.table.allowed);
  return validateProject({...project,lanes:project.lanes.map(row=>row.id===compositionId?{...row,composition:validateCompositionSettings(composition)}:row)});
}

export function scenePublicationPreview(project,compositionId,presentation){
  const source=project?.lanes.find(row=>row.id===compositionId),target=presentation?.lanes.find(row=>row.id===compositionId);
  if(!source?.composition||!target)return null;
  const {composition}=sceneLayoutPublication(target,source);
  return {...structuredClone(presentation),lanes:presentation.lanes.map(row=>row.id===compositionId?{...structuredClone(row),composition}:structuredClone(row))};
}

export async function publishSavedScene({project,compositionId,initial,operatorSlug,fetchImpl=fetch}){
  const expected=scenePublicationPreview(project,compositionId,initial.presentation);
  if(!expected||sameSceneValue(expected,initial.presentation))throw Error('Scenens sparade placering är redan publicerad.');
  // The same check as the server: a moved placement or another dealer blocks an AI table graphic drawn for the old one.
  const [misfit]=aiTableMisfits(expected.lanes.filter(row=>row.id===compositionId),expected.assets);
  if(misfit)throw Error(aiTableMisfitMessage(misfit));
  const response=await fetchImpl('/studio/api/admin/operator-package',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify({action:'publish-scene-layout',operatorId:initial.operatorId,compositionId,expectedPackageRevision:initial.packageRevision,expectedProjectRevision:project.revision})});
  const receipt=await response.json().catch(()=>null);
  if(response.status===413)throw Error('Publiceringspaketet är för stort. Inget publicerades; den sparade mallen finns kvar.');
  const refused=aiTableMisfitError(receipt,expected.assets);
  if(refused)throw refused;
  if(!response.ok)throw Error(response.status===409?'Mallen eller publiceringen har ändrats. Läs in senaste version innan du försöker igen.':'Scenpubliceringen gick inte igenom. Läs in senaste version.');
  if(receipt?.ok!==true||receipt.operatorId!==initial.operatorId||receipt.compositionId!==compositionId||receipt.projectRevision!==project.revision
    ||receipt.packageRevision!==initial.packageRevision+1||!sameSceneValue(receipt.presentation,expected))throw Error('Publiceringskvittot kunde inte bekräftas. Läs in senaste version.');
  const readback=await fetchImpl('/studio/api/partner/branding?operator='+encodeURIComponent(operatorSlug),{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
  const saved=await readback.json().catch(()=>null);
  if(!readback.ok||!appearanceReceipt(saved,initial.operatorId)||saved.packageRevision!==receipt.packageRevision||!sameSceneValue(saved.presentation,expected)
    ||!sameSceneValue(saved.branding,initial.branding)||!sameSceneValue(saved.draft,initial.draft)||saved.draftRevision!==initial.draftRevision)throw Error('Publiceringen kunde inte återläsas säkert. Läs in senaste version.');
  return saved;
}
