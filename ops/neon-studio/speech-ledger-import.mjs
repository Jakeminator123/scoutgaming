import { createHash } from 'node:crypto';
import { StudioStorageError, canonicalStudioJson, studioStorageFailure, validateActor, validateStudioScope } from '../../web/storage/studio-contract.mjs';
import { SPEECH_LEDGER_SNAPSHOT_FORMAT } from './speech-ledger-snapshot.mjs';
import { GPU_RESERVATION_WINDOW_MS } from '../../web/speech-journal-constants.mjs';
import { speechRequestKey } from '../../web/postgres-speech-journal.mjs';
import { normalizeSpeechPackage } from '../../web/public/speech-package.mjs';
import { validatePrivateMedia, mediaBlobPath } from '../../lab/lib/cloud-media-store.mjs';
import { planStudioMigrations } from './migrations.mjs';

const fail = (code = 'studio_speech_import_invalid', status = 422) => { throw new StudioStorageError(code, status); };
const hash = value => createHash('sha256').update(value).digest('hex');
const sha = /^[a-f0-9]{64}$/, id = /^[a-f0-9]{32}$/, jobId = /^[A-Za-z0-9_-]{1,128}$/;
const identifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const terminal = new Set(['COMPLETED','FAILED','CANCELLED','TIMED_OUT']);
const safeCode = /^(?:generated_speech_|invalid_generated_speech_|speech_|gpu_)[a-z_]{1,100}$/;
const same = (a,b) => canonicalStudioJson(a) === canonicalStudioJson(b);
const exact = (value, names) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...names].sort().join(',');
const integer = value => Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000 - GPU_RESERVATION_WINDOW_MS;
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const amount = value => Number.isSafeInteger(value) && value > 0 && value <= 10000000;
function frozen(value) { if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); } return value; }
const clone = value => { try { return JSON.parse(canonicalStudioJson(value)); } catch { fail(); } };
const list = value => Array.isArray(value) && value.length <= 16384;

