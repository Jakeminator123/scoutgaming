import {validateCompositionSettings} from './composition-settings.mjs';

const fail=()=>{throw Object.assign(Error('studio_invalid_scene_layout'),{statusCode:422});};
const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'
  ?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,ordered(item)])):value;
const others=(settings,tableId)=>JSON.stringify(ordered((settings.blackjackTables??[]).filter(row=>row.tableId!==tableId)));

// Edit the current frozen scene, including one board's geometry. Other board
// profiles belong to their own editing context and must remain unchanged.
export function updatePublishedSceneLayout(settings,tableId,composition){
  if(typeof tableId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(tableId))fail();
  const before=validateCompositionSettings(settings),next=validateCompositionSettings(composition);
  if(others(before,tableId)!==others(next,tableId))fail();
  return next;
}
