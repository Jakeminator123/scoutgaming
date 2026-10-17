import {validatePrivateMedia} from './private-media-contract.mjs';
import {createMediaLayout,validateMediaLayout} from './media-layout.mjs';
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
export function createMediaBlobIndex({repositoryRoot,getPrivateMedia,readLocalIndex,readMediaLayout}) {
  if(typeof getPrivateMedia!=='function')throw new TypeError('Explicit private media reader required.');
  const {resolvePublicMedia}=createMediaLayout({repositoryRoot,readMediaLayout});
  function readMediaBlobIndex(options={}) {
    if(Object.hasOwn(options,'runtimeCatalog'))return validateMediaBlobIndex(options.runtimeCatalog?.blobIndex);
    if(!isMediaBlobIndexConfigured(options))return null;
    if(typeof readLocalIndex!=='function')throw new Error('Explicit local Blob index reader required.');
    return readLocalIndex(options);
  }

  function mediaBlobStorage(logicalPath,options={}){return readMediaBlobIndex(options)?.get(logicalPath)?.storage??null;}
  function isMediaBlobIndexConfigured(options={}){
    return Object.hasOwn(options,'runtimeCatalog') || Boolean(options.indexPath||(options.env??process.env).CROUPIER_MEDIA_BLOB_INDEX);
  }
  /** Callers first resolve an authenticated ID or a public allowlist entry. */
  function verifiedMediaBlobStorage(logicalPath,expected,options={}){
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
  async function getIndexedMediaBlobResponse(logicalPath,expected,request,options={}){
    if(!isMediaBlobIndexConfigured(options))return null;
    try{
      const response=await getPrivateMedia(verifiedMediaBlobStorage(logicalPath,expected,options),request,options);
      // A missing/changed authoritative object is an unavailable active source.
      return [404,409,422].includes(response.status)?unavailable():response;
    }catch{return unavailable();}
  }
  /** Both URL generations are checked against the canonical public allowlist. */
  async function getPublicMediaBlobResponse(path,request,options={}){
    if(!isMediaBlobIndexConfigured(options))return null;
    try{
      const entry=resolvePublicMedia(path,{...options,repositoryRoot:options.repositoryRoot??repositoryRoot});if(!entry)return null;
      return await getIndexedMediaBlobResponse(entry.logicalPath,{access:'public',sha256:entry.sha256,size:entry.size},request,options);
    }catch{return unavailable();}
  }

  return {readMediaBlobIndex,mediaBlobStorage,isMediaBlobIndexConfigured,verifiedMediaBlobStorage,getIndexedMediaBlobResponse,getPublicMediaBlobResponse};
}
