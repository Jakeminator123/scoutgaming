import event0 from '../animations/speak.goodluck.json' with { type: 'json' };
import event1 from '../animations/speak.insurance.json' with { type: 'json' };
import event2 from '../animations/speak.double.json' with { type: 'json' };
import event3 from '../animations/speak.other.json' with { type: 'json' };
import event4 from '../animations/deal.player.left.json' with { type: 'json' };
import event5 from '../animations/deal.player.centre.json' with { type: 'json' };
import event6 from '../animations/deal.player.right.json' with { type: 'json' };
import event7 from '../animations/deal.dealer.json' with { type: 'json' };
import event8 from '../animations/reveal.dealer.json' with { type: 'json' };
import event9 from '../animations/turn.player.json' with { type: 'json' };
import event10 from '../animations/settle.blackjack.json' with { type: 'json' };
import event11 from '../animations/settle.dealerBust.json' with { type: 'json' };
import event12 from '../animations/settle.win.json' with { type: 'json' };
import event13 from '../animations/settle.push.json' with { type: 'json' };
import event14 from '../animations/settle.other.json' with { type: 'json' };
import event15 from '../animations/idle.ready.json' with { type: 'json' };
import event16 from '../animations/transition.shoe.json' with { type: 'json' };
import index from '../animations/index.json' with { type: 'json' };
import social from '../animations/social-reactions.json' with { type: 'json' };

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const fields = Object.freeze({
  actor: Object.freeze({ x: [-24, 24], y: [-24, 24], rotate: [-12, 12] }),
  face: Object.freeze({ x: [-16, 16], y: [-16, 16], rotate: [-25, 25] }),
  leftArm: Object.freeze({ rotate: [-160, 160], opacity: [0, 1] }),
  rightArm: Object.freeze({ rotate: [-160, 160], opacity: [0, 1] }),
  blush: Object.freeze({ opacity: [0, 1] }),
  sadFace: Object.freeze({ opacity: [0, 1] }),
  coverHands: Object.freeze({ opacity: [0, 1], y: [0, 45] }),
});
export const MOTION_TARGETS = Object.freeze(Object.keys(fields));
const requiredTargets = ['actor', 'face', 'leftArm', 'rightArm', 'blush'];
const neutral = { actor: { x: 0, y: 0, rotate: 0 }, face: { x: 0, y: 0, rotate: 0 }, leftArm: { rotate: 20, opacity: 1 }, rightArm: { rotate: -20, opacity: 1 }, blush: { opacity: 0 }, sadFace: { opacity: 0 }, coverHands: { opacity: 0, y: 40 } };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const fail = message => { throw new TypeError('Invalid lab motion: ' + message); };

