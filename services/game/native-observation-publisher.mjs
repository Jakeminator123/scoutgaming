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

// movingSpeech is a getter because the runtime starts after the table command is built.
export function createNativeObservationPublisher({ probeRuntime, partner, readPlayerResults, getPlayer, db,
  movingSpeech = () => null, warn = console.warn }) {
  // Event code only: no error text, player or partner identifiers reach the log.
  const report = event => { try { warn(JSON.stringify({ event })); } catch { /* Diagnostics cannot fail a committed command. */ } };
  async function observeProbe(observation) {
    // "Tal vid inaktivitet" exists only for Astrid (probe-client starts only there).
    // command.dealer is the room's dealer key sent with every table command; other
    // rooms must not open a Studio-scoped memory transaction per command.
    if (observation.command?.dealer !== 'astrid') return;
    const scope = { playerId: observation.playerId, dealerId: 'astrid' };
    await probeRuntime.cancel(scope);
    if (observation.command.op !== 'collect' || observation.previousView.round?.phase !== 'settled') return;
    const hands = settledHands(observation.previousView.round);
    const roundId = `collected-${observation.view.shoe.id}-${observation.view.version}`;
    const { currency } = await getPlayer(observation.playerId);
    const sequence = (await readPlayerResults(db, observation.playerId, {}, currency)).currencies.reduce((sum,row)=>sum+row.rounds,0);
    await probeRuntime.completedRound(scope, { roundId, sequence, hands });
  }
  return {
    async publish(observation) {
      try { movingSpeech()?.observeCommitted(observation); } catch { report(NATIVE_OBSERVATION_EVENTS.movingSpeech); }
      try { await observeProbe(observation); } catch { report(NATIVE_OBSERVATION_EVENTS.probe); }
      if (!observation.session?.partnerKeyId) return;
      try { await (await partner()).publishNativeRound(observation); } catch { report(NATIVE_OBSERVATION_EVENTS.partner); }
    },
    onPublishError: () => report(NATIVE_OBSERVATION_EVENTS.publish),
  };
}
