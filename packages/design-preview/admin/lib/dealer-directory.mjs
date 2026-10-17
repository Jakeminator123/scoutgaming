import {validateProject} from '../../../presentation/contracts/studio-model.mjs';

// Changes a shared template only; room overrides and published packages are not
// inferred from a selected room. Publication still validates actual game/media.
export function setTemplateDealers(project, compositionId, ids, defaultId) {
  const next=structuredClone(project),lane=next.lanes?.find(row=>row.id===compositionId);
  if(!lane||!ids.length||new Set(ids).size!==ids.length||!ids.includes(defaultId)
    ||ids.some(id=>!next.dealers.some(row=>row.id===id)))throw Error('Välj minst en registrerad dealer och ett förval bland de tillåtna.');
  lane.dealers=[...ids];
  lane.layers.dealer={...lane.layers.dealer,allowed:[...ids],default:defaultId};
  return validateProject(next);
}
