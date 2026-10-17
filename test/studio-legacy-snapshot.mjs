import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareLegacyStudioSnapshot} from '../ops/neon-studio/legacy-snapshot.mjs';
import {createSeedProject} from '../packages/presentation/contracts/studio-model.mjs';
import {createSocialPolicy} from '../lab/lib/social-store.mjs';
const packet=value=>{const bytes=Buffer.from(JSON.stringify(value));return {bytes,sha256:createHash('sha256').update(bytes).digest('hex'),updatedAt:'2026-10-03T00:00:00.000Z'};};
const administration={tiers:{classic:'vera',high:'astrid',vip:'mei'},rooms:[],pitboss:{payout10x:true,streak5:false,randomWalkMin:10},tournaments:[],neverAgain:{'astrid:idle-1/idle/idle-breathe-head-tilt':{reason:'rejected',by:'operator',at:'2026-10-03T00:00:00.000Z'}}};
const frozen=value=>({...value,freezeProof:{frozen:true,writersStopped:true,sourceId:'fixture-export',scope:structuredClone(value.scope),
  observedAt:'2026-10-03T00:00:00.000Z',completedAt:'2026-10-03T00:01:00.000Z',
  sourceHashes:{project:value.project.sha256,socialPolicy:(value.socialPolicy??value.activeSocialDefault)?.sha256,
    administration:value.administration?.sha256??null,effectiveAdministration:value.effectiveAdministration.sha256}}});
const input=()=>frozen({scope:{environment:'fixture',workspaceId:'croupier'},project:packet(createSeedProject()),socialPolicy:packet(createSocialPolicy()),administration:packet(administration),effectiveAdministration:packet(administration)});
test('explicit frozen packet preserves effective game data and review restrictions with deterministic snapshot revisions',()=>{
  const original=input(),result=prepareLegacyStudioSnapshot(original);assert.deepEqual(result,prepareLegacyStudioSnapshot(original));
  const saved=result.snapshot.documents.find(row=>row.kind==='administration');
  assert.deepEqual(saved.value.legacyClipReview.neverAgain,administration.neverAgain);assert.equal(saved.value.legacyClipReview.sourceSha256,original.administration.sha256);
  assert.deepEqual(saved.value.tiers,administration.tiers);assert.equal(saved.value.neverAgain,undefined);assert.equal(result.snapshot.documents.length,3);
  assert.equal(createHash('sha256').update(original.administration.bytes).digest('hex'),original.administration.sha256);
});

const codePacket=text=>{const bytes=Buffer.from(text);return {bytes,sha256:createHash('sha256').update(bytes).digest('hex'),updatedAt:'2026-10-02T00:00:00.000Z'};};
const defaults=()=>{
 const original=input();delete original.administration;delete original.socialPolicy;
 original.activeSocialDefault=packet(createSocialPolicy());
 original.defaultProvenance={deployedCommit:'a'.repeat(40),
  codeSources:{server:codePacket('const BO_DEFAULTS={};function boLoad() {}'),socialStore:codePacket("if (error.code === 'ENOENT') return checkedPolicy(createSocialPolicy());")},
  absences:['players/bo.json','studio/social-policy.json'].map(path=>({path,before:{exists:false,observedAt:'2026-10-02T23:59:59.000Z'},after:{exists:false,observedAt:'2026-10-03T00:00:59.000Z'}}))};
 return frozen(original);
};
test('explicit first persistence preserves actual effective defaults with frozen absence and deployed source provenance',()=>{
 const value=defaults(),result=prepareLegacyStudioSnapshot(value);
 const saved=result.snapshot.documents.find(row=>row.kind==='administration');
 assert.deepEqual(saved.value.tiers,administration.tiers);
 assert.deepEqual(saved.value.legacyClipReview.neverAgain,administration.neverAgain);
 assert.equal(saved.value.legacyClipReview.sourceSha256,value.effectiveAdministration.sha256);
 assert.equal(result.sourceHashes.administration,null);
 assert.match(result.receiptSha256,/^[a-f0-9]{64}$/);
 assert.equal(result.sourceReceipt.defaults.deployedCommit,'a'.repeat(40));
 assert.deepEqual(result,prepareLegacyStudioSnapshot(value));
 const changed={...value,freezeProof:{...value.freezeProof,sourceId:'different-export'}};
 assert.notEqual(result.snapshot.documents[0].revision,prepareLegacyStudioSnapshot(changed).snapshot.documents[0].revision);
});
test('unfrozen or incomplete first persistence cannot substitute seed files for saved state',()=>{
 for(const change of [
  value=>{delete value.freezeProof;},
  value=>{value.freezeProof.frozen=false;},
  value=>{value.freezeProof.writersStopped=false;},
  value=>{value.freezeProof.scope.environment='production';},
  value=>{value.freezeProof.sourceHashes.project='0'.repeat(64);},
  value=>{delete value.defaultProvenance;},
  value=>{value.defaultProvenance.absences[0].before.exists=true;},
  value=>{value.defaultProvenance.absences[0].after.observedAt='2026-10-02T23:59:00.000Z';},
  value=>{value.defaultProvenance.absences.pop();},
  value=>{value.defaultProvenance.codeSources.server.sha256='0'.repeat(64);},
  value=>{value.defaultProvenance.codeSources.socialStore=codePacket('no legacy fallback');},
  value=>{value.activeSocialDefault=packet({});},
  value=>{delete value.activeSocialDefault;},
 ]) {const value=defaults();change(value);assert.throws(()=>prepareLegacyStudioSnapshot(value));}
});
test('explicitly saved domains do not require or consume old runtime defaults',()=>{
 const value=input();value.activeSocialDefault=packet({});value.defaultProvenance={};
 const result=prepareLegacyStudioSnapshot(value);assert.equal(result.sourceReceipt.defaults,null);
 assert.equal(result.sourceHashes.socialPolicy,value.socialPolicy.sha256);
 assert.equal(result.sourceHashes.administration,value.administration.sha256);
});
test('missing domains, unverifiable review map, source mismatch and malformed packets fail without defaults',()=>{
  for(const changes of [
    {administration:packet({...administration,neverAgain:undefined})},
    {effectiveAdministration:packet({...administration,tiers:undefined})},
    {effectiveAdministration:packet({...administration,tiers:{classic:'astrid',high:'astrid',vip:'mei'}})},
    {project:{...packet(createSeedProject()),sha256:'0'.repeat(64)}}, {socialPolicy:undefined}]) {
    assert.throws(()=>prepareLegacyStudioSnapshot({...input(),...changes}));
  }
});