/** Validate numeric pose data, never CSS, selectors, code, event predicates or URLs. */
export function validateMotionClip(clip) {
  const isSocial = clip?.scope === 'social-lab';
  if (!exact(clip, isSocial ? ['assetId', 'scope', 'reactionId', 'label', 'durationMs', 'tracks'] : ['assetId', 'eventId', 'label', 'durationMs', 'tracks'])) fail('clip fields');
  if (typeof clip.assetId !== 'string' || !ID.test(clip.assetId)) fail('asset identity');
  if (isSocial) {
    if (typeof clip.reactionId !== 'string' || !ID.test(clip.reactionId) || clip.assetId !== 'social.' + clip.reactionId) fail('social identity');
  } else if (typeof clip.eventId !== 'string' || !ID.test(clip.eventId) || !clip.assetId.startsWith(clip.eventId + '.')) fail('asset/event identity');
  if (typeof clip.label !== 'string' || !clip.label.trim() || clip.label.length > 120) fail('label');
  if (!Number.isInteger(clip.durationMs) || clip.durationMs < 200 || clip.durationMs > 10000) fail('duration');
  if (!Array.isArray(clip.tracks) || clip.tracks.length < requiredTargets.length || clip.tracks.length > MOTION_TARGETS.length) fail('tracks');
  const seen = new Set();
  for (const track of clip.tracks) {
    if (!exact(track, ['target', 'frames']) || !Object.hasOwn(fields, track.target) || seen.has(track.target)) fail('target');
    seen.add(track.target);
    const values = fields[track.target];
    if (!Array.isArray(track.frames) || track.frames.length < 3 || track.frames.length > 20) fail('frames');
    // Old arm tracks only rotate; a social pose can additionally fade to bent arms.
    const properties = Object.keys(values).filter(property => !(track.target.endsWith('Arm') && property === 'opacity' && !Object.hasOwn(track.frames[0], 'opacity')));
    let previous = -1;
    for (const frame of track.frames) {
      if (!exact(frame, ['at', ...properties]) || !Number.isFinite(frame.at) || frame.at <= previous || frame.at < 0 || frame.at > 1) fail('frame offset/fields');
      previous = frame.at;
      for (const property of properties) {
        const [min, max] = values[property];
        if (!Number.isFinite(frame[property]) || frame[property] < min || frame[property] > max) fail('numeric pose range');
      }
    }
    const first = track.frames[0], last = track.frames.at(-1);
    if (first.at !== 0 || last.at !== 1) fail('timeline endpoints');
    for (const [property, value] of Object.entries(neutral[track.target])) {
      if (!properties.includes(property)) continue;
      if (first[property] !== value || last[property] !== value) fail('neutral endpoints');
    }
  }
  if (!requiredTargets.every(target => seen.has(target))) fail('required targets');
  return clip;
}

const events = [event0, event1, event2, event3, event4, event5, event6, event7, event8, event9, event10, event11, event12, event13, event14, event15, event16];
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export const MOTION_INDEX = freeze(index);
export const MOTION_CLIPS = freeze(events.flatMap(event => {
  if (event.schemaVersion !== 1 || !Array.isArray(event.clips) || event.clips.some(clip => clip.eventId !== event.eventId)) fail('event file');
  return event.clips.map(validateMotionClip);
}));
if (social.schemaVersion !== 1 || social.scope !== 'social-lab' || !Array.isArray(social.clips) || social.clips.some(clip => clip.scope !== 'social-lab')) fail('social file');
export const SOCIAL_MOTION_CLIPS = freeze(social.clips.map(validateMotionClip));
const byAsset = new Map([...MOTION_CLIPS, ...SOCIAL_MOTION_CLIPS].map(clip => [clip.assetId, clip]));
if (byAsset.size !== MOTION_CLIPS.length + SOCIAL_MOTION_CLIPS.length || MOTION_INDEX.clipCount !== MOTION_CLIPS.length || MOTION_INDEX.socialClipCount !== SOCIAL_MOTION_CLIPS.length) fail('registry identity/count');
export function getMotionClip(assetId) { return byAsset.get(assetId); }
export function motionAllowedForSource(clip, sourceType) { return !clip || clip.scope !== 'social-lab' || sourceType === 'idle'; }

// Authoritative presentation facts stay intact even for a transient/manual preview.
export function stageBaseAnimation(event, requestedAnimation) {
  if (event.sourceType === 'transition') return 'idle';
  if (event.sourceType === 'reveal') return 'reveal';
  if (event.sourceType === 'deal') {
    const action = event.exampleEvent?.clip?.action;
    if (['deal-left', 'deal-centre', 'deal-right', 'deal-dealer'].includes(action)) return action;
    return { 'deal.player.left': 'deal-left', 'deal.player.centre': 'deal-centre', 'deal.player.right': 'deal-right', 'deal.dealer': 'deal-dealer' }[event.id] || 'deal-centre';
  }
  return requestedAnimation || (event.sourceType === 'settle' ? 'celebrate' : event.sourceType === 'idle' ? 'idle' : 'wave');
}
