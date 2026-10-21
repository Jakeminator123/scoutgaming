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
//                                     credit(p, {amount, kind, key}) -> {ledgerId}
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
//   store.outbox.{pending(), ack(row, status)}  delivery after COMMIT
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
export const tickIdOf = (roomId, kind, anchor, scheduledAt) => `${roomId}:${kind}:${anchor}:${scheduledAt}`;

export const TICK_OUTCOMES = Object.freeze(['applied', 'superseded', 'rejected', 'blocked']);