function preparedSource(input, expectedScope, expectedChecksum) {
  const prepared = clone(input), scope = validateStudioScope(expectedScope);
  if (!exact(prepared,['sourceId','snapshot','checksum']) || !sha.test(expectedChecksum ?? '') || prepared.checksum !== expectedChecksum
    || prepared.sourceId !== `legacy-speech-${expectedChecksum}` || hash(canonicalStudioJson(prepared.snapshot)) !== expectedChecksum) fail('studio_speech_import_checksum_mismatch');
  const s = prepared.snapshot;
  if (!exact(s,['format','scope','endpointId','observedAt','sourceHashes','budgetPolicy','sessions','reservations','requests','retainedOperatorQa','requires'])
    || s.format !== SPEECH_LEDGER_SNAPSHOT_FORMAT || !same(validateStudioScope(s.scope),scope)
    || !/^[A-Za-z0-9_-]{1,100}$/.test(s.endpointId ?? '') || !iso(s.observedAt) || !list(s.sessions) || !list(s.reservations)
    || !list(s.requests) || !list(s.retainedOperatorQa) || !list(s.requires) || !s.sourceHashes || Array.isArray(s.sourceHashes)
    || Object.entries(s.sourceHashes).some(([name,value]) => !name || name.length > 200 || name.includes('..') || !sha.test(value))) fail();
  const stamp = Date.parse(s.observedAt), provenance = value => typeof value.sourceId === 'string' && sha.test(value.sourceSha256)
    && s.sourceHashes[value.sourceId] === value.sourceSha256;
  if (s.budgetPolicy !== null && (!exact(s.budgetPolicy,['version','dailyBudgetMicroUsd','createdAt']) || s.budgetPolicy.version !== 1
    || !amount(s.budgetPolicy.dailyBudgetMicroUsd) || !integer(s.budgetPolicy.createdAt) || s.budgetPolicy.createdAt > stamp)) fail();
  const sessionIds = new Set(), jobs = new Set();
  for (const row of s.sessions) {
    if (!exact(row,['sourceId','sourceSha256','sessionId','endpointId','workerId','state','jobId','createdAt','cancelRequestedAt','terminalStatus','terminalReason','releasedAt'])
      || !provenance(row) || !id.test(row.sessionId) || sessionIds.has(row.sessionId) || row.endpointId !== s.endpointId
      || row.sourceId !== `gpu-session-${row.sessionId}.reservation.json` || row.workerId !== `croupier-${row.sessionId}`
      || !integer(row.createdAt) || row.createdAt > stamp || (row.cancelRequestedAt !== null && (!integer(row.cancelRequestedAt) || row.cancelRequestedAt < row.createdAt || row.cancelRequestedAt > stamp))) fail();
    sessionIds.add(row.sessionId);
    if (row.jobId !== null && (!jobId.test(row.jobId) || jobs.has(row.jobId))) fail();
    if (row.jobId) jobs.add(row.jobId);
    if (row.state === 'terminal') {
      if (!row.jobId || !terminal.has(row.terminalStatus) || !['provider','expired_missing_status'].includes(row.terminalReason) || row.releasedAt !== stamp) fail();
    } else {
      if (row.terminalStatus !== null || row.terminalReason !== null || row.releasedAt !== null
        || (row.state === 'submission_uncertain' ? row.jobId !== null : !row.jobId || !['running','cancelling'].includes(row.state))
        || (row.state === 'cancelling' && row.cancelRequestedAt === null)) fail();
    }
  }
  if (s.sessions.length && !s.budgetPolicy || s.sessions.filter(row => row.releasedAt === null).length > 1) fail();
  const charges = new Set();
  for (const row of s.reservations) {
    if (!exact(row,['sessionId','day','reservedMicroUsd']) || !sessionIds.has(row.sessionId) || !amount(row.reservedMicroUsd) || !/^\d{4}-\d{2}-\d{2}$/.test(row.day)) fail();
    const key = `${row.sessionId}/${row.day}`; if (charges.has(key)) fail(); charges.add(key);
  }
  for (const session of s.sessions) {
    const saved = s.reservations.filter(row => row.sessionId === session.sessionId), days = [...new Set([session.createdAt,session.createdAt+GPU_RESERVATION_WINDOW_MS].map(time=>new Date(time).toISOString().slice(0,10)))];
    if (saved.length !== days.length || saved.some(row=>!days.includes(row.day) || row.reservedMicroUsd !== saved[0].reservedMicroUsd)) fail();
  }
  const requests = new Set(), ownerRequests = new Set(), packages = new Set();
  for (const row of s.requests) {
    if (!exact(row,['sourceId','sourceSha256','key','ownerHash','requestId','fingerprint','capability','state','createdAt','updatedAt','packageId','packageMetadata','safeError','requestIdIsOpaque'])
      || !provenance(row) || !sha.test(row.key) || !sha.test(row.ownerHash) || !sha.test(row.fingerprint) || !identifier.test(row.requestId)
      || !['fullfile','stream'].includes(row.capability) || !integer(row.createdAt) || row.createdAt > stamp || row.updatedAt !== stamp
      || ![`${row.key}.request.json`,`stream-${row.key}.request.json`].includes(row.sourceId)
      || (row.safeError !== null && !safeCode.test(row.safeError)) || requests.has(row.key) || ownerRequests.has(`${row.ownerHash}/${row.requestId}`)) fail();
    requests.add(row.key); ownerRequests.add(`${row.ownerHash}/${row.requestId}`);
    if (row.state === 'completed') {
      let value; try { value = normalizeSpeechPackage(row.packageMetadata); } catch { fail(); }
      if (row.capability !== 'fullfile' || row.requestIdIsOpaque !== false || value.packageId !== row.packageId
        || !/^generated-[a-f0-9]{32}$/.test(row.packageId ?? '') || value.generation.requestId !== row.requestId
        || speechRequestKey(row.ownerHash,row.requestId) !== row.key || packages.has(row.packageId)
        || hash(value.exactText) !== value.generation.textSha256 || !same(value,row.packageMetadata)
        || hash(JSON.stringify({ownerHash:row.ownerHash,text:value.exactText,dealerId:value.dealerId,voiceId:value.source.voiceId,
          modelId:value.generation.modelId,profile:value.generation.profileRevision})) !== row.fingerprint) fail();
      packages.add(row.packageId);
    } else if (row.state !== 'submission_uncertain' || row.requestIdIsOpaque !== true || row.requestId !== `legacy-key:${row.key}` || row.packageId !== null || row.packageMetadata !== null) fail();
  }
  for (const retained of s.retainedOperatorQa) if (!exact(retained,['name','value','sha256']) || s.sourceHashes[retained.name] !== retained.sha256
    || !retained.name.startsWith('operator-qa') || !retained.value || typeof retained.value !== 'object') fail();
  return frozen(prepared);
}

