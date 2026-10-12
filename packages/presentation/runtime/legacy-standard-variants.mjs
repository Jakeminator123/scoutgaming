// Read-time view of legacyClipPolicy as standard variants in system A.
// The saved legacyClipPolicy array is left intact. Nothing here writes a file.
import { LEGACY_CLIP_PARTS, LEGACY_PART_LABELS } from './legacy-clip-policy.mjs';
import { mediaSituationForEvent } from './media-family-resolver.mjs';

export const LEGACY_VARIANT_DEALERS = Object.freeze(['vera', 'amira', 'mei']);
const MAX_VARIANTS = 5;
const covered = new Set(LEGACY_VARIANT_DEALERS);
const PLAYING = Object.freeze({ rules: true, model: true, random: false });
const STORED = Object.freeze({ rules: false, model: false, random: false });

// place baseline: the unconditional standard plays this clip (mode off).
// place situation: one event covers several boxes, so the clip is a triggered
// variant and select copies it onto the standard for that exact instruction.
// place stored: no event owns the part; the variant is kept and not auto-played.
// guessed: the original engine has one file for a phase A splits, or no phase.
export const LEGACY_PART_PLACEMENTS = Object.freeze({
  idle: { place: 'baseline', events: ['idle.ready'] },
  think: { place: 'baseline', events: ['turn.player'], guessed: true },
  gest: { place: 'baseline', events: ['settle.blackjack', 'settle.dealerBust', 'settle.win', 'settle.push', 'settle.other'], guessed: true },
  box0: { place: 'situation', eventId: 'deal.player.left', trigger: { id: 'legacy.box.0', path: 'event.box', value: 0, label: 'Plats 1' } },
  box1: { place: 'situation', eventId: 'deal.player.left', trigger: { id: 'legacy.box.1', path: 'event.box', value: 1, label: 'Plats 2' } },
  box2: { place: 'situation', eventId: 'deal.player.centre', trigger: { id: 'legacy.box.2', path: 'event.box', value: 2, label: 'Plats 3' } },
  box3: { place: 'situation', eventId: 'deal.player.centre', trigger: { id: 'legacy.box.3', path: 'event.box', value: 3, label: 'Plats 4' } },
  box4: { place: 'situation', eventId: 'deal.player.centre', trigger: { id: 'legacy.box.4', path: 'event.box', value: 4, label: 'Plats 5' } },
  box5: { place: 'situation', eventId: 'deal.player.right', trigger: { id: 'legacy.box.5', path: 'event.box', value: 5, label: 'Plats 6' } },
  box6: { place: 'situation', eventId: 'deal.player.right', trigger: { id: 'legacy.box.6', path: 'event.box', value: 6, label: 'Plats 7' } },
  'dealer-up': { place: 'situation', eventId: 'deal.dealer', trigger: { id: 'legacy.face-down.false', path: 'event.faceDown', value: false, label: 'Croupierns öppna kort' } },
  'dealer-hole': { place: 'situation', eventId: 'deal.dealer', trigger: { id: 'legacy.face-down.true', path: 'event.faceDown', value: true, label: 'Croupierns dolda kort' }, baselineEvents: ['reveal.dealer'] },
  headTilt: { place: 'stored', eventId: 'idle.ready', guessed: true },
  deal: { place: 'stored', eventId: 'deal.dealer', guessed: true },
  dealWatch: { place: 'stored', eventId: 'deal.dealer', guessed: true },
});

const CLIP_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;

export function isLegacyClipReference(id) {
  return typeof id === 'string' && CLIP_ID.test(id) && !id.includes('..') && !id.includes('\\') && !id.startsWith('/') && !id.includes('://') && !/^[A-Za-z]:\//.test(id);
}

function lineFor(project, dealerId, eventId) {
  return project.lines?.find(line => line.dealerId === dealerId && line.eventId === eventId) ?? null;
}

function setBaseline(project, dealerId, eventId, clipId) {
  const line = lineFor(project, dealerId, eventId);
  const baseline = line?.variants.find(variant => variant.id === line.baselineVariantId);
  if (baseline && baseline.videoGenerationId === null) baseline.videoGenerationId = clipId;
}

function ensureTrigger(project, spec) {
  const found = project.triggers.find(trigger => trigger.path === spec.path && trigger.op === 'eq' && Object.is(trigger.value, spec.value));
  if (found) return found.id;
  if (!Array.isArray(project.triggers) || project.triggers.length >= 128) return null;
  let id = spec.id;
  let serial = 2;
  while (project.triggers.some(trigger => trigger.id === id)) {
    id = `${spec.id}-${serial++}`;
    if (serial > 20) return null;
  }
  project.triggers.push({ id, label: spec.label, category: 'deterministic', path: spec.path, op: 'eq', value: spec.value });
  return id;
}

function addVariant(project, dealerId, eventId, part, clipId, extra) {
  const line = lineFor(project, dealerId, eventId);
  if (!line || line.variants.length >= MAX_VARIANTS) return;
  const id = `${dealerId}.${eventId}.legacy-${part}`;
  if (line.variants.some(variant => variant.id === id)) return;
  const baseline = line.variants.find(variant => variant.id === line.baselineVariantId);
  if (!baseline) return;
  line.variants.push({
    id, label: LEGACY_PART_LABELS[part] ?? part, priority: extra.priority, triggerIds: extra.triggerIds,
    assetId: baseline.assetId, videoGenerationId: clipId, selection: { ...extra.selection },
  });
}

export function applyLegacyStandardVariants(project) {
  if (!project || !Array.isArray(project.legacyClipPolicy)) return project;
  const clips = new Map();
  for (const row of project.legacyClipPolicy) {
    if (!row || !covered.has(row.dealerId) || !isLegacyClipReference(row.clipId) || !Object.hasOwn(LEGACY_PART_PLACEMENTS, row.part)) continue;
    clips.set(`${row.dealerId}/${row.part}`, row.clipId);
  }
  for (const dealerId of LEGACY_VARIANT_DEALERS) {
    for (const part of LEGACY_CLIP_PARTS) {
      const clipId = clips.get(`${dealerId}/${part}`);
      if (!clipId) continue;
      const spec = LEGACY_PART_PLACEMENTS[part];
      if (spec.place === 'baseline') for (const eventId of spec.events) setBaseline(project, dealerId, eventId, clipId);
      else if (spec.place === 'situation') {
        const triggerId = ensureTrigger(project, spec.trigger);
        if (triggerId) addVariant(project, dealerId, spec.eventId, part, clipId, { priority: 10, triggerIds: [triggerId], selection: PLAYING });
        for (const eventId of spec.baselineEvents ?? []) setBaseline(project, dealerId, eventId, clipId);
      } else addVariant(project, dealerId, spec.eventId, part, clipId, { priority: 1, triggerIds: [], selection: STORED });
    }
  }
  return project;
}

// Disposable line for one committed instruction. Saved variants stay unchanged.
export function legacySituationLine(line, event) {
  if (!line || !covered.has(line.dealerId)) return line;
  const situation = mediaSituationForEvent(line.eventId, event);
  if (!situation) return line;
  const match = line.variants.find(variant => variant.id === `${line.dealerId}.${line.eventId}.legacy-${situation}`);
  const baseline = line.variants.find(variant => variant.id === line.baselineVariantId);
  if (!match?.videoGenerationId || !baseline || baseline.videoGenerationId) return line;
  return {
    ...line,
    variants: line.variants.map(variant => variant.id === baseline.id ? { ...variant, videoGenerationId: match.videoGenerationId } : variant),
  };
}
