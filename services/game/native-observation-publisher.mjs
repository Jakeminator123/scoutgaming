// Post-commit fan-out for native table observations. Each concern runs alone:
// a failed probe or moving-speech observer never withholds the partner round,
// and nothing here can turn a committed command into a failure or retry.
export const NATIVE_OBSERVATION_EVENTS = Object.freeze({
  movingSpeech: 'native_observation_moving_speech_failed',
  probe: 'native_observation_probe_failed',
  partner: 'native_observation_partner_failed',
  publish: 'native_observation_publish_failed',
});

const settledHands = round => round.hands.filter(hand=>hand.stake>0).map((hand,handIndex)=>({
  handIndex,box:hand.box,cards:hand.cards.map(({r,s})=>({r,s})),split:hand.splitFrom !== null && hand.splitFrom !== undefined,
  outcome:hand.busted || !(hand.result>0) ? 'lose' : hand.result>hand.stake ? 'win' : 'push',
}));

// Product errors carry their code as the message (e.g. player_memory_dealer_unavailable).
const SAFE_CODE = /^[a-z0-9_]{1,64}$/;

// movingSpeech is a getter because the runtime starts after the table command is built.
export function createNativeObservationPublisher({ probeRuntime, partner, readPlayerResults, getPlayer, db,
  movingSpeech = () => null, warn = console.warn }) {
  // Only the step, an integer status and a code-shaped message are logged: never free
  // error text, player or partner identifiers.
  const report = (event, step, error) => { try {
    warn(JSON.stringify({ event, step, statusCode: Number.isInteger(error?.statusCode) ? error.statusCode : undefined,
      code: typeof error?.message === 'string' && SAFE_CODE.test(error.message) ? error.message : undefined }));
  } catch { /* Diagnostics cannot fail a committed command. */ } };
  async function observeProbe(observation) {
    // "Tal vid inaktivitet" exists only for Astrid (probe-client starts only there); other
    // rooms must not open a Studio-scoped memory transaction per command.
    // command.dealer is client-supplied; a forged value only reaches this player's own Astrid probe scope (which every table command wrote to before this gate), never the wallet or partner publication.
    if (observation.command?.dealer !== 'astrid') return;
    const scope = { playerId: observation.playerId, dealerId: 'astrid' };
    // A failed cancel also skips the completed round, as it always has.
    try { await probeRuntime.cancel(scope); } catch (error) { report(NATIVE_OBSERVATION_EVENTS.probe, 'cancel', error); return; }
    try {
      if (observation.command.op !== 'collect' || observation.previousView.round?.phase !== 'settled') return;
      const hands = settledHands(observation.previousView.round);
      const roundId = `collected-${observation.view.shoe.id}-${observation.view.version}`;
      const { currency } = await getPlayer(observation.playerId);
      const sequence = (await readPlayerResults(db, observation.playerId, {}, currency, { shared: false })).currencies.reduce((sum,row)=>sum+row.rounds,0);
      await probeRuntime.completedRound(scope, { roundId, sequence, hands });
    } catch (error) { report(NATIVE_OBSERVATION_EVENTS.probe, 'completedRound', error); }
  }
  return {
    async publish(observation) {
      try { movingSpeech()?.observeCommitted(observation); } catch (error) { report(NATIVE_OBSERVATION_EVENTS.movingSpeech, 'movingSpeech', error); }
      await observeProbe(observation);
      if (!observation.session?.partnerKeyId) return;
      try { await (await partner()).publishNativeRound(observation); } catch (error) { report(NATIVE_OBSERVATION_EVENTS.partner, 'partner', error); }
    },
    // The table calls this without an error; it logs only the event.
    onPublishError: () => report(NATIVE_OBSERVATION_EVENTS.publish),
  };
}
