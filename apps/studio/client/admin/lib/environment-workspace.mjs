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

const TOKEN = /^[a-z][a-z0-9-]{0,63}$/;
/** The table and company a room link opened the editor from (`operator` and `table` in the address), or null.
 * Room links (the partner portal, Beroenden, the company's table list) keep publishing the environment's saved
 * placement for that company here, and name the table; a table that uses another environment says so.
 * An unknown, foreign or archived table gives no table, never another one; a company without a table still counts. */
export function environmentRoomContext(catalog, laneId, { operator = null, table = null } = {}) {
  const administration = catalog?.administration, operators = administration?.operators ?? [];
  const room = typeof table === 'string' && TOKEN.test(table)
    ? (administration?.rooms ?? []).find(row => row.id === table && row.state !== 'archived' && (!operator || row.operatorId === operator)) : undefined;
  const operatorId = room?.operatorId ?? (typeof operator === 'string' && TOKEN.test(operator) ? operator : null);
  const company = operatorId ? operators.find(row => row.id === operatorId && !row.archivedAt) : undefined;
  if (!company) return null;
  return { operatorId: company.id, operatorSlug: company.slug || company.id, operatorName: company.name,
    room: room ? { id: room.id, name: room.name, compositionId: room.compositionId, game: room.game === 'roulette' ? 'roulette' : 'blackjack' } : null,
    sameEnvironment: !room || room.compositionId === laneId,
    choicesHref: room ? '/admin/rooms?' + new URLSearchParams({ operator: company.id, table: room.id, ...(room.compositionId ? { composition: room.compositionId } : {}), game: room.game === 'roulette' ? 'roulette' : 'blackjack' }) : null,
    query: { operator: company.id, ...(room ? { table: room.id } : {}) } };
}

export const UPLOAD_NAVIGATION_MESSAGE = 'Vänta tills uppladdningen är klar innan du lämnar miljön.';
/** While an upload in the environment editor runs, every in-app navigation is refused (the editor would unmount and
 * abort it) and a reload or close asks first. Returns the cleanup. `target` is the window. */
export function holdNavigationDuringUpload(target, onBlocked = () => {}) {
  const navigate = event => { event.preventDefault(); onBlocked(UPLOAD_NAVIGATION_MESSAGE); };
  const unload = event => { event.preventDefault(); event.returnValue = ''; };
  target.addEventListener('studio:before-navigate', navigate);
  target.addEventListener('beforeunload', unload);
  return () => { target.removeEventListener('studio:before-navigate', navigate); target.removeEventListener('beforeunload', unload); };
}
