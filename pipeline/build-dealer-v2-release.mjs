#!/usr/bin/env node
// Build static-only /v2 assets; preserve the deployed original player's code.
// Usage: node pipeline/build-dealer-v2-release.mjs <captured-live-public> <output-public>
import {readFile,writeFile,mkdir,copyFile,readdir,stat} from 'node:fs/promises';
import {resolve,dirname,join,relative,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolveMediaPath} from '../tools/media-layout.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'), source=join(root,'web/public');
const mediaFile=path=>resolveMediaPath('web/public/'+path.replaceAll('\\','/'),{repositoryRoot:root});
const [originalArg,outArg]=process.argv.slice(2);
if(!originalArg||!outArg)throw new Error('Supply captured live public and output public paths');
const original=resolve(originalArg),out=resolve(outArg);
if(out===source||out.startsWith(source+'/'))throw new Error('Release output must be outside source public');
const copied=new Set(),queue=[],missingReferences=[];
async function copy(path){
  path=path.replace(/^\.\//,'');if(copied.has(path))return;
  if(path.split(/[\\/]/).some(p=>p==='..')||path.startsWith('/')||path.includes(':'))throw new Error('Asset outside public: '+path);
  const file=mediaFile(path);
  const info=await stat(file);
  if(info.isDirectory()){for(const name of await readdir(file))await copy(join(path,name));return;}
  copied.add(path);const target=join(out,'v2',path);await mkdir(dirname(target),{recursive:true});await copyFile(file,target);
  if(['.mjs','.js','.json','.css','.html'].includes(extname(path)))queue.push(path);
}
for(const path of ['app.mjs','index.html','styles.css','environment.css','calibration.css','dealer-version-switcher.css','vendor',
  'assets','dealer/supervisor.webm','dealer/poster.jpg','dealers/mei/poster.jpg',
  'dealers/astrid/audio','dealers/amira/audio','dealers/astrid/poster.jpg','dealers/amira/poster.jpg',
  'dealers/astrid/scene.png','dealers/astrid/table.png','dealers/amira/scene-clear-v2.png','dealers/amira/table.png',
  'review/astrid-table-v2','review/astrid-green-waiting/idle.json','review/astrid-green-speak/speak.json',
  'review/amira-green-waiting/idle.json','review/amira-green-speak/speak.json','review/amira-composite/profile.json'])await copy(path);
while(queue.length){
  const path=queue.shift(),text=await readFile(mediaFile(path),'utf8');
  if(/\.m?js$/.test(path))for(const match of text.matchAll(/(?:from\s*|import\s*\(?)['"](\.\.?\/[^'"]+\.(?:mjs|js))['"]/g))await copy(join(dirname(path),match[1]));
  if(/\.(css|html)$/.test(path))for(const match of text.matchAll(/(?:url\(\s*|(?:src|href)=)['"]([^'"]+)['"]/g)){
    if(/^(?:https?:|data:|\/|#)/.test(match[1]))continue;
    const asset=join(dirname(path),match[1].split('?')[0]);
    if(await stat(mediaFile(asset)).catch(()=>null))await copy(asset);
  }
  if(path.endsWith('.json')){
    const walk=async (value,key='')=>{
      if(typeof value==='string'&&/^(?:review|assets|dealers|dealer)\//.test(value)&&/\.(?:mp4|png|jpg|webm|mp3|json|glb)$/.test(value)){ if(await stat(mediaFile(value)).catch(()=>null))await copy(value); else {
      // These unused provenance images were already absent in the accepted preview.
      const metadataOnly=['media/dealers/astrid/source/3d/greenscreen/blackjack-camera-reference.jpg','review/amira-green-waiting/rest-0000.png','review/amira-green-waiting/rest-full.png'];
      if(!metadataOnly.includes(value))throw new Error(`Missing referenced asset ${value}`);
      missingReferences.push({manifest:path,key,path:value});
    } }
      else if(Array.isArray(value))for(const item of value)await walk(item);
      else if(value&&typeof value==='object')for(const [key,item] of Object.entries(value))await walk(item,key);
    };await walk(JSON.parse(text));
  }
}
// No server or database is included. Originals get just the comparison rail.
const live=await readFile(join(original,'app.mjs'),'utf8');
const anchor="  $('#dealer-options').appendChild(button);\n}";
if(live.includes('installDealerVersionSwitcher')||live.split(anchor).length!==2)throw new Error('Live original changed; review the switcher patch');
const patched="import { installDealerVersionSwitcher } from './dealer-version-switcher.mjs';\n"+live.replace(anchor,anchor+"\ninstallDealerVersionSwitcher({ dealer: DEALER.key, version: 'original', isBusy: () => !!round || busy });");
await writeFile(join(out,'app.mjs'),patched);
for(const path of ['dealer-version-switcher.mjs','dealer-version-switcher.css'])await copyFile(join(source,path),join(out,path));
const sha=data=>createHash('sha256').update(data).digest('hex');
const files=[];
async function list(dir){for(const name of await readdir(dir)){const file=join(dir,name);if((await stat(file)).isDirectory())await list(file);else{const data=await readFile(file);files.push({path:relative(out,file),bytes:data.length,sha256:sha(data)});}}}
await list(out);
const receipt={missingReferences,originalAppSha256:sha(live),originalAppPatchedSha256:sha(patched),files:files.sort((a,b)=>a.path.localeCompare(b.path))};
await writeFile(join(dirname(out),'release-manifest.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({files:files.length,megabytes:Math.round(files.reduce((n,f)=>n+f.bytes,0)/1024/1024),originalAppSha256:receipt.originalAppSha256}));
