import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, constants } from 'node:fs';
import { readdir, lstat, realpath, readlink, mkdir, copyFile, readFile, writeFile, rename, unlink, rmdir } from 'node:fs/promises';
import { join, resolve, relative, dirname, extname, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { repositoryRoot, PRESENTATION_BANK, readMediaLayout } from './media-layout.mjs';
const MEDIA=/\.(mp4|mov|webm|mkv|mp3|wav|ogg|flac|png|jpe?g|webp|gif|svg|ico|glb|gltf|blend|fbx|obj|stl|usdz|bin|h264|webpseq|zip|7z)$/i;
const owners=new Set(['astrid','vera','amira','mei']);
const normalize=value=>value.split(sep).join('/');
export async function hashFile(file) { const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex'); }
async function exists(file) {try{return await lstat(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}}
function inside(root,path) {const absolute=resolve(root,path),distance=relative(root,absolute);if(!distance||distance.startsWith('..')||distance.includes(':'))throw new Error('Migration escaped the repository.');return absolute;}
async function safeParents(root,file,{create=false}={}) {
  if((await lstat(root)).isSymbolicLink()||resolve(await realpath(root)).toLowerCase()!==root.toLowerCase())throw new Error('Repository links refused.');
  const parts=relative(root,dirname(file)).split(sep).filter(Boolean);let parent=root;
  for(const part of parts){parent=join(parent,part);let info=await exists(parent);if(!info&&create){await mkdir(parent);info=await lstat(parent);}if(!info)continue;if(!info.isDirectory()||info.isSymbolicLink())throw new Error('Migration directory links refused.');}
}
async function files(root,path) {
  const target=inside(root,path),found=[];
  await safeParents(root,target);
  if(!await exists(target))return found;
  if((await lstat(target)).isSymbolicLink())throw new Error('Source links refused.');
  async function walk(dir) {for(const entry of await readdir(dir,{withFileTypes:true})){const file=join(dir,entry.name),name=normalize(relative(root,file));if(entry.isSymbolicLink()){if(name==='web/public/astrid-collection-sweep.glb'){found.push(name);continue;}throw new Error(`Link refused: ${name}`);}if(entry.isDirectory())await walk(file);else if(entry.isFile())found.push(name);else throw new Error('Special file refused.');}}
  if((await lstat(target)).isDirectory())await walk(target);else found.push(path);
  return found;
}
function dealerIn(name) {return ['astrid','amira','mei','vera'].find(id=>new RegExp(`(^|[/_-])${id}([/_-]|$)`).test(name));}
function publicPlacement(file) {
  const path=file.slice('web/public/'.length),parts=path.split('/');
  if(parts[0]==='dealer')return `dealers/vera/runtime/indexed/${parts.slice(1).join('/')}`;
  if(parts[0]==='dealer-hands')return `dealers/vera/runtime/hands/${parts.slice(1).join('/')}`;
  if(parts[0]==='dealers'){
    const id=parts[1].replace(/-hands$/,'');if(owners.has(id))return `dealers/${id}/runtime/${parts[1].endsWith('-hands')?'hands':'indexed'}/${parts.slice(2).join('/')}`;
  }
  if(parts[0]==='review'){const dealer=dealerIn(parts[1])??'astrid';return `dealers/${dealer}/runtime/composited/${parts.slice(1).join('/')}`;}
  if(parts[0]==='assets')return `game/runtime/assets/${parts.slice(1).join('/')}`;
  if(parts[0]==='sfx')return `game/runtime/audio/${parts.slice(1).join('/')}`;
  if(parts[0]==='kevin-cards')return `game/runtime/cards/${parts.slice(1).join('/')}`;
  if(parts[0]==='bo')return `site/runtime/backoffice/${parts.slice(1).join('/')}`;
  if(path==='speech-media.json')return 'game/runtime/speech-media.json';
  const dealer=dealerIn(path);if(dealer)return `dealers/${dealer}/runtime/assets/${path}`;
  if(['scene.jpg','dealer-fallback.png'].includes(path))return `game/runtime/scene/${path}`;
  return `site/runtime/${path}`;
}
async function oldLayout(root) {try{return JSON.parse(await readFile(join(root,'media/layout.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return {schemaVersion:1,roots:{},files:[]};throw error;}}
export async function planMediaMigration({root=repositoryRoot,scope='all',hash=false}={}) {
  root=resolve(root);const previous=await oldLayout(root),planned=new Map(previous.files.map(row=>[row.legacyPath,row]));
  const roots={...previous.roots,'emil/dealklipp-v1':PRESENTATION_BANK};
  let tracked=new Set();try{tracked=new Set(execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).split('\0').filter(Boolean));}catch{}
  async function add(old,newRoot,{filter=()=>true,access='source'}={}){
    roots[old]=`media/${newRoot}`;
    for(const legacyPath of await files(root,old))if(filter(legacyPath)){
      const path=`${newRoot}${legacyPath===old?'':'/'+legacyPath.slice(old.length+1)}`;
      const info=await lstat(inside(root,legacyPath));
      planned.set(legacyPath,{legacyPath,path,size:info.size,sha256:hash?await hashFile(inside(root,legacyPath)):planned.get(legacyPath)?.sha256??null,tracked:tracked.has(legacyPath),access});
    }
  }
  if(['bank','all'].includes(scope))await add('emil/dealklipp-v1',PRESENTATION_BANK.slice(6));
  if(scope==='all'){
    await add('emil/README.md','dealers/astrid/source/provenance/emil-delivery.md');
    await add('design-kit','site/source/design-kit');
    for(const file of await files(root,'content'))if(file.split('/').length===2&&MEDIA.test(file))await add(file,`game/source/${file.includes('cardback')?'cards':'scene'}/${file.slice('content/'.length)}`);
    for(const [old,next] of [['assets/astrid-3d','dealers/astrid/source/3d'],['assets/blackjack-3d','game/source/3d'],['assets/scene-footage','game/source/scene-footage'],['content/persona','game/source/persona']])await add(old,next);
    for(const id of owners)await add(`content/dealers/${id}`,`dealers/${id}/source/generation`);
    for(const name of ['raw','raw-all','raw2','raw-super','raw-speak','raw-speak2','encoded','encoded2','bake','cutout','norm'])await add(`content/${name}`,`game/source/pipeline/${name}`);
    const stages=join(root,'content/staging');
    if(await exists(stages))for(const date of await readdir(stages,{withFileTypes:true}))if(date.isDirectory())for(const take of await readdir(join(stages,date.name),{withFileTypes:true})){
      const old=`content/staging/${date.name}/${take.name}`,dealer=dealerIn(take.name),owner=dealer?`dealers/${dealer}`:'game';
      await add(old,`${owner}/staging/${date.name}/${take.name}`);
    }
    for(const legacyPath of await files(root,'web/public')){
      const path=legacyPath.slice('web/public/'.length),metadata=path==='speech-media.json'||/^(dealer(?:-hands)?|dealers|review|assets|sfx)\//.test(path)&&extname(path)==='.json';
      if(!MEDIA.test(path)&&!metadata)continue;
      if(path.startsWith('vendor/'))continue;
      const prefix=path.startsWith('review/')?path.split('/').slice(0,2).join('/') : path.startsWith('dealers/')?path.split('/').slice(0,2).join('/') : ['dealer','dealer-hands','assets','sfx','kevin-cards','bo'].includes(path.split('/')[0])?path.split('/')[0]:null;
      if(prefix){const exactPrefix=prefix==='bo'?path.split('/').slice(0,2).join('/'):prefix;const mapped=publicPlacement('web/public/'+exactPrefix+'/__root__').replace(/\/__root__$/,'');roots['web/public/'+exactPrefix]='media/'+mapped;}
      let source=inside(root,legacyPath),info=await lstat(source),copySource;
      if(info.isSymbolicLink()){copySource='assets/astrid-3d/collection-sweep/astrid-collection-sweep.glb';const expected=inside(root,copySource);if(legacyPath!=='web/public/astrid-collection-sweep.glb'||resolve(dirname(source),await readlink(source)).toLowerCase()!==expected.toLowerCase())throw new Error('Unexpected old media alias.');await safeParents(root,expected);source=expected;info=await lstat(source);if(!info.isFile()||info.isSymbolicLink())throw new Error('Unsafe alias source.');}
      planned.set(legacyPath,{legacyPath,path:publicPlacement(legacyPath),size:info.size,sha256:hash?await hashFile(source):planned.get(legacyPath)?.sha256??null,tracked:tracked.has(legacyPath),access:path.startsWith('bo/gen/')?'private':'public',...(copySource?{copySource}:{}),...(!path.startsWith('bo/gen/')?{publicUrl:'/'+path}:{})});
    }
  }
  if(scope==='docs')await add('docs/reference','dealers/astrid/source/reference');
  const output={schemaVersion:1,roots,provenance:{presentation:{supplier:'Emil',originalRoot:'emil/dealklipp-v1',deliveryVersion:1},recordedCards:{supplier:'Kevin',sourceCommit:'0d12b7a559d328a333598b7e583b980e88d7925c'}},files:[...planned.values()].sort((a,b)=>a.path.localeCompare(b.path))};
  const destinations=new Set();for(const row of output.files){inside(root,'media/'+row.path);if(destinations.has(row.path))throw new Error(`Duplicate destination: ${row.path}`);destinations.add(row.path);}
  return output;
}
async function atomic(file,value,root){await safeParents(root,file,{create:true});const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});await rename(temp,file);}
async function emptyDirectories(root,oldRoots){for(const old of Object.keys(oldRoots).sort((a,b)=>b.length-a.length)){const target=inside(root,old);async function prune(dir){const info=await exists(dir);if(!info||!info.isDirectory())return;if(info.isSymbolicLink())throw new Error('Cleanup links refused.');for(const entry of await readdir(dir,{withFileTypes:true}))if(entry.isDirectory())await prune(join(dir,entry.name));try{await rmdir(dir);}catch(error){if(!['ENOTEMPTY','ENOENT'].includes(error.code))throw error;}}await prune(target);}}
export async function applyMediaMigration(options={}) {
  const root=resolve(options.root??repositoryRoot),before=await oldLayout(root),layout=await planMediaMigration({...options,root,hash:true});
  const ledgerFile=join(root,'media/.migration',`migration-${new Date().toISOString().replaceAll(':','-')}-${randomUUID()}.json`);
  const ledger={schemaVersion:1,root,scope:options.scope??'all',state:'copying',previousLayout:before,files:layout.files};await atomic(ledgerFile,ledger,root);
  for(const row of layout.files){
    const source=inside(root,row.copySource??row.legacyPath),destination=inside(root,'media/'+(row.canonicalPath??row.path));
    await safeParents(root,source);await safeParents(root,destination,{create:true});const src=await exists(source),dest=await exists(destination);
    if(dest){if(dest.isSymbolicLink()||!dest.isFile()||dest.size!==row.size||await hashFile(destination)!==row.sha256)throw new Error(`Target conflict: ${row.path}`);continue;}
    if(!src||src.isSymbolicLink()||!src.isFile())throw new Error(`Source unavailable: ${row.legacyPath}`);
    await copyFile(source,destination,constants.COPYFILE_EXCL);
    if(await hashFile(destination)!==row.sha256)throw new Error(`Copy mismatch: ${row.legacyPath}`);
  }
  ledger.state='verified';await atomic(ledgerFile,ledger,root);await atomic(join(root,'media/layout.json'),layout,root);
  for(const row of layout.files){const source=inside(root,row.legacyPath),info=await exists(source);if(info){if(info.isSymbolicLink()){if(!row.copySource||resolve(dirname(source),await readlink(source)).toLowerCase()!==inside(root,row.copySource).toLowerCase())throw new Error('Old alias changed.');}else if(await hashFile(source)!==row.sha256)throw new Error(`Source changed during migration: ${row.legacyPath}`);await unlink(source);}}
  await emptyDirectories(root,layout.roots);ledger.state='complete';await atomic(ledgerFile,ledger,root);
  return {ledger:normalize(relative(root,ledgerFile)),files:layout.files.length,bytes:layout.files.reduce((n,row)=>n+row.size,0),state:'complete'};
}
/** Restore every old byte without replacing an existing differing source. Keep
 * the canonical copies so both old and new application revisions remain usable. */
export async function rollbackMediaMigration(ledgerFile,{root=repositoryRoot}={}) {
  root=resolve(root);const ledger=JSON.parse(await readFile(inside(root,ledgerFile),'utf8'));
  if(resolve(ledger.root)!==root||ledger.schemaVersion!==1)throw new Error('Rollback belongs to another repository.');
  for(const row of ledger.files){const old=inside(root,row.legacyPath),current=inside(root,'media/'+row.path),existing=await exists(old);
    await safeParents(root,current);await safeParents(root,old);
    if(await hashFile(current)!==row.sha256)throw new Error('Canonical file changed; rollback stopped.');
    if(existing){if(existing.isSymbolicLink()||!existing.isFile()||await hashFile(old)!==row.sha256)throw new Error('Rollback source conflict.');continue;}
    await safeParents(root,old,{create:true});await copyFile(current,old,constants.COPYFILE_EXCL);if(await hashFile(old)!==row.sha256)throw new Error('Rollback copy mismatch.');
  }
  return {restored:ledger.files.length,canonicalCopiesRetained:true};
}
export async function verifyMediaLayout({root=repositoryRoot}={}){
  const layout=readMediaLayout(root),errors=[],checked=new Map();
  for(const row of layout.files){
    const path=row.canonicalPath??row.path,file=inside(root,'media/'+path);
    if(!checked.has(path)){
      await safeParents(resolve(root),file);const info=await exists(file);
      checked.set(path,{size:row.size,ok:!!info&&info.isFile()&&!info.isSymbolicLink()&&info.size===row.size&&await hashFile(file)===row.sha256});
    }
    if(!checked.get(path).ok)errors.push(row.path);
  }
  return{files:layout.files.length,physicalFiles:checked.size,bytes:[...checked.values()].reduce((n,row)=>n+row.size,0),errors};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){const args=process.argv.slice(2),value=key=>args[args.indexOf(key)+1],root=args.includes('--root')?value('--root'):repositoryRoot;
  if(args.includes('--rollback')){if(!args.includes('--apply'))throw new Error('Rollback requires --apply.');console.log(JSON.stringify(await rollbackMediaMigration(value('--rollback'),{root})));}
  else if(args.includes('--verify')){const result=await verifyMediaLayout({root});console.log(JSON.stringify(result));if(result.errors.length)process.exitCode=1;}
  else{const scope=args.includes('--scope')?value('--scope'):'all';if(!['bank','all','docs'].includes(scope))throw new Error('Scope must be bank, all or docs.');
    const result=args.includes('--apply')?await applyMediaMigration({root,scope}):await planMediaMigration({root,scope});console.log(JSON.stringify(args.includes('--apply')?result:{scope,files:result.files.length,bytes:result.files.reduce((n,row)=>n+row.size,0),roots:result.roots},null,2));}
}
