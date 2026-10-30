// Publication refuses an AI table graphic in a scene template it was not drawn
// for: another dealer's landings or another dealer/table placement. Checked
// in apps/studio before anything is frozen into a package; the presentation
// contracts are unchanged. Other material is never affected.
import {AI_TABLE_MISFIT_CODE,aiTableMisfits} from './ai-image-contract.mjs';

export class AiTableMisfitError extends Error {
  constructor(misfit) {
    super(AI_TABLE_MISFIT_CODE);
    this.name='AiTableMisfitError';this.code=AI_TABLE_MISFIT_CODE;this.statusCode=422;
    this.compositionId=misfit.compositionId;this.assetId=misfit.assetId;this.reason=misfit.code;
  }
}
export function assertAiTablesFit(lanes,assets) {
  const [misfit]=aiTableMisfits(lanes,assets);
  if (misfit) throw new AiTableMisfitError(misfit);
}
// One chosen table (an operator's branding choice) in one template.
export function assertAiTableChoiceFits(lane,assets,tableId) {
  if (typeof tableId!=='string'||!tableId) return;
  assertAiTablesFit([{...lane,layers:{...lane.layers,table:{...lane.layers.table,default:tableId,allowed:[]}}}],assets);
}
// The fixed answer: code, template and material ids, and the reason code only.
export function aiTableMisfitBody(error) {
  if (error?.code!==AI_TABLE_MISFIT_CODE) return null;
  const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value)?value:null;
  return {error:AI_TABLE_MISFIT_CODE,code:AI_TABLE_MISFIT_CODE,compositionId:id(error.compositionId),assetId:id(error.assetId),
    reason:['ai_table_other_dealer','ai_table_other_placement'].includes(error.reason)?error.reason:null};
}
