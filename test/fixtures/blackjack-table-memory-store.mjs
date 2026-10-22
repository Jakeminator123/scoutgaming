// Test-only in-memory reference adapter for the K03 table ports (services/game/games/blackjack/table/ports.mjs).
// One mutex serializes units of work; each works on a private copy that replaces the state only
// on success, so a throw is a full rollback and a savepoint is a copy of that working state.
// The declared lock plan is enforced: touching a room or player outside it throws LockSetExceeded.
// No SQL, no SQLite and never a production fallback: J07 owns the Postgres adapter.
import { GENESIS, chainRow, verifyChain } from '../../services/game/games/blackjack/table/audit-chain.mjs';
import { LockSetExceeded, WalletDenied } from '../../services/game/games/blackjack/table/ports.mjs';

export const DEFAULT_CONFIG = Object.freeze({ limits: { min: 5, max: 2000, sideMax: 2000 }, chips: [1, 5, 10, 25, 100, 200, 500],
  refill: 1000, betMs: 20000, actionMs: 15000, leadMs: 700, cardMs: 500, language: 'en' });

const clone = v => v === undefined ? undefined : structuredClone(v);
const rkey = ({ roomId, actorId, commandId }) => JSON.stringify([roomId, actorId, commandId]);
const mkey = (roomId, actorId) => `${roomId}\u0000${actorId}`;

