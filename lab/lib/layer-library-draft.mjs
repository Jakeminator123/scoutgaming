import {validateProject} from './studio-model.mjs';
import {rebaseProjectDraft} from './project-rebase.mjs';
import {layerAssetReferences} from './layer-asset-removal.mjs';

// The general project schema also accepts built-in layer ids, so it cannot
// detect a removed uploaded asset which another writer has started using.
export function validateLibraryDraft(project,...knownProjects) {
  validateProject(project);
  const remaining=new Set((project.layerAssets??[]).map(row=>row.id));
  if(knownProjects.some(known=>(known.layerAssets??[]).some(row=>!remaining.has(row.id)&&layerAssetReferences(project,row.id).length)))
    throw new Error('En borttagen biblioteksfil används nu i en sammansättning. Välj sparade val i konflikten eller koppla loss filen innan du tar bort den.');
  return project;
}

// Upload commits independently. Merge by asset identity so a local removal and
// a remote addition can coexist, without selecting either file in a scene.
export function registerLibraryLayer(base,draft,remote,{id,role}) {
  validateProject(remote);
  const asset=remote.layerAssets?.find(row=>row.id===id&&row.role===role);
  if(!asset)throw new Error('Lagerfilens registrering kunde inte verifieras.');
  const indexed=project=>({...project,layerAssets:Object.fromEntries((project.layerAssets??[]).map(row=>[row.id,row]))});
  const result=rebaseProjectDraft(indexed(base),indexed(draft),indexed(remote));
  const project={...result.project,layerAssets:Object.values(result.project.layerAssets)};
  const existing=project.layerAssets.find(row=>row.id===id);
  if(existing&&JSON.stringify(existing)!==JSON.stringify(asset))throw new Error('Lagerfilens registrering krockar med utkastet.');
  if(!existing)project.layerAssets.push(structuredClone(asset));
  validateLibraryDraft(project,base,remote);
  return {project,conflicts:result.conflicts};
}
