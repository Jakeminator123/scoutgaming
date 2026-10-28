// UI intents only. WebSocket snapshots remain the sole source of cards, funds and rules.
const seat = value => Number.isInteger(value) && value >= 0 && value < 7;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const fail = () => { throw new TypeError('shared_room_invalid_controls'); };
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const messages = {
  STALE_COMMAND:'Bordet har ändrats. Använd de aktuella kontrollerna.', REQUEST_REUSED:'Kommandot kunde inte bekräftas. Ladda om sidan.',
  PAUSED:'Din paus är aktiv.', NOT_SEATED:'Välj en ledig plats först.', SEAT_TAKEN:'Platsen är redan upptagen.',
  INSUFFICIENT_BALANCE:'Ditt tillgängliga demosaldo räcker inte.', LIMITS:'Insatsen ligger utanför bordets gränser.',
  BETTING_CLOSED:'Insatsfönstret är stängt.', READY:'Du är redan redo. Vänta på de andra spelarna.',
  NO_BETS:'Lägg en insats först.', NO_REPEAT:'Det finns ingen tidigare insats att upprepa.',
  REFILL_REFUSED:'Demosaldo kan inte fyllas på just nu.', CLEAR_FIRST:'Rensa dina insatser innan du byter plats.',
  NOT_YOUR_TURN:'Vänta på din tur.', DEADLINE_PASSED:'Tiden för ditt beslut har gått ut.',
  AUTHORITY_REJECTED:'Din inloggning eller rumsbehörighet har ändrats. Ladda om sidan.',
  shared_room_authentication_required:'Logga in igen för att fortsätta.', shared_room_forbidden:'Du har inte längre tillgång till rummet.',
};
// The server repeats r.lastBets: the boxes with a main bet when the player's last round began. Those are the
// boxes of me.lastSettlement's hands, so one that is still the player's own has a bet to repeat.
const previous = s => Array.isArray(s.me.lastSettlement?.hands) && s.me.lastSettlement.hands.some(h => s.me.seats.includes(h?.box));
// A side bet needs the main bet of its own box (coordinator.mjs bet: NO_BETS).
const sideOpen = (s, box) => s.bets[box]?.main > 0;
export const SIGN_IN_EXPIRED = 'Din session har gått ut. Logga in igen.';
// A partner key's company (docs/plans/NYCKEL-BOLAG.md): a reload cannot change these answers.
export const PARTNER_REFUSED = new Map([
  ['partner_operator_mismatch', 'Nyckeln gäller ett annat bolag. Öppna spelet från ditt eget spelbolag.'],
  ['partner_key_unbound', 'Nyckeln är inte kopplad till något spelbolag.'],
]);
function checked(raw, roomId) {
  const s = structuredClone(raw), cfg = s?.settings;
  if (s?.contract !== 'blackjack-table/1' || s.roomId !== roomId || !integer(s.version) || !integer(s.presentationVer)
    || !['bets','round','settled'].includes(s.phase) || typeof s.windowId !== 'string' || !s.windowId
    || typeof s.me?.id !== 'string' || !integer(s.me.memberGen) || !Array.isArray(s.me.seats) || !s.me.seats.every(seat)
    || !Array.isArray(s.owners) || s.owners.length !== 7 || !Array.isArray(s.seatGen) || s.seatGen.length !== 7 || !s.seatGen.every(integer)
    || !Array.isArray(s.bets) || s.bets.length !== 7 || !s.bets.every(b => ['main','pp','tp'].every(k => typeof b?.[k] === 'number' && Number.isFinite(b[k]) && b[k] >= 0))
    || typeof s.me.available !== 'number' || !Number.isFinite(s.me.available) || s.me.available < 0 || !integer(s.me.pausedUntil)
    || !integer(s.serverNow) || !integer(s.turnSeq) || !cfg || cfg.configVersion !== s.configVersion || !['en','sv'].includes(cfg.language)
    || !Array.isArray(cfg.chips) || !cfg.chips.length || !cfg.chips.every(positive) || new Set(cfg.chips).size !== cfg.chips.length
    || !positive(cfg.limits?.min) || !positive(cfg.limits.max) || cfg.limits.max < cfg.limits.min
    || typeof cfg.limits.sideMax !== 'number' || !Number.isFinite(cfg.limits.sideMax) || cfg.limits.sideMax < 0 || !positive(cfg.refill)) fail();
  if (s.me.seats.some(i => s.owners[i] !== s.me.id) || new Set(s.me.seats).size !== s.me.seats.length) fail();
  return freeze(s);
}
export function createSharedRoomController({ roomId, commands, view, presentation, now = Date.now, reconnect = null }) {
  if (!/^[a-z0-9_-]{1,128}$/.test(roomId) || !commands || !view || !presentation || (reconnect !== null && typeof reconnect !== 'function')) fail();
  let snapshot = null, chip = null, focusSeat = null, activeSignal, disconnected, clockOffset = 0, clockTimer;
  let closed = false, connected = false, presenting = false, sending = false, restoring = false, restoreGeneration = 0, waiting = null, notice = 'Ansluter till bordet…';
  // lost: the socket of the shown state closed and the client reconnects by itself (K04 B2); offline: its budget is spent.
  let offline = false, expired = false, lost = false;
  const serverTime = () => now() + clockOffset;
  function available() {
    const s = snapshot, result = { join:false, leave:false, bet:false, undo:false, clear:false, doubleBets:false, allSeats:false, repeat:false,
      ready:false, insurance:false, next:false, refill:false, pause:false, act:[] };
    if (!s || closed || !connected || activeSignal?.aborted || sending || waiting || commands.state !== 'idle') return result;
    const paused = s.me.pausedUntil > serverTime(), own = s.me.seats.length > 0;
    const turnAt = s.plan?.turnAt ?? 0, beforeDeadline = !s.actionDeadline || serverTime() < s.actionDeadline;
    result.insurance = s.phase === 'round' && s.round?.phase === 'insurance' && s.me.insuranceDue === true && serverTime() >= turnAt && beforeDeadline;
    const hand = s.round?.hands?.[s.round.active];
    if (s.phase === 'round' && s.round?.phase === 'decisions' && hand && s.owners[hand.box] === s.me.id && serverTime() >= turnAt && beforeDeadline)
      result.act = (s.round.legalActions ?? []).filter(action => ['hit','stand','double','split'].includes(action) && (!paused || action === 'stand'));
    // K04 R2: the player's decision opens on the server's clock. A take that already shows frames at turnAt
    // plays to its end (shared-room-presentation.mjs), but no longer keeps hit/stand or insurance closed past
    // turnAt. Every other control still waits for the presentation.
    if (presenting) return result;
    const player = s.players?.find(p => p.id === s.me.id), bets = s.phase === 'bets' && !player?.ready && !player?.leaving;
    const inWindow = !s.deadline || serverTime() < s.deadline;
    result.join = bets && !paused; result.leave = own && !player?.leaving;
    result.bet = result.undo = result.doubleBets = result.allSeats = result.repeat = bets && own && inWindow && !paused;
    // Local guards before the server's NO_BETS and NO_REPEAT (coordinator.mjs stays the authority).
    result.repeat = result.repeat && previous(s);
    // K04 B5: the server lets clear through READY, the deadline and a pause, and clear withdraws ready
    // (coordinator.mjs BET_OPS); it refuses a leaving player. The server stays the authority.
    result.clear = s.phase === 'bets' && own && !player?.leaving;
    result.ready = result.bet && s.me.seats.some(i => s.bets[i].main > 0);
    result.next = s.phase === 'settled' && typeof s.roundId === 'string' && serverTime() >= (s.plan?.endAt ?? 0);
    result.refill = !paused; result.pause = !paused;
    return result;
  }
  // Why a betting control stays closed while betting is open: the same texts as the server's NO_BETS and NO_REPEAT.
  const hints = can => can.bet ? { ready:can.ready ? '' : messages.NO_BETS, repeat:can.repeat ? '' : messages.NO_REPEAT, side:messages.NO_BETS }
    : { ready:'', repeat:'', side:'' };
  function draw() { const can = available(); view.render({ snapshot, chip, focusSeat, can, hints:hints(can), busy:sending || Boolean(waiting) || presenting, offline:offline && !closed, reconnecting:lost && !offline && !closed, signIn:expired,
    retry:commands.state === 'uncertain' && !sending && !closed && connected && !restoring && !activeSignal?.aborted, notice, connected, stopped:closed, serverNow:serverTime() }); }
  function schedule() {
    clearTimeout(clockTimer);
    if (!snapshot || closed || !connected) return;
    const next = [snapshot.deadline,snapshot.actionDeadline,snapshot.plan?.turnAt,snapshot.plan?.endAt,snapshot.me.pausedUntil]
      .filter(t => Number.isFinite(t) && t > serverTime()).sort((a,b) => a-b)[0];
    if (next !== undefined) clockTimer = setTimeout(() => { draw(); schedule(); }, Math.min(2147483647, Math.max(1,next-serverTime()+1)));
  }
  function confirmed() {
    if (waiting && snapshot && (waiting.version !== undefined ? snapshot.version >= waiting.version : snapshot.me.pausedUntil >= waiting.pausedUntil)) {
      waiting = null; notice = '';
    }
  }
  function intent(op, args = {}) {
    const s = snapshot, can = available();
    if (op === 'act' ? !can.act.includes(args.action) : !Object.hasOwn(can,op) || !can[op]) return null;
    if (op === 'join') {
      if (!seat(args.seat) || s.owners[args.seat] !== null && s.owners[args.seat] !== s.me.id) return null;
      const seats = s.me.seats.includes(args.seat) ? s.me.seats.filter(i => i !== args.seat) : [...s.me.seats,args.seat].sort((a,b) => a-b);
      return seats.length ? {op,memberGen:s.me.memberGen,seats,seatGens:Object.fromEntries(seats.map(i => [i,s.seatGen[i]]))} : {op:'leave',memberGen:s.me.memberGen};
    }
    if (op === 'leave') return {op,memberGen:s.me.memberGen};
    if (['bet','undo','clear','doubleBets','allSeats','repeat','ready'].includes(op)) {
      if (op === 'bet' && (!seat(args.seat) || !s.me.seats.includes(args.seat) || !['main','pp','tp'].includes(args.field))) return null;
      if (op === 'bet' && args.field !== 'main' && !sideOpen(s,args.seat)) return null;
      return {op,windowId:s.windowId,...(op === 'bet' ? {seat:args.seat,field:args.field,chip} : op === 'allSeats' ? {chip} : {})};
    }
    if (op === 'act') { const handIndex = s.round.active, box = s.round.hands[handIndex].box; return {op,roundId:s.roundId,turnSeq:s.turnSeq,box,handIndex,action:args.action}; }
    if (op === 'insurance') {
      if (typeof args.take !== 'boolean' || s.me.pausedUntil > serverTime() && args.take) return null;
      return {op,roundId:s.roundId,phase:'insurance',take:args.take};
    }
    if (op === 'next') return {op,roundId:s.roundId};
    return {op};
  }
  async function execute(work) {
    if (closed || sending || restoring || !connected || activeSignal?.aborted) return;
    sending = true; notice = 'Skickar…'; draw();
    try {
      const reply = await work();
      if (closed) return reply;
      if (reply.status === 'ok') {
        waiting = reply.result.op === 'pause' ? {pausedUntil:reply.result.pausedUntil} : {version:reply.result.version};
        notice = 'Väntar på bordets bekräftelse…'; confirmed();
      } else if (reply.status === 'uncertain') notice = 'Svaret saknas. Försök igen för att kontrollera samma kommando.';
      else if (reply.status === 'rejected') {
        notice = messages[reply.code] ?? 'Bordet nekade kommandot. Kontrollera aktuell plats, insats och tur.';
        if(reply.httpStatus===401||reply.httpStatus===403){commands.stop();connected=false;clearTimeout(clockTimer);}
      }
      return reply;
    } catch { if (!closed) notice = commands.state === 'uncertain' ? 'Svaret saknas. Försök igen för att kontrollera samma kommando.' : 'Kommandot kunde inte skickas.'; }
    finally { sending = false; if (!closed) { draw(); schedule(); } }
  }
  const api = {
    async restoreSnapshot(raw, { signal, receivedAt = now() } = {}) {
      signal?.throwIfAborted(); if (closed) return;
      const next = checked(raw,roomId);
      if (snapshot && (next.me.id !== snapshot.me.id || next.version < snapshot.version || next.presentationVer < snapshot.presentationVer)) fail();
      const generation = ++restoreGeneration;
      // An active socket is not authority to act while its new window's media
      // binding is loading and being checked again by the server.
      connected = false; restoring = true; clearTimeout(clockTimer); draw();
      try { await presentation.restoreSnapshot(next,{signal,receivedAt}); signal?.throwIfAborted(); }
      catch(error) { if (generation === restoreGeneration) { restoring = false; if (!closed) draw(); } throw error; }
      if (closed || generation !== restoreGeneration) return;
      restoring = false;
      activeSignal?.removeEventListener('abort',disconnected);
      // Include time spent queued and checking the binding in the table clock.
      snapshot = next; activeSignal = signal; connected = true; offline = false; lost = false; clockOffset = next.serverNow-receivedAt;
      disconnected = () => { connected = false; lost = true; clearTimeout(clockTimer); if (!closed) { notice = 'Anslutningen avbröts. Återansluter…'; draw(); } };
      activeSignal?.addEventListener('abort',disconnected,{once:true});
      if (!next.settings.chips.includes(chip)) chip = next.settings.chips[0];
      if (!sending && !waiting && commands.state === 'idle') notice = '';
      confirmed(); draw(); schedule();
    },
    async present(value,{signal,superseded} = {}) {
      signal?.throwIfAborted(); if (closed) return;
      presenting = true; draw();
      try { await presentation.present(value,{signal,superseded}); signal?.throwIfAborted(); }
      finally { presenting = false; if (!closed) { draw(); schedule(); } }
    },
    dispatch(op,args) { const selected = intent(op,args); return selected ? execute(() => commands.send(selected)) : Promise.resolve(); },
    focusSeat(value) { if (!closed && seat(value)) { focusSeat=value; draw(); } },
    selectChip(value) { if (!closed && snapshot?.settings.chips.includes(value) && !sending && !waiting && commands.state === 'idle') { chip = value; draw(); } },
    retry() { return commands.state === 'uncertain' ? execute(() => commands.retry()) : Promise.resolve(); },
    // K04 F8: a session the server refused twice (shared-room-client.mjs, 1008) asks for a new sign-in, not a reload.
    fail(code) { if (!closed) { api.stop(); expired = code === 'shared_room_unauthorized';
      notice = expired ? SIGN_IN_EXPIRED : PARTNER_REFUSED.get(code) ?? 'Bordet kunde inte uppdateras. Ladda om sidan för att fortsätta.'; draw(); } },
    // The socket's reconnect budget is spent: the last server state stays on screen without controls, and the
    // player reconnects here instead of reloading the page (the socket also does so when the page or network returns).
    offline() { if (closed) return; offline = true; connected = false; clearTimeout(clockTimer); notice = 'Anslutningen till bordet bröts.'; draw(); },
    reconnect() { if (closed || !offline || !reconnect) return; offline = false; notice = 'Återansluter…'; draw(); reconnect(); },
    stop() {
      if (closed) return; closed = true; connected = false; restoring = false; ++restoreGeneration; clearTimeout(clockTimer);
      activeSignal?.removeEventListener('abort',disconnected); commands.stop(); presentation.close(); view.close();
    },
    get state() { return Object.freeze({snapshot,chip,waiting:waiting ? {...waiting} : null,closed,connected}); },
  };
  view.bind({dispatch:api.dispatch,selectChip:api.selectChip,focusSeat:api.focusSeat,retry:api.retry,reconnect:api.reconnect}); draw(); return Object.freeze(api);
}

