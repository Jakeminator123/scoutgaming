// Miljöer och material: pure helpers for the environment list, the editor's "Används av" and the material
// counts. Read from the registered catalog and the project draft; nothing here writes.
const roomHref = id => '/admin/rooms/' + encodeURIComponent(id) + '?flik=utseende';

/** The live and paused tables that use an environment, with their company and a link to the table's own editor,
 * where publication happens. Archived tables are left out. */
export function environmentRooms(catalog, laneId) {
  if (!laneId) return [];
  const operators = catalog?.administration?.operators ?? [];
  return (catalog?.administration?.rooms ?? []).filter(room => room.compositionId === laneId && room.state !== 'archived')
    .map(room => ({ id: room.id, name: room.name, game: room.game === 'roulette' ? 'roulette' : 'blackjack', state: room.state === 'live' ? 'live' : 'paused',
      published: Boolean(room.published), operatorId: room.operatorId,
      operatorName: operators.find(operator => operator.id === room.operatorId)?.name ?? room.operatorId, href: roomHref(room.id) }))
    .sort((a, b) => a.operatorName.localeCompare(b.operatorName, 'sv') || a.name.localeCompare(b.name, 'sv'));
}

/** Counts for the two tabs and the three material filters. */
export function environmentCounts(project) {
  const assets = project?.layerAssets ?? [];
  const background = assets.filter(asset => asset.role === 'background').length, table = assets.filter(asset => asset.role === 'table').length;
  const archived = (project?.layerAssetTrash ?? []).filter(entry => ['background', 'table'].includes(entry?.asset?.role)).length;
  return { miljoer: project?.lanes?.length ?? 0, material: background + table, bakgrund: background, bordsgrafik: table, arkiverat: archived };
}
