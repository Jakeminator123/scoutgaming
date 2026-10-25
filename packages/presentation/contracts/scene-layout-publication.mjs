import {retainBlackjackTableGeometry,validateCompositionSettings} from './composition-settings.mjs';

const fail=()=>{throw Object.assign(Error('studio_invalid_scene_layout'),{statusCode:422});};
const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'
  ?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,ordered(item)])):value;
function geometryKey(settings){
  const value=structuredClone(settings);
  if(value.blackjackTables?.length)value.blackjackTables.sort((a,b)=>a.tableId.localeCompare(b.tableId));
  else delete value.blackjackTables;
  return JSON.stringify(ordered(value));
}

// Geometry follows the saved template; material grants still belong to the
// frozen package. Removing a template material must not reset its live profile.
export function sceneLayoutPublication(publishedLane,savedLane){
  const publishedIds=publishedLane?.layers?.table?.allowed,savedIds=savedLane?.layers?.table?.allowed;
  if(!Array.isArray(publishedIds)||!Array.isArray(savedIds)||!savedLane?.composition)fail();
  const before=publishedLane.composition===undefined?undefined:validateCompositionSettings(publishedLane.composition,{tableIds:publishedIds});
  const composition=validateCompositionSettings(savedLane.composition,{tableIds:savedIds});
  retainBlackjackTableGeometry(composition,publishedIds);
  const retained=(before?.blackjackTables??[]).filter(row=>!savedIds.includes(row.tableId));
  if(retained.length)composition.blackjackTables=[...(composition.blackjackTables??[]),...structuredClone(retained)];
  validateCompositionSettings(composition,{tableIds:publishedIds});
  const changed=before===undefined||geometryKey(before)!==geometryKey(composition);
  return {composition:changed?composition:before,changed};
}
