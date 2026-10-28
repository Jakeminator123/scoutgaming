// K03: port contract for the shared blackjack table (O01-svar 2.1). SQL-free by design:
// J07 binds every port to the already locked Postgres client; this module only defines
// the shapes, the shared errors and the deterministic keys both sides must agree on.
//
// store.runLocked(lockPlan, work) is the unit of work. lockPlan = {global, rooms[], players[]}
// (sorted ids). The adapter takes G -> R(rooms, sorted) -> P(players, sorted) -> A before `work`,
// commits when `work` resolves and rolls everything back when it throws. A port call that needs
// a room or player outside the plan throws LockSetExceeded; the coordinator rolls back and
// retries with a larger plan (never widens a held lock set).
//
// Inside `work(tx)`:
//   tx.rooms      RoomStatePort       read(roomId) -> state|null, write(roomId, state)
//   tx.members    MembershipPort      get(roomId, actorId), list(roomId), put(roomId, member),
//                                     roomsOf(actorId) -> sorted active room ids
//   tx.presence   (MembershipPort)    get(roomId, actorId) -> last seen ms|null (read only here)
//   tx.receipts   CommandReceiptPort  get({roomId, actorId, commandId}), put(key, {fingerprint, result})
//   tx.ticks      TickPort            get(tickId), put({tickId, room, kind, outcome, result, blockedOn, committedAt})
//   tx.pause      PausePort           get(actorId) -> untilMs, extend(actorId, untilMs) -> MAX(existing, untilMs)
//   tx.wallet     WalletPort          available(p), gen(p), reservation(id),
//                                     reserve(p, {reservationId, roomId, kind, amount}) (absolute amount; 0 releases),
//                                     release(p, {reservationId}),
//                                     consume(p, {reservationId, key}) -> {ledgerId, amount},
//                                     debit(p, {amount, kind, key}) -> {ledgerId},
//                                     credit(p, {amount, kind, key}) -> {ledgerId},
//                                     currency(p) -> ledger currency (optional; recorded in settlements)
//                                     A domain refusal throws WalletDenied; anything else is an infrastructure error.
//   tx.audit      GameAuditPort       append({room, roundId, at, parent, type, payload}) -> {seq, hash} (global A-writer,
//                                     serialization in audit-chain.mjs), openShoe(row), closeShoe(row), shoe(shoeId),
//                                     engineDraws(room, shoeId)
//   tx.outbox     PresentationOutbox  put({roomId, auditSeq, talkId, ver, payload})
//   tx.config     ConfigPort          latest(roomId) -> configVersion, frozen(roomId, configVersion) -> config
//   tx.savepoint() -> handle, tx.rollbackTo(handle)   (blocked consume, O01 2.5; mechanics owned by J07)
//
// Outside a unit of work (no game state written):
//   store.read.{room, rooms, members, memberRooms, presence, tick, walletGen, reservation, available, pausedUntil}
//   store.presence.touch(roomId, actorId, at)   separate presence write (O01 2.2 `seen`)
//   store.outbox.{pending(), deliveredVer(roomId), ack(row, status)}  delivery after COMMIT.
//     deliveredVer(roomId) is the highest ver acked 'delivered' for the room. It only lets a
//     deliverer skip rows that are already known to be old; it is no ordering guarantee, since
//     two deliverers can both read it before either acks.
//   sink(row) -> 'applied' | 'stale'  the presentation receiver. Ordering is guaranteed there:
//     it applies a row only if row.ver > the last ver it accepted for row.roomId, as one atomic
//     check-and-set at the moment of applying (see createPresentationGate). It answers 'applied'
//     for that and for a redelivery of exactly the last accepted ver (ack lost; not applied
//     twice), and 'stale' for any older ver. So an older plan that arrives after a newer one
//     (parallel or retried delivery) is never applied. Anything else (throw, other value) is a
//     failed delivery and the row stays pending.
//   store.audit.verifyChain(fromSeq, toSeq)     global chain, never a per-room view
import { createHash } from 'node:crypto';

export class TableError extends Error {
  constructor(code, message) { super(message); this.name = 'TableError'; this.code = code; }
}

export class LockSetExceeded extends Error {
  constructor(need) { super('A lock outside the declared lock plan was needed'); this.name = 'LockSetExceeded'; this.need = need; }
}

// A domain refusal from the wallet (insufficient funds, missing reservation). Never used for
// connection or transaction failures: those must not produce a blocked receipt.
export class WalletDenied extends Error {
  constructor({ playerId, reservationId = null, walletGen, reason }) {
    super(`Wallet refused: ${reason}`); this.name = 'WalletDenied';
    Object.assign(this, { playerId, reservationId, walletGen, reason });
  }
}

const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;

// Full input fingerprint for the command receipt (O01 2.2).
export const fingerprint = input => createHash('sha256').update(JSON.stringify(canonical(input))).digest('hex');

// Unique ledger idempotency key (O01 2.5): (namespace, roomId, actorId, identity, affectedPlayerId, effect).
export const ledgerKey = ({ namespace, roomId, actorId, identity, playerId, effect }) =>
  JSON.stringify([namespace, roomId, actorId, identity, playerId, effect]);

// tickId = roomId : kind : anchor : scheduledAt, scheduledAt being the stored deadline (O01 2.3).
// The anchor is a list of identity parts (e.g. actor id and member generation). Each part is
// percent-encoded and the parts are joined by ',', so the anchor contains neither ':' nor an
// unescaped ',' and two different part lists (actor ids may contain anything) never give the
// same tickId.
export const tickAnchor = parts => parts.map(p => encodeURIComponent(String(p))).join(',');
export const tickIdOf = (roomId, kind, anchor, scheduledAt) => `${roomId}:${kind}:${tickAnchor(anchor)}:${scheduledAt}`;

// Reference receiver-side guard for the presentation sink (contract above). The check and the
// update of the last accepted ver happen in one synchronous step, so concurrent deliveries
// cannot interleave between them. A real receiver keeps lastAccepted durable and does the same
// as one compare-and-set.
// accept(row) -> 'new' (apply it now) | 'duplicate' (already applied) | 'stale' (never apply).
export function createPresentationGate() {
  const last = new Map();
  return {
    accept(row) {
      const prev = last.get(row.roomId) ?? 0;
      if (row.ver === prev) return 'duplicate';
      if (!(row.ver > prev)) return 'stale';
      last.set(row.roomId, row.ver);
      return 'new';
    },
    lastAccepted: roomId => last.get(roomId) ?? 0,
  };
}

export const TICK_OUTCOMES = Object.freeze(['applied', 'superseded', 'rejected', 'blocked']);
