const modes = ['off','saving','warm'];
const observations = ['unknown','off','starting','loading','ready','stopping','error'];
const integer = value => Number.isSafeInteger(value) && value >= 0;
const timestamp = value => integer(value) && value <= 8640000000000000;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value,max=128) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
const nullable = (value,check) => value === null || check(value);
const profileId = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(value);
function fail(message='Driftstatusen kunde inte verifieras. Läs om den.',status=503) { throw Object.assign(new Error(message),{status}); }

/** Read only the public DTO. Unknown server fields never enter the UI state. */
export function readMovingDriftStatus(value) {
  if (!object(value) || value.schemaVersion !== 1 || !integer(value.revision) || !timestamp(value.serverNowMs)
    || !nullable(value.operationId,value=>text(value)) || !object(value.desired) || !modes.includes(value.desired.mode)
    || !nullable(value.desired.profileId,profileId) || !nullable(value.desired.endsAtMs,timestamp)
    || (value.desired.mode !== 'off' && value.desired.profileId === null)
    || (value.desired.mode === 'warm' && value.desired.endsAtMs === null)
    || !object(value.observed) || !observations.includes(value.observed.status)
    || !nullable(value.observed.atMs,timestamp) || !nullable(value.observed.reasonCode,value=>text(value))
    || !Array.isArray(value.profiles) || value.profiles.length > 8
    || value.profiles.some(row=>!object(row)||!profileId(row.id)||!text(row.label,80))
    || new Set(value.profiles.map(row=>row.id)).size !== value.profiles.length
    || !nullable(value.selectedProfileId,profileId) || !object(value.actual)
    || !nullable(value.actual.profileId,profileId) || !nullable(value.actual.gpu,value=>text(value))
    || !nullable(value.actual.workerId,value=>text(value)) || !object(value.readiness)
    || ['modelReady','releaseMatches','bankMatches'].some(key=>typeof value.readiness[key] !== 'boolean')
    || !object(value.admission) || typeof value.admission.allowed !== 'boolean'
    || !nullable(value.admission.reasonCode,value=>text(value)) || !object(value.capabilities)
    || typeof value.capabilities.connected !== 'boolean' || !Array.isArray(value.capabilities.allowedModes)
    || !value.capabilities.allowedModes.includes('off') || value.capabilities.allowedModes.some(mode=>!modes.includes(mode))
    || new Set(value.capabilities.allowedModes).size !== value.capabilities.allowedModes.length
    || (!value.capabilities.connected && value.capabilities.allowedModes.some(mode=>mode !== 'off'))
    || !nullable(value.capabilities.reasonCode,value=>text(value)) || !object(value.cost)
    || !nullable(value.cost.estimatedMicroUsd,integer) || !nullable(value.cost.source,value=>text(value))
    || !nullable(value.cost.quotedAtMs,timestamp) || !nullable(value.cost.shutdownTailMs,integer)) fail();
  const pick=(source,keys)=>Object.fromEntries(keys.map(key=>[key,source[key]]));
  return {
    ...pick(value,['schemaVersion','revision','operationId','serverNowMs','selectedProfileId']),
    desired:pick(value.desired,['mode','profileId','endsAtMs']),
    observed:pick(value.observed,['status','atMs','reasonCode']),
    profiles:value.profiles.map(row=>pick(row,['id','label'])),
    actual:pick(value.actual,['profileId','gpu','workerId']),
    readiness:pick(value.readiness,['modelReady','releaseMatches','bankMatches']),
    admission:pick(value.admission,['allowed','reasonCode']),
    capabilities:{...pick(value.capabilities,['connected','reasonCode']),allowedModes:[...value.capabilities.allowedModes]},
    cost:pick(value.cost,['estimatedMicroUsd','source','quotedAtMs','shutdownTailMs']),
  };
}

export const driftModeLabel = mode => ({off:'Av',saving:'Sparläge',warm:'Varm'})[mode] ?? 'Okänt';
export function driftDraft(status) {
  const selected=status.desired.profileId ?? status.selectedProfileId;
  return {mode:status.desired.mode,profileId:selected===null?(status.profiles.length===1?status.profiles[0].id:''):(status.profiles.some(row=>row.id===selected)?selected:''),durationSeconds:1800,revision:status.revision,dirty:false};
}
export function driftView(status,elapsedMs=0) {
  const elapsed=Number.isFinite(elapsedMs)&&elapsedMs>=0?elapsedMs:Infinity;
  const now=status.serverNowMs+elapsed, recent=elapsed<=15000;
  const fresh=recent&&status.observed.atMs!==null&&now>=status.observed.atMs&&now-status.observed.atMs<=15000;
  const expired=status.desired.mode==='warm'&&now>=status.desired.endsAtMs;
  const ready=fresh&&!expired&&status.capabilities.connected&&status.observed.status==='ready'
    &&status.admission.allowed&&Object.values(status.readiness).every(Boolean)
    &&status.desired.mode!=='off'&&status.actual.profileId===status.desired.profileId;
  let label=!fresh?'Okänd':({unknown:'Okänd',off:'Av',starting:'Startar',loading:'Förbereder tal',ready:ready?'Redo för tal':'GPU redo · tal pausat',stopping:'Stänger av',error:'Fel'})[status.observed.status];
  if (expired && (!fresh || status.observed.status!=='off')) label='Avstängning ej bekräftad';
  const currentQuote=status.desired.mode==='warm'&&status.cost.estimatedMicroUsd!==null
    &&status.cost.source!==null&&status.cost.quotedAtMs!==null&&status.cost.quotedAtMs<=now;
  const amount=currentQuote?status.cost.estimatedMicroUsd/1e6:null;
  const costLabel=amount===null?'Okänd':amount>0&&amount<.01?'< 0,01 USD':new Intl.NumberFormat('sv-SE',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(amount);
  return {recent,fresh,ready,expired,label,costLabel,remainingSeconds:status.desired.mode==='warm'?Math.max(0,Math.ceil((status.desired.endsAtMs-now)/1000)):null};
}
export function driftCommand(status,draft,commandId) {
  if (draft.revision!==status.revision) fail('Driftläget har ändrats. Läs in det sparade valet först.',409);
  if (!status.capabilities.allowedModes.includes(draft.mode)) fail('Det valda driftläget är inte tillgängligt.',409);
  if (typeof commandId!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(commandId)) fail('Kommandot kunde inte skapas. Försök igen.',400);
  const command={expectedRevision:draft.revision,commandId,mode:draft.mode};
  if (draft.mode!=='off') {
    if (!status.profiles.some(row=>row.id===draft.profileId)) fail('Välj en tillgänglig GPU-profil.',422);
    command.profileId=draft.profileId;
  }
  if (draft.mode==='warm') {
    if (![1800,7200,86400].includes(draft.durationSeconds)) fail('Välj en tillåten varmperiod.',422);
    command.durationSeconds=draft.durationSeconds;
  }
  return command;
}