import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import {isAbsolute,resolve} from 'node:path';
import {repositoryRoot,resolvePublicMedia,readMediaLayout,validateMediaLayout} from '../../tools/media-layout.mjs';
import {getPrivateMedia,validatePrivateMedia} from './cloud-media-store.mjs';
const cached=new Map();
/** The configured private server index contains IDs/pathnames, never Blob URLs. */
export function readMediaBlobIndex(options={}){
  const {env=process.env,indexPath=env.CROUPIER_MEDIA_BLOB_INDEX}=options;
  if(Object.hasOwn(options,'runtimeCatalog'))return validateMediaBlobIndex(options.runtimeCatalog?.blobIndex);
  if(!indexPath)return null;
  if(!isAbsolute(indexPath))throw new Error('Absolute media Blob index required.');
  const file=resolve(indexPath),info=lstatSync(file),actual=realpathSync(file);
  if(!info.isFile()||info.isSymbolicLink()||actual.toLowerCase()!==file.toLowerCase()||info.size>16*1024*1024)throw new Error('Unsafe media Blob index.');
  const key=`${info.size}:${info.mtimeMs}`;if(cached.get(file)?.key===key)return cached.get(file).index;
  const data=JSON.parse(readFileSync(file,'utf8'));
  const index=validateMediaBlobIndex(data);cached.set(file,{key,index});return index;
}
export function validateMediaBlobIndex(data){
  if(data?.schemaVersion!==1||data.namespace!=='croupier/media'||data.verification!=='readback-sha256'||!Array.isArray(data.files)||data.files.length>20000)throw new Error('Invalid media Blob index.');
  const index=new Map();for(const row of data.files){
    if(typeof row.logicalPath!=='string'||row.logicalPath.includes('\\')||row.logicalPath.split('/').some(part=>!part||part==='.'||part==='..')||index.has(row.logicalPath)||!['source','public','private'].includes(row.access))throw new Error('Invalid media Blob entry.');
    // Managed uploads are owned solely by the Neon registry, never a deployed bank index.
    if(/^croupier\/media\/dealers\/[^/]+\/review\/uploads\//.test(row.storage?.pathname??''))throw new Error('Managed upload cannot be an immutable bank asset.');
    validatePrivateMedia(row.storage);if(row.sha256!==row.storage.sha256||row.size!==row.storage.size)throw new Error('Media Blob integrity mismatch.');index.set(row.logicalPath,row);
  }
  return index;
}
export function mediaBlobStorage(logicalPath,options={}){return readMediaBlobIndex(options)?.get(logicalPath)?.storage??null;}
export function isMediaBlobIndexConfigured(options={}){
  return Object.hasOwn(options,'runtimeCatalog') || Boolean(options.indexPath||(options.env??process.env).CROUPIER_MEDIA_BLOB_INDEX);
}
/** Callers first resolve an authenticated ID or a public allowlist entry. */
export function verifiedMediaBlobStorage(logicalPath,expected,options={}){
  if(!isMediaBlobIndexConfigured(options))return null;
  const layout=Object.hasOwn(options,'runtimeCatalog')?validateMediaLayout(options.runtimeCatalog?.layout):options.layout??readMediaLayout(options.repositoryRoot??repositoryRoot);
  const entry=layout.files.find(row=>row.path===logicalPath),row=readMediaBlobIndex(options)?.get(logicalPath);
  if(!entry||!row||row.access!==entry.access||row.sha256!==entry.sha256||row.size!==entry.size
    ||row.access!==expected.access||expected.sha256!==undefined&&row.sha256!==expected.sha256
    ||expected.size!==undefined&&row.size!==expected.size||expected.id!==undefined&&row.id!==expected.id
    ||expected.pathname!==undefined&&row.storage.pathname!==expected.pathname
    ||expected.contentType!==undefined&&row.storage.contentType!==expected.contentType){
    throw new Error('The active media Blob index does not match the allowed media.');
  }
  return row.storage;
}
const unavailable=()=>new Response(null,{status:503,headers:{'Cache-Control':'no-store'}});
export async function getIndexedMediaBlobResponse(logicalPath,expected,request,options={}){
  if(!isMediaBlobIndexConfigured(options))return null;
  try{
    const response=await getPrivateMedia(verifiedMediaBlobStorage(logicalPath,expected,options),request,options);
    // A missing/changed authoritative object is an unavailable active source.
    return [404,409,422].includes(response.status)?unavailable():response;
  }catch{return unavailable();}
}
/** Both URL generations are checked against the canonical public allowlist. */
export async function getPublicMediaBlobResponse(path,request,options={}){
  if(!isMediaBlobIndexConfigured(options))return null;
  try{
    const entry=resolvePublicMedia(path,{...options,repositoryRoot:options.repositoryRoot??repositoryRoot});if(!entry)return null;
    return await getIndexedMediaBlobResponse(entry.logicalPath,{access:'public',sha256:entry.sha256,size:entry.size},request,options);
  }catch{return unavailable();}
}
