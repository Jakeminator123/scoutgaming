import { registeredIdlePolicy, registeredIdleInventory } from '../../presentation-runtime/registered-idle-policy.mjs';
import { frozenPlaybackProject } from '../frozen-dealer-playback.mjs';
import { isPresentationRoomLaneCompatible } from './frozen-presentation-capture.mjs';
import { createOperatorStore } from './operator-store.mjs';
import { validateStudioScope, studioStorageFailure, canonicalStudioJson } from './studio-contract.mjs';
import {PRESENTATION_PACKAGE_KEY} from './presentation-package.mjs';
import { validateStudioGameAdministration } from './studio-game-policy.mjs';
import { isActiveDealerId as isDealerId } from '../dealer-identity.mjs';
import { isGameLaneId, isOperatorSlug } from '../public/game-lanes.mjs';
import { isPresentationRoom } from '../presentation-room-contract.mjs';
import { StudioStorageError } from './studio-contract.mjs';
import { resolveFrozenDealerIdle, validateFrozenRegisteredDealers } from './frozen-dealer-idle.mjs';

const prefix = '/api/presentation/registered-idle/';
const videoPrefix = '/api/presentation/registered-video/';
const mediaIdPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const fail = (code, statusCode) => { throw new StudioStorageError(code, statusCode); };
const exactContext = value => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === 4 && ['operatorSlug', 'roomId', 'packageRevision', 'dealerId'].every(key => Object.hasOwn(value, key));

function validateContext(value) {
  if (!exactContext(value) || !isOperatorSlug(value.operatorSlug) || !isGameLaneId(value.roomId)
    || !Number.isSafeInteger(value.packageRevision) || value.packageRevision < 1
    || !isDealerId(value.dealerId)) fail('studio_presentation_idle_context_invalid', 400);
  return Object.freeze({ ...value });
}
function idlePath(context) {
  return `${prefix}${context.operatorSlug}/${context.roomId}/${context.packageRevision}/${context.dealerId}`;
}
function publicIdle(record, context) {
  if (!record) return null;
  return { id: record.id, sha256: record.sha256, fileName: record.classification.label,
    src: idlePath(context), ...(record.classification.compositing ? { compositing: structuredClone(record.classification.compositing) } : {}),
    ...(record.classification.framing ? {framing:structuredClone(record.classification.framing)} : {}) };
}

/**
 * Callers authenticate the player before using this read-only service.
 * readCurrentContext must return one uncached, atomic operator/package/admin
 * snapshot; the ordinary game-entry cache must never authorize media here.
 * readPresentation is the server's validated package decoder. No live media
 * registry, project baseline or browser-supplied media record is consulted.
 */
