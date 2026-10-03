import { createHash } from 'node:crypto';
import { STUDIO_JSON_LIMIT, STUDIO_SNAPSHOT_FORMAT, StudioStorageError, validateDocumentValue,
  validateSnapshot, validateStudioScope, studioContentHash, canonicalStudioJson } from '../../web/storage/studio-contract.mjs';
import { validateStudioGameAdministration } from '../../web/storage/studio-game-policy.mjs';

const fail = () => { throw new StudioStorageError('studio_import_source_invalid',422); };
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

// Inputs must be verified bytes from one frozen export. No filesystem discovery,
// seed, legacy media import, identity/wallet mutation or live database access.
// effectiveAdministration is the old engine's actual merged projection; the raw
// BO packet preserves its exact rejection map, including an explicit empty map.
export function prepareLegacyStudioSnapshot({scope,project,socialPolicy,administration,effectiveAdministration} = {}) {
  scope=validateStudioScope(scope);
  const raw=source(administration), effective=source(effectiveAdministration);
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
  value.legacyClipReview={neverAgain:raw.neverAgain,sourceSha256:administration.sha256};
  const admin=validateStudioGameAdministration(value);
  const documents=[['project',source(project),project],['social-policy',source(socialPolicy),socialPolicy],['administration',admin,administration]]
    .map(([kind,input,packet])=>{
      const revision=`import-${studioContentHash({kind,sourceSha256:packet.sha256})}`;
      const value=validateDocumentValue(kind,input,revision);
      return {kind,revision,value,checksum:studioContentHash(value),updatedAt:packet.updatedAt};
    });
  const snapshot=validateSnapshot({format:STUDIO_SNAPSHOT_FORMAT,scope,documents},scope);
  return {snapshot,sourceHashes:{project:project.sha256,socialPolicy:socialPolicy.sha256,administration:administration.sha256,effectiveAdministration:effectiveAdministration.sha256},
    preserved:['project-policy','social-policy','game-administration','legacy-review-restrictions'],
    excluded:['legacy-upload-library','legacy-generation-media','clip-assignments'],
    requires:['frozen-source-parity','exact-project-media-bindings','existing-cost-journal-import','empty-scoped-target']};
}