function verifyFreeze(prepared, proof) {
  const s = prepared.snapshot;
  if (!exact(proof,['scope','sourceId','checksum','observedAt','sourceHashes','complete','providersStopped','relayDrained','operatorQaRetained'])
    || !same(proof.scope,s.scope) || proof.sourceId !== prepared.sourceId || proof.checksum !== prepared.checksum || proof.observedAt !== s.observedAt
    || !same(proof.sourceHashes,s.sourceHashes) || proof.complete !== true || proof.providersStopped !== true
    || proof.relayDrained !== true || proof.operatorQaRetained !== true) fail('studio_speech_import_frozen_proof_required');
}

function completedMetadata(request, metadata) {
  if (!exact(metadata,['speechPackage','artifacts']) || !same(metadata.speechPackage,request.packageMetadata)
    || !exact(metadata.artifacts,['schemaVersion','artifactId','ownerHash','audio','video']) || metadata.artifacts.schemaVersion !== 1
    || metadata.artifacts.artifactId !== request.packageId.slice('generated-'.length) || metadata.artifacts.ownerHash !== request.ownerHash) fail('studio_speech_import_blob_proof_required');
  const artifactId = metadata.artifacts.artifactId, uuid = `${artifactId.slice(0,8)}-${artifactId.slice(8,12)}-${artifactId.slice(12,16)}-${artifactId.slice(16,20)}-${artifactId.slice(20)}`;
  for (const [kind,extension,mime,limit] of [['audio','wav','audio/wav',1200044],['video','mp4','video/mp4',30*1024*1024]]) {
    let record; try { record = validatePrivateMedia(metadata.artifacts[kind]); } catch { fail('studio_speech_import_blob_proof_required'); }
    if (record.sha256 !== request.packageMetadata[kind].sha256 || record.contentType !== mime || record.size > limit
      || record.pathname !== mediaBlobPath(`dealers/astrid/runtime/generated/${request.ownerHash}`,uuid,record.sha256,extension)) fail('studio_speech_import_blob_proof_required');
  }
  return metadata;
}

