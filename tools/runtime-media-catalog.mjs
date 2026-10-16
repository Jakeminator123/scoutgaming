import {readFileSync} from 'node:fs';
import {join,relative} from 'node:path';
import {repositoryRoot as defaultRoot,resolveMediaAbsolutePath} from './media-layout.mjs';

// Offline authoring tools may read the exported files. Native Studio supplies
// the scoped Neon catalog for each operation and obtains media bytes from Blob.
export function runtimeCatalogPaths(root=defaultRoot) {
  return {manifest:join(root,'media/catalog/presentation.json'),legacy:join(root,'media/catalog/legacy.json')};
}
export function createRuntimeMetadataBytesReader(root=defaultRoot,options={}) {
  let entries;
  return async file => {
    if (!entries) {
      const document=Object.hasOwn(options,'runtimeCatalog') ? options.runtimeCatalog?.legacy : JSON.parse(readFileSync(runtimeCatalogPaths(root).legacy,'utf8'));
      if(document?.schemaVersion!==2 || !document.entries || typeof document.entries!=='object' || Array.isArray(document.entries)) throw Error('Invalid runtime media catalog.');
      entries=document.entries;
    }
    const path=relative(root,resolveMediaAbsolutePath(file,{repositoryRoot:root,...options})).split('\\').join('/');
    if(!Object.hasOwn(entries,path)) throw Error('Runtime metadata missing: '+path);
    const source=entries[path];
    if(source===null)return null;
    if(typeof source!=='string')throw Error('Invalid runtime metadata: '+path);
    return Buffer.from(source,'utf8');
  };
}
export function createRuntimeMetadataReader(root=defaultRoot,options={}) {
  const readBytes=createRuntimeMetadataBytesReader(root,options);
  return async file => {
    const bytes=await readBytes(file);
    return bytes===null?null:JSON.parse(bytes.toString('utf8'));
  };
}

/** The repository validates the imported catalog. Detach each operation's source. */
export function capturedRuntimeCatalog(snapshot) {
  if (!snapshot || !/^[a-f0-9]{64}$/.test(snapshot.revision??'')
    || snapshot.value?.schemaVersion!==1 || !snapshot.value.layout || !snapshot.value.blobIndex || !snapshot.value.presentation || !snapshot.value.legacy) {
    throw Object.assign(Error('studio_runtime_catalog_unavailable'),{code:'studio_runtime_catalog_unavailable',statusCode:503});
  }
  return structuredClone(snapshot.value);
}
export async function readRuntimeCatalog(repository) {
  if(typeof repository?.readRuntimeCatalog!=='function')throw Object.assign(Error('studio_runtime_catalog_unavailable'),{code:'studio_runtime_catalog_unavailable',statusCode:503});
  return capturedRuntimeCatalog(await repository.readRuntimeCatalog());
}
