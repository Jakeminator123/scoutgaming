// UI classification only. Never infer a runtime binding from a clip's duration.
export const DEALER_WORKSPACE_SECTIONS = Object.freeze([
  { id: 'idle', label: 'Idle' },
  { id: 'deal', label: 'Kort & deal' },
  { id: 'clips', label: 'Fasta repliker / ljud' },
]);
// Former tabs that became their own pages. Old bookmarks still land there.
const MOVED_SECTIONS = Object.freeze({ background: '/control/zones', probe: '/control/probe', stream: '/control/activity' });
const idleParts = new Set(['idle', 'headTilt', 'think', 'gest']);
const dealParts = new Set(['deal', 'dealWatch', 'box0', 'box1', 'box2', 'box3', 'box4', 'box5', 'box6', 'dealer-up', 'dealer-hole']);
export function workspaceLocation(hash) {
  const value = String(hash ?? '').replace(/^#/, '');
  if (value === 'upload') return { section: 'idle', upload: true, redirect: null };
  if (Object.hasOwn(MOVED_SECTIONS, value)) return { section: 'idle', upload: false, redirect: MOVED_SECTIONS[value] };
  return { section: DEALER_WORKSPACE_SECTIONS.some(row => row.id === value) ? value : 'idle', upload: false, redirect: null };
}
export function legacyPartInSection(part, section) {
  if (!section || section === 'all') return true;
  return section === 'idle' ? idleParts.has(part) : section === 'deal' ? dealParts.has(part) : false;
}
export function legacyClipInSection(clip, section) {
  if (!section || section === 'all') return true;
  if (section === 'clips') return clip.kind === 'recorded-speech' || Boolean(clip.lineId);
  return clip.exactParts.some(part => legacyPartInSection(part, section));
}
export function selectedDealerClips(clips, dealerId, section) {
  return clips.filter(clip => clip.dealerId === dealerId && legacyClipInSection(clip, section));
}
export function supportsFamilyWorkspace(dealerId) { return dealerId === 'astrid'; }
