import { randomUUID } from 'node:crypto';
import { createSpinResult, describePocket } from './index.mjs';
import { BET_BY_ID, LIMITS } from './rules.mjs';

const fail = code => { throw Object.assign(Error(code), { statusCode: 400 }); };
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key));
export const ROOM = Object.freeze({ id:'roulette-main', operatorId:'native', name:'Privé Roulette', variant:'european-single-zero' });
export const newRoom = () => ({ schemaVersion:1, version:0, rounds:[] });
export function cents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e9
      || Math.abs(value*100-Math.round(value*100)) > 0.000001) fail('invalid_amount');
  return Math.round(value*100);
}
export function validateBets(value) {
  if (!Array.isArray(value) || !value.length || value.length > Object.keys(BET_BY_ID).length) fail('invalid_bets');
  const seen = new Set();
  const bets = value.map(row => {
    if (!exact(row,['id','amount']) || typeof row.id !== 'string' || !Object.hasOwn(BET_BY_ID,row.id) || seen.has(row.id)) fail('invalid_bets');
    seen.add(row.id);
    const stake = cents(row.amount);
    if (stake < LIMITS.min*100 || stake > LIMITS.maxPerBet*100) fail('stake_out_of_range');
    return { id:row.id, amount:stake/100 };
  }).sort((a,b)=>a.id.localeCompare(b.id));
  if (bets.reduce((n,b)=>n+cents(b.amount),0) > LIMITS.maxTotal*100) fail('total_stake_exceeded');
  return bets;
}
export function roomView(state, room = ROOM) {
  return { schemaVersion:1, room, version:state.version, phase:'betting', limits:LIMITS,
    rounds:state.rounds.map(({ requestId, fingerprint, ...round })=>structuredClone(round)) };
}
// Called only inside the wallet transaction. A failed commit exposes no outcome.
// Version checks prevent stale/replayed commands from generating another result.
export function roomCommand(state, request, balance, { draw = createSpinResult, currency = 'USD', room = ROOM } = {}) {
  if (state.schemaVersion !== 1 || !Number.isSafeInteger(state.version) || state.version < 0 || !Array.isArray(state.rounds)) fail('invalid_saved_room');
  if (exact(request,['op']) && request.op === 'state') return { view:roomView(state,room), changed:false };
  if (!exact(request,['op','requestId','version','bets',...(Object.hasOwn(request ?? {},'currency')?['currency']:[])]) || request.op !== 'spin'
      || request.currency !== undefined && (typeof request.currency !== 'string' || !/^[A-Z]{3}$/.test(request.currency))
      || typeof request.requestId !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(request.requestId)
      || !Number.isSafeInteger(request.version) || request.version < 0) fail('invalid_command');
  const bets = validateBets(request.bets);
  const fingerprint = JSON.stringify({ version:request.version, bets, currency:request.currency ?? currency });
  const receipt = state.rounds.find(round=>round.requestId === request.requestId);
  if (receipt) {
    if (receipt.fingerprint !== fingerprint) fail('request_id_reused');
    return { view:roomView(state,room), changed:false, round:roomView({ ...state, rounds:[receipt] },room).rounds[0], replayed:true };
  }
  if (state.version >= Number.MAX_SAFE_INTEGER) fail('invalid_saved_room');
  if (state.version !== request.version) fail('room_changed');
  if (request.currency !== undefined && request.currency !== currency) fail('currency_changed');
  const wagered = bets.reduce((sum,bet)=>sum+cents(bet.amount),0);
  if (cents(balance) < wagered) fail('insufficient_balance');
  const event = draw({ operatorId:room.operatorId, roomId:room.id, roundId:randomUUID() });
  const pocket = describePocket(event?.outcome?.number);
  if (pocket.color !== event.outcome.color) fail('invalid_outcome');
  const settled = bets.map(bet => {
    const definition = BET_BY_ID[bet.id];
    const returned = definition.numbers.includes(pocket.number) ? cents(bet.amount)*(definition.payout+1) : 0;
    return { ...bet, returned:returned/100 };
  });
  const returned = settled.reduce((sum,bet)=>sum+cents(bet.returned),0);
  const round = { id:event.roundId, event, currency, bets:settled, wagered:wagered/100,
    returned:returned/100, net:(returned-wagered)/100, balanceAfter:(cents(balance)+returned-wagered)/100 };
  state.version++;
  state.rounds = [{ ...round, requestId:request.requestId, fingerprint }, ...state.rounds].slice(0,20);
  return { view:roomView(state,room), changed:true, round, replayed:false };
}
