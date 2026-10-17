import { createHash } from 'node:crypto';
import { StudioStorageError, canonicalStudioJson, validateStudioScope } from '../../packages/studio-registry/server/document-contract.mjs';
import { GPU_RESERVATION_WINDOW_MS, speechRequestKey } from '../../web/postgres-speech-journal.mjs';
import { normalizeSpeechPackage } from '../../packages/presentation/contracts/speech-package.mjs';

export const SPEECH_LEDGER_SNAPSHOT_FORMAT = 'croupier-speech-ledger-v1';
const hashPattern = /^[a-f0-9]{64}$/, jobPattern = /^[A-Za-z0-9_-]{1,128}$/;
const terminals = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT']);
const safeCode = /^(?:generated_speech_|invalid_generated_speech_|speech_|gpu_)[a-z_]{1,100}$/;
const fail = () => { throw new StudioStorageError('studio_speech_import_source_invalid', 422); };
const hash = value => createHash('sha256').update(value).digest('hex');
const keys = (value, expected) => value && !Array.isArray(value) && typeof value === 'object'
  && Object.keys(value).sort().join(',') === expected.sort().join(',');
const integer = value => Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000 - GPU_RESERVATION_WINDOW_MS;
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const microUsd = (value, maximum = 10000000) => Number.isSafeInteger(value) && value > 0 && value <= maximum;
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function source(packet) {
  if (!keys(packet, ['name','bytes','sha256','updatedAt']) || !(packet.bytes instanceof Uint8Array)
    || !packet.bytes.byteLength || packet.bytes.byteLength > 32768 || !hashPattern.test(packet.sha256)
    || !timestamp(packet.updatedAt) || hash(packet.bytes) !== packet.sha256) fail();
  let value; try { value = JSON.parse(new TextDecoder('utf-8', { fatal:true }).decode(packet.bytes)); } catch { fail(); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  return { value, sha256:packet.sha256, updatedAt:packet.updatedAt };
}

// Offline only. All packets must come from one COMPLETE, stopped export; this
// function cannot prove completeness from an arbitrary caller-supplied subset.
// No FS/network/DB/provider activity, import apply, seed, delete or refund API.
// Raw disk request keys are preserved: unfinished legacy records do not contain
// a recoverable original requestId. Inventing a new key would reopen paid work.
export function prepareLegacySpeechLedgerSnapshot({ scope, endpointId, observedAt, sources, confirmation, drainProof, lockState } = {}) {
  scope = validateStudioScope(scope);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(endpointId ?? '') || !timestamp(observedAt)
    || confirmation !== 'verified-frozen-complete-speech-ledger'
    || !keys(drainProof, ['observedAt','workers','busy','available']) || drainProof.observedAt !== observedAt
    || drainProof.workers !== 0 || drainProof.busy !== 0 || drainProof.available !== 0
    || !keys(lockState, ['fullfileProvider','streamSession','operatorQa']) || lockState.fullfileProvider !== 'stopped'
    || lockState.streamSession !== 'stopped' || lockState.operatorQa !== 'disabled'
    || !Array.isArray(sources) || sources.length > 16384) fail();
  const stamp = Date.parse(observedAt), packets = new Map(); let size = 0;
  const namePattern = /^(?:gpu-budget-policy\.json|gpu-session-[a-f0-9]{32}\.(?:reservation|job|cancel|terminal)\.json|(?:stream-)?[a-f0-9]{64}\.request\.json|[a-f0-9]{64}\.(?:done|failed)\.json|[a-f0-9]{32}\/metadata\.json|operator-qa\.json|operator-qa-[a-f0-9-]{36}\.(?:campaign|attempt-[123])\.json)$/;
  for (const packet of sources) {
    if (!namePattern.test(packet?.name ?? '') || packets.has(packet.name) || (size += packet.bytes?.byteLength ?? 0) > 16777216) fail();
    const parsed = source(packet);
    if (Date.parse(parsed.updatedAt) > stamp) fail();
    packets.set(packet.name, parsed);
  }
  const used = new Set(), get = name => { const packet = packets.get(name); if (packet) used.add(name); return packet?.value ?? null; };
  const budget = get('gpu-budget-policy.json');
  if (budget && (!keys(budget, ['version','dailyBudgetMicroUsd','createdAt']) || budget.version !== 1
    || !microUsd(budget.dailyBudgetMicroUsd, 20000000) || !integer(budget.createdAt) || budget.createdAt > stamp)) fail();
  const sessions = [], reservations = [], requests = [], retainedOperatorQa = [];
  for (const name of [...packets.keys()].sort()) {
    const match = /^gpu-session-([a-f0-9]{32})\.reservation\.json$/.exec(name);
    if (!match) continue;
    const id = match[1], value = get(name), prefix = `gpu-session-${id}`;
    if (!keys(value, ['id','endpointId','days','reservedMicroUsd','createdAt','workerId']) || value.id !== id
      || value.endpointId !== endpointId || value.workerId !== `croupier-${id}` || !microUsd(value.reservedMicroUsd)
      || !integer(value.createdAt) || value.createdAt > stamp || !Array.isArray(value.days)) fail();
    const expectedDays = [...new Set([value.createdAt, value.createdAt + GPU_RESERVATION_WINDOW_MS].map(time => new Date(time).toISOString().slice(0,10)))];
    if (canonicalStudioJson(value.days) !== canonicalStudioJson(expectedDays)) fail();
    const job = get(`${prefix}.job.json`), cancel = get(`${prefix}.cancel.json`), terminal = get(`${prefix}.terminal.json`);
    if (job && (!keys(job, ['jobId']) || !jobPattern.test(job.jobId))) fail();
    if (cancel && (!keys(cancel, ['requestedAt']) || !integer(cancel.requestedAt) || cancel.requestedAt < value.createdAt || cancel.requestedAt > stamp)) fail();
    if (terminal && (!job || !terminals.has(terminal.status)
      || !(keys(terminal, ['status']) || (keys(terminal, ['status','reason','observedAt'])
        && terminal.status === 'TIMED_OUT' && terminal.reason === 'provider_status_not_found_after_expiry'
        && integer(terminal.observedAt) && terminal.observedAt >= value.createdAt + GPU_RESERVATION_WINDOW_MS && terminal.observedAt <= stamp)))) fail();
    const state = terminal ? 'terminal' : !job ? 'submission_uncertain' : cancel ? 'cancelling' : 'running';
    sessions.push({ sourceId:name, sourceSha256:packets.get(name).sha256, sessionId:id, endpointId, workerId:value.workerId, state, jobId:job?.jobId ?? null, createdAt:value.createdAt,
      cancelRequestedAt:cancel?.requestedAt ?? null, terminalStatus:terminal?.status ?? null,
      terminalReason:terminal ? terminal.reason ? 'expired_missing_status' : 'provider' : null,
      releasedAt:terminal ? stamp : null });
    for (const day of value.days) reservations.push({ sessionId:id, day, reservedMicroUsd:value.reservedMicroUsd });
  }
  if ((sessions.length && !budget) || sessions.filter(value => value.releasedAt === null).length > 1
    || new Set(sessions.filter(value => value.jobId).map(value => value.jobId)).size !== sessions.filter(value => value.jobId).length) fail();
  for (const name of [...packets.keys()].sort()) {
    const match = /^(stream-)?([a-f0-9]{64})\.request\.json$/.exec(name);
    if (!match) continue;
    const key = match[2], value = get(name);
    const fullfile = keys(value, ['fingerprint','ownerHash']);
    const stream = keys(value, ['fingerprint','ownerHash','state','createdAt']);
    if (!(fullfile || stream) || !hashPattern.test(value.fingerprint) || !hashPattern.test(value.ownerHash)
      || (stream && (value.state !== 'reserved' || !integer(value.createdAt) || value.createdAt > stamp))
      || (match[1] && !stream)) fail();
    const done = get(`${key}.done.json`), failed = get(`${key}.failed.json`);
    if ((done && stream) || (done && failed) || (failed && (!keys(failed, ['code']) || !safeCode.test(failed.code)))) fail();
    let packageId = null, packageMetadata = null, requestId = `legacy-key:${key}`, createdAt = stream ? value.createdAt : Date.parse(packets.get(name).updatedAt);
    if (done) {
      if (!keys(done, ['id']) || !/^[a-f0-9]{32}$/.test(done.id)) fail();
      const metadata = get(`${done.id}/metadata.json`);
      if (!keys(metadata, ['ownerHash','speechPackage']) || metadata.ownerHash !== value.ownerHash) fail();
      try { packageMetadata = normalizeSpeechPackage(metadata.speechPackage); } catch { fail(); }
      packageId = packageMetadata.packageId; requestId = packageMetadata.generation?.requestId;
      if (packageId !== `generated-${done.id}` || speechRequestKey(value.ownerHash, requestId) !== key) fail();
      if (hash(packageMetadata.exactText) !== packageMetadata.generation.textSha256
        || hash(JSON.stringify({ ownerHash:value.ownerHash, text:packageMetadata.exactText, dealerId:packageMetadata.dealerId,
          voiceId:packageMetadata.source.voiceId, modelId:packageMetadata.generation.modelId, profile:packageMetadata.generation.profileRevision })) !== value.fingerprint) fail();
    }
    if (requests.some(previous => previous.key === key)) fail();
    requests.push({ sourceId:name, sourceSha256:packets.get(name).sha256, key, ownerHash:value.ownerHash, requestId, fingerprint:value.fingerprint, capability:stream ? 'stream' : 'fullfile',
      state:done ? 'completed' : 'submission_uncertain', createdAt, updatedAt:stamp, packageId, packageMetadata,
      safeError:failed?.code ?? null, requestIdIsOpaque:!done });
  }
  // Operator gating remains owned by its current private store. Its immutable
  // attempts are included and hash-bound; this is never permission to reset the
  // gate, infer three fresh attempts or delete its state during cutover.
  for (const name of [...packets.keys()].filter(value => value.startsWith('operator-qa')).sort()) {
    const value = get(name);
    const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
    if (/\.attempt-[123]\.json$/.test(name)) {
      if (!keys(value, ['campaignId','attempt','turn','reservedAt']) || !uuid.test(value.campaignId)
        || name !== `operator-qa-${value.campaignId}.attempt-${value.attempt}.json` || ![1,2,3].includes(value.attempt)
        || ![1,2].includes(value.turn) || !integer(value.reservedAt) || value.reservedAt > stamp) fail();
      const campaign = get(`operator-qa-${value.campaignId}.campaign.json`);
      if (!campaign || value.reservedAt < campaign.createdAt || value.reservedAt >= campaign.expiresAt) fail();
    } else if (!keys(value, ['id','createdAt','expiresAt']) || !uuid.test(value.id) || !integer(value.createdAt)
      || !integer(value.expiresAt) || value.createdAt > stamp || value.expiresAt <= value.createdAt
      || value.expiresAt - value.createdAt > 1800000 || (name !== 'operator-qa.json' && name !== `operator-qa-${value.id}.campaign.json`)) fail();
    retainedOperatorQa.push({ name, value, sha256:packets.get(name).sha256 });
  }
  if (used.size !== packets.size) fail(); // Orphan job/done/receipt/metadata cannot silently disappear.
  const snapshot = { format:SPEECH_LEDGER_SNAPSHOT_FORMAT, scope, endpointId, observedAt,
    sourceHashes:Object.fromEntries([...packets].sort(([a],[b]) => a.localeCompare(b)).map(([name, packet]) => [name, packet.sha256])),
    budgetPolicy:budget, sessions, reservations, requests, retainedOperatorQa,
    requires:['verified-complete-frozen-export','empty-environment-cost-target','verified-stopped-provider-and-drained-relay',
      'byte-preserved-owned-fullfile-artifacts','verified-private-blob-refs-for-completed-packages','retained-operator-qa-state', ...(sessions.some(value => value.state === 'submission_uncertain') ? ['operator-reconciliation-of-unknown-submit'] : [])] };
  const checksum = hash(canonicalStudioJson(snapshot));
  return freeze({ sourceId:`legacy-speech-${checksum}`, snapshot, checksum });
}
