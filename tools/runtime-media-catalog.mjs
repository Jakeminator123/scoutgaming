import {readFileSync} from 'node:fs';
import {join,relative} from 'node:path';
import {repositoryRoot as defaultRoot,resolveMediaAbsolutePath} from './media-layout.mjs';

// Shared deployment metadata. Dealer directories are authoring inputs only;
// native Studio reads this catalog and obtains media bytes from private Blob.
export function runtimeCatalogPaths(root=defaultRoot) {
  return {manifest:join(root,'media/catalog/presentation.json'),legacy:join(root,'media/catalog/legacy.json')};
}
export function createRuntimeMetadataReader(root=defaultRoot) {
  let entries;
  return async file => {
    if (!entries) {
      const document=JSON.parse(readFileSync(runtimeCatalogPaths(root).legacy,'utf8'));
      if(document.schemaVersion!==1 || !document.entries || Array.isArray(document.entries)) throw Error('Invalid runtime media catalog.');
      entries=document.entries;
    }
    const path=relative(root,resolveMediaAbsolutePath(file,{repositoryRoot:root})).split('\\').join('/');
    if(!Object.hasOwn(entries,path)) throw Error('Runtime metadata missing: '+path);
    return structuredClone(entries[path]);
  };
}
