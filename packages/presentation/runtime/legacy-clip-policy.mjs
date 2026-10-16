// Exact bindings for the existing shared engine. Media bytes, recorded speech
// and game decisions remain in their original registers. Only Lab edits these
// bindings; old BO picks are review data and are never runtime fallbacks.
export const LEGACY_DEALERS = Object.freeze(['astrid']);
// Archived projects and dealer trash retain their original bindings for history.
const STORED_LEGACY_DEALERS = Object.freeze(['vera', 'astrid', 'amira', 'mei']);
export const LEGACY_ENGINE_PARTS = Object.freeze(['idle', 'headTilt', 'deal', 'dealWatch', 'think', 'gest']);
export const LEGACY_CLIP_PARTS = Object.freeze([...LEGACY_ENGINE_PARTS, 'box0', 'box1', 'box2', 'box3', 'box4', 'box5', 'box6', 'dealer-up', 'dealer-hole']);
export const LEGACY_PART_LABELS = Object.freeze({ idle: 'Grundidle', headTilt: 'Huvudrörelse', deal: 'Delningsrörelse', dealWatch: 'Följ utdelning', think: 'Vänta på beslut', gest: 'Resultatgest', box0: 'Plats 1', box1: 'Plats 2', box2: 'Plats 3', box3: 'Plats 4', box4: 'Plats 5', box5: 'Plats 6', box6: 'Plats 7', 'dealer-up': 'Croupierns öppna kort', 'dealer-hole': 'Croupierns dolda kort' });
const object = value => value && typeof value === 'object' && !Array.isArray(value);

export function validateLegacyClipPolicy(policy) {
  const fail = () => { throw new Error('Ogiltig klippkoppling: välj en unik exakt dealer, situation och registrerad fil i Lab.'); };
  if (!Array.isArray(policy) || policy.length > 60) fail();
  const seen = new Set();
  for (const binding of policy) {
    if (!object(binding) || Object.keys(binding).length !== 3 || !STORED_LEGACY_DEALERS.includes(binding.dealerId)
      || !LEGACY_CLIP_PARTS.includes(binding.part) || typeof binding.clipId !== 'string'
      || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(binding.clipId) || binding.clipId.includes('..')) fail();
    const key = `${binding.dealerId}/${binding.part}`;
    if (seen.has(key)) fail();
    seen.add(key);
  }
  return policy;
}

export function legacyBindingCandidate(inventory, binding) {
  return inventory.clips.find(clip => clip.id === binding.clipId && clip.dealerId === binding.dealerId
    && clip.available && clip.exactParts.includes(binding.part)) ?? null;
}

export function resolveLegacyClipPolicy(project, inventory) {
  validateLegacyClipPolicy(project.legacyClipPolicy ?? []);
  const dealers = Object.fromEntries(LEGACY_DEALERS.map(id => [id, { engine: {}, staged: {} }]));
  const conflicts = [];
  for (const binding of project.legacyClipPolicy ?? []) {
    if (!LEGACY_DEALERS.includes(binding.dealerId)) { conflicts.push({ ...binding, reason: 'avvecklad_dealer', active: false }); continue; }
    const clip = legacyBindingCandidate(inventory, binding);
    if (!clip) { conflicts.push({ ...binding, reason: 'exakt_familj_eller_fil_saknas', active: false }); continue; }
    if (clip.kind === 'engine') dealers[binding.dealerId].engine[binding.part] = clip.engineKey;
    else if (clip.kind === 'performance') dealers[binding.dealerId].staged[binding.part] = clip.id;
  }
  return { source: 'lab/project.json', projectRevision: project.revision, dealers, conflicts, actualPlayback: false };
}

export function upsertLegacyClipBinding(policy, binding) {
  if (binding.clipId && !LEGACY_DEALERS.includes(binding.dealerId)) throw new Error('Dealern är avvecklad och kan inte få nya klippkopplingar.');
  const next = (policy ?? []).filter(row => row.dealerId !== binding.dealerId || row.part !== binding.part);
  if (binding.clipId) next.push(binding);
  return validateLegacyClipPolicy(next);
}