export function createMemoryTableStore({ hooks = {} } = {}) {
  let db = { rooms: {}, members: {}, presence: {}, receipts: {}, ticks: {}, pauses: {}, balances: {}, walletGen: {},
    reservations: {}, ledger: [], audit: [], shoes: {}, outbox: [], delivered: {},
    configs: { latest: 'v1', versions: { v1: { configVersion: 'v1', ...clone(DEFAULT_CONFIG) } } } };
  const failures = new Map(); // name -> calls to let through before failing once
  const stats = { units: 0, lockRetries: 0 };
  let tail = Promise.resolve();
  const acquire = () => { let release; const held = new Promise(r => { release = r; }); const prev = tail; tail = prev.then(() => held); return prev.then(() => release); };
  const maybeFail = name => {
    if (!failures.has(name)) return;
    const skip = failures.get(name);
    if (skip > 0) { failures.set(name, skip - 1); return; }
    failures.delete(name); throw new Error(`injected failure: ${name}`);
  };

  // Wallet arithmetic shared by units of work and the "other writer" test helpers.
  const available = (s, p) => (s.balances[p] ?? 0) - Object.values(s.reservations).filter(x => x.playerId === p).reduce((n, x) => n + x.amount, 0);
  function ledgerRow(s, p, kind, amount, key) {
    if (s.ledger.some(row => row.key === key)) throw new Error(`duplicate ledger key ${key}`);
    const before = s.balances[p] ?? 0;
    s.balances[p] = Math.round((before + amount) * 100) / 100;
    s.walletGen[p] = (s.walletGen[p] ?? 0) + 1;
    const row = { id: s.ledger.length + 1, playerId: p, kind, amountCents: Math.round(amount * 100), key };
    s.ledger.push(row);
    return row.id;
  }

  function makeTx(get, set, plan) {
    const room = id => { if (!plan.rooms.includes(id)) throw new LockSetExceeded({ rooms: [id] }); };
    const player = id => { if (!plan.players.includes(id)) throw new LockSetExceeded({ players: [id] }); };
    return {
      savepoint: async () => clone(get()),
      rollbackTo: async sp => { set(clone(sp)); },
      rooms: {
        read: async id => { room(id); return clone(get().rooms[id]) ?? null; },
        write: async (id, state) => { room(id); maybeFail('rooms.write'); get().rooms[id] = clone(state); },
      },
      members: {
        get: async (roomId, a) => { room(roomId); return clone(get().members[mkey(roomId, a)]) ?? null; },
        list: async roomId => { room(roomId); return Object.values(clone(get().members)).filter(m => m.roomId === roomId); },
        put: async (roomId, m) => { room(roomId); player(m.actorId); get().members[mkey(roomId, m.actorId)] = { ...clone(m), roomId }; },
        roomsOf: async a => { player(a); return Object.values(get().members).filter(m => m.actorId === a && m.active).map(m => m.roomId).sort(); },
      },
      presence: { get: async (roomId, a) => get().presence[mkey(roomId, a)] ?? null },
      receipts: {
        get: async k => { room(k.roomId); return clone(get().receipts[rkey(k)]) ?? null; },
        put: async (k, v) => { room(k.roomId); maybeFail('receipts.put'); if (get().receipts[rkey(k)]) throw new Error('duplicate receipt'); get().receipts[rkey(k)] = clone(v); },
      },
      ticks: {
        get: async id => clone(get().ticks[id]) ?? null,
        put: async row => { room(row.room); maybeFail('ticks.put'); if (get().ticks[row.tickId]) throw new Error('duplicate tick'); get().ticks[row.tickId] = clone(row); },
      },
      pause: {
        get: async a => { player(a); return get().pauses[a] ?? 0; },
        extend: async (a, until) => { player(a); return (get().pauses[a] = Math.max(get().pauses[a] ?? 0, until)); },
      },
      wallet: {
        available: async p => { player(p); return available(get(), p); },
        gen: async p => { player(p); return get().walletGen[p] ?? 0; },
        reservation: async id => { maybeFail('wallet.reservation'); return clone(get().reservations[id]) ?? null; },
        reserve: async (p, { reservationId, roomId, kind, amount }) => {
          player(p); const s = get(), cur = s.reservations[reservationId];
          if (amount - (cur?.amount ?? 0) > available(s, p)) throw new WalletDenied({ playerId: p, reservationId, walletGen: s.walletGen[p] ?? 0, reason: 'insufficient available' });
          if (amount <= 0) delete s.reservations[reservationId];
          else s.reservations[reservationId] = { playerId: p, roomId, kind, amount, gen: (cur?.gen ?? 0) + 1 };
        },
        release: async (p, { reservationId }) => { player(p); delete get().reservations[reservationId]; },
        consume: async (p, { reservationId, key }) => {
          player(p); const s = get(), res = s.reservations[reservationId];
          if (!res || res.playerId !== p) throw new WalletDenied({ playerId: p, reservationId, walletGen: s.walletGen[p] ?? 0, reason: 'no reservation' });
          if ((s.balances[p] ?? 0) < res.amount) throw new WalletDenied({ playerId: p, reservationId, walletGen: s.walletGen[p] ?? 0, reason: 'insufficient balance' });
          delete s.reservations[reservationId];
          return { ledgerId: ledgerRow(s, p, `consume:${res.kind}`, -res.amount, key), amount: res.amount };
        },
        debit: async (p, { amount, kind, key }) => {
          player(p); const s = get();
          if (amount > available(s, p)) throw new WalletDenied({ playerId: p, walletGen: s.walletGen[p] ?? 0, reason: 'insufficient available' });
          return { ledgerId: ledgerRow(s, p, kind, -amount, key) };
        },
        credit: async (p, { amount, kind, key }) => { player(p); maybeFail('wallet.credit'); return { ledgerId: ledgerRow(get(), p, kind, amount, key) }; },
      },
      audit: {
        // The A-writer: head read and insert in one serialized step.
        append: async row => {
          maybeFail('audit.append'); const s = get();
          const out = { seq: s.audit.length + 1, ...chainRow(s.audit.at(-1)?.hash ?? GENESIS, row) };
          s.audit.push(out); return { seq: out.seq, hash: out.hash };
        },
        openShoe: async row => { get().shoes[row.shoeId] = clone(row); },
        closeShoe: async row => { Object.assign(get().shoes[row.shoeId], clone(row)); },
        shoe: async id => clone(get().shoes[id]) ?? null,
        engineDraws: async (room, shoeId) => get().audit.filter(e => e.room === room && e.type.startsWith('engine.'))
          .map(e => JSON.parse(e.payload)).filter(p => p.shoeId === shoeId).flatMap(p => p.draws ?? []),
      },
      outbox: { put: async row => { maybeFail('outbox.put'); get().outbox.push({ ...clone(row), status: 'pending' }); } },
      config: {
        latest: async () => get().configs.latest,
        frozen: async (roomId, v) => { const c = get().configs.versions[v]; if (!c) throw new Error(`unknown configVersion ${v}`); return clone(c); },
      },
    };
  }

  async function runLocked(plan, work) {
    if (hooks.beforeLock) await hooks.beforeLock(plan);
    const release = await acquire();
    try {
      stats.units++;
      let state = clone(db);
      const out = await work(makeTx(() => state, v => { state = v; }, plan));
      db = state;
      return clone(out);
    } catch (e) { if (e instanceof LockSetExceeded) stats.lockRetries++; throw e; }
    finally { release(); }
  }

  return {
    runLocked,
    read: {
      room: async id => clone(db.rooms[id]) ?? null,
      rooms: async () => Object.keys(db.rooms).sort(),
      members: async roomId => Object.values(clone(db.members)).filter(m => m.roomId === roomId),
      memberRooms: async a => Object.values(db.members).filter(m => m.actorId === a && m.active).map(m => m.roomId).sort(),
      presence: async (roomId, a) => db.presence[mkey(roomId, a)] ?? null,
      tick: async id => clone(db.ticks[id]) ?? null,
      walletGen: async p => db.walletGen[p] ?? 0,
      reservation: async id => clone(db.reservations[id]) ?? null,
      available: async p => available(db, p),
      pausedUntil: async a => db.pauses[a] ?? 0,
    },
    presence: { touch: async (roomId, a, at) => { db.presence[mkey(roomId, a)] = at; } },
    outbox: {
      pending: async () => clone(db.outbox.filter(r => r.status === 'pending')),
      deliveredVer: async roomId => db.delivered[roomId] ?? 0,
      ack: async (row, status) => {
        const r = db.outbox.find(x => x.roomId === row.roomId && x.ver === row.ver);
        r.status = status;
        if (status === 'delivered') db.delivered[row.roomId] = Math.max(db.delivered[row.roomId] ?? 0, row.ver);
      },
    },
    audit: { verifyChain: async (from = 1, to = db.audit.length) => verifyChain(db.audit.slice(from - 1, to), from === 1 ? GENESIS : db.audit[from - 2].hash) },
    // Test-only controls and inspection; not part of the port contract.
    test: {
      stats,
      failOnce: (name, skip = 0) => failures.set(name, skip),
      fund: (p, amount) => { db.balances[p] = (db.balances[p] ?? 0) + amount; db.walletGen[p] = (db.walletGen[p] ?? 0) + 1; },
      // Another main writer that respects reservations (O01 2.5): refuses to cut into them.
      otherWriterDebit: (p, amount) => { if (amount > available(db, p)) return false; ledgerRow(db, p, 'other-writer', -amount, `other:${db.ledger.length}`); return true; },
      // A writer outside the contract (or an aggregator refusal) that leaves reservations uncovered.
      uncoveredDebit: (p, amount) => ledgerRow(db, p, 'uncovered', -amount, `uncovered:${db.ledger.length}`),
      balance: p => db.balances[p] ?? 0,
      ledger: () => clone(db.ledger),
      audit: () => clone(db.audit),
      ticks: () => Object.values(clone(db.ticks)),
      receipts: () => Object.keys(db.receipts).length,
      reservations: () => clone(db.reservations),
      outbox: () => clone(db.outbox),
      publish: (version, overrides) => { db.configs.versions[version] = { configVersion: version, ...clone(DEFAULT_CONFIG), ...clone(overrides) }; db.configs.latest = version; },
      mutateRoom: (id, fn) => { fn(db.rooms[id]); },
      // Another wallet writer changing a reservation row directly (missing, shrunk or restored).
      mutateReservations: fn => { fn(db.reservations); },
      tamperAudit: (seq, payload) => { db.audit[seq - 1].payload = payload; },
    },
  };
}
