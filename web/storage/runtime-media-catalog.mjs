import {createHash} from 'node:crypto';
import {cloneStudioJson, StudioStorageError} from './studio-contract.mjs';
import {validateMediaLayout} from '../../tools/media-layout.mjs';
import {validateLabVideoManifest} from '../../lab/lib/lab-video-manifest.mjs';
import {validatePrivateMedia} from '../../lab/lib/cloud-media-store.mjs';

const limits={maxBytes:16*1024*1024,maxNodes:200000,maxDepth:32};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=()=>{throw new StudioStorageError('studio_runtime_catalog_invalid',503);};
const safe=path=>typeof path==='string'&&path.length>0&&!/[\\\u0000:]/.test(path)&&!path.startsWith('/')&&path.split('/').every(part=>part&&part!=='.'&&part!=='..');
export const runtimeCatalogJson=value=>JSON.stringify(cloneStudioJson(value,limits));
export const runtimeCatalogRevision=value=>hash(runtimeCatalogJson(value));

/** Server-owned catalogue only. No disk reads, registration or provider requests. */
export function validateRuntimeMediaCatalog(source) {
  try {
    const value=cloneStudioJson(source,limits);
    if(value.schemaVersion!==1||Object.keys(value).sort().join(',')!=='blobIndex,layout,legacy,presentation,schemaVersion')fail();
    validateMediaLayout(value.layout);
    validateLabVideoManifest(value.presentation);
    const index=value.blobIndex;
    if(index.schemaVersion!==1||index.namespace!=='croupier/media'||index.verification!=='readback-sha256'||!Array.isArray(index.files)||index.files.length>20000)fail();
    const layout=new Map(value.layout.files.map(row=>[row.path,row])), blobs=new Map();
    for(const row of index.files){
      if(!safe(row.logicalPath)||blobs.has(row.logicalPath))fail();
      validatePrivateMedia(row.storage);
      const entry=layout.get(row.logicalPath);
      if(!entry||row.access!==entry.access||row.sha256!==entry.sha256||row.size!==entry.size||row.sha256!==row.storage.sha256||row.size!==row.storage.size
        ||/^croupier\/media\/dealers\/[^/]+\/review\/uploads\//.test(row.storage.pathname))fail();
      blobs.set(row.logicalPath,row);
    }
    for(const row of value.layout.files)if(row.access!=='source'&&!blobs.has(row.path))fail();
    for(const item of value.presentation.items){
      const row=blobs.get('dealers/astrid/runtime/presentation/'+item.relativePath);
      if(!row||row.id!==item.id||row.sha256!==item.sha256||row.size!==item.size)fail();
    }
    if(value.legacy.schemaVersion!==2||!value.legacy.entries||Array.isArray(value.legacy.entries)||typeof value.legacy.entries!=='object')fail();
    for(const [path,text] of Object.entries(value.legacy.entries)){
      if(!safe(path)||!path.startsWith('media/')||typeof text!=='string')fail();
      const row=layout.get(path.slice(6));
      if(!row||row.sha256!==hash(Buffer.from(text,'utf8'))||row.size!==Buffer.byteLength(text,'utf8'))fail();
      JSON.parse(text);
    }
    for(const row of index.files)if(row.access!=='source'&&row.storage.contentType==='application/json'
      &&!Object.hasOwn(value.legacy.entries,'media/'+row.logicalPath))fail();
    return value;
  }catch{fail();}
}

export function validateRuntimeCatalogRecord(row){
  if(!row||typeof row.revision!=='string'||!/^[a-f0-9]{64}$/.test(row.revision))fail();
  const value=validateRuntimeMediaCatalog(row.value);
  if(runtimeCatalogRevision(value)!==row.revision)fail();
  return {revision:row.revision,value};
}