export function createFrozenDealerPresentationContext({ readCurrentContext, readPresentation, privateMedia } = {}) {
  if (typeof readCurrentContext !== 'function' || typeof readPresentation !== 'function' || typeof privateMedia !== 'function') {
    throw new TypeError('Explicit frozen presentation readers required');
  }
  async function resolve(input) {
    const context = validateContext(input);
    const saved = await readCurrentContext(context.operatorSlug, context.packageRevision);
    if (!saved) fail('studio_presentation_idle_context_unavailable', 503);
    const { operator, package: pack, administration } = saved;
    if (!operator || operator.slug !== context.operatorSlug || operator.status !== 'active') {
      fail('studio_presentation_idle_room_unavailable', 404);
    }
    if (!pack) fail('studio_presentation_idle_room_unavailable', 404);
    if (pack.operatorId !== operator.id || !Number.isSafeInteger(pack.revision) || pack.revision < 1) {
      fail('studio_presentation_idle_context_unavailable', 503);
    }
    if (pack.revision !== context.packageRevision) fail('studio_presentation_idle_package_changed', 409);
    if (!Array.isArray(administration?.rooms) || !Array.isArray(administration?.gameLanes)
      || !Array.isArray(pack.tables) || !Array.isArray(pack.lanes)) fail('studio_presentation_idle_context_unavailable', 503);
    const rooms = administration.rooms.filter(room => room?.id === context.roomId);
    const room = rooms.length === 1 ? rooms[0] : null;
    if (!isPresentationRoom(room) || room.operatorId !== operator.id || room.state !== 'live' || !pack.tables.includes(room.id)) {
      fail('studio_presentation_idle_room_unavailable', 404);
    }
    const presentation = readPresentation(pack);
    if (![2, 3].includes(presentation?.schemaVersion)) fail('studio_presentation_idle_package_update_required', 409);
    if (!Array.isArray(presentation.lanes) || !Array.isArray(presentation.registeredDealers)) fail('studio_presentation_idle_context_unavailable', 503);
    const dealerIds = [...new Set(presentation.lanes.flatMap(lane => [...lane.dealers, ...lane.layers.dealer.allowed]))];
    validateFrozenRegisteredDealers(presentation.registeredDealers, { dealerIds });
    const lanes = presentation.lanes.filter(lane => lane.id === room.presentationLaneId);
    const lane = lanes.length === 1 ? lanes[0] : null;
    const gameLanes = administration.gameLanes.filter(item => item?.id === room.gameLaneId);
    const gameLane = gameLanes.length === 1 ? gameLanes[0] : null;
    if (!lane || !pack.lanes.includes(lane.id) || !Array.isArray(lane.layers?.dealer?.allowed)
      || !lane.layers.dealer.allowed.includes(context.dealerId) || !gameLane
      || !isPresentationRoomLaneCompatible(gameLane,lane,presentation)
      || gameLane.schemaVersion !== 1 || gameLane.renderer !== 'portrait-video'
      || presentation.schemaVersion === 2 && (gameLane.dealer !== context.dealerId || gameLane.mediaCollection !== `${context.dealerId}-presentation`)) {
      fail('studio_presentation_idle_room_unavailable', 404);
    }
    const entries = presentation.registeredDealers.filter(entry => entry.id === context.dealerId);
    if (entries.length !== 1) fail('studio_presentation_idle_room_unavailable', 404);
    const record = resolveFrozenDealerIdle(presentation.registeredDealers, {
      dealerId: context.dealerId, allowedDealerIds: lane.layers.dealer.allowed,
    });
    const project = presentation.schemaVersion === 3 ? frozenPlaybackProject(presentation.playback, {registeredDealers:presentation.registeredDealers, projectRevision:presentation.projectRevision}) : null;
    const records = presentation.schemaVersion === 3 ? presentation.playback.media.filter(row => row.classification.dealerId === context.dealerId) : record ? [record] : [];
    const inventoryRecords = presentation.schemaVersion === 3 ? presentation.playback.media : records;
    const inventory = {families:[], videos:inventoryRecords.map(row => ({id:row.id, dealer:row.classification.dealerId, sha256:row.sha256, bytes:row.size,
      available:true, integrity:'verified', eventId:row.classification.eventId, playbackType:'once', fileName:row.classification.label, classification:structuredClone(row.classification)}))};
    const idlePolicy = project ? registeredIdlePolicy(project,context.dealerId) : null;
    const idleInventory = idlePolicy ? registeredIdleInventory(inventory,{dealerId:context.dealerId,policy:idlePolicy}) : {videos:[],families:[]};
    for (const video of idleInventory.videos) {
      const media = records.find(row => row.id === video.id);
      video.label = video.fileName; video.fileName = video.id + '.' + media.contentType.slice(6);
    }
    return { context, projectRevision: presentation.projectRevision, schemaVersion:presentation.schemaVersion, idlePolicy, idleInventory,
      configurationSource:'operator-package-v' + presentation.schemaVersion, lane:structuredClone(lane), project, inventory, records,
      dealer: { id: context.dealerId, label: entries[0].label }, record };
  }
  async function configuration(input) {
    const resolved = await resolve(input);
    return { owner: 'web', configurationSource: resolved.configurationSource,
      projectRevision: resolved.projectRevision, packageRevision: resolved.context.packageRevision,
      operator: resolved.context.operatorSlug, roomId: resolved.context.roomId, dealer: resolved.dealer,
      dealerIdle: { [resolved.dealer.id]: publicIdle(resolved.record, resolved.context) },
      ...(resolved.schemaVersion === 3 ? {idlePolicy:resolved.idlePolicy,inventory:{families:structuredClone(resolved.idleInventory.families),videos:resolved.records.map(row => {
        const idle = resolved.idleInventory.videos.find(video => video.id === row.id);
        return {...publicVideo(resolved,row.id),available:true,...(idle ? {familyId:idle.familyId,role:idle.role,dealer:resolved.dealer.id} : {})};
      })}} : {}) };
  }
  function publicVideo(resolved, mediaId) {
    const record = resolved.records.find(row => row.id === mediaId && row.classification.dealerId === resolved.context.dealerId);
    if (!record) return null;
    if (resolved.schemaVersion === 2) return record.id === resolved.record?.id ? publicIdle(record,resolved.context) : null;
    return {...publicIdle(record,resolved.context), src:videoPrefix + [resolved.context.operatorSlug,resolved.context.roomId,resolved.context.packageRevision,resolved.context.dealerId,record.id].join('/')};
  }
  async function response(request) {
    const url = new URL(request.url);
    const eventMedia = url.pathname.startsWith(videoPrefix);
    if (!eventMedia && !url.pathname.startsWith(prefix)) return null;
    const json = (status, code) => new Response(request.method === 'HEAD' ? null : JSON.stringify({ error: code }),
      { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405,
      headers: { Allow: 'GET, HEAD', 'Cache-Control': 'private, no-store' } });
    if (url.search || url.hash) return json(400, 'studio_presentation_idle_context_invalid');
    const parts = url.pathname.slice(eventMedia ? videoPrefix.length : prefix.length).split('/');
    if (parts.length !== (eventMedia ? 5 : 4) || eventMedia && !mediaIdPattern.test(parts[4]) || !/^[1-9][0-9]{0,15}$/.test(parts[2])) return json(400, 'studio_presentation_idle_context_invalid');
    try {
      const resolved = await resolve({ operatorSlug: parts[0], roomId: parts[1], packageRevision: Number(parts[2]), dealerId: parts[3] });
      const record = eventMedia ? (resolved.schemaVersion === 3 ? resolved.records.find(row => row.id === parts[4]) : null) : resolved.record;
      if (!record) return json(404, 'studio_presentation_idle_media_unavailable');
      const { pathname, sha256, size, contentType } = record;
      return await privateMedia({ provider: 'vercel-blob', pathname, sha256, size, contentType }, request);
    } catch (error) {
      const status = [400, 404, 409].includes(error?.statusCode) ? error.statusCode : 503;
      const code = typeof error?.code === 'string' && error.code.startsWith('studio_presentation_idle_') ? error.code : 'studio_presentation_idle_media_unavailable';
      return json(status, code);
    }
  }
  return Object.freeze({ resolve, configuration, publicVideo, response });
}

