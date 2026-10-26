import { validateRoomGameMaterial } from './room-game-config.mjs';
import { nativeRoomFilmedPlanning, isNativeRoomMaterial } from './native-room-filmed-planning.mjs';
import { planFilmedDealSequence, orderFilmedPresentationEvents } from '../runtime/filmed-deal-sequence.mjs';
export { isNativeRoomMaterial } from './native-room-filmed-planning.mjs';

export const NATIVE_ROOM_MATERIAL_PREFIX = 'native-film-v1-';
export const NATIVE_ROOM_PRESENTATION_CONTRACT = 'blackjack-presentation/1';
export const NATIVE_ROOM_SPEECH_SLOTS = Object.freeze(['blackjack','dealerblackjack','dealerbust','double','goodluck','insurance','lose','placebets','push','win']);
const outcomes = new Set(['blackjack','dealerblackjack','dealerbust','lose','push','win']);
const fail = () => { throw Object.assign(Error('native_room_sequence_unsupported'), {code:'native_room_sequence_unsupported',statusCode:422}); };

// Invoke on the actual complete public instruction list before committing a
// native plan. Existing non-native configurations retain their own contract.
// This guard never chooses cards, changes deadlines or performs any I/O.
export function assertNativeRoomSequenceBudget({material,steps,draws,presentationContract,kind='plan'} = {}) {
  if (!isNativeRoomMaterial(material)) return false;
  try { validateRoomGameMaterial(material,{dealerId:material.dealerId,language:material.language}); } catch { fail(); }
  if (!/^native-film-v[12]-[a-f0-9]{64}$/.test(material.revision) || presentationContract !== NATIVE_ROOM_PRESENTATION_CONTRACT || !Array.isArray(steps) || steps.length > 128
    || !Number.isSafeInteger(draws) || draws < 0) fail();
  if (kind === 'window') {
    if (draws !== 0 || steps.length !== 2 || steps.some(event => !event || typeof event !== 'object' || Array.isArray(event)) || steps[0]?.type !== 'speak'
      || steps[0]?.line !== 'placebets' || steps[1]?.type !== 'idle') fail();
    return true;
  }
  if (kind !== 'plan') fail();
  const dealt = new Set(), spoken = [], counts = {deal:0,reveal:0,settle:0,turn:0};
  for (const event of steps) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) fail();
    if (event.type === 'speak') {
      if (!NATIVE_ROOM_SPEECH_SLOTS.includes(event.line) || event.line === 'placebets' || spoken.includes(event.line)) fail();
      spoken.push(event.line);
      if (spoken.length > 2) fail();
    } else if (event.type === 'deal') {
      if (!Number.isSafeInteger(event.shoeDraw) || event.shoeDraw < 1 || dealt.has(event.shoeDraw)
        || !['box','dealer'].includes(event.to) || typeof event.faceDown !== 'boolean'
        || event.to === 'box' && (!Number.isInteger(event.box) || event.box < 0 || event.box > 6 || event.faceDown)) fail();
      dealt.add(event.shoeDraw); counts.deal++;
    } else if (event.type === 'reveal') {
      if (event.to !== 'dealer' || !Number.isSafeInteger(event.shoeDraw) || event.shoeDraw < 1 || ++counts.reveal > 1) fail();
    } else if (event.type === 'settle' || event.type === 'turn') {
      if (++counts[event.type] > 1) fail();
    } else fail();
  }
  if (counts.deal !== draws || counts.settle && counts.turn) fail();
  if (spoken.length === 2 && !(spoken[0] === 'goodluck' && (spoken[1] === 'insurance' || outcomes.has(spoken[1]))
    || spoken[0] === 'double' && outcomes.has(spoken[1]))) fail();
  try {
    const planning=nativeRoomFilmedPlanning(material);
    if(planning&&!planFilmedDealSequence({...planning,events:orderFilmedPresentationEvents(steps)}).complete)fail();
  } catch { fail(); }
  return true;
}
