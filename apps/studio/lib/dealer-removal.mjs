// Local references are informative. The server checks the complete consequences
// and archives the dealer with its linked compositions, rooms and owned media.
export function dealerRemovalStatus(project, dealerId) {
  const dealer = project.dealers.find(row => row.id === dealerId);
  if (!dealer) return { kind: 'missing', references: [], message: 'Dealern finns inte i utkastet.' };
  const references = (project.lanes ?? []).filter(lane => lane.dealers.includes(dealerId)
    || lane.layers.dealer.default === dealerId || lane.layers.dealer.allowed.includes(dealerId))
    .map(lane => ({ id: lane.id, label: lane.label }));
  return { kind: 'ready', references, message: '' };
}
