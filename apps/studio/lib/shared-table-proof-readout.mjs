import { createOperatorStore } from '../../../packages/operators/server/operator-store.mjs';
import { isPresentationRoom, roomGame } from '../../../packages/presentation/contracts/presentation-room.mjs';
import { validateStudioScope, canonicalStudioJson, StudioStorageError } from '../../../packages/studio-registry/server/document-contract.mjs';
import { isAdministratorRole } from '../../../packages/studio-access/account-role.mjs';
import { verifyShoe } from '../../../services/game/games/blackjack/shoe-proof.mjs';
import { verifyChain } from '../../../services/game/games/blackjack/table/audit-chain.mjs';

const fail = (code, status = 503) => { throw new StudioStorageError(code, status); };
const id = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value);
const parse = value => { try { return JSON.parse(value); } catch { fail('studio_shared_proof_corrupt'); } };
const summary = shoe => ({ shoeId: shoe.shoeId, commitment: shoe.commitment, openedAt: shoe.openedAt,
  ...(shoe.closedAt != null ? { closedAt: shoe.closedAt, verdict: shoe.verdict } : {}) });

function traceRounds(audit, roomId, shoeId, { checked, complete, proofVerified }) {
  const unavailable = reason => ({ status: 'unavailable', reason });
  const invalid = reason => ({ status: 'failed', reason });
  if (!checked.ok) return invalid('audit_invalid');
  if (!complete) return unavailable('audit_incomplete');
  if (!proofVerified) return invalid('proof_unverified');
  const sequence = value => Number.isSafeInteger(value) && value > 0;
  const payload = row => { try { const value = JSON.parse(row.payload); return value && typeof value === 'object' && !Array.isArray(value) ? value : null; } catch { return null; } };
  const rows = new Map(audit.map(row => [row.seq, row]));
  const own = audit.filter(row => row.room === roomId);
  const engines = own.filter(row => row.type?.startsWith('engine.')).map(row => ({ row, value: payload(row) }));
  const drawn = engines.filter(({ value }) => value?.shoeId === shoeId && Array.isArray(value.draws) && value.draws.length);
  if (!drawn.length) return unavailable('round_binding_missing');
  const starts = own.filter(row => row.type === 'round.started').map(row => ({ row, value: payload(row) }));
  const references = new Map(), usedTriggers = new Set();
  for (const { row, value } of drawn) {
    if (row.round_id == null || row.parent == null) return unavailable('round_binding_missing');
    if (!id(row.round_id) || !sequence(row.parent)) return invalid('round_binding_invalid');
    const cause = rows.get(row.parent);
    if (!cause || cause.room !== roomId || cause.seq >= row.seq
      || row.type !== 'engine.start' && cause.round_id !== row.round_id
      || value.cause?.eventId !== undefined && value.cause.eventId !== row.parent) return invalid('round_binding_invalid');
    if (references.has(row.round_id)) continue;
    const engineStarts = engines.filter(entry => entry.row.type === 'engine.start' && entry.row.round_id === row.round_id);
    if (!engineStarts.length) return unavailable('round_binding_missing');
    if (engineStarts.length !== 1) return invalid('round_binding_invalid');
    const start = engineStarts[0];
    if (start.row.parent == null) return unavailable('round_binding_missing');
    if (!sequence(start.row.parent) || start.value?.shoeId !== shoeId || start.row.seq > row.seq) return invalid('round_binding_invalid');
    const trigger = rows.get(start.row.parent), triggerPayload = trigger && payload(trigger);
    if (!trigger || trigger.room !== roomId || trigger.seq >= start.row.seq
      || !(trigger.type === 'player.ready' || trigger.type === 'table.tick' && triggerPayload?.kind === 'window.close')) return invalid('round_binding_invalid');
    // The coordinator records round.started before it has a round ID. Its
    // triggerEvent and engine.start.parent identify the same committed cause;
    // nearest timestamps, ordering alone and the current config head do not.
    const matching = starts.filter(entry => entry.value?.triggerEvent === trigger.seq);
    if (!matching.length) return unavailable('round_binding_missing');
    if (matching.length !== 1) return invalid('round_binding_invalid');
    const started = matching[0];
    if (started.value.configVersion == null) return unavailable('round_binding_missing');
    if (!id(started.value.configVersion) || started.row.seq <= trigger.seq || started.row.seq >= start.row.seq
      || started.row.round_id != null && started.row.round_id !== row.round_id || usedTriggers.has(trigger.seq)) return invalid('round_binding_invalid');
    usedTriggers.add(trigger.seq);
    references.set(row.round_id, { roomId, shoeId, roundId: row.round_id, configVersion: started.value.configVersion });
  }
  return { status: 'verified', references: [...references.values()] };
}

function request(query) {
  const entries = query instanceof URLSearchParams ? [...query] : Object.entries(query ?? {});
  if (entries.some(([key]) => !['roomId', 'shoeId'].includes(key)) || new Set(entries.map(([key]) => key)).size !== entries.length)
    fail('studio_shared_proof_request_rejected', 400);
  const { roomId, shoeId } = Object.fromEntries(entries);
  if (!id(roomId) || shoeId !== undefined && !id(shoeId)) fail('studio_shared_proof_request_rejected', 400);
  return { roomId, shoeId: shoeId ?? null };
}

