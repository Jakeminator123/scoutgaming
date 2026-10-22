// K03: shared blackjack table coordinator (O01-svar 2.1-2.11). It computes the lock plan, reads
// through the ports in ports.mjs, calls the pure K02 core (`step`) and writes the result in one
// unit of work. No SQL, files, HTTP/WS, timers, media or lipsync: time comes from the injected
// clock, randomness from the injected random port, and every time-driven transition is a tick
// run by an independent scheduler (dueTicks + tick). Behaviour reference: Kevin's
// server/shared-table.mjs @ 5aa7ed1 (`:NNN` below), changed where O01 2.x decides otherwise.
import { BlackjackCoreError, newGame, publicView, step } from '../core.mjs';
import { verifyShoe } from '../shoe-proof.mjs';
import { LockSetExceeded, TableError, WalletDenied, fingerprint, ledgerKey, tickIdOf } from './ports.mjs';

export const TABLE_CONTRACT = 'blackjack-table/1';
export const PRESENTATION_CONTRACT = 'blackjack-presentation/1';
const PAUSE_MS = 86400000;                         // :350
const emptyBets = () => Array.from({ length: 7 }, () => ({ main: 0, pp: 0, tp: 0 }));
const sum = b => b.main + b.pp + b.tp;
const owned = (r, p) => r.owners.flatMap((o, i) => o === p ? [i] : []);
const sorted = ids => [...new Set(ids.filter(Boolean))].sort();
const fail = (code, message) => { throw new TableError(code, message); };
const ROOM_ID = /^[a-z0-9_-]{1,128}$/;             // Main room-<UUID> ids are 41 chars; ':' remains forbidden for tick identity.
const BET_OPS = new Set(['bet', 'undo', 'clear', 'doubleBets', 'allSeats', 'repeat']);
const OPS = new Set([...BET_OPS, 'join', 'leave', 'ready', 'act', 'insurance', 'next', 'pause', 'refill']);
// :348 demo-break block list: stand and declining insurance stay allowed.
const PAUSE_BLOCKS = new Set(['join', 'refill', 'bet', 'undo', 'doubleBets', 'allSeats', 'repeat', 'ready']);
const stakeReservation = (r, p) => `${r.roomId}:${r.windowId}:${p}:stake`;
const insuranceReservation = (r, p) => `${r.roomId}:${r.roundId}:${p}:insurance`;
// Ticks whose wallet refusal (reservation or consume) is recorded as `blocked` (O01 2.5).
const BLOCKABLE = new Set(['window.close', 'insurance.timeout']);

