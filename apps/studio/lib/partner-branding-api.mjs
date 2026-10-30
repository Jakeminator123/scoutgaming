import {nativeFilmedPlanningMutations} from './presentation-runtime-readiness.mjs';
import {validatePresentationBranding} from '../../../packages/presentation/server/presentation-storage.mjs';
import { createHash } from 'node:crypto';
import { canonicalStudioJson } from '../../../packages/studio-registry/server/document-contract.mjs';
import {listPackageRooms} from '../../../packages/presentation/server/package-rooms.mjs';
import {roomGame} from '../../../packages/presentation/contracts/presentation-room.mjs';
import { gameLaneConfiguration } from '../../../packages/presentation/contracts/game-lanes.mjs';
import { isPresentationRoomLaneCompatible } from '../../../packages/presentation/server/frozen-presentation-capture.mjs';
import { publicEditableBranding, resolveRoomBranding, PARTNER_BRANDING_FIELDS, PARTNER_ROOM_BRANDING_FIELDS } from '../../../packages/operators/contracts/branding.mjs';
import {StudioStorageError} from '../../../packages/studio-registry/server/document-contract.mjs';
import { partnerPresentationDealerChoices } from './partner-presentation-choices.mjs';
import { adminLayerAdjustments, effectivePartnerAdjustments, partnerLayerChoices } from './partner-package-view.mjs';
import { PRESENTATION_PACKAGE_KEY, publicPackageBranding, readPackagePresentation } from '../../../packages/presentation/server/presentation-package.mjs';
import { assertAiTableChoiceFits } from './ai-table-publication-guard.mjs';
import { partnerAllow } from './partner-assignment.mjs';
import { mergeOperatorMaterialsForPublication, operatorMaterialFingerprint, presentationFits, publicationRooms } from './operator-material-publication.mjs';
import { encodePresentationPackage } from '../../../packages/presentation/server/presentation-package.mjs';
import { isExtendedPresentationEnvelope } from '../../../packages/presentation/server/presentation-storage.mjs';

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
  const found = new Set();
  for (const id of Array.isArray(laneIds) ? laneIds : []) {
    if (typeof id !== 'string') continue;
    const lane = byId.get(id);
    const items = Array.isArray(lane?.operatorAdjustable) ? lane.operatorAdjustable : [];
    for (const item of items) if (ADJUSTABLE_ORDER.includes(item)) found.add(item);
  }
  return ADJUSTABLE_ORDER.filter(item => found.has(item));
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

// The company's open (unpublished, not discarded) appearance draft, or null.
// Shared with the room publication (room-release.mjs), which stops on an open draft.
export async function cleanBrandingDraft(draft,pack,source) {
  // Discard restores the current published choices in the existing immutable
  // draft journal. Compare against that original package so a later publication
  // cannot resurrect the discarded draft. Keep its revision for the next CAS.
  const restoredCurrent=draft?.action==='draft.restore'&&draft.sourcePackageRevision===draft.basePackageRevision;
  const restored=restoredCurrent?(draft.sourcePackageRevision===pack.revision?pack:await source.getPackage(pack.operatorId,draft.sourcePackageRevision)):null;
  const discarded=restored?.operatorId===pack.operatorId&&restored.revision===draft.sourcePackageRevision
    &&canonicalStudioJson(publicEditableBranding(draft.branding))===canonicalStudioJson(publicEditableBranding(restored.branding));
  return !draft||draft.action==='draft.publish'||discarded?null:{revision:draft.revision,basePackageRevision:draft.basePackageRevision,
    branding:publicEditableBranding(draft.branding),sourcePackageRevision:draft.sourcePackageRevision,updatedAt:draft.updatedAt};
}

