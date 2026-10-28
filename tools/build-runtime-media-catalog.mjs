import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {repositoryRoot,readMediaLayout,presentationBankRoot,PRESENTATION_BANK_PATH} from './media-layout.mjs';
import {runtimeCatalogPaths} from './runtime-media-catalog.mjs';
import {readLabVideoManifest,createEmptyPresentationManifest} from '../packages/studio-registry/server/video-manifest.mjs';

// The catalogue serves exactly the layout's public and private JSON metadata.
const servedJson=row=>row.access!=='source'&&row.path.endsWith('.json');

async function presentationManifest(root,layout){
  try{return await readLabVideoManifest(join(presentationBankRoot(root),'lab-video-manifest.json'));}
  catch(error){
    if(error?.code!=='ENOENT')throw error;
    // Without a bank the catalogue has no dealer families. A layout that still
    // lists bank rows is stale and must be rebuilt before the catalogue.
    const bank=PRESENTATION_BANK_PATH+'/';
    if(layout.files.some(row=>row.path.startsWith(bank)))throw Error('The media layout still lists a presentation bank without its manifest.');
    return createEmptyPresentationManifest();
  }
}

export async function buildRuntimeMediaCatalog(root=repositoryRoot,{check=false}={}) {
  const paths=runtimeCatalogPaths(root),layout=readMediaLayout(root),entries={};
  const sources=layout.files.filter(servedJson);
  for(const row of sources){
    const value=await readFile(join(root,'media',row.canonicalPath??row.path),'utf8');
    JSON.parse(value);
    entries['media/'+row.path]=value;
  }
  const manifest=await presentationManifest(root,layout);
  const outputs=[[paths.manifest,manifest],[paths.legacy,{schemaVersion:2,entries}]];
  for(const [path,value] of outputs){
    const content=JSON.stringify(value,null,2)+'\n';
    if(check){if(await readFile(path,'utf8')!==content)throw Error('Shared media catalog is stale: '+path);}
    else {await mkdir(join(root,'media/catalog'),{recursive:true});await writeFile(path,content);}
  }
  return {files:outputs.length,metadataSources:sources.length};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log(JSON.stringify(await buildRuntimeMediaCatalog(repositoryRoot,{check:process.argv.includes('--check')})));
