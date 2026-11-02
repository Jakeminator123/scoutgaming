export const CHIPS = [1, 5, 10, 25, 50, 100, 500, 1000];
export const LIMITS = { min: 5, max: 2000 };

// Live state is supplied by the game document; this controller never owns game outcomes.
export function createBlackjackBetControls({state, $, hint, fmt, flyChip, sfx, renderBets, ensureLogin, dealSequence, SEATS}) {
  const betTotal = () => state.bets.reduce((a, b) => a + b.main + b.pp + b.tp, 0);
  function placeBet(i, field, targetEl) {
    console.info('[bet]', i, field, 'round=', !!state.round, 'busy=', state.busy);
    if (state.round || state.busy) return;
    // ALL SEATS mode: one click on any side-bet crescent bets it on every staked box
    if (field !== 'main' && state.allSides && !placeBet.bulk) {
      placeBet.bulk = true;
      for (let j = 0; j < SEATS; j++) {
        if (state.bets[j].main > 0) placeBet(j, field, state.seatEls[j].querySelector(field === 'pp' ? '.side.pp' : '.side.tp'));
      }
      placeBet.bulk = false;
      return;
    }
    if (field !== 'main' && state.bets[i].main === 0) return; // side bets ride on a main bet
    const cap = field === 'main' ? LIMITS.max : LIMITS.max / 2;
    const next = state.bets[i][field] + state.selected;
    if (next > cap) { hint('LIMIT', `${field === 'main' ? 'box' : 'side bet'} caps at ${fmt(cap)}`); return; }
    if (betTotal() + state.selected > state.balance) { hint('BALANCE', `${fmt(state.selected)} more than you have — add funds`); return; }
    flyChip(state.selected, targetEl);
    sfx.play('chip');
    state.bets[i][field] = next;
    state.undoStack.push({ box: i, field, value: state.selected });
    renderBets();
  }
  function doubleBets() {
    if (state.round || state.busy) return;
    const add = betTotal();
    if (!add || add * 2 > state.balance + add - add || betTotal() * 2 > state.balance || state.bets.some(b => b.main * 2 > LIMITS.max || b.pp * 2 > LIMITS.max / 2 || b.tp * 2 > LIMITS.max / 2)) return;
    for (const [i, b] of state.bets.entries()) {
      if (b.main) state.undoStack.push({ box: i, field: 'main', value: b.main });
      if (b.pp) state.undoStack.push({ box: i, field: 'pp', value: b.pp });
      if (b.tp) state.undoStack.push({ box: i, field: 'tp', value: b.tp });
    }
    state.bets = state.bets.map(b => ({ main: b.main * 2, pp: b.pp * 2, tp: b.tp * 2 }));
    renderBets();
  }
  async function startRound() { if(state.round||state.busy)return; if(state.bets.some(b=>b.main>LIMITS.max||b.pp>LIMITS.max/2||b.tp>LIMITS.max/2)){hint('CLASSIC LIMIT','Reduce or clear your selected bets: 2,000 per main bet, 1,000 per side bet.');renderBets();return;} try { if(!await ensureLogin('Sign in to start this round. Your selected bets will stay in place.'))return; if(betTotal()>state.balance){hint('BALANCE','Add funds or reduce your bet.');renderBets();return;} if(!state.round&&!state.busy)void dealSequence(); } catch(e){hint('SIGN IN',e.message);} }
  function renderControls(){
    const staked = state.bets.filter(b => b.main > 0);
    const withinLimits = state.bets.every(b => b.main <= LIMITS.max && b.pp <= LIMITS.max / 2 && b.tp <= LIMITS.max / 2);
    const playable = staked.length > 0 && staked.every(b => b.main >= LIMITS.min) && withinLimits;
    $('#deal-now').title = withinLimits ? '' : 'Classic supports up to 2,000 per main bet and 1,000 per side bet. Reduce or clear your selected bets.';
    $('#deal-now').disabled = !playable || !!state.round || state.busy;
    $('#clear-btn').disabled = betTotal() === 0 || !!state.round || state.busy;
    $('#undo-btn').disabled = !state.undoStack.length || !!state.round || state.busy;
    $('#double-btn').disabled = !betTotal() || betTotal() * 2 > state.balance || state.bets.some(b => b.main * 2 > LIMITS.max || b.pp * 2 > LIMITS.max / 2 || b.tp * 2 > LIMITS.max / 2) || !!state.round || state.busy;
    $('#max-btn').disabled = state.balance < LIMITS.min || !!state.round || state.busy;
  }
  return {betTotal, placeBet, doubleBets, startRound, renderControls};
}
