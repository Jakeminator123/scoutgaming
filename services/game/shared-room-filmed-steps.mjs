import { nativeRoomFilmedPlanning } from '../../packages/presentation/contracts/native-room-filmed-planning.mjs';
import { planFilmedDealSequence, orderFilmedPresentationEvents } from '../../packages/presentation/runtime/filmed-deal-sequence.mjs';

// K04 F5c: a committed plan's filmed step choices travel with the plan itself.
// POST /api/presentation/select took a median 3.3 s in staging (G lock and a frozen
// context per call), longer than the plan's first step after a decision. For a
// native v2 room the choice is a pure function of the room's frozen config material
// and the committed events: each deal/reveal event gets
//   filmedTake        { profileId, takeKey, id, sha256 }  (same names as the client)
//   filmedTransitions { before, after }                  ({ id, sha256 } | null)
// computed exactly as filmedDealSelection does. The events are first projected as
// the channel sends them (a face-down card is null), so no field can depend on the
// hole card: takes follow the track (flip/v, box, pose), never a card value.
// Anything else (old material, an incomplete plan) returns the plan unchanged, and
// the client keeps POST select. The video's address, file and framing come from the
// room's own frozen configuration, as before.
const visible = event => event?.type === 'deal' && event.faceDown ? { ...event, card: null } : event;

export function withFilmedSteps(presentation, material) {
  if (!presentation || presentation.status !== 'ready' || presentation.kind !== 'plan' || !Array.isArray(presentation.events) || !material) return presentation;
  let planning;
  try { planning = nativeRoomFilmedPlanning(material); } catch { return presentation; }
  if (!planning) return presentation;
  const events = presentation.events.map(visible);
  let plan;
  try {
    plan = planFilmedDealSequence({ profile: planning.profile, events: orderFilmedPresentationEvents(events),
      inventory: planning.inventory, dealerId: planning.dealerId, transitions: planning.transitions });
  } catch { return presentation; }
  if (!plan?.complete) return presentation;
  const clip = id => {
    if (!id) return null;
    const row = material.media.find(item => item.id === id);
    return row ? { id: row.id, sha256: row.sha256 } : undefined;
  };
  const steps = new Map(plan.steps.map(step => [`${step.type}:${step.shoeDraw}`, step]));
  let complete = true;
  const enriched = presentation.events.map(event => {
    const step = ['deal', 'reveal'].includes(event?.type) ? steps.get(`${event.type}:${event.shoeDraw}`) : null;
    if (!step) return event;
    const before = clip(step.beforeVideoId), after = clip(step.afterVideoId), take = clip(step.videoId);
    if (before === undefined || after === undefined || !take || take.sha256 !== step.sha256) { complete = false; return event; }
    return { ...event, filmedTake: { profileId: plan.profileId, takeKey: step.takeKey, id: take.id, sha256: take.sha256 },
      filmedTransitions: { before, after } };
  });
  return complete ? { ...presentation, events: enriched } : presentation;
}

// The frozen config of a version never changes; a small cache spares one SQL read per
// frame and connection. readConfig(roomId, configVersion) returns the stored config.
export function createFilmedStepReader({ readConfig, maxEntries = 64 } = {}) {
  if (typeof readConfig !== 'function' || !Number.isSafeInteger(maxEntries) || maxEntries < 1) throw new TypeError('Explicit config reader required');
  const cache = new Map();
  async function material(roomId, configVersion) {
    const key = `${roomId}\0${configVersion}`;
    if (cache.has(key)) return cache.get(key);
    const config = await readConfig(roomId, configVersion);
    const value = config?.configVersion === configVersion && config.roomId === roomId ? config.material ?? null : null;
    if (value) { cache.set(key, value); if (cache.size > maxEntries) cache.delete(cache.keys().next().value); }
    return value;
  }
  return async function enrich(roomId, presentation) {
    if (!presentation || presentation.kind !== 'plan' || presentation.status !== 'ready' || typeof presentation.configVersion !== 'string') return presentation;
    let value;
    // Missing choices are never fatal: the plan still goes out and select remains.
    try { value = await material(roomId, presentation.configVersion); } catch { return presentation; }
    return withFilmedSteps(presentation, value);
  };
}
