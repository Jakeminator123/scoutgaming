// K03: the game audit hash chain (O01-svar 2.11). One global chain; every adapter's A-writer
// builds rows with chainRow and verifies with verifyChain. The serialization is Kevin's
// server/game-audit.mjs @ 5aa7ed1 (event()): payload stored as JSON text and
// hash = sha256(JSON.stringify({room, roundId, at, parent, type, payload, previous})).
import { digest } from '../shoe-proof.mjs';

export const GENESIS = 'genesis';

export function chainRow(previous, { room, roundId = null, at, parent = null, type, payload }) {
  const data = JSON.stringify(payload);
  const hash = digest({ room, roundId: roundId ?? null, at, parent, type, payload: data, previous });
  return { room, round_id: roundId ?? null, at, parent, type, payload: data, previous_hash: previous, hash };
}

// rows: contiguous global seq range. `previous` is the hash before rows[0] (GENESIS for seq 1).
export function verifyChain(rows, previous = GENESIS) {
  let prev = previous, seq = rows[0]?.seq;
  for (const row of rows) {
    if (row.seq !== seq) return { ok: false, seq: row.seq, reason: 'sequence gap' };
    if (row.previous_hash !== prev) return { ok: false, seq: row.seq, reason: 'previous hash mismatch' };
    const expect = digest({ room: row.room, roundId: row.round_id, at: row.at, parent: row.parent, type: row.type, payload: row.payload, previous: prev });
    if (row.hash !== expect) return { ok: false, seq: row.seq, reason: 'hash mismatch' };
    prev = row.hash; seq++;
  }
  return { ok: true, head: rows.length ? { seq: rows.at(-1).seq, hash: prev } : null };
}
