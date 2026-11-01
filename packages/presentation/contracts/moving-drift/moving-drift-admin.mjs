/** Browser-safe projection. Executor proposals, endpoints and hashes stay server-side. */
export function publicMovingDriftStatus(value) {
  const pick=(source,keys)=>Object.fromEntries(keys.map(key=>[key,structuredClone(source[key])]));
  return {
    ...pick(value,['schemaVersion','revision','operationId','serverNowMs','selectedProfileId']),
    desired:pick(value.desired,['mode','profileId','endsAtMs']),
    observed:pick(value.observed,['status','atMs','reasonCode']),
    profiles:value.profiles.map(profile=>pick(profile,['id','label'])),
    actual:pick(value.actual,['profileId','gpu','workerId']),
    readiness:pick(value.readiness,['modelReady','releaseMatches','bankMatches']),
    admission:pick(value.admission,['allowed','reasonCode']),
    capabilities:pick(value.capabilities,['connected','allowedModes','reasonCode']),
    cost:pick(value.cost,['estimatedMicroUsd','source','quotedAtMs','shutdownTailMs']),
  };
}
const errors=new Map([
  ['drift_invalid_command',[422,'Ogiltigt driftkommando.']],
  ['drift_unknown_profile',[422,'Driftprofilen finns inte.']],
  ['drift_profile_unavailable',[409,'Driftprofilen är inte ansluten.']],
  ['drift_revision_conflict',[409,'Driftläget har ändrats. Läs om det före nästa ändring.']],
  ['drift_command_reused',[409,'Kommandots ID har redan använts för en annan ändring.']],
  ['drift_runtime_unavailable',[503,'Driftstyrningen är inte ansluten.']],
  ['drift_warm_unavailable',[409,'Varm drift är inte tillgänglig.']],
  ['drift_warm_budget_unavailable',[409,'Godkänt kostnadsunderlag för varm drift saknas.']],
  ['drift_store_unavailable',[503,'Driftläget kan inte läsas eller sparas just nu.']],
  ['drift_dealer_required',[400,'Välj vilken dealer taldriften gäller.']],
  ['drift_unknown_dealer',[422,'Dealern har ingen driftprofil för rörligt tal.']],
  ['drift_api_unavailable',[503,'Driftväljaren är inte tillgänglig.']],
]);
export function publicMovingDriftError(error) {
  const entry=errors.get(error?.code);
  return entry&&error.statusCode===entry[0]
    ? {status:entry[0],body:{error:entry[1],code:error.code}} : null;
}