// Verify on the server. Other rooms' audit payloads and every open shoe's
// nonce, random samples and future cards are never returned to the browser.
function project(row, roomId, shoeId) {
  if (!row || !Array.isArray(row.shoes) || !Array.isArray(row.audit)) fail('studio_shared_proof_corrupt');
  const shoes = row.shoes.map(parse), selected = row.selected == null ? null : parse(row.selected);
  for (const shoe of [...shoes, ...(selected ? [selected] : [])]) {
    if (shoe.room !== roomId || !id(shoe.shoeId) || !/^[a-f0-9]{64}$/.test(shoe.commitment))
      fail('studio_shared_proof_corrupt');
  }
  if (shoeId && (!selected || selected.shoeId !== shoeId)) fail('studio_shared_proof_not_found', 404);
  const audit = row.audit.map(parse), total = Number(row.total);
  if (!Number.isSafeInteger(total) || total < audit.length) fail('studio_shared_proof_corrupt');
  const checked = audit.length && audit[0].seq !== 1 ? { ok: false, reason: 'sequence must start at genesis' } : verifyChain(audit);
  const complete = total === audit.length;
  const chain = { ok: checked.ok && complete, complete, count: audit.length, total, head: checked.head ?? null,
    ...(!checked.ok ? { reason: checked.reason } : !complete ? { reason: 'Audit exceeds the bounded verification window' } : {}) };
  let view = selected ? summary(selected) : null;
  if (selected?.closedAt != null) {
    const proof = selected.proof;
    const verification = verifyShoe(proof, selected.commitment);
    const own = [...verification.checks, { name: 'Shoe identity matches stored receipt', pass: proof?.shoeId === selected.shoeId }];
    const checks = [...own, { name: 'Complete persisted global audit chain', pass: chain.ok }];
    const draws = audit.filter(a => a.room === roomId && a.type?.startsWith('engine.'))
      .map(a => parse(a.payload)).filter(p => p.shoeId === selected.shoeId).flatMap(p => p.draws ?? []);
    checks.push({ name: 'Proof draws match persisted engine events', pass: chain.ok && JSON.stringify(draws) === JSON.stringify(proof?.commandDraws) });
    // An intact chain prefix beyond the bounded window cannot verify the draws,
    // but it is not evidence of tampering either: report it as incomplete.
    const incomplete = checked.ok && !complete && own.every(c => c.pass);
    const status = checks.every(c => c.pass) ? 'verified' : incomplete ? 'incomplete' : 'failed';
    view = { ...view, proof, rawProof: JSON.stringify(proof), verification: { ...verification, checks, status },
      traceability: traceRounds(audit, roomId, selected.shoeId, { checked, complete, proofVerified: status === 'verified' }) };
  }
  return { roomId, shoes: shoes.map(summary), selected: view, chain };
}

export function createSharedTableProofReadout({ repository, scope } = {}) {
  scope = validateStudioScope(scope);
  if (!repository?.transaction || !repository?.withTransactionClient) throw new TypeError('Scoped Studio repository required');
  const handler = async context => {
    let sameScope = false;
    try { sameScope = canonicalStudioJson(validateStudioScope(context.scope)) === canonicalStudioJson(scope); } catch {}
    if (!sameScope || !isAdministratorRole(context.actor?.role) || typeof context.actor?.user !== 'string' || !context.actor.user.trim())
      fail('studio_shared_proof_request_rejected', 403);
    const { roomId, shoeId } = request(new URL(context.request.url).searchParams);
    return repository.transaction(() => repository.withTransactionClient(async client => {
      const administration = await repository.readDocument('administration');
      const room = administration?.value?.rooms?.find(r => r.id === roomId);
      if (!isPresentationRoom(room) || roomGame(room) !== 'blackjack') fail('studio_shared_proof_not_found', 404);
      const operators = await createOperatorStore({ sql: client, scope, transaction: work => repository.withTransactionClient(work) });
      const operator = await operators.getOperatorById(room.operatorId);
      const pack = operator?.status === 'active' ? await operators.getCurrentPackage(room.operatorId) : null;
      if (!pack?.tables.includes(roomId)) fail('studio_shared_proof_not_found', 404);
      // A single SQL statement gives shoes and global audit the same MVCC snapshot.
      // This route has no schema installer or game/wallet writer.
      const result = await client.query(`/* studio:shared-table-proof */
        SELECT
          ARRAY(SELECT body FROM croupier_game.shared_table_shoes WHERE room_id=$3 ORDER BY body::jsonb->>'openedAt' DESC,shoe_id LIMIT 50) AS shoes,
          (SELECT body FROM croupier_game.shared_table_shoes WHERE room_id=$3 AND shoe_id=$4) AS selected,
          ARRAY(SELECT body FROM croupier_game.shared_table_audit ORDER BY seq LIMIT 10000) AS audit,
          (SELECT count(*) FROM croupier_game.shared_table_audit) AS total
        WHERE $1::text IS NOT NULL AND $2::text IS NOT NULL`, [scope.environment, scope.workspaceId, roomId, shoeId]);
      return project(result.rows[0], roomId, shoeId);
    }));
  };
  return { handlers: new Map([['GET /studio/api/admin/shared-table-proof', handler]]) };
}
