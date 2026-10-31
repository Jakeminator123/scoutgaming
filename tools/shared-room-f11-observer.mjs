// F11 evidence observer, not a deploy/game driver or an acceptance authority.
// Render: https://render.com/docs/logging (Rndr-Id identifies a REQUEST, not an
// instance; request logs have no instance). A socket needs a correlated runtime
// app-log record. Never infer identity from a different HTTP request or a SHA.
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

export const F11_TARGET = Object.freeze({ origin: 'https://preview.scoutgaming.tech',
  engineOrigin: 'https://croupier-k06-k07-staging.onrender.com', serviceId: 'srv-dbf61l0m7kps73ft7mk0',
  projectId: 'prj_7dgyvW5zakx1qJ8YaH5pueVTVi14', neonProjectId: 'red-violet-36066351',
  branchId: 'br-plain-voice-b9yu49xi', endpointId: 'ep-billowing-surf-b93x7p3c',
  databaseHost: 'ep-billowing-surf-b93x7p3c.c-7.eu-central-1.aws.neon.tech',
  database: 'croupier_staging', environment: 'staging_k06_k07', workspaceId: 'croupier' });
const target = F11_TARGET;
const fail = code => { throw Object.assign(Error(`f11_${code}`), { code: `f11_${code}` }); };
const need = (yes, code) => { if (!yes) fail(code); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(value);
const synthetic = value => typeof value === 'string' && /^f11-[a-z0-9-]{1,100}$/.test(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const eventTypes = new Set(['speak', 'idle', 'deal', 'reveal', 'settle', 'turn']);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);

// This receipt is evidence for independent review, not authenticated authority.
// The live driver must establish absence BEFORE its API writes and read back the
// exact newly created identities through the pinned preview database connection.
export function validateF11Ownership(value, manifest) {
  const only = (row, keys) => object(row) && Object.keys(row).length === keys.length && keys.every(key => Object.hasOwn(row,key));
  need(only(value,['schemaVersion','source','runId','operatorId','roomId','checkedAt','verifiedAt','absent','readback','accounts','digest'])
    && only(value.absent,['operators','accounts','rooms','packages'])
    && only(value.readback,[...Object.keys(target),'operatorId','roomId','configVersion','packageRevision','roomCount','accountCount']), 'ownership_receipt_required');
  need(object(value) && value.schemaVersion === 1 && value.source === 'preview-api-created'
    && value.runId === manifest.runId && value.operatorId === manifest.runId
    && value.roomId === manifest.roomId && /^room-/.test(value.roomId) && uuid(value.roomId.slice(5))
    && integer(value.checkedAt) && integer(value.verifiedAt) && value.checkedAt <= value.verifiedAt
    && value.verifiedAt <= manifest.startedAt, 'ownership_receipt_required');
  need(object(value.absent) && ['operators','accounts','rooms','packages'].every(key => value.absent[key] === 0), 'fixture_already_exists');
  const readback = value.readback;
  need(object(readback) && Object.keys(target)
    .every(key => readback[key] === target[key]) && readback.roomId === manifest.roomId
    && readback.operatorId === value.operatorId && id(readback.configVersion)
    && readback.packageRevision === 1 && readback.roomCount === 1 && readback.accountCount === 2, 'ownership_readback_invalid');
  need(Array.isArray(value.accounts) && value.accounts.length === 2
    && value.accounts.every((account,i) => only(account,['actorId','username','createdAt','openingId','openingCents','currency','openingAt']) && uuid(account.actorId)
      && account.actorId === manifest.actors[i] && account.username === `${manifest.runId}-${i ? 'b' : 'a'}`
      && integer(account.createdAt) && account.createdAt >= value.checkedAt && account.createdAt <= value.verifiedAt
      && id(account.openingId) && account.openingCents === 100000 && account.currency === 'USD'
      && typeof account.openingAt === 'string' && Date.parse(account.openingAt) >= account.createdAt
      && Date.parse(account.openingAt) <= value.verifiedAt)
    && new Set(value.accounts.map(account => account.actorId)).size === 2, 'ownership_accounts_invalid');
  const { digest, ...receipt } = value;
  need(typeof digest === 'string' && digest === hash(receipt), 'ownership_digest_invalid');
  return structuredClone(value);
}

export function validateF11Manifest(value) {
  need(object(value) && value.schemaVersion === 1 && sha(value.sha), 'manifest_invalid');
  need(Object.entries(target).every(([key, expected]) => value[key] === expected), 'target_mismatch');
  need(synthetic(value.runId) && value.runId.length <= 28 && typeof value.roomId === 'string' && Array.isArray(value.actors)
    && value.actors.length === 2 && value.actors.every(uuid) && new Set(value.actors).size === 2
    && value.syntheticOnly === true, 'synthetic_scope_required');
  need(integer(value.startedAt) && integer(value.endedAt) && value.endedAt - value.startedAt >= 120000
    && value.endedAt - value.startedAt <= 900000, 'observation_window_invalid');
  // Only fixed/validated fields survive: credentials, unknown paths and URLs are never echoed.
  const ownership = validateF11Ownership(value.ownership, value);
  return Object.freeze({ ...target, schemaVersion: 1, sha: value.sha, runId: value.runId, roomId: value.roomId, ownership,
    actors: Object.freeze([...value.actors]), syntheticOnly: true, startedAt: value.startedAt, endedAt: value.endedAt });
}

// Read-only, parameterized monetary sample. Caller uses one read-only transaction,
// the preview database, and parameters [manifest.roomId, manifest.actors]. No SQL
// execution, connection or credentials are provided by this module.
export const F11_MONEY_SQL = `SELECT current_database() AS database,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('actorId',id,'balanceCents',(balance*100)::bigint) ORDER BY id)
    FROM croupier_game.players WHERE id=ANY($2::text[])), '[]'::jsonb) AS balances,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',reservation_id,'actorId',player_id,'amountCents',(amount*100)::bigint) ORDER BY reservation_id)
    FROM croupier_game.shared_wallet_reservations WHERE room_id=$1 AND player_id=ANY($2::text[])), '[]'::jsonb) AS reservations,
  (SELECT count(*)::int FROM croupier_game.shared_wallet_hands WHERE room_id=$1 AND player_id=ANY($2::text[])) AS hands,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id::text,'actorId',player_id,'amountCents',(amount*100)::bigint,
      'sourceKey',source_key,'fingerprint',source_fingerprint,'type',type,'currency',currency,'at',at,
      'roundId',(SELECT min(a.body::jsonb->>'round_id') FROM croupier_game.shared_table_audit a
        WHERE a.room_id=$1 AND a.body::jsonb->>'type' LIKE 'engine.%'
          AND (a.body::jsonb->>'payload')::jsonb->'ledgerIds' ? t.id::text
        HAVING count(DISTINCT a.body::jsonb->>'round_id')=1)) ORDER BY id)
    FROM croupier_game.transactions t WHERE player_id=ANY($2::text[])), '[]'::jsonb) AS ledger,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('roundId',body::jsonb->>'round_id',
      'actorId',(body::jsonb->>'payload')::jsonb->>'playerId','ledgerId',(body::jsonb->>'payload')::jsonb->>'ledgerId',
      'returnedCents',(((body::jsonb->>'payload')::jsonb->>'returned')::numeric*100)::bigint) ORDER BY seq)
    FROM croupier_game.shared_table_audit WHERE room_id=$1 AND body::jsonb->>'type'='wallet.settlement'
      AND (body::jsonb->>'payload')::jsonb->>'playerId'=ANY($2::text[])), '[]'::jsonb) AS settlements;`;

function scope(row, manifest) {
  need(row.roomId === manifest.roomId && equal(row.actors, manifest.actors), 'scope_mismatch');
}
function money(row, manifest) {
  scope(row, manifest);
  need(row.source === 'preview-sql' && row.database === target.database && row.neonProjectId === target.neonProjectId
    && row.branchId === target.branchId, 'money_source_invalid');
  need(['before', 'during', 'after'].includes(row.stage) && integer(row.hands) && Array.isArray(row.balances)
    && row.balances.length === 2 && new Set(row.balances.map(x => x.actorId)).size === 2
    && row.balances.every(x => manifest.actors.includes(x.actorId) && integer(x.balanceCents)), 'money_invalid');
  need(Array.isArray(row.reservations) && row.reservations.length <= 20 && row.reservations.every(x => id(x.id)
    && manifest.actors.includes(x.actorId) && integer(x.amountCents) && x.amountCents > 0)
    && new Set(row.reservations.map(x => x.id)).size === row.reservations.length, 'reservations_invalid');
  need(Array.isArray(row.ledger) && row.ledger.length <= 10000, 'ledger_invalid');
  const keys = new Set(), ids = new Set();
  for (const entry of row.ledger) {
    need(id(entry.id) && !ids.has(entry.id), 'duplicate_wallet_effect'); ids.add(entry.id);
    if (entry.type === 'open') {
      const account = manifest.ownership.accounts.find(account => account.actorId === entry.actorId);
      need(account && entry.id === account.openingId && entry.amountCents === account.openingCents
        && entry.currency === account.currency && entry.at === account.openingAt
        && entry.roundId === null && entry.sourceKey === null && entry.fingerprint === null, 'opening_ledger_invalid');
      continue;
    }
    need(id(entry.id) && id(entry.roundId) && manifest.actors.includes(entry.actorId) && Number.isSafeInteger(entry.amountCents)
      && /^[a-f0-9]{64}$/.test(entry.fingerprint) && ['consume:stake', 'consume:insurance', 'double', 'split', 'payout'].includes(entry.type)
      && (entry.type === 'payout' ? entry.amountCents > 0 : entry.amountCents < 0), 'ledger_invalid');
    let key; try { key = JSON.parse(entry.sourceKey); } catch { fail('ledger_key_invalid'); }
    need(Array.isArray(key) && key.length === 6 && key.every(x => typeof x === 'string')
      && ['command', 'tick'].includes(key[0]) && key[1] === manifest.roomId && key[4] === entry.actorId
      && JSON.stringify(key) === entry.sourceKey, 'ledger_scope_invalid');
    need(!keys.has(entry.sourceKey), 'duplicate_wallet_effect');
    keys.add(entry.sourceKey);
  }
  need(manifest.ownership.accounts.every(account => row.ledger.filter(entry => entry.type === 'open'
    && entry.actorId === account.actorId).length === 1), 'opening_ledger_required');
  if (row.stage === 'before') need(row.ledger.length === 2 && row.balances.every(balance =>
    balance.balanceCents === manifest.ownership.accounts.find(account => account.actorId === balance.actorId).openingCents), 'fixture_not_fresh');
  for (const balance of row.balances) need(BigInt(balance.balanceCents) === row.ledger
    .filter(entry => entry.actorId === balance.actorId).reduce((sum,entry)=>sum+BigInt(entry.amountCents),0n), 'balance_mismatch');
  need(Array.isArray(row.settlements) && row.settlements.length <= 10000, 'settlements_required');
  const settled = new Set();
  for (const entry of row.settlements) {
    need(id(entry.roundId) && manifest.actors.includes(entry.actorId) && integer(entry.returnedCents)
      && (entry.returnedCents ? id(entry.ledgerId) : entry.ledgerId === null), 'settlement_invalid');
    const key = hash([entry.roundId,entry.actorId]);
    need(!settled.has(key), 'duplicate_settlement'); settled.add(key);
    if (entry.returnedCents) need(row.ledger.some(e => e.id === entry.ledgerId && e.actorId === entry.actorId
      && e.roundId === entry.roundId && e.type === 'payout' && e.amountCents === entry.returnedCents), 'payout_mismatch');
  }
  need(row.ledger.filter(e => e.type === 'payout').every(e => row.settlements.filter(s => s.ledgerId === e.id).length === 1), 'payout_without_settlement');
  return { stage: row.stage, at: row.at, hands: row.hands, reservations: row.reservations.map(x => ({ id: x.id, amountCents: x.amountCents })),
    settlements: row.settlements.map(x => ({ roundId: x.roundId, actorId: x.actorId, ledgerId: x.ledgerId, returnedCents: x.returnedCents })),
    balances: row.balances.map(x => ({ actorId: x.actorId, balanceCents: x.balanceCents })),
    ledger: row.ledger.map(x => ({ id: x.id, roundId: x.roundId, actorId: x.actorId, amountCents: x.amountCents,
      sourceKey: x.sourceKey, fingerprint: x.fingerprint, type: x.type, currency: x.currency ?? null, at: x.at ?? null })) };
}

/** Consume captures in chronological order. Ports/callers may feed real WS frames
 * directly; this observer never sends commands or opens sockets. Raw frames,
 * headers, cookies, exceptions and dealer text never appear in the report.
 * Evidence is supplied by the operator; a complete report still requires human
 * provenance review and does NOT constitute F11 production acceptance. */
export function createF11Observer(input) {
  const manifest = validateF11Manifest(input), connections = new Map(), targets = [], samples = [], negatives = new Set(), versions = new Map();
  let lastAt = manifest.startedAt, count = 0, poisoned = false;
  function observe(row) {
    need(object(row) && integer(row.at) && row.at >= lastAt && row.at <= manifest.endedAt && ++count <= 100000, 'event_order_invalid');
    lastAt = row.at;
    if (row.type === 'target') {
      scope(row, manifest);
      need(row.source === 'provider-api' && Object.entries(target).every(([key, value]) => row[key] === value)
        && row.engineSha === manifest.sha && row.vercelSha === manifest.sha && row.healthStatus === 200
        && row.suspended === false && row.ready === true && row.syntheticOnly === true, 'target_evidence_invalid');
      targets.push(row.at); return;
    }
    if (row.type === 'open') {
      // A caller-supplied "old/new" label, Rndr-Id or SHA alone cannot pass this gate.
      need(id(row.connectionId) && !connections.has(row.connectionId) && manifest.actors.includes(row.actorId)
        && row.roomId === manifest.roomId, 'connection_scope_invalid');
      const proof = row.instanceProof;
      need(object(proof) && proof.source === 'render-app-log' && id(proof.logId) && id(proof.instanceId)
        && id(proof.connectionNonce) && proof.connectionNonce === row.connectionNonce
        && proof.serviceId === target.serviceId && proof.sha === manifest.sha
        && integer(proof.at) && Math.abs(proof.at - row.at) <= 2000, 'instance_evidence_required');
      need(![...connections.values()].some(c => c.nonce === proof.connectionNonce || c.logId === proof.logId), 'instance_evidence_reused');
      connections.set(row.connectionId, { actor: row.actorId, instance: proof.instanceId, nonce: proof.connectionNonce,
        logId: proof.logId, openedAt: row.at, frames: [], closedAt: null, closeCode: null }); return;
    }
    if (row.type === 'frame') {
      const c = connections.get(row.connectionId), f = row.frame, s = f?.snapshot, p = f?.presentation;
      need(c && c.closedAt === null && object(f) && f.type === 'shared-room-state' && f.roomId === manifest.roomId
        && object(s) && s.roomId === manifest.roomId && s.me?.id === c.actor && integer(s.version)
        && s.contract === 'blackjack-table/1' && id(s.configVersion) && id(s.windowId) && integer(s.turnSeq)
        && integer(s.presentationVer) && ['bets', 'round', 'settled'].includes(s.phase)
        && (s.roundId === null || id(s.roundId)) && (s.phase !== 'round' || id(s.roundId)), 'frame_invalid');
      // These fields always exist in coordinator.snapshot, including explicit nulls.
      // Missing evidence is not equivalent to a legitimately unopened/cleared field.
      need(['round','shoe','plan','deadline','actionDeadline'].every(key => Object.hasOwn(s,key))
        && [s.round,s.shoe,s.plan].every(value => value === null || object(value))
        && [s.deadline,s.actionDeadline].every(value => value === null || integer(value))
        && (s.phase !== 'round' || object(s.round) && object(s.shoe))
        && Array.isArray(s.owners) && s.owners.length === 7 && s.owners.every(value => value === null || id(value))
        && Array.isArray(s.seatGen) && s.seatGen.length === 7 && s.seatGen.every(integer)
        && Array.isArray(s.bets) && s.bets.length === 7 && s.bets.every(bet => object(bet)
          && ['main','pp','tp'].every(key => Number.isFinite(bet[key]) && bet[key] >= 0)), 'snapshot_contract_incomplete');
      need(p === null ? s.presentationVer === 0 : object(p) && p.roomId === manifest.roomId && p.ver === s.presentationVer
        && Array.isArray(p.events) && p.events.length <= 128 && p.events.every(e => eventTypes.has(e.type)), 'presentation_mismatch');
      const previous = c.frames.at(-1);
      need(!previous || s.version >= previous.version && s.presentationVer >= previous.presentationVer, 'version_regressed');
      need(!previous || previous.roundId !== s.roundId || s.turnSeq >= previous.turnSeq, 'revision_regressed');
      // Common server state excludes per-player projection, online presence and serverNow.
      const state = ['contract','version','configVersion','presentationVer','phase','roundId','turnSeq','windowId',
        'owners','seatGen','shoe','round','bets','plan','deadline','actionDeadline'].map(key => [key, s[key]]);
      const stateHash = hash(state);
      need(!versions.has(s.version) || versions.get(s.version) === stateHash, 'state_conflict'); versions.set(s.version,stateHash);
      c.frames.push({ at: row.at, version: s.version, presentationVer: s.presentationVer, phase: s.phase,
        roundId: s.roundId, turnSeq: s.turnSeq, stateHash,
        presentationHash: hash(p), eventTypes: p?.events.map(e => e.type) ?? [] }); return;
    }
    if (row.type === 'close') {
      const c = connections.get(row.connectionId);
      need(c && c.closedAt === null && integer(row.code), 'close_invalid');
      c.closedAt = row.at; c.closeCode = row.code; return;
    }
    if (row.type === 'negative') {
      need(row.source === 'socket-capture' && ['wrong-room', 'revoked-session'].includes(row.probe)
        && manifest.actors.includes(row.actorId) && row.stateFrames === 0 && [401,403,1008].includes(row.status)
        && id(row.connectionId) && !connections.has(row.connectionId)
        && (row.probe === 'wrong-room' ? synthetic(row.roomId) && row.roomId !== manifest.roomId : row.roomId === manifest.roomId), 'negative_probe_invalid');
      negatives.add(row.probe); return;
    }
    if (row.type === 'money') { samples.push(money(row, manifest)); return; }
    fail('event_type_invalid');
  }
  function finish() {
    need(targets.length >= 2 && targets[0] === manifest.startedAt && targets.at(-1) === manifest.endedAt, 'target_bookends_required');
    need(!poisoned, 'observer_poisoned');
    const all = [...connections.values()], timeline = all.flatMap(c => c.frames).sort((a,b) => a.at-b.at);
    need(timeline.length && timeline[0].at <= manifest.startedAt + 5000 && timeline.at(-1).at >= manifest.endedAt - 5000
      && timeline.every((f,i) => i === 0 || f.at - timeline[i-1].at <= 20000)
      && new Set(timeline.filter(f => f.phase === 'round').map(f => f.roundId)).size >= 2, 'continuous_hands_not_proven');
    let overlap;
    for (const old of all) for (const fresh of all) {
      if (old.instance === fresh.instance || old.actor === fresh.actor || old.openedAt >= fresh.openedAt || old.closeCode !== 1012) continue;
      const start = fresh.openedAt, end = Math.min(old.closedAt, fresh.closedAt ?? manifest.endedAt);
      if (end - start < 30000) continue;
      const a = old.frames.filter(f => f.at >= start && f.at < end), b = fresh.frames.filter(f => f.at >= start && f.at < end);
      if (a.length < 3 || b.length < 3) continue;
      // Both sockets must keep moving during overlap, not merely recover on reconnect.
      const progressing = frames => frames[0].at <= start + 2000 && frames.at(-1).at >= end - 2000
        && frames.at(-1).version > frames[0].version && frames.every((f,i) => i === 0 || f.at-frames[i-1].at <= 20000)
        && ['bets','round'].every(phase => frames.some(f => f.phase === phase));
      if (!progressing(a) || !progressing(b)) continue;
      let consistent = true;
      // A new socket initially receives the state already held by the old one.
      // Its matching presentation may have arrived just before overlap began.
      // This seed is only correlation evidence: advancing overlap still requires
      // the actual in-window frames above, on BOTH connections.
      const seeded = (connection, frames) => {
        const seed=connection.frames.filter(frame=>frame.at<start&&frame.at>=start-20000).at(-1);
        return seed?[seed,...frames]:frames;
      };
      for (const [left, right] of [[a,seeded(fresh,b)],[b,seeded(old,a)]]) for (const frame of left) {
        if (frame.at > end - 2000) continue;
        const peer = right.find(other => other.at <= frame.at + 2000 && other.version >= frame.version);
        if (!peer || peer.version === frame.version && peer.stateHash !== frame.stateHash) consistent = false;
        if (frame.eventTypes.length && !right.some(other => other.at <= frame.at + 2000
          && other.presentationVer === frame.presentationVer && other.presentationHash === frame.presentationHash)) consistent = false;
      }
      if (!consistent || !a.some(f => f.eventTypes.includes('deal')) || !b.some(f => f.eventTypes.includes('deal'))) continue;
      const last = old.frames.at(-1), again = all.find(c => c !== old && c.actor === old.actor && c.instance === fresh.instance
        && c.openedAt >= old.closedAt && c.openedAt - old.closedAt <= 10000 && c.frames.length);
      if (!again || !last?.roundId || again.frames[0].roundId !== last.roundId || again.frames[0].version < last.version
        || again.frames[0].presentationVer < last.presentationVer || again.frames[0].turnSeq < last.turnSeq
        || again.frames[0].presentationVer === last.presentationVer && again.frames[0].presentationHash !== last.presentationHash) continue;
      overlap = { startedAt: start, endedAt: end, durationMs: end - start, frames: a.length + b.length,
        instances: [hash(old.instance),hash(fresh.instance)], reconnect: true }; break;
    }
    need(overlap, 'continuous_overlap_not_proven');
    need(negatives.size === 2, 'negative_probes_required');
    const before = samples.filter(s => s.stage === 'before'), after = samples.filter(s => s.stage === 'after');
    need(before.length === 1 && after.length === 1 && before[0].at <= Math.min(...all.map(c => c.openedAt))
      && after[0].at >= Math.max(...all.flatMap(c => c.frames.map(f => f.at))) && after[0].at > before[0].at, 'money_bookends_required');
    const first = before[0], last = after[0];
    need(!first.reservations.length && !first.hands && !last.reservations.length && !last.hands, 'unsettled_money');
    need(samples.some(s => s.stage === 'during' && s.at >= overlap.startedAt && s.at < overlap.endedAt && s.reservations.length)
      && samples.some(s => s.stage === 'during' && s.at >= overlap.startedAt && s.at < overlap.endedAt && s.hands > 0), 'active_money_not_observed');
    const baseline = new Map(first.ledger.map(e => [e.id,e]));
    need(first.ledger.every(e => last.ledger.some(x => equal(x,e))), 'ledger_history_changed');
    need(first.settlements.every(e => last.settlements.some(x => equal(x,e))), 'settlement_history_changed');
    const delta = last.ledger.filter(e => !baseline.has(e.id));
    need(last.ledger.filter(e => e.amountCents < 0).every(e => last.settlements.some(s => s.roundId === e.roundId
      && s.actorId === e.actorId)), 'consumption_without_settlement');
    need(delta.some(e => e.type === 'payout' && e.amountCents > 0) && delta.some(e => e.amountCents < 0), 'settlement_not_observed');
    for (const actor of manifest.actors) need(BigInt(last.balances.find(x => x.actorId === actor).balanceCents)
      - BigInt(first.balances.find(x => x.actorId === actor).balanceCents) === delta.filter(e => e.actorId === actor)
        .reduce((sum,e) => sum + BigInt(e.amountCents),0n), 'balance_mismatch');
    return { schemaVersion: 1, status: 'evidence-complete-review-required', acceptance: false,
      sha: manifest.sha, origin: target.origin, serviceId: target.serviceId, projectId: target.projectId,
      runHash: hash(manifest.runId), scopeHash: hash([manifest.roomId,manifest.actors]),
      startedAt: manifest.startedAt, endedAt: manifest.endedAt, events: count, overlap,
      walletEffects: delta.length, negativeProbes: ['wrong-room','revoked-session'],
      limitations: ['operator-supplied-evidence-not-authenticated-by-this-tool', 'instance-claims-need-independent-provenance-review',
        'no-deploy-or-game-executed-by-this-tool'] };
  }
  return Object.freeze({ observe(row) {
    need(!poisoned, 'observer_poisoned');
    try { observe(row); } catch (error) { poisoned = true; throw error; }
  }, finish });
}

export const F11_HELP = `F11 evidence review (offline; no sockets, games, accounts, database writes or deploys).
  node tools/run-shared-table-qa.mjs --f11 --help
  node tools/run-shared-table-qa.mjs --f11 --run --manifest <private.json> --events <private.ndjson>
Required manifest: schemaVersion=1, sha=<full lowercase SHA>, syntheticOnly=true,
  ${Object.entries(target).map(([key,value]) => `${key}=${value}`).join(', ')}
  runId=f11-..., API-generated roomId/actor UUIDs, ownership=<creation/absence/SQL-readback receipt>,
  startedAt/endedAt=epoch-ms (2-15 minutes). Opening demo transactions are retained and verified.
Input: chronological event objects with type + at. target at both bookends contains
  the manifest target/scope, source=provider-api, engineSha/vercelSha, healthStatus=200,
  ready=true, suspended=false, syntheticOnly=true. Obtain from fresh provider metadata.
open: connectionId, connectionNonce, actorId, roomId, instanceProof={source:render-app-log,
  logId,instanceId,connectionNonce,serviceId,sha,at}; correlate the SAME socket to its app log.
  Rndr-Id, request logs, old/new labels and separate version HTTP calls are NOT instance evidence.
frame: connectionId, frame=<actual shared-room-state>; close: connectionId, code.
negative: source=socket-capture, probe=wrong-room|revoked-session, connectionId, actorId,
  roomId, status=401|403|1008, stateFrames=0. Use a separate rejected socket for each probe.
money: source=preview-sql, stage=before|during|after, roomId, actors, neonProjectId,
  branchId, database, balances, reservations, hands, ledger, settlements (F11_MONEY_SQL export).
Preparation after human approval: bind saved synthetic publication/accounts to scope;
  capture one old socket and one new-instance socket concurrently for >=30 seconds;
  run continuous synthetic hands with normal 20s/15s windows throughout deployment;
  retain all snapshots/presentation events, correlate dealer events on BOTH sockets;
  observe reservations, consumption and a payout; retain 1012 + same-hand reconnect;
  run wrong-room/revoked-session probes; finish all hands and take final SQL snapshot.
  Revisions may advance. Never pause clocks or change rules to manufacture overlap.
Live collection: node tools/run-f11-preview.mjs --help (explicit --run only).
  Requires reviewed socket identity headers and correlated Render app logs at the frozen SHA.
Output is projected/hashes only, never headers, cookies, tokens, raw text or exceptions.
Exit 0 means evidence complete for HUMAN REVIEW, never production acceptance.
Exit 1 means unverifiable/invalid evidence. Instance IDs in operator input are claims,
  NOT proof of real instances until independently correlated with runtime evidence.
  No default live driver or implicit --run.
Rollback belongs to the separately approved run: stop new synthetic bets, settle/release
  existing obligations, preserve captures, then deploy the frozen rollback SHA explicitly.
`;

export async function runF11EvidenceCli(args, { read = readFile, size = stat, output = console.log } = {}) {
  if (args.length === 1 && args[0] === '--help') { output(F11_HELP); return 0; }
  if (args.length !== 5 || args[0] !== '--run' || args[1] !== '--manifest' || args[3] !== '--events') {
    output('f11_explicit_run_and_evidence_required'); return 1;
  }
  try {
    need((await size(args[2])).size <= 16384 && (await size(args[4])).size <= 32 * 1024 * 1024, 'input_too_large');
    const observer = createF11Observer(JSON.parse(await read(args[2], 'utf8')));
    for (const line of (await read(args[4], 'utf8')).split(/\r?\n/)) if (line.trim()) observer.observe(JSON.parse(line));
    output(JSON.stringify(observer.finish())); return 0;
  } catch (error) {
    // No parser, filesystem, transport or SQL error text is safe to echo.
    const code = typeof error?.code === 'string' && /^f11_[a-z_]+$/.test(error.code) ? error.code : 'f11_evidence_unavailable';
    output(JSON.stringify({ status: 'unverifiable', acceptance: false, code })); return 1;
  }
}
