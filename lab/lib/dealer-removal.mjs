import { DEALER_IDS } from './studio-model.mjs';

// Draft-only operation. The saved registry, media bytes and published packages
// have their own lifecycles and are never altered by this pure helper.
export function dealerRemovalStatus(project, dealerId) {
  const dealer = project.dealers.find(row => row.id === dealerId);
  if (!dealer) return { kind: 'missing', references: [], message: 'Dealern finns inte i utkastet.' };
  if (DEALER_IDS.includes(dealerId)) return { kind: 'base', references: [], message: 'Grunddealers kan inte tas bort.' };
  const references = (project.lanes ?? []).filter(lane => lane.dealers.includes(dealerId)
    || lane.layers.dealer.default === dealerId || lane.layers.dealer.allowed.includes(dealerId))
    .map(lane => ({ id: lane.id, label: lane.label }));
  if (references.length) return { kind: 'referenced', references,
    message: 'Ta först bort dealern från presentationerna: ' + references.map(row => row.label).join(', ') + '.' };
  return { kind: 'ready', references: [], message: '' };
}
