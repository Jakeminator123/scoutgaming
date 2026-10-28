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
// The channel's own identity and hash rules (shared-room-channel.mjs). A value it would refuse
// is never attached: one bad record must not close every plan frame with 1011.
const channelId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
const channelRef = ref => ref === null || channelId(ref?.id) && typeof ref.sha256 === 'string' && /^[a-f0-9]{64}$/.test(ref.sha256);

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
    if (before === undefined || after === undefined || !take || take.sha256 !== step.sha256
      || !channelId(plan.profileId) || !channelId(step.takeKey) || ![take, before, after].every(channelRef)) { complete = false; return event; }
    return { ...event, filmedTake: { profileId: plan.profileId, takeKey: step.takeKey, id: take.id, sha256: take.sha256 },
      filmedTransitions: { before, after } };
  });
  return complete ? { ...presentation, events: enriched } : presentation;
}

// The frozen config of a version never changes, and neither does a delivered plan version:
// the material is cached per config version and the enriched plan per (room, ver, talk), so
// the planning runs once per plan rather than per socket and update.
// readConfig(roomId, configVersion) returns the stored config.
export function createFilmedStepReader({ readConfig, maxEntries = 64 } = {}) {
  if (typeof readConfig !== 'function' || !Number.isSafeInteger(maxEntries) || maxEntries < 1) throw new TypeError('Explicit config reader required');
  const cache = new Map(), plans = new Map();
  const remember = (map, key, value) => { map.set(key, value); if (map.size > maxEntries) map.delete(map.keys().next().value); return value; };
  async function material(roomId, configVersion) {
    const key = `${roomId}\0${configVersion}`;
    if (cache.has(key)) return cache.get(key);
    const config = await readConfig(roomId, configVersion);
    const value = config?.configVersion === configVersion && config.roomId === roomId ? config.material ?? null : null;
    if (value) remember(cache, key, value);
    return value;
  }
  return async function enrich(roomId, presentation) {
    if (!presentation || presentation.kind !== 'plan' || presentation.status !== 'ready' || typeof presentation.configVersion !== 'string') return presentation;
    const key = JSON.stringify([roomId, presentation.ver, presentation.talkId, presentation.configVersion]);
    const cached = plans.get(key);
    if (cached?.source === presentation) return cached.value;
    let value;
    // Missing choices are never fatal: the plan still goes out and select remains (not cached).
    try { value = await material(roomId, presentation.configVersion); } catch { return presentation; }
    if (!value) return presentation;
    // The receiver row is immutable per ver; a different object with the same key is the same plan,
    // so reuse its result only when the events are byte-equal.
    if (cached && JSON.stringify(cached.source.events) === JSON.stringify(presentation.events)) return cached.value;
    return remember(plans, key, { source: presentation, value: withFilmedSteps(presentation, value) }).value;
  };
}
