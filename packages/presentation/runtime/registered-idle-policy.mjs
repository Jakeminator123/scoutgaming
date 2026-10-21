import { MAX_DEALERS, isDealerId, isActiveDealerId } from '../contracts/dealer-identity.mjs';
import { validateIdlePolicy } from './idle-policy.mjs';
import { videoFitsLine } from '../contracts/video-intake.mjs';

const fail = () => { throw Error('Ogiltig sparad dealergrundloop.'); };
export function registeredIdleFamilyId(dealerId) {
  if (!isDealerId(dealerId)) fail();
  return dealerId + '/idle.ready/ready';
}
export function createRegisteredIdlePolicy({ dealerId, baselineVideoId, durationMs } = {}) {
  if (!isActiveDealerId(dealerId)) fail();
  return validateIdlePolicy({schemaVersion:1,familyId:registeredIdleFamilyId(dealerId),
    base:[{videoId:baselineVideoId,weight:100,durationMs}],variants:[]});
}
export function registeredIdlePolicy(project, dealerId) {
  const own=project?.dealerIdlePolicies?.find(row => row.dealerId === dealerId)?.policy;
  if(own)return own;
  const legacy=dealerId==='astrid'?project?.idlePolicy:null;
  const line=project?.lines?.find(row=>row.dealerId===dealerId&&row.eventId==='idle.ready');
  return legacy && line?.variants.find(row=>row.id===line.baselineVariantId)?.videoGenerationId===legacy.base[0]?.videoId ? legacy : null;
}
export function validateRegisteredIdlePolicies(value, { dealers, lines, requireBaseline = false } = {}) {
  if (!Array.isArray(value) || value.length > MAX_DEALERS) fail();
  const registered = new Set((dealers ?? []).map(row => row.id)), seen = new Set();
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).sort().join(',') !== 'dealerId,policy'
      || !isDealerId(row.dealerId) || !registered.has(row.dealerId) || seen.has(row.dealerId)) fail();
    seen.add(row.dealerId);
    validateIdlePolicy(row.policy);
    if (row.policy.familyId !== registeredIdleFamilyId(row.dealerId)) fail();
    const matches = (lines ?? []).filter(line => line.dealerId === row.dealerId && line.eventId === 'idle.ready');
    const baseline = matches.length === 1 ? matches[0].variants?.find(variant => variant.id === matches[0].baselineVariantId) : null;
    if (requireBaseline && (!baseline?.videoGenerationId || baseline.triggerIds?.length || row.policy.base[0].videoId !== baseline.videoGenerationId)) fail();
  }
  return value;
}
/** Adapt exact own idle metadata to the common live-idle/editor family contract.
 * This inventory is only for idle; keep event selection's inventory unchanged. */
export function registeredIdleInventory(inventory, { dealerId, policy = null } = {}) {
  const familyId = registeredIdleFamilyId(dealerId);
  if (policy && (validateIdlePolicy(policy).familyId !== familyId)) fail();
  const baseIds = new Set(policy?.base.map(row => row.videoId) ?? []);
  const videos = (inventory?.videos ?? []).filter(video => video.dealer === dealerId && video.available === true
    && video.classification?.kind === 'idle' && (video.classification.playback ?? 'once') === 'once'
    && videoFitsLine(video,dealerId,'idle.ready')).map(video => ({...structuredClone(video),familyId,
      role:baseIds.has(video.id)?'standard':'variant'}));
  const available = new Set(videos.map(row => row.id));
  return {videos,families:[{id:familyId,dealerId,eventId:'idle.ready',situation:'ready',playbackType:'idle-pool',
    standardIds:(policy?.base ?? []).map(row => row.videoId).filter(id => available.has(id)),
    variantIds:videos.filter(row => row.role==='variant').map(row => row.id)}]};
}
