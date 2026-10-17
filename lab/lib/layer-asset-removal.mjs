import {validateProject} from '../../packages/presentation/contracts/studio-model.mjs';
import {compositionLabel} from './control-flow.mjs';
export function layerAssetReferences(project,id){
  const lanes=[...(project.lanes??[]),...(project.dealerTrash??[]).flatMap(entry=>entry.compositions??[])];
  return lanes.filter(lane=>['background','table'].some(role=>lane.layers[role].default===id||lane.layers[role].allowed.includes(id))
    ||lane.composition?.blackjackTables?.some(row=>row.tableId===id)).map(lane=>({id:lane.id,label:compositionLabel(lane.label)}));
}
export function removeLayerAsset(project,id){
  if(!project.layerAssets?.some(asset=>asset.id===id))throw Error('Filen finns inte längre i biblioteket.');
  if(layerAssetReferences(project,id).length)throw Error('Koppla loss filen från presentationernas standardval och tillåtna alternativ först.');
  const next={...project,layerAssets:project.layerAssets.filter(asset=>asset.id!==id)};validateProject(next);return next;
}
export function restoreLayerAsset(project,asset){
  const existing=project.layerAssets?.find(row=>row.id===asset.id);
  if(existing){if(JSON.stringify(existing)!==JSON.stringify(asset))throw Error('En annan fil har samma id. Ladda om biblioteket.');return project;}
  const next={...project,layerAssets:[...(project.layerAssets??[]),structuredClone(asset)]};validateProject(next);return next;
}
