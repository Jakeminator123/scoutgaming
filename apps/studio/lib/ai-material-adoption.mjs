// "Använd i miljön": an AI material (table graphic and/or background) is allowed
// in one scene template and becomes its default; a table graphic drawn for an
// adjusted table width also brings that width (Bordsbredd %, both layouts).
// Pure and shared: the dialog saves the result as the project draft, and the
// room publication (room-release.mjs, action adopt-room-material) writes the
// same result and publishes the room in one transaction.
import {validateProject} from '../../../packages/presentation/contracts/studio-model.mjs';
import {defaultCompositionSettings,retainBlackjackTableGeometry,validateCompositionSettings} from '../../../packages/presentation/contracts/composition-settings.mjs';
import {layerAssetFitsGame} from '../../../packages/presentation/contracts/layer-asset-contract.mjs';
import {aiTableFitsTemplate} from './ai-image-contract.mjs';

export const AI_ADOPT_ACTION = 'adopt-room-material';
// Fixed reasons, also the server's studio_release_invalid reasons.
export const AI_ADOPT_REASONS = Object.freeze({
  ai_adopt_template_missing:'Scenmallen finns inte längre.',
  ai_adopt_material_missing:'Materialet finns inte i biblioteket eller passar inte Blackjack.',
  ai_adopt_table_misfit:'Bordsgrafiken passar inte scenmallens dealers eller placering.',
  ai_adopt_invalid:'Valet kunde inte läggas in i scenmallen.',
});
export class AiAdoptError extends Error { constructor(code) { super(AI_ADOPT_REASONS[code]??AI_ADOPT_REASONS.ai_adopt_invalid); this.code=code; } }
const fail=code=>{ throw new AiAdoptError(code); };

const ROLES=['table','background'];
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));

/** One or two materials, one per role; tableWidth only with a table. Throws ai_adopt_invalid. */
export function validateAdoptMaterials(materials,tableWidth=null) {
  if (!Array.isArray(materials)||materials.length<1||materials.length>2) fail('ai_adopt_invalid');
  const rows=materials.map(row=>{
    if (!exact(row,['role','assetId'])||!ROLES.includes(row.role)||typeof row.assetId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(row.assetId)) fail('ai_adopt_invalid');
    return {role:row.role,assetId:row.assetId};
  });
  if (new Set(rows.map(row=>row.role)).size!==rows.length) fail('ai_adopt_invalid');
  if (tableWidth!==null&&(!exact(tableWidth,['mobile','desktop'])||!rows.some(row=>row.role==='table')
    ||['mobile','desktop'].some(layout=>!Number.isFinite(tableWidth[layout])||tableWidth[layout]<.1||tableWidth[layout]>4))) fail('ai_adopt_invalid');
  return {materials:rows,tableWidth:tableWidth===null?null:{mobile:tableWidth.mobile,desktop:tableWidth.desktop}};
}

/**
 * The project with the materials allowed in the scene template and set as its
 * defaults, and the table width in both layouts when given. A background's mode
 * follows its type (image or video). An AI table graphic must fit the result
 * (same check as the template's table choice and every publication).
 */
export function adoptLayerAssets(project,{compositionId,materials,tableWidth=null}) {
  const checked=validateAdoptMaterials(materials,tableWidth);
  const next=structuredClone(project),lane=next.lanes?.find(row=>row?.id===compositionId);
  if (!lane) fail('ai_adopt_template_missing');
  for (const {role,assetId} of checked.materials) {
    const asset=(next.layerAssets??[]).find(row=>row.id===assetId);
    if (!asset||asset.role!==role||role==='table'&&!layerAssetFitsGame(asset,'blackjack')) fail('ai_adopt_material_missing');
    const layer=lane.layers[role];
    layer.enabled=true;layer.default=assetId;
    if (!layer.allowed.includes(assetId)) layer.allowed=[...layer.allowed,assetId];
    if (role==='background') layer.mode=asset.contentType.startsWith('video/')?'video':'image';
  }
  if (checked.tableWidth) {
    let composition;
    try { composition=validateCompositionSettings(lane.composition??defaultCompositionSettings()); } catch { fail('ai_adopt_invalid'); }
    for (const layout of ['mobile','desktop']) composition[layout].table={...composition[layout].table,width:checked.tableWidth[layout]};
    retainBlackjackTableGeometry(composition,lane.layers.table.allowed);
    lane.composition=composition;lane.renderer='layered';
  }
  const table=checked.materials.find(row=>row.role==='table');
  if (table&&!aiTableFitsTemplate(next.layerAssets.find(row=>row.id===table.assetId),lane).ok) fail('ai_adopt_table_misfit');
  try { return validateProject(next); } catch { return fail('ai_adopt_invalid'); }
}
