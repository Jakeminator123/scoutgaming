import { DEALER_IDS, validateProject } from './studio-model.mjs';

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

export function removeDealerFromDraft(project, dealerId) {
  validateProject(project);
  const status = dealerRemovalStatus(project, dealerId);
  if (status.kind !== 'ready') throw new Error(status.message);
  const next = structuredClone(project);
  next.dealers = next.dealers.filter(row => row.id !== dealerId);
  next.lines = next.lines.filter(row => row.dealerId !== dealerId);
  if (next.dealerIdlePolicies) next.dealerIdlePolicies = next.dealerIdlePolicies.filter(row => row.dealerId !== dealerId);
  return validateProject(next);
}
