import {validateProject} from '../../../../../packages/presentation/contracts/studio-model.mjs';
import {isActiveDealerId} from '../../../../../packages/presentation/contracts/dealer-identity.mjs';

// A new dealer's id comes from its name: lower case a–z, 0–9 and hyphens (å, ä, ö → a, a, o), starting
// with a letter, at most 40 characters, valid and free by the same rule addDealer checks (active dealers,
// the trash, reserved and retired names). A clash gets -2, -3 … The id is used in storage paths and
// is never typed or shown in the form.
export function dealerIdFromName(project,name){
  let base=String(name??'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  if(!base)base='dealer';
  if(!/^[a-z]/.test(base))base='dealer-'+base;
  const fit=(stem,suffix='')=>stem.slice(0,40-suffix.length).replace(/-+$/,'')+suffix;
  const taken=id=>(project?.dealers??[]).some(row=>row.id===id)||(project?.dealerTrash??[]).some(row=>row.dealer?.id===id);
  for(let index=1;index<1000;index++){
    const id=fit(base,index===1?'':'-'+index);
    if(isActiveDealerId(id)&&!taken(id))return id;
  }
  throw Error('Inget ledigt id kunde skapas ur namnet.');
}

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
