import {createHash} from 'node:crypto';
import {RETAINED_BANK_PROVENANCE,RETAINED_BANK_VARIANTS,createRetainedStudioMedia,StudioStorageError,canonicalStudioJson} from '../../web/storage/studio-contract.mjs';

const fail = () => {throw new StudioStorageError('studio_retained_source_invalid',422);};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

/** Pure explicit source verification. No Git, filesystem, provider or SQL calls. */
export function verifyRetainedBankSourceManifest(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > 5*1024*1024
    || sha(bytes)!==RETAINED_BANK_PROVENANCE.sourceManifestSha256) fail();
  let source;
  try {source=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));} catch {fail();}
  if (source.schemaVersion!==2 || source.source!=='emil/dealklipp-v1'
    || !Array.isArray(source.items) || !Array.isArray(source.families)) fail();
  for (const tuple of RETAINED_BANK_VARIANTS) {
    const rows=source.items.filter(row=>row.id===tuple.id),families=source.families.filter(row=>row.id===tuple.familyId);
    if (rows.length!==1 || families.length!==1 || !families[0].variantIds.includes(tuple.id)) fail();
    const {originalRelativePath,...rest}=tuple;
    if (canonicalStudioJson(rows[0])!==canonicalStudioJson({...rest,relativePath:originalRelativePath,extension:'mp4'})) fail();
  }
  return {...RETAINED_BANK_PROVENANCE};
}

export async function prepareRetainedBankImport({sourceManifestBytes,readOriginal}={}) {
  const provenance=verifyRetainedBankSourceManifest(sourceManifestBytes);
  if (typeof readOriginal!=='function') fail();
  const records=[];
  for (const original of RETAINED_BANK_VARIANTS) {
    const bytes=await readOriginal({...original});
    if (!(bytes instanceof Uint8Array) || bytes.byteLength!==original.size || sha(bytes)!==original.sha256) fail();
    records.push(createRetainedStudioMedia(original.id));
  }
  return {provenance,records};
}
