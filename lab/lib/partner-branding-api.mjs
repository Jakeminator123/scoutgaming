import { defaultPresentationLane } from './studio-model.mjs';
import { PRESENTATION_PACKAGE_KEY, publicPackageBranding, readPackagePresentation, normalizePresentationBranding } from '../../web/storage/presentation-package.mjs';

// canonicalBranding in operator-store accepts any plain object within
// 8000 bytes, 200 nodes and depth 6. It has no key whitelist.
// table.color is stored as the branding key already used by publishPackage tests.
export const TABLE_COLOR_BRANDING_KEY = 'color';
const ADJUSTABLE_ORDER = ['table.color', 'table', 'background', 'dealer', 'branding'];

function fail(statusCode) {
  throw Object.assign(new Error('partner_branding_rejected'), { statusCode });
}

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Object.keys(value);
  return Object.getOwnPropertySymbols(value).length === 0 && Object.getOwnPropertyNames(value).length === keys.length;
}

function projectLanes(saved) {
  if (!saved || typeof saved !== 'object') return [];
  const project = saved.project && typeof saved.project === 'object' ? saved.project : saved;
  return Array.isArray(project.lanes) ? project.lanes : [];
}

export function adjustableForPackage(laneIds, saved) {
  const byId = new Map();
  for (const lane of projectLanes(saved)) {
    if (lane && typeof lane.id === 'string' && !byId.has(lane.id)) byId.set(lane.id, lane);
  }
  const standard = defaultPresentationLane();
  const found = new Set();
  for (const id of Array.isArray(laneIds) ? laneIds : []) {
    if (typeof id !== 'string') continue;
    const lane = byId.has(id) ? byId.get(id) : (id === standard.id ? standard : null);
    const items = Array.isArray(lane?.operatorAdjustable) ? lane.operatorAdjustable : [];
    for (const item of items) if (ADJUSTABLE_ORDER.includes(item)) found.add(item);
  }
  return ADJUSTABLE_ORDER.filter(item => found.has(item));
}

function gateKeys(branding, adjustable) {
  if (!plainObject(branding)) fail(422);
  const allowed = new Set(adjustable);
  for (const key of Object.keys(branding)) {
    if (key === PRESENTATION_PACKAGE_KEY) fail(422);
    if (key === 'lane') continue;
    const token = key === TABLE_COLOR_BRANDING_KEY ? 'table.color' : key === 'background' ? 'background' : key === 'dealer' ? 'dealer' : key === 'table' ? 'table' : 'branding';
    if (!allowed.has(token)) fail(422);
  }
}

function view(pack, adjustable) {
  return {
    operatorId: pack.operatorId,
    packageRevision: pack.revision,
    lanes: [...pack.lanes],
    branding: publicPackageBranding(pack.branding),
    adjustable,
  };
}

export function createPartnerBrandingApi({ store, readProject } = {}) {
  if (typeof store?.getCurrentPackage !== 'function' || typeof store?.publishPackage !== 'function' || typeof readProject !== 'function') fail(503);
  async function savedProject() {
    try {
      return await readProject();
    } catch (error) {
      if (Number.isInteger(error?.statusCode)) throw error;
      fail(503);
    }
  }
  async function load(operatorId) {
    const pack = await store.getCurrentPackage(operatorId);
    if (!pack) fail(404);
    if (pack.operatorId !== operatorId) fail(403);
    return pack;
  }
  async function present(pack) {
    const presentation = readPackagePresentation(pack);
    const saved = presentation ? { lanes: presentation.lanes } : await savedProject();
    return { ...view(pack, adjustableForPackage(pack.lanes, saved)), ...(presentation ? { presentation } : {}) };
  }
  return Object.freeze({
    async read({ operatorId }) {
      return present(await load(operatorId));
    },
    async write({ operatorId, actor, expectedRevision, branding }) {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) fail(400);
      const current = await load(operatorId);
      const presentation = readPackagePresentation(current);
      const adjustable = adjustableForPackage(current.lanes, presentation ? { lanes: presentation.lanes } : await savedProject());
      gateKeys(branding, adjustable);
      let nextBranding={...structuredClone(current.branding),...branding};
      if (presentation) {
        // Choices are constrained to a single published lane, never a union that
        // could combine assets the operator was not granted together.
        const laneId = branding.lane ?? current.branding.lane ?? presentation.lanes[0].id;
        const lane = presentation.lanes.find(item => item.id === laneId);
        if (!lane) fail(422);
        const base=normalizePresentationBranding({...current.branding,lane:laneId},presentation);
        const merged = {...base,...branding};
        const rights = new Set(lane.operatorAdjustable);
        gateKeys(branding,lane.operatorAdjustable);
        for (const role of ['background', 'table', 'dealer']) {
          if (Object.hasOwn(branding,role) && !rights.has(role)) fail(422);
          if (merged[role] !== undefined && merged[role] !== null && !lane.layers[role].allowed.includes(merged[role])) fail(422);
        }
        if (Object.hasOwn(branding,'color') && (!rights.has('table.color') || !/^#[a-f0-9]{6}$/.test(branding.color)
          || lane.layers.table.colors?.length && !lane.layers.table.colors.includes(branding.color))) fail(422);
        nextBranding={...merged,[PRESENTATION_PACKAGE_KEY]:current.branding[PRESENTATION_PACKAGE_KEY]};
      } else if (Object.hasOwn(branding,'lane')) {
        fail(422);
      }
      if (current.revision !== expectedRevision) fail(409);
      let published;
      try {
        published = await store.publishPackage({
          actor,
          operatorId,
          lanes: [...current.lanes],
          games: [...current.games],
          tables: [...current.tables],
          branding: nextBranding,
        });
      } catch (error) {
        if (Number.isInteger(error?.statusCode)) throw error;
        fail(503);
      }
      return present(published);
    },
  });
}
