import { createPublicOperatorRooms, isUnplayableOperatorRooms } from '../../../packages/operators/server/public-rooms.mjs';
import { validatePublicOperatorRooms } from '../../../packages/presentation/contracts/operator-rooms-contract.mjs';
import { roomEnvironment } from '../../../packages/presentation/contracts/room-environment.mjs';
import { gameLaneConfiguration } from '../../../packages/presentation/contracts/game-lanes.mjs';
import {isPresentationRoom, roomGame} from '../../../packages/presentation/contracts/presentation-room.mjs';
import {inspectPackageRooms} from '../../../packages/presentation/server/package-rooms.mjs';
import { readPackagePresentation } from '../../../packages/presentation/server/presentation-package.mjs';
import { readOperatorLifecycle } from '../../../packages/operators/server/operator-lifecycle.mjs';
import { createOperatorStore } from '../../../packages/operators/server/operator-store.mjs';
import { designPreviewHeaders } from './design-preview.mjs';
import { adminAssignmentView } from './partner-assignment.mjs';

// Bolag › Tilldelat: Admins tilldelning ur det publicerade paketet (null utan fryst presentation).
// Ett paket vars presentation inte går att läsa visar ingen tilldelning i stället för att fälla katalogen.
function assignmentOf(pack) {
  try { return adminAssignmentView(pack, readPackagePresentation(pack)); } catch { return null; }
}
const unavailable = () => { throw Object.assign(new Error('design_catalog_unavailable'), { statusCode: 503 }); };

