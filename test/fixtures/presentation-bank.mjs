// Synthetic presentation bank for contract tests. The repository carries no
// dealer bank since 2026-10-28 (docs/plans/REN-START.md, K1): the structure
// comes only from the locked family definitions, and the bytes are
// deterministic placeholders, never filmed media.
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {MEDIA_FAMILY_DEFINITIONS,mediaDefinitionForPath,validateLabVideoManifest,videoIdFromSha256} from '../../packages/studio-registry/server/video-manifest.mjs';
import {PRESENTATION_BANK_PATH} from '../../packages/studio-registry/server/media-layout.mjs';
import {mediaBlobPath} from '../../packages/studio-registry/server/private-media-contract.mjs';

export const syntheticBankBytes=relativePath=>Buffer.from(`0000ftypisom00000synthetic-bank:${relativePath}`);

/** One variant per dealt card (not the hole or its reveal) and an idle pool as large as the seed idle policy. */
export function defaultBankVariants({idleVariants=13}={}) {
  return MEDIA_FAMILY_DEFINITIONS.flatMap(definition=>{
    const count=definition.playbackType==='idle-pool'?idleVariants:definition.eventId.startsWith('deal.')&&definition.situation!=='dealer-hole'?1:0;
    return Array.from({length:count},(_,index)=>`${definition.variantDirectory}/variant-${index+1}.mp4`);
  });
}

/** The manifest the bank builder writes for these files, without touching disk. */
export function syntheticPresentationManifest({variants=defaultBankVariants()}={}) {
  const paths=[...MEDIA_FAMILY_DEFINITIONS.flatMap(definition=>definition.standardPaths),...variants].sort((a,b)=>a<b?-1:a>b?1:0);
  const items=paths.map(relativePath=>{
    const placement=mediaDefinitionForPath(relativePath);
    if(!placement)throw Error(`Synthetic bank path is outside the family definitions: ${relativePath}`);
    const bytes=syntheticBankBytes(relativePath),sha256=createHash('sha256').update(bytes).digest('hex');
    return {id:videoIdFromSha256(sha256),familyId:placement.definition.id,role:placement.role,relativePath,extension:'mp4',size:bytes.length,sha256};
  });
  const byPath=new Map(items.map(item=>[item.relativePath,item]));
  const families=MEDIA_FAMILY_DEFINITIONS.map(definition=>({id:definition.id,dealerId:definition.dealerId,eventId:definition.eventId,
    situation:definition.situation,playbackType:definition.playbackType,standardIds:definition.standardPaths.map(path=>byPath.get(path).id),
    variantIds:items.filter(item=>item.familyId===definition.id&&item.role==='variant').map(item=>item.id)}));
  return validateLabVideoManifest({schemaVersion:2,source:'emil/dealklipp-v1',families,items});
}

/** Writes the placeholder bytes, empty variant folders and the manifest under an explicit test root. */
export async function writeSyntheticPresentationBank(root,options={}) {
  const manifest=syntheticPresentationManifest(options);
  for(const definition of MEDIA_FAMILY_DEFINITIONS){
    const directory=join(root,...definition.variantDirectory.split('/'));
    await mkdir(directory,{recursive:true});await writeFile(join(directory,'.gitkeep'),'');
  }
  for(const item of manifest.items)await writeFile(join(root,...item.relativePath.split('/')),syntheticBankBytes(item.relativePath));
  await writeFile(join(root,'lab-video-manifest.json'),`${JSON.stringify(manifest,null,2)}\n`);
  return manifest;
}

/** A runtime catalogue that still carries a bank: source layout rows, verified Blob tuples and the manifest. */
export function withSyntheticBank(catalog,options={}) {
  const manifest=syntheticPresentationManifest(options),value=structuredClone(catalog);
  for(const item of manifest.items){
    const logicalPath=`${PRESENTATION_BANK_PATH}/${item.relativePath}`,directory=logicalPath.slice(0,logicalPath.lastIndexOf('/'));
    value.layout.files.push({path:logicalPath,legacyPath:`synthetic-bank/${item.relativePath}`,access:'source',sha256:item.sha256,size:item.size});
    value.blobIndex.files.push({logicalPath,id:item.id,sha256:item.sha256,size:item.size,access:'source',legacyUrls:[],
      storage:{provider:'vercel-blob',pathname:mediaBlobPath(directory,item.id,item.sha256,'mp4'),sha256:item.sha256,size:item.size,contentType:'video/mp4'}});
  }
  value.presentation=manifest;
  return value;
}

/** Binds a saved idle policy to the bank's idle family in order: bases to standards, variants to variants. */
export function bindIdlePolicy(policy,manifest) {
  const family=manifest.families.find(row=>row.id===policy.familyId);
  if(!family||family.standardIds.length<policy.base.length||family.variantIds.length<policy.variants.length)throw Error('Synthetic bank cannot hold this idle policy.');
  const bound=structuredClone(policy);
  bound.base.forEach((row,index)=>{row.videoId=family.standardIds[index];});
  bound.variants.forEach((row,index)=>{row.videoId=family.variantIds[index];});
  return bound;
}
