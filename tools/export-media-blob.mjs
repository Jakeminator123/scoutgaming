import {readFile,writeFile,mkdir,rename,lstat} from 'node:fs/promises';
import {openAsBlob,createReadStream} from 'node:fs';
import {dirname,join,resolve,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {readMediaLayout,repositoryRoot,resolveMediaPath,validateMediaAliases} from './media-layout.mjs';
import {MEDIA_MIME,mediaBlobPath,putPrivateMedia,getPrivateMedia} from '../apps/studio/lib/cloud-media-store.mjs';
const identity=hash=>`${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
// Streams the file; the result is compared with the layout's exact SHA-256.
async function hashFile(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
/** Metadata-only dry run: public rows, and source rows on request. The ID is
 * derived from the exact bytes; the repository carries no presentation bank. */
export async function planBlobExport({root=repositoryRoot,includeSource=false,layout=readMediaLayout(root)}={}){
  validateMediaAliases(layout);
  return {schemaVersion:1,namespace:'croupier/media',files:layout.files.filter(row=>(includeSource||row.access==='public')&&MEDIA_MIME[extname(row.path).slice(1)]&&row.size>0).map(row=>{
    const canonical=row.canonicalPath??row.path,extension=extname(row.path).slice(1),id=identity(row.sha256),pathname=mediaBlobPath(dirname(canonical).replaceAll('\\','/'),id,row.sha256,extension);
    return {logicalPath:row.path,id,sha256:row.sha256,size:row.size,access:row.access,legacyUrls:row.publicUrl?[row.publicUrl]:[],storage:{provider:'vercel-blob',pathname,sha256:row.sha256,size:row.size,contentType:MEDIA_MIME[extension]}};
  })};
}
/** Explicit apply only; immutable existing objects are verified and reused.
 * No URL or credentials are exported and no existing object is deleted. */
export async function syncBlobExport(plan,{root=repositoryRoot,concurrency=4,checkpoint,...options}={}){
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>4)throw new Error('Export concurrency must be 1–4.');
  const completed=new Map(),objects=new Map(),result={...plan,files:[]};let cursor=0,failure,writing=Promise.resolve();
  if(checkpoint)try{const info=await lstat(checkpoint);if(!info.isFile()||info.isSymbolicLink()||info.size>16*1024*1024)throw new Error('Unsafe export checkpoint.');const prior=JSON.parse(await readFile(checkpoint,'utf8'));if(prior.schemaVersion!==1||prior.namespace!==plan.namespace||!Array.isArray(prior.files))throw new Error('Invalid export checkpoint.');const expected=new Map(plan.files.map(row=>[row.logicalPath,JSON.stringify(row)]));if(prior.verification==='readback-sha256')for(const row of prior.files)if(expected.get(row.logicalPath)===JSON.stringify(row))completed.set(row.logicalPath,row);}catch(error){if(error.code!=='ENOENT')throw error;}
  async function worker(){while(!failure&&cursor<plan.files.length){const row=plan.files[cursor++];if(completed.has(row.logicalPath))continue;try{
    const file=resolveMediaPath('media/'+row.logicalPath,{repositoryRoot:root}),info=await lstat(file);
    if(!info.isFile()||info.isSymbolicLink()||info.size!==row.size||await hashFile(file)!==row.sha256)throw new Error(`Media changed before export: ${row.logicalPath}`);
    // Distinct logical takes can have identical bytes and the same immutable
    // object key. Share one verification/upload rather than racing two puts.
    if(!objects.has(row.storage.pathname))objects.set(row.storage.pathname,(async()=>{
      const existing=await getPrivateMedia(row.storage,new Request('http://localhost/media-export',{method:'HEAD'}),options);
      if(existing.status===404){
        // SDK retries reuse the same body. A file-backed Blob provides a fresh
        // stream for each attempt and rejects source changes while being read.
        const body=await openAsBlob(file,{type:row.storage.contentType});
        if(body.size!==row.size)throw new Error(`Media changed before export: ${row.logicalPath}`);
        await putPrivateMedia(row.storage.pathname,body,{...options,...row.storage});
      }
      else if(!existing.ok)throw new Error(`Existing private object could not be verified (${existing.status}): ${row.logicalPath}`);
    })());
    await objects.get(row.storage.pathname);
    completed.set(row.logicalPath,row);
    if(checkpoint){writing=writing.then(()=>writeBlobIndex(checkpoint,{...plan,verification:'readback-sha256',files:[...completed.values()]}));await writing;}
    if(options.onProgress)options.onProgress({completed:completed.size,total:plan.files.length,logicalPath:row.logicalPath});
  }catch(error){failure??=new Error(`Media export failed for ${row.logicalPath}: ${error.message}`,{cause:error});}}}
  await Promise.all(Array.from({length:concurrency},worker));await writing;
  if(failure)throw failure;
  result.files=plan.files.filter(row=>completed.has(row.logicalPath));
  result.verification='readback-sha256';
  return result;
}
export async function writeBlobIndex(file,index){await mkdir(dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(index,null,2)+'\n',{flag:'wx'});await rename(temp,file);}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const args=process.argv.slice(2),value=name=>args[args.indexOf(name)+1],root=args.includes('--root')?resolve(value('--root')):repositoryRoot;
  const plan=await planBlobExport({root,includeSource:args.includes('--include-source')});
  const output=args.includes('--output')?resolve(value('--output')):join(root,'apps/studio/data/media-blob-index.json');
  const result=args.includes('--apply')?await syncBlobExport(plan,{root,checkpoint:output,cacheDir:join(root,'apps/studio/data/.media-export-cache')}):plan;
  if(args.includes('--output')||args.includes('--apply'))await writeBlobIndex(output,result);
  console.log(JSON.stringify({mode:args.includes('--apply')?'verified-private-sync':'dry-run',files:result.files.length,bytes:result.files.reduce((n,row)=>n+row.size,0),runtimePublic:result.files.filter(row=>row.access==='public').length,namespace:result.namespace}));
}
