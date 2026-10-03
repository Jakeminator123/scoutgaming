import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareLegacyStudioSnapshot} from '../ops/neon-studio/legacy-snapshot.mjs';
import {createSeedProject} from '../lab/lib/studio-model.mjs';
import {createSocialPolicy} from '../lab/lib/social-store.mjs';
const packet=value=>{const bytes=Buffer.from(JSON.stringify(value));return {bytes,sha256:createHash('sha256').update(bytes).digest('hex'),updatedAt:'2026-10-03T00:00:00.000Z'};};
const administration={tiers:{classic:'vera',high:'astrid',vip:'mei'},rooms:[],pitboss:{payout10x:true,streak5:false,randomWalkMin:10},tournaments:[],neverAgain:{'astrid:idle-1/idle/idle-breathe-head-tilt':{reason:'rejected',by:'operator',at:'2026-10-03T00:00:00.000Z'}}};
const input=()=>({scope:{environment:'fixture',workspaceId:'croupier'},project:packet(createSeedProject()),socialPolicy:packet(createSocialPolicy()),administration:packet(administration),effectiveAdministration:packet(administration)});
test('explicit frozen packet preserves effective game data and review restrictions with deterministic snapshot revisions',()=>{
  const original=input(),result=prepareLegacyStudioSnapshot(original);assert.deepEqual(result,prepareLegacyStudioSnapshot(original));
  const saved=result.snapshot.documents.find(row=>row.kind==='administration');
  assert.deepEqual(saved.value.legacyClipReview.neverAgain,administration.neverAgain);assert.equal(saved.value.legacyClipReview.sourceSha256,original.administration.sha256);
  assert.deepEqual(saved.value.tiers,administration.tiers);assert.equal(saved.value.neverAgain,undefined);assert.equal(result.snapshot.documents.length,3);
  assert.equal(createHash('sha256').update(original.administration.bytes).digest('hex'),original.administration.sha256);
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