// materials: optional store of the company's own material (Bolagets eget
// material), read before SQL; the write context supplies the same store on its
// locked client. Without it every branding publication keeps the frozen package.
export function createPartnerBrandingApi({ store, readProject, readAdministration, withWriteContext, materials } = {}) {
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
  function requireDraftStore(source) {
    if(!['getBrandingDraft','saveBrandingDraft','publishBrandingDraft','getPackage','listPackages'].every(key=>typeof source?.[key]==='function'))fail(503);
  }
  function roomList(pack,document) {
    const presentation=readPackagePresentation(pack);
    if(!presentation)return [];
    const {gameLanes}=gameLaneConfiguration(document.value);
    return listPackageRooms({administration:document.value,package:pack,operatorId:pack.operatorId}).filter(room=>room.state==='live'
      && isPresentationRoomLaneCompatible(gameLanes.find(lane=>lane.id===room.gameLaneId),presentation.lanes.find(lane=>lane.id===room.presentationLaneId),presentation,room.game??'blackjack'));
  }
  // One room's view of the package: `tables` and the package's own `rooms` (Studio 023) together,
  // or the package rooms would no longer match `tables` and read as a corrupt package (503).
  const roomPackage=(pack,room)=>({...pack,tables:[room.id],rooms:pack.rooms?.filter(row=>row.id===room.id)??null});
  const cleanDraft=(draft,pack,source=store)=>cleanBrandingDraft(draft,pack,source);
  async function state(operatorId,source=store,document=null) {
    requireDraftStore(source);
    const pack=await load(operatorId,source),draft=await source.getBrandingDraft(operatorId);
    document??=await administrationSnapshot();
    const history=await source.listPackages(operatorId,{limit:20});
    return {...await present(pack,document),branding:publicEditableBranding(pack.branding),draft:await cleanDraft(draft,pack,source),
      draftRevision:draft?.revision??0,history:history.map(row=>({revision:row.revision,publishedAt:row.publishedAtMs,branding:publicEditableBranding(row.branding)})),
      roomDealerChoices:Object.fromEntries(roomList(pack,document).map(room=>[room.id,choices(roomPackage(pack,room),readPackagePresentation(pack),document)[room.presentationLaneId]])),
      rooms:roomList(pack,document).map(room=>({id:room.id,label:room.name,presentationLaneId:room.presentationLaneId,game:roomGame(room)}))};
  }
  function assertEditable(branding) {
    if(!plainObject(branding)||Object.keys(branding).some(key=>!PARTNER_BRANDING_FIELDS.includes(key)&&key!=='roomOverrides'))fail(422);
    for(const key of PARTNER_BRANDING_FIELDS)if(Object.hasOwn(branding,key)&&(typeof branding[key]!=='string'||branding[key].length>100))fail(422);
    if(Object.hasOwn(branding,'roomOverrides')){
      if(!plainObject(branding.roomOverrides)||Object.keys(branding.roomOverrides).length>32)fail(422);
      for(const [id,value]of Object.entries(branding.roomOverrides)){
        if(!/^[a-z][a-z0-9-]{0,63}$/.test(id)||!plainObject(value)||Object.keys(value).some(key=>!PARTNER_ROOM_BRANDING_FIELDS.includes(key)))fail(422);
        for(const item of Object.values(value))if(typeof item!=='string'||item.length>100)fail(422);
      }
    }
  }
  // The Admin route carries the server-derived access class in the audit
  // context. An N1 administrator may choose any layer the frozen composition
  // allows; partner sessions keep the company's operatorAdjustable gate,
  // narrowed by Admins `allow` i tilldelningen (partner-assignment.mjs): utan
  // allow.dealer, allow.tableAsset eller allow.background ändrar bolaget inte
  // det lagret, oavsett väg (dealer, branding save-draft, restore, publish).
  const ALLOW_LAYERS=Object.freeze({dealer:'dealer',table:'tableAsset',background:'background'});
  function laneRights(lane,adminChoices,allow) {
    if(adminChoices)return new Set(adminLayerAdjustments(lane));
    return new Set(effectivePartnerAdjustments(lane).filter(token=>!Object.hasOwn(ALLOW_LAYERS,token)||allow?.[ALLOW_LAYERS[token]]===true));
  }
  async function validateDraft(pack,branding,document,adminChoices=false) {
    assertEditable(branding);
    const presentation=readPackagePresentation(pack);
    if(!presentation)fail(409); // A published Scout presentation is the authority for every editable choice.
    const rooms=roomList(pack,document),base=publicEditableBranding(pack.branding);
    const laneId=branding.lane??presentation.lanes[0].id;
    const lane=presentation.lanes.find(row=>row.id===laneId);
    if(!lane)fail(422);
    const defaults={...branding};delete defaults.roomOverrides;
    // Läses ur samma paket som valideringen, under bolagets lås i skrivvägen.
    const allow=partnerAllow(pack,presentation);
    function checkedValues(value,baseline,selectedLane,allowedDealers) {
      const rights=laneRights(selectedLane,adminChoices,allow);
      for(const key of PARTNER_ROOM_BRANDING_FIELDS){
        const changed=canonicalStudioJson(value[key]??null)!==canonicalStudioJson(baseline[key]??null);
        const token=key==='color'?'table.color':key;
        if(changed&&!rights.has(token))fail(422);
        if(!Object.hasOwn(value,key))continue;
        if(key==='color'){
          if(!/^#[a-f0-9]{6}$/.test(value.color)||selectedLane.layers.table.colors?.length&&!selectedLane.layers.table.colors.includes(value.color))fail(422);
        }else if(!partnerLayerChoices(selectedLane,key).includes(value[key]))fail(422);
        if(key==='table')assertAiTableChoiceFits(selectedLane,presentation.assets,value.table);
        if(key==='dealer'&&!allowedDealers.includes(value[key]))fail(409);
      }
    }
    checkedValues(defaults,resolveRoomBranding({...base,lane:base.lane??presentation.lanes[0].id},null,laneId),lane,choices(pack,presentation,document)[laneId]);
    // Ett pausat (eller annars inte redigerbart) spelbord som fortfarande hör
    // till bolagets paket behåller sin publicerade override oförändrad: utkastet
    // får bära den vidare, men aldrig lägga till eller ändra den. Ett arkiverat
    // spelbord finns inte i paketets spelbord och nekas som förut.
    const held=new Set(listPackageRooms({administration:document.value,package:pack,operatorId:pack.operatorId}).map(room=>room.id));
    for(const [id,value]of Object.entries(branding.roomOverrides??{})){
      if(rooms.some(room=>room.id===id))continue;
      if(!held.has(id)||!Object.hasOwn(base.roomOverrides??{},id)||canonicalStudioJson(value)!==canonicalStudioJson(base.roomOverrides[id]))fail(422);
    }
    for(const room of rooms){
      const selectedLane=presentation.lanes.find(row=>row.id===room.presentationLaneId);
      // Explicit overrides change future inheritance even when today's rendered value is equal.
      const explicitBefore=base.roomOverrides?.[room.id]??{},explicitAfter=branding.roomOverrides?.[room.id]??{};
      const roomRights=laneRights(selectedLane,adminChoices,allow);
      for(const key of PARTNER_ROOM_BRANDING_FIELDS)if(canonicalStudioJson(explicitBefore[key]??null)!==canonicalStudioJson(explicitAfter[key]??null)
        &&!roomRights.has(key==='color'?'table.color':key))fail(422);
      const value=resolveRoomBranding({...branding,lane:laneId},room.id,room.presentationLaneId);
      const baseline=resolveRoomBranding({...base,lane:base.lane??presentation.lanes[0].id},room.id,room.presentationLaneId);
      const roomDealers=choices(roomPackage(pack,room),presentation,document)[selectedLane.id];
      checkedValues(value,baseline,selectedLane,roomDealers);
    }
    // Keep all N1-owned metadata exactly, replacing only the public editable surface.
    const next=structuredClone(pack.branding);
    for(const key of [...PARTNER_BRANDING_FIELDS,'roomOverrides'])delete next[key];
    // Save, review and publish must all fit the same final package, including N1-owned metadata.
    try { return validatePresentationBranding({...next,...structuredClone(branding)}); }
    catch(error) { if(error instanceof StudioStorageError && error.statusCode===422)fail(413); throw error; }
  }
  function changesFor(pack,draft,document) {
    const presentation=readPackagePresentation(pack),fallback=presentation?.lanes[0]?.id;
    const before=publicEditableBranding(pack.branding),after=publicEditableBranding(draft.branding),changes=[];
    for(const key of PARTNER_BRANDING_FIELDS)if(canonicalStudioJson(before[key]??null)!==canonicalStudioJson(after[key]??null))
      changes.push({roomId:null,key,before:before[key]??null,after:after[key]??null});
    const affectedRooms=[];
    for(const room of roomList(pack,document)){
      const previous=resolveRoomBranding({...before,lane:before.lane??fallback},room.id,room.presentationLaneId);
      const next=resolveRoomBranding({...after,lane:after.lane??fallback},room.id,room.presentationLaneId);
      let changed=false;
      for(const key of PARTNER_ROOM_BRANDING_FIELDS)if(canonicalStudioJson(previous[key]??null)!==canonicalStudioJson(next[key]??null)){
        changed=true;changes.push({roomId:room.id,key,before:previous[key]??null,after:next[key]??null});
      }
      for(const key of PARTNER_ROOM_BRANDING_FIELDS){
        const explicitBefore=before.roomOverrides?.[room.id]?.[key]??null,explicitAfter=after.roomOverrides?.[room.id]?.[key]??null;
        if(canonicalStudioJson(explicitBefore)!==canonicalStudioJson(explicitAfter)){
          changed=true;
          if(canonicalStudioJson(previous[key]??null)===canonicalStudioJson(next[key]??null))
            changes.push({roomId:room.id,key:'roomOverrides.'+key,before:explicitBefore,after:explicitAfter});
        }
      }
      if(changed)affectedRooms.push(room.id);
    }
    return {changes,affectedRooms};
  }
  function reviewOf(pack,draft,document) {
    return {reviewToken:createHash('sha256').update(canonicalStudioJson({scope:store.scope??null,operatorId:pack.operatorId,
      packageRevision:pack.revision,draftRevision:draft.revision,branding:draft.branding,administrationRevision:document.revision})).digest('hex'),
      draftRevision:draft.revision,packageRevision:pack.revision,branding:publicEditableBranding(draft.branding),...changesFor(pack,draft,document)};
  }
  function publicationMutation(pack) {
    const presentation=readPackagePresentation(pack);
    return [...nativeFilmedPlanningMutations(pack),...(presentation?[{kind:'presentation-package',value:presentation}]:[])];
  }
  // Bolagets eget material. brandingFor(pack) is the exact branding this
  // publication writes for a package; the merge is sized against that branding
  // (never the old package's), then the choices are validated again against the
  // merged package. No rows (no store, no 021, no material): the plain branding.
  const mergesMaterials=typeof materials?.listMaterials==='function';
  const materialRowsBeforeSql=operatorId=>mergesMaterials?materials.listMaterials(operatorId):[];
  async function lockedMaterialRows(context,operatorId,fingerprint) {
    if(!mergesMaterials)return [];
    if(typeof context.materials?.listMaterials!=='function')fail(503);
    const rows=await context.materials.listMaterials(operatorId);
    // The negotiated candidate assumed these rows; a decision in between is a conflict.
    if(operatorMaterialFingerprint(rows)!==fingerprint)fail(409);
    return rows;
  }
  async function brandingWithMaterials(pack,rows,document,brandingFor) {
    const plain=await brandingFor(pack),presentation=readPackagePresentation(pack);
    if(!rows.length||!presentation)return plain;
    const allowExtended=isExtendedPresentationEnvelope(pack.branding?.[PRESENTATION_PACKAGE_KEY]);
    const merged=mergeOperatorMaterialsForPublication({presentation,rows,rooms:publicationRooms(document?.value,pack.operatorId,pack),
      fits:presentationFits({branding:plain,base:presentation,allowExtended})});
    if(!merged.changed)return plain;
    return brandingFor({...pack,branding:{...pack.branding,[PRESENTATION_PACKAGE_KEY]:encodePresentationPackage(merged.presentation,{allowExtended})}});
  }
  async function checkPublication(context,pack) {
    // Native callers already negotiated this exact operator before SQL. Check
    // the locked payload again; the mutation context forbids HTTP under lock.
    const descriptor=publicationMutation(pack);
    if(descriptor&&typeof context.withMutationContext==='function')
      await context.withMutationContext(async()=>{},descriptor);
  }
  async function command(input) {
    requireDraftStore(store);
    if(!['save-draft','review','publish','restore','discard-draft'].includes(input.action)
      ||!Number.isSafeInteger(input.expectedDraftRevision)||input.expectedDraftRevision<0
      ||!Number.isSafeInteger(input.expectedPackageRevision)||input.expectedPackageRevision<1)fail(400);
    input=structuredClone(input);
    if(typeof withWriteContext!=='function')fail(503);
    // Partner changes retain N1's frozen presentation. Negotiate that package,
    // never the latest project or a different operator's package, before SQL;
    // with the company's material it is the merged candidate this publish writes.
    let presentationMutation,materialFingerprint=operatorMaterialFingerprint([]);
    const adminChoices=input.audit?.accessClass==='internal-admin';
    if(input.action==='publish'){
      const current=await load(input.operatorId),rows=await materialRowsBeforeSql(input.operatorId);
      materialFingerprint=operatorMaterialFingerprint(rows);
      let candidate=current;
      if(rows.length) {
        try {
          const draft=await store.getBrandingDraft(input.operatorId),document=await administrationSnapshot();
          candidate={...current,branding:await brandingWithMaterials(current,rows,document,pack=>validateDraft(pack,draft.branding,document,adminChoices))};
        } catch { /* The locked publication validates again and fails with the real reason. */ }
      }
      presentationMutation=publicationMutation(candidate);
    }
    return withWriteContext(async context=>{
      if(await context.reauthorize()!==true)fail(403);
      requireDraftStore(context.store);
      const pack=await load(input.operatorId,context.store),draft=await context.store.getBrandingDraft(input.operatorId);
      if(!Array.isArray(pack.lanes)||!pack.lanes.length||pack.revision!==input.expectedPackageRevision||(draft?.revision??0)!==input.expectedDraftRevision)fail(409);
      const document=await administrationSnapshot(context.readAdministration);
      if(input.action==='discard-draft'){
        if(!await cleanDraft(draft,pack,context.store))fail(409);
        await context.store.saveBrandingDraft({...input,branding:publicEditableBranding(pack.branding),sourcePackageRevision:pack.revision});
      }else if(input.action==='save-draft'||input.action==='restore'){
        let branding=input.branding;
        if(input.action==='restore'){
          if(!Number.isSafeInteger(input.sourcePackageRevision)||input.sourcePackageRevision<1)fail(400);
          if(input.sourcePackageRevision===pack.revision)fail(409);
          const previous=await context.store.getPackage(input.operatorId,input.sourcePackageRevision);
          if(!previous||previous.operatorId!==input.operatorId)fail(404);
          branding=publicEditableBranding(previous.branding);
        }
        await validateDraft(pack,branding,document,adminChoices);
        await context.store.saveBrandingDraft({...input,branding});
      }else{
        if(!await cleanDraft(draft,pack,context.store)||draft.basePackageRevision!==pack.revision)fail(409);
        const brandingFor=source=>validateDraft(source,draft.branding,document,adminChoices);
        const branding=input.action==='publish'
          ?await brandingWithMaterials(pack,await lockedMaterialRows(context,input.operatorId,materialFingerprint),document,brandingFor)
          :await brandingFor(pack),review=reviewOf(pack,draft,document);
        if(input.action==='review')return review;
        if(typeof input.reviewToken!=='string'||input.reviewToken!==review.reviewToken)fail(409);
        await checkPublication(context,{...pack,branding});
        await context.store.publishBrandingDraft({...input,branding});
      }
      return state(input.operatorId,context.store,document);
    },{presentationMutation});
  }
  return Object.freeze({
    readState:({operatorId})=>state(operatorId),
    command,
  });
}
