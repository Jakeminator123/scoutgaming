import {resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {lstatSync} from 'node:fs';
import {createProjectStore,StudioError} from './project-store.mjs';
import {loadVideoRegistry,getVideoResponse} from './video-registry.mjs';

// Available only in the launcher-created, network-blocked disposable process.
// A failed production Neon connection can never activate this adapter.
export function comparisonStudio() {
  if(globalThis[Symbol.for('croupier.local-comparison.guard')]!==true||!process.env.CROUPIER_QA_ALLOWED_PORTS)return null;
  const dir=resolve(process.env.LAB_STUDIO_DATA_DIR??'');
  if(basename(dir)!=='studio'||dirname(dirname(dir))!==resolve(tmpdir())||!basename(dirname(dir)).startsWith('croupier-comparison-'))throw new StudioError('invalid_comparison_directory',503);
  for(const path of [dir,dirname(dir)])if(lstatSync(path).isSymbolicLink())throw new StudioError('invalid_comparison_directory',503);
  const options={archiveDir:process.env.LAB_VIDEO_ARCHIVE};
  return {projectStore:createProjectStore(dir),videoRegistry:()=>loadVideoRegistry(options),videoResponse:(id,request)=>getVideoResponse(id,request,options)};
}
