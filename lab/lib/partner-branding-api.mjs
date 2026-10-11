import {StudioStorageError} from '../../web/storage/studio-contract.mjs';
import { partnerPresentationDealerChoices } from './partner-presentation-choices.mjs';
import { defaultPresentationLane } from './studio-model.mjs';
import { effectivePartnerAdjustments } from './partner-package-view.mjs';
import { PRESENTATION_PACKAGE_KEY, publicPackageBranding, readPackagePresentation, normalizePresentationBranding } from '../../web/storage/presentation-package.mjs';

// canonicalBranding in operator-store accepts any plain object within
// 8000 bytes, 200 nodes and depth 6. It has no key whitelist.
// table.color is stored as the branding key already used by publishPackage tests.
export const TABLE_COLOR_BRANDING_KEY = 'color';
const ADJUSTABLE_ORDER = ['table.color', 'table', 'background', 'dealer', 'branding'];

function fail(statusCode) {
  throw new StudioStorageError('partner_branding_rejected',statusCode);
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

export function createPartnerBrandingApi({ store, readProject, readAdministration, withWriteContext } = {}) {
  if (typeof store?.getCurrentPackage !== 'function' || typeof store?.publishPackage !== 'function' || typeof readProject !== 'function') fail(503);
  async function savedProject() {
    try {
      return await readProject();
    } catch (error) {
      if (Number.isInteger(error?.statusCode)) throw error;
      fail(503);
    }
  }
  async function load(operatorId, source = store) {
    const pack = await source.getCurrentPackage(operatorId);
    if (!pack) fail(404);
    if (pack.operatorId !== operatorId) fail(403);
    return pack;
  }
  async function administrationSnapshot(reader = readAdministration) {
    if (typeof reader !== 'function') fail(503);
    const document = await reader();
    if (!document?.value || typeof document.revision !== 'string' || !document.revision) fail(503);
    return document;
  }
  function choices(pack, presentation, document) {
    return partnerPresentationDealerChoices({administration:document.value, package:pack, presentation, operatorId:pack.operatorId});
  }
  async function present(pack, document) {
    const presentation = readPackagePresentation(pack);
    const saved = presentation ? { lanes: presentation.lanes.map(lane => ({ ...lane, operatorAdjustable: effectivePartnerAdjustments(lane) })) } : await savedProject();
    if (presentation) document ??= await administrationSnapshot();
    return { ...view(pack, adjustableForPackage(pack.lanes, saved)), ...(presentation ? { presentation, dealerChoices:choices(pack,presentation,document) } : {}) };
  }
  async function prepareBranding(current, branding, document) {
    const presentation = readPackagePresentation(current);
    const adjustable = adjustableForPackage(current.lanes, presentation ? { lanes: presentation.lanes } : await savedProject());
    gateKeys(branding, adjustable);
    let nextBranding={...structuredClone(current.branding),...branding};
    if (presentation) {
      const laneId = branding.lane ?? current.branding.lane ?? presentation.lanes[0].id;
      const lane = presentation.lanes.find(item => item.id === laneId);
      if (!lane) fail(422);
      const previous={...current.branding};
      if((previous.lane??presentation.lanes[0].id)!==laneId) {
        for(const key of ['dealer','table','background','color'])delete previous[key];
      }
      const base=normalizePresentationBranding({...previous,lane:laneId},presentation);
      const merged = {...base,...branding};
      const rights = new Set(effectivePartnerAdjustments(lane));
      gateKeys(branding,[...rights]);
      for (const role of ['background', 'table', 'dealer']) {
        if (Object.hasOwn(branding,role) && !rights.has(role)) fail(422);
        if (merged[role] !== undefined && merged[role] !== null && !lane.layers[role].allowed.includes(merged[role])) fail(422);
      }
      if (Object.hasOwn(branding,'dealer') || merged.dealer !== undefined && merged.dealer !== null) {
        const wanted = merged.dealer ?? lane.layers.dealer.default;
        if (!choices(current,presentation,document)[lane.id].includes(wanted)) fail(409);
      }
      if (Object.hasOwn(branding,'color') && (!rights.has('table.color') || !/^#[a-f0-9]{6}$/.test(branding.color)
        || lane.layers.table.colors?.length && !lane.layers.table.colors.includes(branding.color))) fail(422);
      nextBranding={...merged,[PRESENTATION_PACKAGE_KEY]:current.branding[PRESENTATION_PACKAGE_KEY]};
    } else if (Object.hasOwn(branding,'lane')) fail(422);
    return nextBranding;
  }
  return Object.freeze({
    async read({ operatorId }) { return present(await load(operatorId)); },
    async write({ operatorId, actor, audit, expectedRevision, branding }) {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) fail(400);
      if (!plainObject(branding)) fail(422);
      // Capture the request before any await; a caller cannot change the intent.
      branding=structuredClone(branding);
      const current=await load(operatorId), presentation=readPackagePresentation(current);
      const captured=presentation?await administrationSnapshot():null;
      await prepareBranding(current,branding,captured);
      if (current.revision !== expectedRevision) fail(409);
      if (typeof withWriteContext !== 'function') fail(503);
      return withWriteContext(async context=>{
        if (await context.reauthorize() !== true) fail(403);
        const locked=await load(operatorId,context.store);
        const document=presentation?await administrationSnapshot(context.readAdministration):null;
        if (locked.revision !== current.revision || document?.revision !== captured?.revision) fail(409);
        const nextBranding=await prepareBranding(locked,branding,document);
        let published;
        try {
          published=await context.store.publishPackage({actor,audit,operatorId,expectedRevision:locked.revision,
            lanes:[...locked.lanes],games:[...locked.games],tables:[...locked.tables],branding:nextBranding});
        } catch(error) { if(Number.isInteger(error?.statusCode)) throw error; fail(503); }
        return present(published,document);
      });
    },
  });
}
