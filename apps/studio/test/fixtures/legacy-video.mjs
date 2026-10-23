import {randomUUID,createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute,join} from 'node:path';
import {tmpdir} from 'node:os';
import {validateVideoMetadata} from '../../../../packages/presentation/contracts/video-intake.mjs';
import {mediaBlobPath} from '../../../../packages/studio-registry/server/private-media-contract.mjs';

// Test data only: explicit temporary directory, no requests, uploads, provider calls or product defaults.
export async function seedLegacyVideo(options,bytes,metadata,{cloud=false}={}) {
  if(typeof options.uploadDir!=='string')throw Error('temporary uploadDir required');
  const dir=resolve(options.uploadDir),distance=relative(tmpdir(),dir);
  if(!distance||distance.startsWith('..')||isAbsolute(distance))throw Error('fixture must stay under tmpdir');
  await mkdir(dir,{recursive:true});
  let videos=[];
  try{videos=JSON.parse(await readFile(join(dir,'index.json'),'utf8')).videos;}catch(error){if(error.code!=='ENOENT')throw error;}
  const id=randomUUID(),sha256=createHash('sha256').update(bytes).digest('hex');
  const classification=validateVideoMetadata(metadata,{forWrite:true});
  const row={id,sha256,size:bytes.length,extension:'mp4',classification,addedAt:'2026-10-22T00:00:00.000Z'};
  if(cloud)row.storage={provider:'vercel-blob',pathname:mediaBlobPath('dealers/'+classification.dealerId+'/review/uploads',id,sha256,'mp4'),sha256,size:bytes.length,contentType:'video/mp4'};
  else await writeFile(join(dir,id+'.mp4'),bytes);
  await writeFile(join(dir,'index.json'),JSON.stringify({schemaVersion:1,videos:[...videos,row]}));
  return row;
}