// Reads existing scoped registers only. No migrations, seeds, publication or
// mutation handlers are used, and no private package/media objects leave here.
export async function registeredDesignCatalog({ store, policy, now = Date.now }) {
  const saved = await policy.readSaved();
  const listed = await store.listOperators();
  if (!Array.isArray(listed) || listed.length > 1000 || !saved?.project || !saved?.administration) unavailable();
  const operators = [], packages = new Map(), seen = new Set();
  for (const row of listed) {
    if (seen.has(row.id) || operators.some(item => item.slug === row.slug)) unavailable();
    seen.add(row.id);
    const pack = await store.getCurrentPackage(row.id);
    if (pack && pack.operatorId !== row.id) unavailable();
    packages.set(row.id, pack);
    operators.push({ id: row.id, slug: row.slug, name: row.name, status: row.status, packageRevision: pack?.revision ?? null,
      archivedAt: readOperatorLifecycle(pack?.branding).operator?.archivedAt ?? null, assignment: assignmentOf(pack) });
  }
  // Each public room is checked by the same selector used at game entry, using
  // captured data throughout the response. Game entry revalidates on launch.
  const frozenStore = {
    getOperatorBySlug: async slug => listed.find(row => row.slug === slug) ?? null,
    getCurrentPackage: async id => packages.get(id) ?? null,
    // The published bet profile per room, read for the captured package above (the lobby's room picture).
    ...(typeof store.getPublishedRoomLimitPresets === 'function' ? { getPublishedRoomLimitPresets: pack => store.getPublishedRoomLimitPresets(pack) } : {}),
  };
  const roomReader = createPublicOperatorRooms({ store: frozenStore, policy: {
    readSaved: async () => saved,
    readGameConfiguration: async () => ({ ...gameLaneConfiguration(saved.administration),
      tiers: saved.administration.tiers, rooms: saved.administration.rooms, pitboss: saved.administration.pitboss,
      tournaments: saved.administration.tournaments, revision: saved.revision, projectRevision: saved.projectRevision,
      administrationRevision: saved.administrationRevision, configurationSource: saved.configurationSource }),
  } });
  const catalogs = [], unavailableOperators = [];
  const publications=new Map(operators.map(operator=>[operator.id,new Map(inspectPackageRooms({administration:saved.administration,
    package:packages.get(operator.id),operatorId:operator.id}).map(row=>[row.room.id,row]))]));
  for (const operator of operators.filter(row => row.status === 'active')) {
    try {
      const value = await roomReader.read(operator.slug);
      if (value) {
        const catalog = validatePublicOperatorRooms(value, { operatorSlug: operator.slug });
        if (catalog.rooms.length) catalogs.push(catalog);
      }
    } catch (error) {
      if (!isUnplayableOperatorRooms(error, operator.slug)) throw error;
      unavailableOperators.push(operator.slug);
    }
  }
  const project = saved.project;
  const dealers = [
    ...project.dealers.map(row => ({ id: row.id, name: row.label, archived: false })),
    ...(project.dealerTrash ?? []).map(row => ({ id: row.dealer.id, name: row.dealer.label, archived: true })),
  ];
  // A lane's saved miljöbild, for Admin's own pictures (scene cards, room pictures) through Admin's layer route.
  const illustrationOf = lane => typeof lane?.illustration === 'string' && (project.layerAssets ?? []).some(asset => asset.id === lane.illustration && asset.role === 'illustration')
    ? '/studio/api/layer-assets/' + encodeURIComponent(lane.illustration) : null;
  const compositions = (project.lanes ?? []).map(row => ({ id: row.id, name: row.label,
    dealerIds: [...row.layers.dealer.allowed], defaultDealerId: row.layers.dealer.default,
    ...(illustrationOf(row) ? { illustration: illustrationOf(row) } : {}) }));
  const rooms = (saved.administration.rooms ?? []).filter(isPresentationRoom).map(row => {
    const operator = operators.find(item => item.id === row.operatorId);
    const pack = packages.get(row.operatorId);
    const frozen = pack ? readPackagePresentation(pack) : null;
    const publication=publications.get(row.operatorId)?.get(row.id);
    const published = Boolean(publication);
    const playable = catalogs.find(item => item.operator.slug === operator?.slug)?.rooms.find(item => item.id === row.id);
    const composition = compositions.find(item => item.id === row.presentationLaneId);
    const frozenLane = published ? frozen.lanes.find(item => item.id === row.presentationLaneId) : null;
    const dealerIds = published ? [...frozenLane.layers.dealer.allowed] : composition?.dealerIds ?? [];
    const roomDealers = dealerIds.map(id => ({ id, name: (published ? frozen.registeredDealers?.find(item => item.id === id)?.label : null)
      ?? dealers.find(item => item.id === id)?.name ?? id }));
    return { id: row.id, name: row.name, operatorId: row.operatorId, game: roomGame(row), state: row.state,
      compositionId: row.presentationLaneId, laneId: row.gameLaneId, published, playable: Boolean(playable),
      dealerIds, dealers: roomDealers, dealerSource: published ? 'published' : 'saved',
      environment: playable ? roomEnvironment(playable, operator.slug) : null,
      ...(composition?.illustration ? { illustration: composition.illustration } : {}),
      playUrl: playable?.playUrl ?? null,
      ...(publication&&!publication.materialsCompatible?{materialWarning:'catalog_game_material_mismatch'}:{}) };
  });
  const result = { schemaVersion: 1, source: 'registered', readAt: new Date(now()).toISOString(),
    administration: { revisions: { project: saved.projectRevision, administration: saved.administrationRevision },
      operators, rooms, dealers, compositions }, lobby: { catalogs, unavailableOperators } };
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 2 * 1024 * 1024) unavailable();
  return result;
}

export function createDesignCatalogReader({ pool, scope, policy }) {
  return async () => registeredDesignCatalog({ store: await createOperatorStore({ sql: pool, scope }), policy });
}

export async function serveDesignCatalog(request, { authorize, readCatalog }) {
  const headers = { ...designPreviewHeaders, 'Content-Type': 'application/json; charset=utf-8' };
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
  if (typeof authorize !== 'function' || typeof readCatalog !== 'function') unavailable();
  await authorize(new Request(request.url, { method: 'GET', headers: request.headers, signal: request.signal }));
  if (new URL(request.url).search) return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400, headers });
  const catalog = await readCatalog();
  return new Response(request.method === 'HEAD' ? null : JSON.stringify(catalog), { headers });
}
