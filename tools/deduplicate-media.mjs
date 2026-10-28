import {readFile,writeFile,rename,unlink,lstat,realpath} from 'node:fs/promises';
import {resolve,join,relative,dirname,extname,sep} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {validateMediaAliases} from './media-layout.mjs';
import {hashFile} from './export-media-blob.mjs';
import {MEDIA_MIME,validatePrivateMedia} from '../apps/studio/lib/cloud-media-store.mjs';

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rank=(row,indexed)=>[
  row.canonicalPath?1:0,
  row.path.includes('/runtime/presentation/')&&extname(row.path)==='.mp4'?0:1,
  row.access==='public'?0:1,
  indexed.has(row.path)?0:1,
  row.path.includes('/runtime/indexed/')&&!/\/(orig|dry|pre-trim)\//.test(row.path)?0:1,
  row.path.includes('/runtime/')?0:1,
  row.path.includes('/source/')?0:1,
].join('')+row.path;

/** Logical identity, access and URLs survive; only byte-identical physical
 * media (including their JSON metadata) share storage. Control/source files
 * such as .gitkeep, logs and scripts retain their independent purpose. */
export function planMediaDeduplication({layout,index}) {
  validateMediaAliases(layout);
  if(index.verification!=='readback-sha256')throw new Error('A verified Blob index is required.');
  const indexed=new Map(index.files.map(row=>[row.logicalPath,row])),groups=new Map();
  for(const row of layout.files){
    if(!row.size||!MEDIA_MIME[extname(row.path).slice(1)])continue;
    const key=`${row.sha256}:${row.size}:${extname(row.path)}`;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
  }
  const aliases=new Map();
  for(const rows of groups.values())if(rows.length>1){
    rows.sort((a,b)=>rank(a,indexed).localeCompare(rank(b,indexed)));
    for(const row of rows.slice(1))aliases.set(row.path,rows[0].path);
  }
  const nextLayout={...layout,files:layout.files.map(row=>aliases.has(row.path)?{...row,canonicalPath:aliases.get(row.path)}:{...row})};
  validateMediaAliases(nextLayout);
  const nextIndex={...index,files:index.files.map(row=>{
    const target=aliases.get(row.logicalPath);if(!target)return {...row};
    const canonical=indexed.get(target);
    if(!canonical||canonical.sha256!==row.sha256||canonical.size!==row.size||canonical.storage.contentType!==row.storage.contentType)throw new Error(`Missing verified canonical Blob: ${row.logicalPath}`);
    for(const entry of [row,canonical]){validatePrivateMedia(entry.storage);if(entry.storage.sha256!==entry.sha256||entry.storage.size!==entry.size)throw new Error('Blob identity mismatch.');}
    return {...row,storage:{...canonical.storage}};
  })};
  const retained=new Set(nextIndex.files.map(row=>row.storage.pathname));
  const blobDeletes=[...new Map(index.files.filter(row=>!retained.has(row.storage.pathname)).map(row=>[row.storage.pathname,row.storage])).values()];
  const localDeletes=nextLayout.files.filter(row=>row.canonicalPath&&!layout.files.find(old=>old.path===row.path)?.canonicalPath);
  return {schemaVersion:1,layoutDigest:digest(layout),indexDigest:digest(index),nextLayout,nextIndex,localDeletes,blobDeletes,
    summary:{logicalFiles:layout.files.length,aliases:nextLayout.files.filter(row=>row.canonicalPath).length,localFiles:localDeletes.length,localBytes:localDeletes.reduce((n,row)=>n+row.size,0),blobObjects:blobDeletes.length,blobBytes:blobDeletes.reduce((n,row)=>n+row.size,0)}};
}

async function checkedFile(root,path,row){
  const base=resolve(root,'media'),file=resolve(base,path),distance=relative(base,file);
  if(!distance||distance.startsWith('..')||distance.includes(':'))throw new Error('Media escaped its root.');
  for(const parent of [base,...distance.split(sep).slice(0,-1).map((_,i)=>join(base,...distance.split(sep).slice(0,i+1)))]){
    const info=await lstat(parent);if(!info.isDirectory()||info.isSymbolicLink()||resolve(await realpath(parent)).toLowerCase()!==parent.toLowerCase())throw new Error('Media directory link refused.');
  }
  const info=await lstat(file);
  if(!info.isFile()||info.isSymbolicLink()||info.size!==row.size||await hashFile(file)!==row.sha256)throw new Error(`Media bytes changed: ${path}`);
  return file;
}
async function atomic(file,value){const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});await rename(temp,file);}

/** Verify the complete set before changing metadata or deleting the first
 * file. Metadata is switched first so readers can already use the survivor. */
export async function applyMediaDeduplication(plan,{root,receipt}={}){
  const layoutPath=join(root,'media/layout.json'),indexPath=join(root,'media/blob-index.json');
  const layout=JSON.parse(await readFile(layoutPath,'utf8')),index=JSON.parse(await readFile(indexPath,'utf8'));
  if(digest(layout)!==plan.layoutDigest||digest(index)!==plan.indexDigest)throw new Error('Deduplication inputs changed.');
  const expected=planMediaDeduplication({layout,index});
  if(digest(expected)!==digest(plan))throw new Error('Deduplication plan changed.');
  const files=[];
  for(const row of plan.localDeletes){await checkedFile(root,row.canonicalPath,row);files.push(await checkedFile(root,row.path,row));}
  if(receipt)await atomic(receipt,{summary:plan.summary,deleted:[],state:'verified'});
  await atomic(layoutPath,plan.nextLayout);await atomic(indexPath,plan.nextIndex);
  const deleted=[];
  for(let i=0;i<files.length;i++){
    // Recheck both copies immediately before unlink in the shared checkout.
    const row=plan.localDeletes[i];await checkedFile(root,row.canonicalPath,row);await checkedFile(root,row.path,row);await unlink(files[i]);deleted.push(row.path);
    if(receipt)await atomic(receipt,{summary:plan.summary,deleted,state:'deleting'});
  }
  if(receipt)await atomic(receipt,{summary:plan.summary,deleted,state:'complete'});
  return plan.summary;
}