async function materialize(prepared, completedPackages, verifier) {
  if (!list(completedPackages)) fail('studio_speech_import_blob_proof_required');
  const supplied = new Map();
  for (const row of completedPackages) {
    if (!exact(row,['requestKey','metadata']) || !sha.test(row.requestKey) || supplied.has(row.requestKey)) fail('studio_speech_import_blob_proof_required');
    supplied.set(row.requestKey,clone(row.metadata));
  }
  const rows = clone(prepared.snapshot);
  for (const request of rows.requests.filter(row=>row.state === 'completed')) {
    const metadata = completedMetadata(request,supplied.get(request.key)); supplied.delete(request.key);
    if (typeof verifier !== 'function') fail('studio_speech_import_blob_proof_required');
    let proof; try { proof = await verifier(frozen(clone({requestKey:request.key,ownerHash:request.ownerHash,metadata}))); }
    catch { fail('studio_speech_import_blob_verification_failed',503); }
    const expected = { verified:true, artifactId:metadata.artifacts.artifactId, ownerHash:request.ownerHash,
      textSha256:request.packageMetadata.generation.textSha256, audioSha256:metadata.artifacts.audio.sha256,
      audioSize:metadata.artifacts.audio.size, videoSha256:metadata.artifacts.video.sha256, videoSize:metadata.artifacts.video.size };
    if (!same(proof,expected)) fail('studio_speech_import_blob_proof_required');
    request.packageMetadata = metadata;
  }
  if (supplied.size) fail('studio_speech_import_blob_proof_required');
  const campaigns = new Map(), attempts = [], gates = [], uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
  const campaignValue = value => {
    if (!exact(value,['id','createdAt','expiresAt']) || !uuid.test(value.id) || !integer(value.createdAt) || !integer(value.expiresAt)
      || value.createdAt > Date.parse(rows.observedAt) || value.expiresAt <= value.createdAt || value.expiresAt-value.createdAt > 1800000) fail('studio_speech_import_operator_qa_invalid');
    return {campaignId:value.id,createdAt:value.createdAt,expiresAt:value.expiresAt};
  };
  for (const entry of rows.retainedOperatorQa.filter(entry=>entry.name.endsWith('.campaign.json'))) {
    const value = campaignValue(entry.value);
    if (entry.name!==`operator-qa-${value.campaignId}.campaign.json` || campaigns.has(value.campaignId)) fail('studio_speech_import_operator_qa_invalid');
    campaigns.set(value.campaignId,{...value,sourceSha256:entry.sha256});
  }
  for (const entry of rows.retainedOperatorQa.filter(entry=>entry.name==='operator-qa.json')) {
    const value = campaignValue(entry.value), existing=campaigns.get(value.campaignId);
    if (gates.length || existing && (existing.createdAt!==value.createdAt || existing.expiresAt!==value.expiresAt)) fail('studio_speech_import_operator_qa_invalid');
    if (!existing) campaigns.set(value.campaignId,{...value,sourceSha256:entry.sha256});
    gates.push({...value,sourceSha256:entry.sha256});
  }
  for (const entry of rows.retainedOperatorQa.filter(entry=>/\.attempt-[123]\.json$/.test(entry.name))) {
    const value=entry.value,campaign=campaigns.get(value.campaignId);
    if (!exact(value,['campaignId','attempt','turn','reservedAt']) || !campaign || ![1,2,3].includes(value.attempt) || ![1,2].includes(value.turn)
      || entry.name!==`operator-qa-${value.campaignId}.attempt-${value.attempt}.json` || !integer(value.reservedAt)
      || value.reservedAt<campaign.createdAt || value.reservedAt>=campaign.expiresAt || value.reservedAt>Date.parse(rows.observedAt)
      || attempts.some(row=>row.campaignId===value.campaignId&&row.attempt===value.attempt)) fail('studio_speech_import_operator_qa_invalid');
    attempts.push({campaignId:value.campaignId,attempt:value.attempt,turn:value.turn,reservedAt:value.reservedAt,actor:null,sourceSha256:entry.sha256});
  }
  if (campaigns.size+attempts.length+gates.length!==rows.retainedOperatorQa.length
    // A real gate may have no campaign receipt yet. Its exact payload derives
    // one campaign row; that does not create an extra retained source file.
    + gates.filter(gate=>!rows.retainedOperatorQa.some(entry=>entry.name===`operator-qa-${gate.campaignId}.campaign.json`)).length) fail('studio_speech_import_operator_qa_invalid');
  for (const campaign of campaigns.values()) {
    const saved=attempts.filter(row=>row.campaignId===campaign.campaignId).map(row=>row.attempt).sort();
    if (saved.some((attempt,index)=>attempt!==index+1)) fail('studio_speech_import_operator_qa_invalid');
  }
  rows.operatorCampaigns=[...campaigns.values()].sort((a,b)=>a.campaignId.localeCompare(b.campaignId));
  rows.operatorAttempts=attempts.sort((a,b)=>a.campaignId.localeCompare(b.campaignId)||a.attempt-b.attempt);
  rows.operatorGates=gates;
  const resources = new Set(rows.requests.map(row=>row.capability === 'stream' ? 'stream-session' : 'fullfile-provider'));
  if (rows.sessions.length) resources.add('stream-session');
  if (rows.retainedOperatorQa.length) resources.add('operator-qa');
  rows.leases = [...resources].sort().map(resource=>({resource,holderId:prepared.sourceId,fence:1,expiresAt:0,recoveryOnly:false}));
  for (const row of rows.requests) Object.assign(row,{leaseResource:row.capability === 'stream' ? 'stream-session' : 'fullfile-provider',holderId:prepared.sourceId,leaseFence:1});
  for (const row of rows.sessions) Object.assign(row,{holderId:prepared.sourceId,leaseFence:1});
  return frozen(rows);
}