// Historical branding remains readable only while the exact N1 presentation and
// ownership lists are still published. This preserves an ongoing round through
// N2 appearance publication without resurrecting old or revoked N1 media.
export function sameFrozenPackage(current, previous) {
  if (!current || !previous || current.operatorId !== previous.operatorId
    || !Number.isSafeInteger(previous.revision) || previous.revision < 1 || previous.revision >= current.revision
    || !current.branding?.[PRESENTATION_PACKAGE_KEY] || !previous.branding?.[PRESENTATION_PACKAGE_KEY]) return false;
  return ['lanes','games','tables'].every(key => Array.isArray(current[key]) && Array.isArray(previous[key])
    && canonicalStudioJson(current[key]) === canonicalStudioJson(previous[key]))
    && canonicalStudioJson(current.branding[PRESENTATION_PACKAGE_KEY]) === canonicalStudioJson(previous.branding[PRESENTATION_PACKAGE_KEY]);
}

// All database authority comes from one uncached repeatable-read snapshot.
// No provider/media operation runs while this reader owns its SQL client.
export function createFrozenDealerContextReader({ pool, scope } = {}) {
  scope = validateStudioScope(scope);
  if (typeof pool?.connect !== 'function') throw new TypeError('Scoped SQL pool required');
  const readCurrent = async (slug, packageRevision = null) => {
    if (!isOperatorSlug(slug)) return { operator: null, package: null };
    let client, active = false;
    try {
      client = await pool.connect();
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); active = true;
      await client.query("SET LOCAL statement_timeout = '5000ms'; SET LOCAL lock_timeout = '3000ms'; SET LOCAL idle_in_transaction_session_timeout = '10000ms'");
      const sql = { query(text, values) {
        if (!active || !Array.isArray(values) || values[0] !== scope.environment || values[1] !== scope.workspaceId) throw new StudioStorageError('studio_scope_mismatch', 409);
        return client.query(text, [...values]);
      } };
      const store = await createOperatorStore({ sql, scope });
      const operator = await store.getOperatorBySlug(slug);
      let result = { operator: null, package: null };
      if (operator?.status === 'active') {
        let pack = await store.getCurrentPackage(operator.id);
        if (Number.isSafeInteger(packageRevision) && packageRevision > 0 && pack && packageRevision < pack.revision) {
          const previous = await store.getPackage(operator.id, packageRevision);
          if (sameFrozenPackage(pack, previous)) pack = previous;
        }
        const saved = await sql.query(`/* frozen-dealer:administration */ SELECT value FROM croupier_studio.documents WHERE environment_id=$1 AND workspace_id=$2 AND kind=$3`, [scope.environment, scope.workspaceId, 'administration']);
        if (saved.rows.length !== 1) throw new StudioStorageError('studio_document_missing', 503);
        result = { operator, package: pack, administration: validateStudioGameAdministration(saved.rows[0].value) };
      }
      const committed = await client.query('COMMIT'); active = false;
      if (committed?.command === 'ROLLBACK') throw new StudioStorageError('studio_transaction_rolled_back', 503);
      return result;
    } catch (error) {
      if (active) try { await client.query('ROLLBACK'); } catch {}
      throw studioStorageFailure(error);
    } finally { active = false; try { client?.release(); } catch {} }
  };
  // The wallet owns this client and its transaction. Do not BEGIN, COMMIT,
  // release, or borrow another pool connection while it holds the player lock.
  readCurrent.inTransaction = async (client, slug) => {
    if (!isOperatorSlug(slug)) return { operator: null, package: null };
    if (typeof client?.query !== 'function') throw new TypeError('Transaction client required');
    try {
      const store = await createOperatorStore({ sql: client, scope });
      const result = await store.getCurrentPresentationContext(slug);
      if (result.operator?.status !== 'active') return { operator: null, package: null };
      if (result.administration == null) throw new StudioStorageError('studio_document_missing', 503);
      return { ...result, administration: validateStudioGameAdministration(result.administration) };
    } catch (error) { throw studioStorageFailure(error); }
  };
  return Object.freeze(readCurrent);
}
