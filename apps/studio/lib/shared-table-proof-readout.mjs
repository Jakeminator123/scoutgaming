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
    const checks = [...verification.checks, { name: 'Shoe identity matches stored receipt', pass: proof?.shoeId === selected.shoeId },
      { name: 'Complete persisted global audit chain', pass: chain.ok }];
    const draws = audit.filter(a => a.room === roomId && a.type?.startsWith('engine.'))
      .map(a => parse(a.payload)).filter(p => p.shoeId === selected.shoeId).flatMap(p => p.draws ?? []);
    checks.push({ name: 'Proof draws match persisted engine events', pass: chain.ok && JSON.stringify(draws) === JSON.stringify(proof?.commandDraws) });
    view = { ...view, proof, rawProof: JSON.stringify(proof), verification: { ...verification, checks,
      status: checks.every(c => c.pass) ? 'verified' : 'failed' } };
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
