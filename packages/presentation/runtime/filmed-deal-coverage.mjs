import { orderFilmedPresentationEvents, planFilmedDealSequences } from './filmed-deal-sequence.mjs';

function cardEvents(targets, { nextDraw = 2, holeDraw = 1 } = {}) {
  return targets.map(target => {
    if (target === 'flip') return { type: 'reveal', to: 'dealer', shoeDraw: holeDraw };
    const shoeDraw = nextDraw++;
    if (target === 'hole') holeDraw = shoeDraw;
    return typeof target === 'number'
      ? { type: 'deal', to: 'box', box: target, faceDown: false, shoeDraw }
      : { type: 'deal', to: 'dealer', box: null, faceDown: target === 'hole', shoeDraw };
  });
}

const settlement = () => [{ type: 'settle' }, { type: 'speak', line: 'win' }];
const opening = (seats, reveal = false) => [
  { type: 'speak', line: 'goodluck', blocking: true },
  ...cardEvents([...seats, 'dealer', ...seats, 'hole', ...(reveal ? ['flip'] : [])], { nextDraw: 1 }),
  ...(reveal ? settlement() : [{ type: 'turn', box: seats[0] }]),
];
const action = (box, playerDraws, dealerDraws = null) => [
  ...cardEvents([...Array(playerDraws).fill(box), ...(dealerDraws === null ? [] : ['flip', ...Array(dealerDraws).fill('dealer')])]),
  ...(dealerDraws === null ? [{ type: 'turn', box }] : settlement()),
];

// Complete command shapes for blackjack-presentation/1, not cards or rules.
// The planner uses only the immediately preceding/following target. These
// witnesses exhaust those neighborhoods, independently of the profile's poses:
// - Every nonempty seat subset opens right-to-left, twice, ending at the hole.
// - Immediate settlement changes only [last seat, hole, boundary] into
//   [last seat, hole, flip] and [hole, flip, boundary]. One seat per witness
//   covers every possible last seat without repeating the other opening joins.
// - An action adds zero, one or two same-seat cards (split). Speech, turn and
//   settle are boundaries; double's leading speech adds no new neighborhood.
// - A reveal is followed by zero or more dealer cards. Lengths 0..3 cover the
//   empty, singleton, first, interior and last neighborhoods of that loop.
//   Preceding player cards affect only the reveal, hence their 0/1-dealer cases.
// Commands and windows start/end at a boundary; no pose joins cross commands.
export function nativeFilmedCoverageSequences() {
  const sequences = [];
  for (let mask = 1; mask < 1 << 7; mask++) {
    const seats = Array.from({ length: 7 }, (_, box) => 6 - box).filter(box => mask & (1 << box));
    sequences.push(opening(seats));
  }
  for (let box = 0; box < 7; box++) {
    sequences.push(opening([box], true));
    for (const draws of [1, 2]) {
      sequences.push(action(box, draws));
      for (const dealerDraws of [0, 1]) sequences.push(action(box, draws, dealerDraws));
    }
  }
  for (let draws = 0; draws <= 3; draws++) sequences.push(action(null, 0, draws));
  return sequences;
}

// Profile-only inventory is deliberately synthetic: this derives the required
// keys, never proves uploaded media, approval, binding or timing. The caller must
// check those facts against its frozen publication and replan the real command
// before commit. Selected transition records must already be resolved/validated.
export function requiredNativeFilmedTakes({ profile, dealerId, transitions = {} } = {}) {
  const inventory = { videos: (Array.isArray(profile?.takes) ? profile.takes : []).map(take => ({
    id: take?.key, sha256: take?.sha256, available: true, classification: { dealerId },
  })) };
  const batch = planFilmedDealSequences({ profile, dealerId, inventory, transitions,
    eventSequences: nativeFilmedCoverageSequences().map(orderFilmedPresentationEvents) });
  if (!batch.complete) return { complete: false, requiredTakeKeys: [], reason: batch.reason };
  const required = new Set(batch.plans.flatMap(plan => plan.steps.map(step => step.takeKey)));
  return { complete: true, requiredTakeKeys: [...required].sort(), reason: null };
}
