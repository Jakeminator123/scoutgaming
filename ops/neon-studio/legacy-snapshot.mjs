import { createHash } from 'node:crypto';
import { STUDIO_JSON_LIMIT, STUDIO_SNAPSHOT_FORMAT, StudioStorageError, validateDocumentValue,
  validateSnapshot, validateStudioScope, studioContentHash, canonicalStudioJson } from '../../web/storage/studio-contract.mjs';
import { validateStudioGameAdministration } from '../../web/storage/studio-game-policy.mjs';

const fail = () => { throw new StudioStorageError('studio_import_source_invalid',422); };
const stamp=value=>{
  if(typeof value!=='string'||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)fail();
  return Date.parse(value);
};
function source(packet) {
  if (!packet || Object.keys(packet).sort().join(',') !== 'bytes,sha256,updatedAt'
    || !(packet.bytes instanceof Uint8Array) || packet.bytes.byteLength > STUDIO_JSON_LIMIT
    || !/^[a-f0-9]{64}$/.test(packet.sha256)
    || typeof packet.updatedAt !== 'string' || !Number.isFinite(Date.parse(packet.updatedAt))
    || new Date(packet.updatedAt).toISOString() !== packet.updatedAt) fail();
  const bytes=Buffer.from(packet.bytes);
  if (createHash('sha256').update(bytes).digest('hex') !== packet.sha256) fail();
  try {return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));} catch {fail();}
}

function frozenReceipt(proof,scope,hashes) {
  if(!proof || proof.frozen!==true || proof.writersStopped!==true
    || typeof proof.sourceId!=='string' || !/^[a-zA-Z0-9._:-]{1,128}$/.test(proof.sourceId)
    || canonicalStudioJson(validateStudioScope(proof.scope))!==canonicalStudioJson(scope)
    || canonicalStudioJson(proof.sourceHashes)!==canonicalStudioJson(hashes)) fail();
  const observed=stamp(proof.observedAt),completed=stamp(proof.completedAt);
  if(observed>completed || completed-observed>30*60*1000)fail();
  return {sourceId:proof.sourceId,scope,observedAt:proof.observedAt,completedAt:proof.completedAt,sourceHashes:hashes};
}

function defaultReceipt(input,receipt,missing) {
  const proof=input.defaultProvenance;
  if(!proof || !/^[a-f0-9]{40}$/.test(proof.deployedCommit??'') || !Array.isArray(proof.absences)
    || proof.absences.length!==missing.length)fail();
  const codes={};
  for(const kind of missing) {
    const path=kind==='administration'?'players/bo.json':'studio/social-policy.json';
    const checks=proof.absences.filter(row=>row.path===path);
    if(checks.length!==1)fail();
    const {before,after}=checks[0];
    if(before?.exists!==false || after?.exists!==false || stamp(before.observedAt)>stamp(receipt.observedAt)
      || stamp(after.observedAt)<stamp(receipt.observedAt) || stamp(after.observedAt)>stamp(receipt.completedAt)
      || stamp(before.observedAt)<stamp(receipt.observedAt)-30*60*1000)fail();
    const name=kind==='administration'?'server':'socialStore';
    const packet=proof.codeSources?.[name];
    // Hash actual deployed source bytes; never use a current local default as
    // evidence for what an older deployed engine was serving.
    if(!packet || !(packet.bytes instanceof Uint8Array) || packet.bytes.length>STUDIO_JSON_LIMIT
      || !/^[a-f0-9]{64}$/.test(packet.sha256??'') || createHash('sha256').update(packet.bytes).digest('hex')!==packet.sha256)fail();
    stamp(packet.updatedAt);
    let code;try{code=new TextDecoder('utf-8',{fatal:true}).decode(packet.bytes);}catch{fail();}
    if(kind==='administration' && (!code.includes('BO_DEFAULTS') || !code.includes('function boLoad(')))fail();
    if(kind==='social-policy' && (!code.includes("error.code === 'ENOENT'") || !code.includes('checkedPolicy(createSocialPolicy())')))fail();
    codes[name]=packet.sha256;
  }
  return {deployedCommit:proof.deployedCommit,codeHashes:codes,absences:proof.absences};
}

// Inputs must be verified bytes from one frozen export. No filesystem discovery,
// seed, legacy media import, identity/wallet mutation or live database access.
// effectiveAdministration is the old engine's actual merged projection; the raw
// BO packet preserves its exact rejection map, including an explicit empty map.
export function prepareLegacyStudioSnapshot(input = {}) {
  let {scope,project,socialPolicy,administration,effectiveAdministration,activeSocialDefault}=input;
  scope=validateStudioScope(scope);
  const missing=[];
  if(administration==null)missing.push('administration');
  if(socialPolicy==null)missing.push('social-policy');
  const social=socialPolicy??activeSocialDefault;
  const hashes={project:project?.sha256,socialPolicy:social?.sha256,administration:administration?.sha256??null,effectiveAdministration:effectiveAdministration?.sha256};
  const receipt=frozenReceipt(input.freezeProof,scope,hashes);
  const defaults=missing.length?defaultReceipt(input,receipt,missing):null;
  const receiptSha256=studioContentHash({...receipt,defaults});
  const effective=source(effectiveAdministration), raw=administration?source(administration):effective;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)
    || !Object.hasOwn(raw,'neverAgain') || !raw.neverAgain || typeof raw.neverAgain !== 'object' || Array.isArray(raw.neverAgain)) fail();
  const fields=['tiers','rooms','pitboss','tournaments','voiceReview','genVerdicts','genLandings'];
  if (!effective || typeof effective !== 'object' || Array.isArray(effective)) fail();
  // The caller may export an API projection with revision metadata. It is never
  // used as a substitute for BO review data or an authoritative saved revision.
  const value=Object.fromEntries(fields.filter(key=>Object.hasOwn(effective,key)).map(key=>[key,effective[key]]));
  for(const field of fields.filter(key=>Object.hasOwn(raw,key))) {
    if (!Object.hasOwn(value,field) || canonicalStudioJson(raw[field]) !== canonicalStudioJson(value[field])) fail();
  }
  const adminPacket=administration??effectiveAdministration;
  value.legacyClipReview={neverAgain:raw.neverAgain,sourceSha256:adminPacket.sha256};
  const admin=validateStudioGameAdministration(value);
  const documents=[['project',source(project),project],['social-policy',source(social),social],['administration',admin,adminPacket]]
    .map(([kind,input,packet])=>{
      const revision=`import-${studioContentHash({kind,sourceSha256:packet.sha256,receiptSha256})}`;
      const value=validateDocumentValue(kind,input,revision);
      return {kind,revision,value,checksum:studioContentHash(value),updatedAt:packet.updatedAt};
    });
  const snapshot=validateSnapshot({format:STUDIO_SNAPSHOT_FORMAT,scope,documents},scope);
  return {snapshot,sourceHashes:hashes,receiptSha256,sourceReceipt:{...receipt,defaults},
    preserved:['project-policy','social-policy','game-administration','legacy-review-restrictions'],
    excluded:['legacy-upload-library','legacy-generation-media','clip-assignments'],
    requires:['frozen-source-parity','exact-project-media-bindings','existing-cost-journal-import','empty-scoped-target']};
}