const number = value => { const result = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value; if (!integer(result)) fail('studio_speech_import_target_invalid',409); return result; };
function identityUuid(value) { const bytes = Buffer.from(hash(value).slice(0,32),'hex'); bytes[6]=(bytes[6]&15)|80; bytes[8]=(bytes[8]&63)|128; const hex=bytes.toString('hex'); return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`; }
const projections = {
  leases:row=>({resource:row.resource,holderId:row.holder_id,fence:number(row.fence),expiresAt:number(row.expires_at_ms),recoveryOnly:row.recovery_only}),
  policy:row=>({version:row.version,dailyBudgetMicroUsd:number(row.daily_budget_micro_usd),createdAt:number(row.created_at_ms)}),
  requests:row=>({key:row.request_key,ownerHash:row.owner_hash,requestId:row.request_id,fingerprint:row.fingerprint,capability:row.capability,state:row.state,
    leaseResource:row.lease_resource,holderId:row.holder_id,leaseFence:number(row.lease_fence),packageId:row.package_id,packageMetadata:row.package_metadata,safeError:row.safe_error,createdAt:number(row.created_at_ms),updatedAt:number(row.updated_at_ms)}),
  sessions:row=>({sessionId:row.session_id,endpointId:row.endpoint_id,workerId:row.worker_id,holderId:row.holder_id,leaseFence:number(row.lease_fence),state:row.state,jobId:row.job_id,
    createdAt:number(row.created_at_ms),cancelRequestedAt:row.cancel_requested_at_ms === null ? null : number(row.cancel_requested_at_ms),terminalStatus:row.terminal_status,
    terminalReason:row.terminal_reason,releasedAt:row.released_at_ms === null ? null : number(row.released_at_ms)}),
  reservations:row=>({sessionId:row.session_id,day:row.day,reservedMicroUsd:number(row.reserved_micro_usd)}),
  operatorCampaigns:row=>({campaignId:row.campaign_id,createdAt:number(row.created_at_ms),expiresAt:number(row.expires_at_ms),sourceSha256:row.source_sha256}),
  operatorGates:row=>({campaignId:row.campaign_id,createdAt:number(row.created_at_ms),expiresAt:number(row.expires_at_ms),sourceSha256:row.source_sha256}),
  operatorAttempts:row=>({campaignId:row.campaign_id,attempt:row.attempt,turn:row.turn,reservedAt:number(row.reserved_at_ms),actor:row.actor,sourceSha256:row.source_sha256}),
};
const ordered = (rows,key) => [...rows].sort((a,b)=>String(key(a)).localeCompare(String(key(b))));
function desired(rows) {
  const strip = row=>Object.fromEntries(Object.entries(row).filter(([name])=>!['sourceId','sourceSha256','requestIdIsOpaque'].includes(name)));
  return {leases:rows.leases,policy:rows.budgetPolicy ? [rows.budgetPolicy] : [],
    requests:ordered(rows.requests.map(strip),row=>row.key),sessions:ordered(rows.sessions.map(strip),row=>row.sessionId),
    reservations:ordered(rows.reservations,row=>`${row.sessionId}/${row.day}`),operatorCampaigns:rows.operatorCampaigns,operatorAttempts:rows.operatorAttempts,operatorGates:rows.operatorGates};
}

// Explicit operator API; no CLI, startup hook or environment-selected apply.
// The caller verifies a complete frozen export and a stopped/drained provider.
// Original pending requests remain uncertain and permanently deny paid replay.
// Replay succeeds only while the entire imported cost target is unchanged;
// later runtime consumption/leases require reconciliation, never merge/reset.
export async function applyLegacySpeechLedgerSnapshot({ pool, prepared, expectedScope, expectedChecksum, expectedTarget, actor,
  confirmation, freezeProof, completedPackages = [], verifyCompletedPackage, schemaCheck = planStudioMigrations } = {}) {
  if (confirmation !== 'verified-frozen-speech-ledger-import' || !pool || typeof pool.connect !== 'function' || !expectedTarget) fail('studio_speech_import_confirmation_required');
  const source = preparedSource(prepared,expectedScope,expectedChecksum); actor = validateActor(actor);
  const target = clone(expectedTarget); verifyFreeze(source,clone(freezeProof));
  const rows = await materialize(source,completedPackages,verifyCompletedPackage), wanted = desired(rows);
  const importChecksum = hash(canonicalStudioJson({sourceId:source.sourceId,sourceChecksum:source.checksum,scope:rows.scope,costRows:wanted,retainedOperatorQa:rows.retainedOperatorQa}));
  const eventId = identityUuid(canonicalStudioJson({sourceId:source.sourceId,scope:rows.scope}));
  const plan = await schemaCheck({pool});
  if (!plan.schemaPresent || plan.toApply.length || !['001,002,003,004,005','001,002,003,004,005,006'].includes(plan.applied.map(row=>row.version).join(','))
    || plan.applied.some(row=>!sha.test(row.checksum) || !sha.test(row.structureChecksum)) || !same(plan.target,target)) fail('studio_speech_import_schema_unverified',409);
  let client, began = false;
  const query = async (tag,sql,values=[]) => client.query(`/* speech-import:${tag} */ ${sql}`,values);
  try {
    client = await pool.connect(); if (!client || typeof client.query !== 'function' || typeof client.release !== 'function') fail('studio_speech_import_target_unavailable',503);
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED'); began = true;
    await client.query("SET LOCAL statement_timeout='10000ms'; SET LOCAL lock_timeout='3000ms'; SET LOCAL idle_in_transaction_session_timeout='10000ms'");
    // Same order/keys as the reviewed migration runner, then speech runtime.
    await query('migration_lock','SELECT pg_advisory_xact_lock($1::integer,$2::integer)',[1129467987,1398035778]);
    await query('cost_lock','SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`croupier:speech:${rows.scope.environment}`]);
    const actualTarget=(await query('target','SELECT current_database() AS database,current_user AS role,inet_server_addr()::text AS address,inet_server_port() AS port')).rows[0];
    if (!same(actualTarget,target)) fail('studio_speech_import_target_mismatch',409);
    const ledger=(await query('schema','SELECT version,checksum,structure_checksum FROM croupier_studio.storage_migrations ORDER BY version')).rows;
    if (!same(ledger,plan.applied.map(row=>({version:row.version,checksum:row.checksum,structure_checksum:row.structureChecksum})))) fail('studio_speech_import_schema_unverified',409);
    const env=rows.scope.environment, found={};
    // Legacy snapshots contain no authoritative fullfile prices/reservations.
    // Preserve their original checksum; new capability costs must remain empty,
    // including on replay, rather than fabricate a policy or merge later usage.
    for(const [kind,table] of [['fullfilePolicies','fullfile_budget_policies'],['fullfileReservations','fullfile_reservations']]){
      if((await query(`read_${kind}`,`SELECT * FROM croupier_studio.${table} WHERE environment_id=$1 LIMIT 1`,[env])).rows.length)
        fail('studio_speech_import_target_conflict',409);
    }
    for (const [kind,table,order] of [['leases','speech_execution_leases','resource'],['policy','gpu_budget_policies','environment_id'],['requests','speech_requests','request_key'],['sessions','gpu_sessions','session_id'],['reservations','gpu_reservations','session_id,day'],
      ['operatorCampaigns','operator_qa_campaigns','campaign_id'],['operatorAttempts','operator_qa_attempts','campaign_id,attempt'],['operatorGates','operator_qa_gate','campaign_id']]) {
      const saved=(await query(`read_${kind}`,`SELECT ${kind==='reservations'?'environment_id,session_id,day::text,reserved_micro_usd':'*'} FROM croupier_studio.${table} WHERE environment_id=$1 ORDER BY ${order} LIMIT 16385`,[env])).rows;
      if (saved.length > 16384) fail('studio_speech_import_target_conflict',409);
      if (kind.startsWith('operator') && saved.some(row=>row.workspace_id!==rows.scope.workspaceId)) fail('studio_speech_import_target_conflict',409);
      found[kind]=saved.map(projections[kind]);
    }
    const markers=(await query('markers',"SELECT workspace_id,event_id,revision FROM croupier_studio.audit_events WHERE environment_id=$1 AND action='import_document' AND subject='speech-ledger' ORDER BY workspace_id,event_id LIMIT 2",[env])).rows;
    if (markers.length) {
      if (markers.length!==1 || markers[0].workspace_id!==rows.scope.workspaceId || markers[0].event_id!==eventId || markers[0].revision!==importChecksum || !same(found,wanted)) fail('studio_speech_import_target_conflict',409);
      await client.query('COMMIT'); began=false;
      return {replayed:true,sourceId:source.sourceId,sourceChecksum:source.checksum,importChecksum,imported:{requests:0,sessions:0,reservations:0},requires:rows.requires};
    }
    if (Object.values(found).some(value=>value.length)) fail('studio_speech_import_target_not_empty',409);
    for (const row of rows.leases) await query('insert_lease','INSERT INTO croupier_studio.speech_execution_leases(environment_id,resource,holder_id,fence,expires_at_ms,recovery_only) VALUES ($1,$2,$3,$4,$5,$6)',[env,row.resource,row.holderId,row.fence,row.expiresAt,row.recoveryOnly]);
    if (rows.budgetPolicy) await query('insert_policy','INSERT INTO croupier_studio.gpu_budget_policies(environment_id,version,daily_budget_micro_usd,created_at_ms) VALUES ($1,$2,$3,$4)',[env,rows.budgetPolicy.version,rows.budgetPolicy.dailyBudgetMicroUsd,rows.budgetPolicy.createdAt]);
    for (const row of rows.requests) await query('insert_request',`INSERT INTO croupier_studio.speech_requests(environment_id,request_key,owner_hash,request_id,fingerprint,capability,state,lease_resource,holder_id,lease_fence,package_id,package_metadata,safe_error,created_at_ms,updated_at_ms)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15)`,[env,row.key,row.ownerHash,row.requestId,row.fingerprint,row.capability,row.state,row.leaseResource,row.holderId,row.leaseFence,row.packageId,row.packageMetadata===null?null:JSON.stringify(row.packageMetadata),row.safeError,row.createdAt,row.updatedAt]);
    for (const row of rows.sessions) await query('insert_session',`INSERT INTO croupier_studio.gpu_sessions(environment_id,session_id,endpoint_id,worker_id,holder_id,lease_fence,state,job_id,created_at_ms,cancel_requested_at_ms,terminal_status,terminal_reason,released_at_ms)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[env,row.sessionId,row.endpointId,row.workerId,row.holderId,row.leaseFence,row.state,row.jobId,row.createdAt,row.cancelRequestedAt,row.terminalStatus,row.terminalReason,row.releasedAt]);
    for (const row of rows.reservations) await query('insert_reservation','INSERT INTO croupier_studio.gpu_reservations(environment_id,session_id,day,reserved_micro_usd) VALUES ($1,$2,$3::date,$4)',[env,row.sessionId,row.day,row.reservedMicroUsd]);
    for (const row of rows.operatorCampaigns) await query('insert_operator_campaign','INSERT INTO croupier_studio.operator_qa_campaigns(environment_id,workspace_id,campaign_id,created_at_ms,expires_at_ms,source_sha256) VALUES ($1,$2,$3::uuid,$4,$5,$6)',[env,rows.scope.workspaceId,row.campaignId,row.createdAt,row.expiresAt,row.sourceSha256]);
    for (const row of rows.operatorAttempts) await query('insert_operator_attempt','INSERT INTO croupier_studio.operator_qa_attempts(environment_id,workspace_id,campaign_id,attempt,turn,reserved_at_ms,actor,source_sha256) VALUES ($1,$2,$3::uuid,$4,$5,$6,$7,$8)',[env,rows.scope.workspaceId,row.campaignId,row.attempt,row.turn,row.reservedAt,row.actor,row.sourceSha256]);
    for (const row of rows.operatorGates) await query('insert_operator_gate','INSERT INTO croupier_studio.operator_qa_gate(environment_id,workspace_id,campaign_id,created_at_ms,expires_at_ms,source_sha256) VALUES ($1,$2,$3::uuid,$4,$5,$6)',[env,rows.scope.workspaceId,row.campaignId,row.createdAt,row.expiresAt,row.sourceSha256]);
    // Schema001 constrains action names; subject clearly distinguishes this
    // operator import from document writes. Existing documents/history stay.
    await query('record',"INSERT INTO croupier_studio.audit_events(environment_id,workspace_id,event_id,action,subject,revision,actor) VALUES ($1,$2,$3,'import_document','speech-ledger',$4,$5)",[env,rows.scope.workspaceId,eventId,importChecksum,actor]);
    const committed=await client.query('COMMIT'); began=false; if (committed?.command==='ROLLBACK') fail('studio_speech_import_rolled_back',503);
    return {replayed:false,sourceId:source.sourceId,sourceChecksum:source.checksum,importChecksum,
      imported:{requests:rows.requests.length,sessions:rows.sessions.length,reservations:rows.reservations.length},requires:rows.requires};
  } catch (error) {
    if (began) try {await client.query('ROLLBACK');} catch {}
    if (error instanceof StudioStorageError) throw error;
    throw studioStorageFailure(error);
  } finally {try {client?.release?.();} catch {}}
}
