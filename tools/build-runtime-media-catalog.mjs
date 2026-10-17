import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {repositoryRoot,resolveMediaAbsolutePath,presentationBankRoot} from './media-layout.mjs';
import {runtimeCatalogPaths} from './runtime-media-catalog.mjs';
import {readLabVideoManifest} from '../packages/studio-registry/server/video-manifest.mjs';

export async function buildRuntimeMediaCatalog(root=repositoryRoot,{check=false}={}) {
  const paths=runtimeCatalogPaths(root),entries={};
  const sources=['speech-media.json',...['astrid'].map(id=>'review/'+id+'-green-speak/speak.json')];
  for(const source of sources){
    const path=resolveMediaAbsolutePath(join(root,'web/public',source),{repositoryRoot:root});
    const value=await readFile(path,'utf8');
    JSON.parse(value);
    entries[path.slice(root.length+1).split('\\').join('/')]=value;
  }
  const manifest=await readLabVideoManifest(join(presentationBankRoot(root),'lab-video-manifest.json'));
  const outputs=[[paths.manifest,manifest],[paths.legacy,{schemaVersion:2,entries}]];
  for(const [path,value] of outputs){
    const content=JSON.stringify(value,null,2)+'\n';
    if(check){if(await readFile(path,'utf8')!==content)throw Error('Shared media catalog is stale: '+path);}
    else {await mkdir(join(root,'media/catalog'),{recursive:true});await writeFile(path,content);}
  }
  return {files:outputs.length,metadataSources:sources.length};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log(JSON.stringify(await buildRuntimeMediaCatalog(repositoryRoot,{check:process.argv.includes('--check')})));