export function createTableCoordinator({ store, clock, random, absentMs = 120000, onlineMs = 15000, maxLockAttempts = 4 }) {
  if (!store?.runLocked || typeof clock?.now !== 'function' || !random) throw new TypeError('store, clock and random are required');
  const now = () => clock.now();

  // ---- shared helpers -------------------------------------------------------------------
  const audit = async (tx, room, roundId, type, payload, parent = null) =>
    (await tx.audit.append({ room, roundId: roundId ?? null, at: now(), parent, type, payload })).seq;

  async function openShoe(tx, room, payload) {
    await tx.audit.openShoe({ shoeId: payload.shoeId, room, commitment: payload.commitment, openedAt: now() });
    await audit(tx, room, null, 'shoe.opened', payload);
  }
  // Kevin's audit.sync (game-audit.mjs:9-17): the closed proof is checked against the stored
  // commitment and the engine draws recorded in the global audit.
  async function closeShoe(tx, room, { shoeId, proof }) {
    const stored = await tx.audit.shoe(shoeId);
    const full = { ...proof, commandDraws: await tx.audit.engineDraws(room, shoeId) };
    const verification = stored?.commitment ? verifyShoe(full, stored.commitment)
      : { status: 'incomplete', checks: [], disclaimer: 'Shoe began before audit capture; no historical proof is claimed.' };
    await tx.audit.closeShoe({ shoeId, room, proof: full, verdict: verification.status, closedAt: now() });
    await audit(tx, room, null, 'shoe.closed', { shoeId, verification });
  }

  // K02 funding (core.mjs fund()): stake and insurance are funded only by the open reservation
  // per box; double/split only by free `available`. The wallet itself is never touched here.
  async function reservedFunding(tx, r, kind) {
    const reserved = {};
    const players = sorted(r.owners);
    for (const p of players) {
      const boxes = kind === 'stake' ? owned(r, p).filter(i => sum(r.bets[i]) > 0) : (r.insurance[p] ? handsOf(r, p).map(h => h.box) : []);
      if (!boxes.length) continue;
      const reservationId = kind === 'stake' ? stakeReservation(r, p) : insuranceReservation(r, p);
      const res = await tx.wallet.reservation(reservationId);
      const amounts = boxes.map(i => kind === 'stake' ? sum(r.bets[i]) : handsOf(r, p).filter(h => h.box === i).reduce((n, h) => n + h.stake / 2, 0));
      // Only a reservation that covers this player's boxes funds them; otherwise K02 refuses.
      const covered = res && res.amount === amounts.reduce((a, b) => a + b, 0);
      // A missing or non-matching stake or insurance reservation is a wallet refusal for this
      // player, decided before the core step, so window.close / insurance.timeout record `blocked`
      // (retried once the wallet or reservation generation changes) instead of a permanent
      // RESERVATION_INSUFFICIENT rejection. Never funded as zero: an accepted yes stays paid.
      if (!covered) throw new WalletDenied({ playerId: p, reservationId,
        walletGen: await tx.wallet.gen(p), reason: res ? `reservation does not cover the ${kind}` : 'no reservation' });
      boxes.forEach((b, i) => { reserved[b] = amounts[i]; });
    }
    return { reserved: { [kind]: reserved } };
  }
  const handsOf = (r, p) => (publicView(r.game).round?.hands ?? []).filter(h => r.owners[h.box] === p);

  // Runs K02 and writes its events: shoe.* first, then engine.<op> with Kevin's payload order
  // (:108) plus cause and ledger ids. `pay(out)` performs the wallet effects before the audit.
  async function engine(tx, r, cfg, command, funding, { parent, cause, pay }) {
    const before = publicView(r.game);   // sanitized projection only (K04 outbox), never raw state
    let out;
    try { out = step(r.game, command, { limits: cfg.limits }, { random, funding }); }
    catch (e) { if (e instanceof BlackjackCoreError) fail(e.code, e.message); throw e; }
    const ledgerIds = pay ? await pay(out) : null;
    r.game = out.state; r.roundId = out.state.roundId;
    r.roundPhase = out.state.paid ? 'collected' : out.view.round?.phase ?? null;
    let engineSeq = null, draws = 0;
    for (const e of out.events) {
      if (e.type === 'shoe.opened') await openShoe(tx, r.roomId, e.payload);
      else if (e.type === 'shoe.closed') await closeShoe(tx, r.roomId, e.payload);
      else {
        const { shoeId, version, draws: d, phase, ...params } = e.payload;
        draws += d.length;
        engineSeq = await audit(tx, r.roomId, e.roundId, e.type,
          { ...params, cause, shoeId, version, draws: d, phase, ...(ledgerIds?.length ? { ledgerIds } : {}) }, parent);
      }
    }
    return { out, engineSeq, draws, before };
  }

  // K04: the public facts a presentation receiver needs, written with the outbox row in the same
  // transaction: sanitized publicView before/after the committed step (no hole card, shoe order,
  // proof or private audit draws) and explicit public fields. Timing and deadlines stay server rules.
  const publicPresentation = (kind, r, { op = null, action = null, before = null } = {}) => ({
    contract: PRESENTATION_CONTRACT, kind, op, action, windowId: r.windowId, configVersion: r.configVersion,
    before, after: kind === 'window' ? null : publicView(r.game) });

  // Presentation plan (:201-217) without media: a server rule from the frozen config gives the
  // timing, the plan is stored in room state and written to the outbox in this transaction with
  // a stored version. Delivery happens only after COMMIT (deliverOutbox).
  async function present(tx, r, cfg, { out, engineSeq, draws, before }, action = null) {
    const startAt = now(), endAt = startAt + cfg.leadMs + draws * cfg.cardMs;
    const plan = { id: random.uuid(), startAt, endAt, turnAt: endAt };
    r.plan = plan;
    r.actionDeadline = ['decisions', 'insurance'].includes(r.roundPhase) ? endAt + cfg.actionMs : null;
    const ver = ++r.presentationVer;
    const seq = await audit(tx, r.roomId, r.roundId, 'presentation.plan',
      { planId: plan.id, language: cfg.language, startAt, endAt, status: 'scheduled; not a playback acknowledgement' }, engineSeq);
    await tx.outbox.put({ roomId: r.roomId, auditSeq: seq, talkId: plan.id, ver,
      payload: { roundId: r.roundId, planId: plan.id, language: cfg.language, startAt, endAt, events: out.publicEvents,
        presentation: publicPresentation('plan', r, { op: out.events.at(-1).type.slice('engine.'.length), action, before }) } });
  }

  // K04: a committed step without a presentation plan (collect, a newly opened betting window). It
  // never touches r.plan or any deadline; talkId is derived from the stored round/window identity.
  async function presentState(tx, r, cfg, kind, auditSeq, extra = {}) {
    const ver = ++r.presentationVer, at = now();
    await tx.outbox.put({ roomId: r.roomId, auditSeq, talkId: `${kind === 'window' ? r.windowId : r.roundId}:${kind}`, ver,
      payload: { roundId: kind === 'window' ? null : r.roundId, planId: null, language: cfg.language, startAt: at, endAt: at, events: [],
        presentation: publicPresentation(kind, r, extra) } });
  }

  async function createRoom(tx, roomId) {
    const configVersion = await tx.config.latest(roomId);
    await tx.config.frozen(roomId, configVersion);
    const created = newGame({ random });
    const r = { contract: TABLE_CONTRACT, roomId, version: 0, configVersion, windowId: random.uuid(), phase: 'bets',
      owners: Array(7).fill(null), seatGen: Array(7).fill(0), bets: emptyBets(), ready: [], history: {}, deadline: null,
      roundId: null, roundPhase: null, insurance: {}, actionDeadline: null, plan: null, leaving: [], boxesAfterRound: {},
      lastBets: {}, lastSettlement: {}, settledAt: null, presentationVer: 0, game: created.state };
    for (const e of created.events) await openShoe(tx, roomId, e.payload);
    return r;
  }

  // :248-252; a new window binds the newest published configVersion (O01 2.7).
  async function resetRound(tx, r) {
    for (const [pid, keep] of Object.entries(r.boxesAfterRound)) for (const i of owned(r, pid)) if (!keep.includes(i)) { r.owners[i] = null; r.seatGen[i]++; }
    Object.assign(r, { boxesAfterRound: {}, phase: 'bets', roundPhase: null, plan: null, bets: emptyBets(), ready: [], history: {},
      deadline: null, insurance: {}, leaving: [], actionDeadline: null, settledAt: null,
      windowId: random.uuid(), configVersion: await tx.config.latest(r.roomId) });
    const cfg = await tx.config.frozen(r.roomId, r.configVersion);
    // K04: placebets follows the betting window actually opened here, not collect or a poll.
    const seq = await audit(tx, r.roomId, null, 'presentation.window', { windowId: r.windowId, configVersion: r.configVersion });
    await presentState(tx, r, cfg, 'window', seq);
  }

  // :253-259 plus O01 2.5: the actor's open stake reservation in this room is released, a
  // bound insurance reservation is not. Releasing the last seat ends the membership (memberGen).
  async function releaseSeats(tx, r, pid) {
    for (const i of owned(r, pid)) { r.owners[i] = null; r.seatGen[i]++; r.bets[i] = { main: 0, pp: 0, tp: 0 }; }
    r.ready = r.ready.filter(x => x !== pid); delete r.history[pid];
    r.leaving = r.leaving.filter(x => x !== pid); delete r.boxesAfterRound[pid];
    if (r.phase === 'bets') await tx.wallet.release(pid, { reservationId: stakeReservation(r, pid) });
    const m = await tx.members.get(r.roomId, pid);
    if (m?.active) await tx.members.put(r.roomId, { ...m, active: false, memberGen: m.memberGen + 1 });
    if (r.phase === 'settled' && !r.owners.some(Boolean)) await resetRound(tx, r);
    if (r.phase === 'bets' && !r.bets.some(b => b.main)) r.deadline = null;
  }

  // Round start (:221-232), from the last `ready` or the window.close tick. Funding comes from
  // the open stake reservations; consume runs per player and a domain refusal throws WalletDenied.
  async function startRound(tx, r, cfg, { parent, origin, cause }) {
    if (r.phase !== 'bets' || !r.bets.some(b => b.main)) fail('NO_BETS', 'Place your bets please');
    const bettors = sorted(r.owners.filter((p, i) => p && sum(r.bets[i]) > 0));
    const funding = await reservedFunding(tx, r, 'stake');
    const startedSeq = await audit(tx, r.roomId, null, 'round.started',
      { owners: [...r.owners], bets: structuredClone(r.bets), configVersion: r.configVersion, triggerEvent: parent });
    const ledger = {};
    const result = await engine(tx, r, cfg, { op: 'start', bets: r.bets }, funding, { parent, cause, pay: async () => {
      for (const p of bettors) {
        const c = await tx.wallet.consume(p, { reservationId: stakeReservation(r, p), key: ledgerKey({ ...origin, roomId: r.roomId, playerId: p, effect: 'consume:stake' }) });
        ledger[p] = c.ledgerId;
      }
      return bettors.map(p => ledger[p]);
    } });
    for (const p of bettors) r.lastBets[p] = Object.fromEntries(owned(r, p).filter(i => r.bets[i].main).map(i => [i, { ...r.bets[i] }]));
    Object.assign(r, { phase: 'round', deadline: null, insurance: {}, history: {}, ready: [], settledAt: null });
    await present(tx, r, cfg, result);
    return { roundId: r.roundId, ledger, startedSeq };
  }

  // :233-241; the last decision or insurance.timeout consumes every bound insurance reservation.
  async function resolveInsurance(tx, r, cfg, { parent, origin, cause }) {
    const takers = sorted(Object.entries(r.insurance).filter(([, v]) => v).map(([p]) => p));
    const takeBoxes = [...new Set(takers.flatMap(p => handsOf(r, p).map(h => h.box)))];
    const funding = await reservedFunding(tx, r, 'insurance');
    const ledger = {};
    const result = await engine(tx, r, cfg, { op: 'insurance', roundId: r.roundId, takeBoxes }, funding, { parent, cause, pay: async () => {
      for (const p of takers) ledger[p] = (await tx.wallet.consume(p, { reservationId: insuranceReservation(r, p),
        key: ledgerKey({ ...origin, roomId: r.roomId, playerId: p, effect: 'consume:insurance' }) })).ledgerId;
      return takers.map(p => ledger[p]);
    } });
    await present(tx, r, cfg, result);
    return { ledger };
  }

  // :272-284 as the round.settle tick: wallet -> ledger id -> settlement -> audit (O01 2.5).
  async function settle(tx, r, cfg, { parent, origin, cause }) {
    const at = now(), receipts = [];
    const handsBefore = publicView(r.game).round.hands;
    const collected = await engine(tx, r, cfg, { op: 'collect', roundId: r.roundId }, null, { parent, cause, pay: async out => {
      const ids = [];
      for (const p of sorted(r.owners)) {
        const hands = handsBefore.filter(h => r.owners[h.box] === p);
        if (!hands.length) continue;
        const returned = out.effects.filter(e => e.kind === 'payout' && r.owners[e.box] === p).reduce((n, e) => n + e.amount, 0);
        const staked = hands.reduce((n, h) => n + h.stake + h.pp + h.tp + (h.insured || 0), 0);
        const ledgerId = returned > 0 ? (await tx.wallet.credit(p, { amount: returned, kind: 'payout',
          key: ledgerKey({ ...origin, roomId: r.roomId, playerId: p, effect: 'payout' }) })).ledgerId : null;
        const receipt = { roundId: r.roundId, settledAt: at, returned, staked, net: returned - staked, hands };
        r.lastSettlement[p] = receipt;
        await audit(tx, r.roomId, r.roundId, 'wallet.settlement', { playerId: p, ...receipt, ledgerId }, parent);
        receipts.push({ playerId: p, returned, staked, ledgerId });
        if (ledgerId) ids.push(ledgerId);
      }
      return ids;
    } });
    Object.assign(r, { phase: 'settled', actionDeadline: null, settledAt: at });
    await presentState(tx, r, cfg, 'collect', collected.engineSeq, { op: 'collect', before: collected.before });
    if (!r.owners.some(Boolean)) await resetRound(tx, r);
    return { receipts };
  }

  // ---- commands -------------------------------------------------------------------------
  async function lockPlanFor(actorId, input) {
    const r = await store.read.room(input.roomId);
    const players = [actorId];
    if (r && input.op === 'ready') players.push(...r.owners.filter((p, i) => p && sum(r.bets[i]) > 0));
    if (r && input.op === 'insurance') players.push(...r.owners);
    if (r && input.op === 'next') players.push(...r.leaving);   // next carries out pending exits
    const rooms = input.op === 'pause' ? [input.roomId, ...await store.read.memberRooms(actorId)] : [input.roomId];
    return { global: false, rooms: sorted(rooms), players: sorted(players) };
  }

  async function withLocks(planFn, work) {
    let lastError;
    for (let attempt = 1; attempt <= maxLockAttempts; attempt++) {
      const plan = await planFn(attempt);
      try { return await store.runLocked(plan, tx => work(tx, plan, attempt)); }
      catch (e) { if (!(e instanceof LockSetExceeded)) throw e; lastError = e; }
    }
    throw lastError;
  }

  async function command(ctx, input) {
    const actorId = ctx?.actorId;
    if (typeof actorId !== 'string' || !actorId || actorId === 'system') fail('ACTOR_REQUIRED', 'An authenticated player is required');
    if (!input || typeof input.roomId !== 'string' || !ROOM_ID.test(input.roomId)) fail('INVALID_ROOM', 'Invalid table link');
    if (typeof input.commandId !== 'string' || !input.commandId || input.commandId.length > 100) fail('REQUEST_ID_REQUIRED', 'Request ID required');
    if (!OPS.has(input.op)) fail('UNKNOWN_COMMAND', 'Unknown table command');
    const key = { roomId: input.roomId, actorId, commandId: input.commandId };
    const print = fingerprint({ actorId, input });
    const outcome = await withLocks(() => lockPlanFor(actorId, input), async (tx, plan) => {
      const prior = await tx.receipts.get(key);
      if (prior) {
        if (prior.fingerprint !== print) fail('REQUEST_REUSED', 'Request ID reused with different input');
        return { replay: true, result: prior.result };
      }
      const result = await apply(tx, plan, { actorId, name: ctx.name ?? null }, input);
      await tx.receipts.put(key, { fingerprint: print, result });
      return { replay: false, result };
    });
    // `seen` is a separate presence write after COMMIT; a replay writes nothing (O01 2.2).
    if (!outcome.replay) await store.presence.touch(input.roomId, actorId, now());
    return { result: outcome.result, replay: outcome.replay, snapshot: await snapshot(input.roomId, actorId) };
  }

  async function apply(tx, plan, { actorId, name }, input) {
    const t = now(), { op, roomId } = input;
    const origin = { namespace: 'command', actorId, identity: input.commandId };
    const pausedUntil = await tx.pause.get(actorId);
    if (pausedUntil > t && (PAUSE_BLOCKS.has(op) || (op === 'act' && input.action !== 'stand') || (op === 'insurance' && input.take)))
      fail('PAUSED', 'Your demo break is active for 24 hours');
    if (op === 'pause') return pause(tx, plan, actorId, input, t);
    let r = await tx.rooms.read(roomId);
    if (!r) { if (op !== 'join') fail('NO_ROOM', 'This table has not opened yet'); r = await createRoom(tx, roomId); }
    const cfg = await tx.config.frozen(roomId, r.configVersion);
    const me = await tx.members.get(roomId, actorId);
    const parent = await audit(tx, roomId, r.phase === 'bets' ? null : r.roundId, `player.${op}`,
      { playerId: actorId, commandId: input.commandId, action: input.action ?? null, seat: input.seat ?? null,
        field: input.field ?? null, chip: input.chip ?? null, take: input.take ?? null });
    const cause = { eventId: parent, source: 'player request' };
    let result = { op };
    const own = owned(r, actorId);
    if (op === 'join') {
      if (me?.active && r.leaving.includes(actorId)) fail('LEAVING', 'Your current hand is finishing before you leave');
      // Always compared with the stored generation (0 before the first join), also when inactive.
      if (input.memberGen !== (me?.memberGen ?? 0)) fail('STALE_COMMAND', 'Your seat changed. Reload the table');
      const seats = input.seats;
      if (!Array.isArray(seats) || !seats.length || seats.length > 7 || new Set(seats).size !== seats.length || seats.some(i => !Number.isInteger(i) || i < 0 || i > 6)) fail('INVALID_SEATS', 'Choose one or more boxes');
      for (const i of seats) {
        if (r.owners[i] === actorId) continue;
        if (r.owners[i]) fail('SEAT_TAKEN', 'That box was just taken. Choose another');
        if (input.seatGens?.[i] !== r.seatGen[i]) fail('STALE_COMMAND', 'That box was just taken. Choose another');
      }
      const inPlay = new Set(r.phase === 'round' ? (publicView(r.game).round?.hands ?? []).map(h => h.box) : []), later = [];
      for (const i of own) if (!seats.includes(i)) {
        if (inPlay.has(i)) { later.push(i); continue; }
        if (sum(r.bets[i])) fail('CLEAR_FIRST', 'Clear your bets before changing boxes');
        r.owners[i] = null; r.seatGen[i]++;
      }
      if (later.length) r.boxesAfterRound[actorId] = [...seats].sort(); else delete r.boxesAfterRound[actorId];
      for (const i of seats) if (r.owners[i] !== actorId) { r.owners[i] = actorId; r.seatGen[i]++; }
      const memberGen = me?.active ? me.memberGen : (me?.memberGen ?? 0) + 1;
      await tx.members.put(roomId, { actorId, name: name ?? me?.name ?? null, memberGen, active: true, joinedAt: me?.active ? me.joinedAt : t });
      result = { op, memberGen, seats: owned(r, actorId), seatGen: [...r.seatGen] };
    } else {
      if (!me?.active || !own.length) fail('NOT_SEATED', 'Choose your boxes and enter your name first');
      if (r.leaving.includes(actorId) && op !== 'leave') fail('LEAVING', 'Your current hand is finishing before you leave');
      if (op === 'leave') {
        if (input.memberGen !== me.memberGen) fail('STALE_COMMAND', 'Your seat changed. Reload the table');
        if (r.phase === 'round') { if (!r.leaving.includes(actorId)) r.leaving.push(actorId); }
        else await releaseSeats(tx, r, actorId);
      } else if (op === 'refill') {
        result.ledgerId = (await tx.wallet.credit(actorId, { amount: cfg.refill, kind: 'refill',
          key: ledgerKey({ ...origin, roomId, playerId: actorId, effect: 'refill' }) })).ledgerId;
      } else if (BET_OPS.has(op)) {
        if (r.phase !== 'bets') fail('BETTING_CLOSED', 'Betting is closed');
        if (input.windowId !== r.windowId) fail('STALE_COMMAND', 'This betting window has closed');
        // After the deadline the window.close tick owns the start; only clearing stays open (O01 2.5 retry).
        if (r.deadline && t >= r.deadline && op !== 'clear') fail('BETTING_CLOSED', 'Betting is closed');
        // Until the round starts, clear also withdraws `ready` and releases the own stake
        // reservation (e.g. after a refused consume); every other bet change waits on READY.
        if (r.ready.includes(actorId) && op !== 'clear') fail('READY', 'You are ready for this round');
        if (op === 'clear') r.ready = r.ready.filter(x => x !== actorId);
        const prior = structuredClone(r.bets), next = structuredClone(r.bets), mine = [...own];
        if (op === 'bet') {
          // :393 a seated player opens a free box with a main bet
          if (!mine.includes(input.seat) && input.field === 'main' && Number.isInteger(input.seat) && input.seat >= 0 && input.seat < 7 && !r.owners[input.seat]) {
            r.owners[input.seat] = actorId; r.seatGen[input.seat]++; mine.push(input.seat);
          }
          if (!mine.includes(input.seat) || !['main', 'pp', 'tp'].includes(input.field)) fail('NOT_YOUR_BOX', 'Choose one of your boxes');
          if (!cfg.chips.includes(input.chip)) fail('INVALID_CHIP', 'Choose a chip from this table');
          if (input.field !== 'main' && !next[input.seat].main) fail('NO_BETS', 'Place your bets please');
          next[input.seat][input.field] += input.chip;
        } else if (op === 'repeat') {
          const last = Object.entries(r.lastBets[actorId] ?? {}).filter(([i]) => mine.includes(Number(i)));
          if (!last.length) fail('NO_REPEAT', 'No previous bet to repeat');
          for (const [i, b] of last) next[i] = { ...b };
        } else if (op === 'undo') {
          const old = r.history[actorId]?.pop(); if (old) for (const i of mine) next[i] = old[i];
        } else for (const i of mine) for (const f of ['main', 'pp', 'tp']) {
          if (op === 'clear') next[i][f] = 0;
          if (op === 'doubleBets') next[i][f] *= 2;
          if (op === 'allSeats' && f === 'main') { if (!cfg.chips.includes(input.chip)) fail('INVALID_CHIP', 'Choose a chip from this table'); next[i].main += input.chip; }
        }
        const L = cfg.limits;
        for (const b of next) if (b.main > L.max || b.pp > L.sideMax || b.tp > L.sideMax || (b.main > 0 && b.main < L.min)) fail('LIMITS', 'Outside the table limits');
        const total = mine.reduce((n, i) => n + sum(next[i]), 0);
        try { await tx.wallet.reserve(actorId, { reservationId: stakeReservation(r, actorId), roomId, kind: 'stake', amount: total }); }
        catch (e) { if (e instanceof WalletDenied) fail('INSUFFICIENT_BALANCE', 'Insufficient demo balance'); throw e; }
        if (op !== 'undo') { (r.history[actorId] ??= []).push(prior); r.history[actorId] = r.history[actorId].slice(-100); }
        r.bets = next;
        if (!r.deadline && next.some(b => b.main)) r.deadline = t + cfg.betMs;
        if (!next.some(b => b.main)) r.deadline = null;
        result.reserved = total;
      } else if (op === 'ready') {
        if (r.phase !== 'bets' || !own.some(i => r.bets[i].main)) fail('NO_BETS', 'Place your bets please');
        if (input.windowId !== r.windowId) fail('STALE_COMMAND', 'This betting window has closed');
        if (r.deadline && t >= r.deadline) fail('BETTING_CLOSED', 'Betting is closed');
        if (!r.ready.includes(actorId)) r.ready.push(actorId);
        const seated = [];
        for (const p of sorted(r.owners)) if (t - ((await tx.presence.get(roomId, p)) ?? -Infinity) < onlineMs || p === actorId) seated.push(p);
        result.started = false;
        if (seated.every(p => r.ready.includes(p))) {
          // A refused consume leaves `ready` accepted and the start to the window.close tick (O01 2.5).
          const sp = await tx.savepoint();
          try { result = { ...result, started: true, ...(await startRound(tx, r, cfg, { parent, origin, cause })) }; }
          catch (e) { if (!(e instanceof WalletDenied)) throw e; await tx.rollbackTo(sp); result.waitingOn = e.playerId; }
        }
      } else if (op === 'act') {
        if (r.phase !== 'round' || r.roundPhase !== 'decisions' || t < r.plan.turnAt) fail('NOT_YOUR_TURN', 'Wait for your turn');
        if (input.roundId !== r.roundId) fail('STALE_COMMAND', 'Command belongs to another round');
        if (t >= r.actionDeadline) fail('DEADLINE_PASSED', 'Time is up for this decision');
        const v = publicView(r.game).round, hand = v.hands[v.active];
        if (r.owners[hand.box] !== actorId) fail('NOT_YOUR_TURN', 'It is another player’s turn');
        const funding = { available: await tx.wallet.available(actorId) };
        const res = await engine(tx, r, cfg, { op: 'act', action: input.action, roundId: input.roundId, turnSeq: input.turnSeq, box: input.box, handIndex: input.handIndex },
          funding, { parent, cause, pay: async out => {
            const ids = [];
            for (const e of out.effects.filter(x => x.direction === 'debit')) {
              try { ids.push((await tx.wallet.debit(actorId, { amount: e.amount, kind: e.kind, key: ledgerKey({ ...origin, roomId, playerId: actorId, effect: `debit:${e.kind}` }) })).ledgerId); }
              catch (err) { if (err instanceof WalletDenied) fail('INSUFFICIENT_BALANCE', 'Insufficient demo balance'); throw err; }
            }
            return ids;
          } });
        await present(tx, r, cfg, res, input.action);
        const debits = res.out.effects.filter(e => e.direction === 'debit');
        if (debits.length) result.debits = debits.map(e => ({ kind: e.kind, amount: e.amount }));
      } else if (op === 'insurance') {
        if (r.phase !== 'round' || r.roundPhase !== 'insurance' || t < r.plan.turnAt || typeof input.take !== 'boolean'
          || Object.hasOwn(r.insurance, actorId) || !handsOf(r, actorId).length) fail('INSURANCE_UNAVAILABLE', 'Insurance is not available');
        if (input.roundId !== r.roundId || input.phase !== 'insurance') fail('STALE_COMMAND', 'Command belongs to another round');
        if (t >= r.actionDeadline) fail('DEADLINE_PASSED', 'Time is up for this decision');
        if (input.take) {
          const cost = handsOf(r, actorId).reduce((n, h) => n + h.stake / 2, 0);
          try { await tx.wallet.reserve(actorId, { reservationId: insuranceReservation(r, actorId), roomId, kind: 'insurance', amount: cost }); }
          catch (e) { if (e instanceof WalletDenied) fail('INSUFFICIENT_BALANCE', 'Insufficient demo balance'); throw e; }
        }
        r.insurance[actorId] = input.take;
        const pending = sorted(r.owners.filter((p, i) => p && handsOf(r, p).length));
        // A wallet refusal while resolving rejects this last choice atomically (no receipt); the
        // choices committed earlier stay, and the insurance.timeout tick records `blocked`.
        if (pending.every(p => Object.hasOwn(r.insurance, p))) {
          try { result.resolved = await resolveInsurance(tx, r, cfg, { parent, origin, cause }); }
          catch (e) { if (e instanceof WalletDenied) fail('INSURANCE_NOT_FUNDED', 'Insurance cannot be settled yet. Try again'); throw e; }
        }
      } else if (op === 'next') {
        if (r.phase !== 'settled' || t < r.plan.endAt) fail('ROUND_IN_PROGRESS', 'The round is still in progress');
        if (input.roundId !== r.roundId) fail('STALE_COMMAND', 'Command belongs to another round');
        // A pending exit (leave or seat.absent) is carried out here, before the reset clears
        // `leaving`; the leavers are in the lock plan. Its seat.release tick is then superseded.
        for (const p of [...r.leaving]) await releaseSeats(tx, r, p);
        if (r.phase === 'settled') await resetRound(tx, r);
      }
    }
    r.version++;
    await tx.rooms.write(roomId, r);
    return { ...result, version: r.version };
  }

  // O01 2.6: never stale; 24 h from commit, MAX with an existing pause, for the account in every
  // room. The room set is re-read under P; a changed set rolls back and replans.
  async function pause(tx, plan, actorId, input, t) {
    const rooms = await tx.members.roomsOf(actorId);
    const wanted = sorted([input.roomId, ...rooms]);
    if (wanted.join() !== plan.rooms.join()) throw new LockSetExceeded({ rooms: wanted });
    const pausedUntil = await tx.pause.extend(actorId, t + PAUSE_MS);
    for (const roomId of rooms) {
      const r = await tx.rooms.read(roomId);
      await audit(tx, roomId, r.phase === 'bets' ? null : r.roundId, 'player.pause', { playerId: actorId, commandId: input.commandId, pausedUntil });
      if (r.phase === 'bets') {
        for (const i of owned(r, actorId)) r.bets[i] = { main: 0, pp: 0, tp: 0 };
        r.ready = r.ready.filter(x => x !== actorId); delete r.history[actorId];
        await tx.wallet.release(actorId, { reservationId: stakeReservation(r, actorId) });
        if (!r.bets.some(b => b.main)) r.deadline = null;
      }
      r.version++;
      await tx.rooms.write(roomId, r);
    }
    return { op: 'pause', pausedUntil, rooms };
  }

  // ---- ticks ----------------------------------------------------------------------------
  // The time-driven transitions of advance() (:260-292), each with its own identity (O01 2.3).
  function candidates(r, members, seenOf) {
    const out = [], add = (kind, anchor, scheduledAt, extra = {}) =>
      out.push({ tickId: tickIdOf(r.roomId, kind, anchor, scheduledAt), roomId: r.roomId, kind, anchor, scheduledAt, ...extra });
    // Anchors are part lists, encoded by tickIdOf (ports.mjs); per-player ticks carry the actor.
    if (r.phase === 'bets' && r.deadline) add('window.close', [r.windowId], r.deadline);
    if (r.phase === 'round' && r.roundPhase === 'insurance') add('insurance.timeout', [r.roundId], r.actionDeadline);
    if (r.phase === 'round' && r.roundPhase === 'decisions') add('turn.autostand', [r.roundId, publicView(r.game).turnSeq], r.actionDeadline);
    if (r.phase === 'round' && r.roundPhase === 'settled') add('round.settle', [r.roundId], r.plan.endAt);
    if (r.phase === 'settled') for (const p of r.leaving) add('seat.release', ['leave', r.roundId, p], r.settledAt, { playerId: p });
    for (const m of members) {
      if (!m.active || !owned(r, m.actorId).length || r.leaving.includes(m.actorId)) continue;
      const at = Math.max(seenOf(m.actorId) ?? -Infinity, m.joinedAt) + absentMs;
      add(r.phase === 'round' ? 'seat.absent' : 'seat.release', ['absent', m.actorId, m.memberGen], at, { playerId: m.actorId });
    }
    return out;
  }

  // A missing reservation has generation null, both in the blocked receipt and when compared
  // here, so an unchanged absence never counts as a change.
  const reservationGen = res => res?.gen ?? null;
  async function blockedChanged(read, blockedOn) {
    for (const b of blockedOn) {
      if ((await read.walletGen(b.playerId)) !== b.walletGen) return true;
      if (reservationGen(await read.reservation(b.reservationId)) !== (b.reservationGen ?? null)) return true;
    }
    return false;
  }

  // Scheduler interface: what is due at `at`. A blocked tick is offered again only as a new
  // `…:retry:<n>` id after something in its blockedOn changed (O01 2.5), never in a loop.
  async function dueTicks(at = now()) {
    const due = [];
    for (const roomId of await store.read.rooms()) {
      const r = await store.read.room(roomId), members = await store.read.members(roomId), seen = {};
      for (const m of members) seen[m.actorId] = await store.read.presence(roomId, m.actorId);
      for (const c of candidates(r, members, p => seen[p])) {
        if (c.scheduledAt > at) continue;
        let n = 0, last = await store.read.tick(c.tickId);
        if (!last) { due.push(c); continue; }
        while (last.outcome === 'blocked') {
          const next = await store.read.tick(`${c.tickId}:retry:${n + 1}`);
          if (!next) break;
          last = next; n++;
        }
        if (last.outcome === 'blocked' && await blockedChanged(store.read, last.blockedOn))
          due.push({ ...c, tickId: `${c.tickId}:retry:${n + 1}`, baseTickId: c.tickId, retry: n + 1,
            blockedPlayers: last.blockedOn.map(b => b.playerId) });
      }
    }
    return due;
  }

  function tickPlayers(r, kind, playerId) {
    if (kind === 'window.close') return r.owners.filter((p, i) => p && sum(r.bets[i]) > 0);
    if (kind === 'insurance.timeout' || kind === 'round.settle') return r.owners;
    if (kind === 'seat.absent' || kind === 'seat.release') return [playerId];
    return [];
  }

  async function tick(desc) {
    return withLocks(async () => {
      const r = await store.read.room(desc.roomId);
      return { global: false, rooms: [desc.roomId], players: sorted([...(r ? tickPlayers(r, desc.kind, desc.playerId) : []), ...(desc.blockedPlayers ?? [])]) };
    }, async tx => {
      const stored = await tx.ticks.get(desc.tickId);
      if (stored) return { ...stored, replay: true };          // same tickId never runs twice
      const t = now(), base = desc.baseTickId ?? desc.tickId;
      const record = async (outcome, result = null, blockedOn = null) => {
        const row = { tickId: desc.tickId, room: desc.roomId, kind: desc.kind, outcome, result, blockedOn, committedAt: t };
        await tx.ticks.put(row); return row;
      };
      const r = await tx.rooms.read(desc.roomId);
      const members = await tx.members.list(desc.roomId), seen = {};
      for (const m of members) seen[m.actorId] = await tx.presence.get(desc.roomId, m.actorId);
      const current = r && candidates(r, members, p => seen[p]).find(c => c.tickId === base);
      if (!current) return record('superseded');
      // Not yet due (an early call, or a retry whose blockedOn has not changed): nothing is
      // written, so the tickId stays available for when it is due.
      const notDue = { tickId: desc.tickId, room: desc.roomId, kind: desc.kind, outcome: 'not_due' };
      if (current.scheduledAt > t) return notDue;
      if (desc.retry) {
        const prev = await tx.ticks.get(desc.retry === 1 ? base : `${base}:retry:${desc.retry - 1}`);
        if (prev?.outcome !== 'blocked') return record('superseded');
        const view = { walletGen: p => tx.wallet.gen(p), reservation: id => tx.wallet.reservation(id) };
        if (!await blockedChanged(view, prev.blockedOn)) return notDue;
      }
      const cfg = await tx.config.frozen(r.roomId, r.configVersion);
      const sp = await tx.savepoint();
      const tickSeq = await audit(tx, r.roomId, r.phase === 'bets' ? null : r.roundId, 'table.tick',
        { tickId: desc.tickId, kind: desc.kind, scheduledAt: current.scheduledAt });
      const ctx = { parent: tickSeq, cause: { eventId: tickSeq, source: 'table tick' },
        origin: { namespace: 'tick', actorId: 'system', identity: desc.tickId } };
      let result = null;
      try {
        if (desc.kind === 'window.close') result = await startRound(tx, r, cfg, ctx);
        else if (desc.kind === 'insurance.timeout') {
          for (const p of sorted(r.owners)) if (handsOf(r, p).length && !Object.hasOwn(r.insurance, p)) r.insurance[p] = false;
          result = await resolveInsurance(tx, r, cfg, ctx);
        } else if (desc.kind === 'turn.autostand') {
          const v = publicView(r.game);
          const res = await engine(tx, r, cfg, { op: 'act', action: 'stand', roundId: r.roundId, turnSeq: v.turnSeq,
            box: v.round.hands[v.round.active].box, handIndex: v.round.active }, null, ctx);
          await present(tx, r, cfg, res, 'stand');
        } else if (desc.kind === 'round.settle') result = await settle(tx, r, cfg, ctx);
        else if (desc.kind === 'seat.absent') r.leaving.push(desc.playerId);
        else if (desc.kind === 'seat.release') await releaseSeats(tx, r, desc.playerId);
      } catch (e) {
        const blocked = e instanceof WalletDenied && BLOCKABLE.has(desc.kind);
        if (!blocked && !(e instanceof TableError)) throw e;   // infrastructure error: full rollback
        // Domain refusal: back to the savepoint (wallet, ledger, state, engine events, outbox),
        // then only the tick receipt and its audit row are written before COMMIT.
        await tx.rollbackTo(sp);
        await audit(tx, r.roomId, r.phase === 'bets' ? null : r.roundId, 'table.tick',
          { tickId: desc.tickId, kind: desc.kind, outcome: blocked ? 'blocked' : 'rejected' });
        if (!blocked) return record('rejected', { code: e.code });
        const res = await tx.wallet.reservation(e.reservationId);
        return record('blocked', { waitingOn: e.playerId },
          [{ playerId: e.playerId, reservationId: e.reservationId, walletGen: e.walletGen, reservationGen: reservationGen(res) }]);
      }
      r.version++;
      await tx.rooms.write(r.roomId, r);
      return record('applied', result);
    });
  }

  // ---- reads and delivery ---------------------------------------------------------------
  // Read-only reconnect snapshot: everything a client needs to resume, incl. stored deadlines.
  async function snapshot(roomId, actorId = null) {
    const r = await store.read.room(roomId);
    if (!r) return null;
    const view = publicView(r.game), members = await store.read.members(roomId), t = now();
    const players = [];
    for (const m of members) if (m.active && owned(r, m.actorId).length) players.push({ id: m.actorId, seats: owned(r, m.actorId),
      ready: r.ready.includes(m.actorId), leaving: r.leaving.includes(m.actorId),
      online: t - ((await store.read.presence(roomId, m.actorId)) ?? -Infinity) < onlineMs });
    const m = actorId && members.find(x => x.actorId === actorId);
    const me = actorId ? { id: actorId, seats: owned(r, actorId), memberGen: m?.memberGen ?? 0, active: Boolean(m?.active),
      available: await store.read.available(actorId), pausedUntil: await store.read.pausedUntil(actorId),
      insuranceDue: r.roundPhase === 'insurance' && handsOf(r, actorId).length > 0 && !Object.hasOwn(r.insurance, actorId),
      lastSettlement: r.lastSettlement[actorId] ?? null } : null;
    return { contract: TABLE_CONTRACT, roomId, version: r.version, configVersion: r.configVersion, windowId: r.windowId,
      phase: r.phase, roundId: r.roundId, turnSeq: view.turnSeq, owners: r.owners, seatGen: r.seatGen, bets: r.bets,
      deadline: r.deadline, actionDeadline: r.actionDeadline, plan: r.plan, round: view.round, shoe: view.shoe,
      // K04: the outbox version of the room's latest committed presentation (reconnect check only).
      presentationVer: r.presentationVer, players, serverNow: t, me };
  }

  // Delivery after COMMIT with the stored talkId/ver (O01 2.9). deliveredVer only skips rows
  // already known to be old; the ordering guarantee is the receiver's atomic version check
  // (sink contract in ports.mjs): a row it answers 'stale' was never applied and is superseded.
  // Failures leave the row for a later attempt.
  async function deliverOutbox(sink) {
    const delivered = [], superseded = [], failed = [];
    for (const row of await store.outbox.pending()) {
      if (row.ver < (await store.outbox.deliveredVer(row.roomId))) { await store.outbox.ack(row, 'superseded'); superseded.push(row); continue; }
      try {
        const status = await sink(row);
        if (status === 'applied') { await store.outbox.ack(row, 'delivered'); delivered.push(row); }
        else if (status === 'stale') { await store.outbox.ack(row, 'superseded'); superseded.push(row); }
        else throw new TypeError(`presentation sink must answer 'applied' or 'stale', got ${status}`);
      } catch (error) { failed.push({ row, error }); }
    }
    return { delivered, superseded, failed };
  }

  return { command, tick, dueTicks, snapshot, deliverOutbox,
    seen: (roomId, actorId) => store.presence.touch(roomId, actorId, now()) };
}
