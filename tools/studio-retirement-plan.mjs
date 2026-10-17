// Pure, offline retirement planning. This module has no API, SQL or filesystem
// writer. An execution adapter must lock/re-read the complete scoped snapshot,
// verify the CAS token and separately verify its local backup before writing.
//
// Input schema (all arrays must be complete, including deleted media rows):
// {schemaVersion:1, scope:{environment,workspaceId}, coverage:{...},
//  documents:{project:{revision,value}, administration:{revision,value}, ...},
//  media:[{id,revision,record}], operators:[{id,...}],
//  packages:[{key,operatorId,revision,current:boolean,value:{lanes,games,tables,branding}}],
//  history:[{id,kind,revision,value}],
//  forge:{profiles:[{dealerId,revision,profile}],jobs:[{jobId,dealerId,status,...}]},
//  references:[{id,kind,value}],
//  files:[{pathname,sha256,size,present:boolean,owners:[{kind,id}]}],
//  holds?:[{code,field,id}]}
// File owners use dealer/media/layerAsset/package/history/forgeProfile/forgeJob
// or external. A caller must inventory every owner of a pathname, across scopes;
// equal hashes NEVER establish shared ownership. `references` covers other
// persisted consumers (e.g. memberships or generation records) and is read-only.
// Package JSON columns accept decoded values or one SQL JSON-text encoding;
// lanes/games/tables must be ID arrays and branding must be an object.
// Forge profile anchors (anchors.vila/redo) and job result.anchor need their
// own file owner and immutable hash/size evidence, even with complete coverage.
//
// Selection: {remove:{dealerIds,operatorIds,roomIds,gameLaneIds,compositionIds,
// mediaIds,layerAssetIds,animationAssetIds,triggerIds,packageKeys,historyIds,
// forgeProfileIds,forgeJobIds,filePathnames}, protect:{same ID fields, games,
// allBackgrounds}, replacements:{dealerDefaults:{laneId:dealerId},
// layerDefaults:{laneId:{table:idOrNull,background:idOrNull}}}}.
// Owned media, Forge records, operator packages/rooms, and compositions whose
// EVERY dealer is selected are enumerated automatically in the resulting plan.
// Other historical rows require explicit IDs; a surviving reference blocks.
// Whole historical rows containing protected dealers/material must be handled
// separately: selecting their row ID never overrides resource protection.
import { createHash } from 'node:crypto';
import { cloneStudioJson, validateDocumentValue, validateRevision, validateStudioScope, validateStudioMedia } from '../web/storage/studio-contract.mjs';

import { layerAssetFitsGame } from '../packages/presentation/contracts/layer-asset-contract.mjs';
import { MEDIA_FAMILY_DEFINITIONS } from '../packages/presentation/runtime/media-families.mjs';

const familyDealers = new Map(MEDIA_FAMILY_DEFINITIONS.map(row => [row.id,row.dealerId]));
const COVERAGE = ['documents', 'media', 'operators', 'packages', 'history', 'forge', 'references', 'files'];
const FIELDS = ['dealerIds', 'operatorIds', 'roomIds', 'gameLaneIds', 'compositionIds', 'mediaIds', 'layerAssetIds',
  'animationAssetIds', 'triggerIds', 'packageKeys', 'historyIds', 'forgeProfileIds', 'forgeJobIds', 'filePathnames'];
const DESCRIPTIVE = new Set(['name', 'label', 'notes', 'description', 'text', 'transcript', 'fileName', 'sha256']);
const TERMINAL = new Set(['succeeded', 'failed', 'cancelled']);
const PACKAGE_COLUMNS = ['lanes', 'games', 'tables', 'branding'];
const OWNER_FIELDS = {dealer:'dealerIds',media:'mediaIds',layerAsset:'layerAssetIds',package:'packageKeys',history:'historyIds',forgeProfile:'forgeProfileIds',forgeJob:'forgeJobIds'};
const copy = value => cloneStudioJson(value, {maxBytes:64 * 1024 * 1024, maxNodes:1000000, maxDepth:48});
const canonical = value => JSON.stringify(copy(value));
export const retirementSnapshotHash = value => createHash('sha256').update(canonical(value)).digest('hex');
const fail = (code, details = null) => { const error = new Error(code); error.code = code; error.details = details; throw error; };
const object = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const stableId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{0,255}$/.test(value);
const pathValid = value => typeof value === 'string' && value.length <= 2048 && value.length > 0
  && !value.startsWith('/') && !/[\\?#%\u0000-\u001f]/.test(value) && value.split('/').every(part => part && part !== '.' && part !== '..') && !value.includes(':');
const sorted = values => [...new Set(values)].sort();
const uniqueRows = (rows, key, name) => {
  if (!Array.isArray(rows)) fail('retirement_invalid_snapshot', name);
  const ids = new Set();
  for (const row of rows) {
    if (!object(row) || !stableId(row[key]) || ids.has(row[key])) fail('retirement_invalid_snapshot', name);
    ids.add(row[key]);
  }
  return ids;
};
const laneDealerIds = lane => sorted([...(lane.dealers ?? []), ...(lane.layers?.dealer?.allowed ?? []), lane.layers?.dealer?.default].filter(Boolean));
const layerRows = project => [...(project.layerAssets ?? []), ...(project.layerAssetTrash ?? []).map(row => row.asset)];
const referencePaths = (value, targets, prefix = '') => {
  const found = [];
  const walk = (item, at) => {
    if (typeof item === 'string') { if (targets.has(item)) found.push({path:at, target:item}); return; }
    if (Array.isArray(item)) return item.forEach((row, index) => walk(row, `${at}[${index}]`));
    if (object(item)) for (const [key, row] of Object.entries(item)) {
      if (DESCRIPTIVE.has(key)) continue;
      if (targets.has(key)) found.push({path:`${at}.${key}`, target:key});
      walk(row, `${at}.${key}`);
    }
  };
  walk(value, prefix); return found;
};
function packageValue(value) {
  if (!object(value) || Object.keys(value).length !== PACKAGE_COLUMNS.length || PACKAGE_COLUMNS.some(key => !Object.hasOwn(value,key))) fail('retirement_invalid_snapshot','package columns');
  const result = {};
  for (const key of PACKAGE_COLUMNS) {
    let parsed = value[key];
    if (typeof parsed === 'string') {
      try { parsed = copy(JSON.parse(parsed)); }
      catch { fail('retirement_invalid_snapshot',`package ${key}`); }
    }
    if (key === 'branding' ? !object(parsed) : !Array.isArray(parsed) || parsed.some(id => !stableId(id))) fail('retirement_invalid_snapshot',`package ${key}`);
    result[key] = parsed;
  }
  if (Object.hasOwn(result.branding,'_scoutPresentation') && !object(result.branding._scoutPresentation)) fail('retirement_invalid_snapshot','package presentation');
  return result;
}
function validateForgeAnchor(anchor, source) {
  if (!object(anchor) || !pathValid(anchor.pathname) || !/^[a-f0-9]{64}$/.test(anchor.sha256)
    || !Number.isSafeInteger(anchor.size) || anchor.size < 16 || !['image/png','image/jpeg','image/webp'].includes(anchor.contentType)
    || ![anchor.width,anchor.height].every(n => Number.isSafeInteger(n) && n > 0 && n <= 16384)) fail('retirement_invalid_snapshot',source);
}
function forgeAnchors(forge) {
  const anchors = [];
  for (const row of forge.profiles) {
    const poses = row.profile.anchors;
    if (!object(poses) || Object.keys(poses).some(key => !['vila','redo'].includes(key))) fail('retirement_invalid_snapshot','forge profile anchors');
    for (const [pose,anchor] of Object.entries(poses)) if (anchor !== null) {
      const subject = `forgeProfile:${row.dealerId}:${pose}`;
      validateForgeAnchor(anchor,subject); anchors.push({anchor,subject,kind:'forgeProfile',id:row.dealerId});
    }
  }
  for (const row of forge.jobs) if (row.result?.anchor !== undefined && row.result.anchor !== null) {
    const subject = `forgeJob:${row.jobId}:anchor`;
    validateForgeAnchor(row.result.anchor,subject); anchors.push({anchor:row.result.anchor,subject,kind:'forgeJob',id:row.jobId});
  }
  return anchors;
}
function selectionValue(input = {}) {
  const value = copy(input);
  if (!object(value) || Object.keys(value).some(key => !['remove','protect','replacements'].includes(key))) fail('retirement_invalid_selection');
  const result = {remove:{}, protect:{}, replacements:{dealerDefaults:{}, layerDefaults:{}}};
  for (const mode of ['remove', 'protect']) {
    const section = value[mode] ?? {};
    if (!object(section) || Object.keys(section).some(key => !FIELDS.includes(key) && !(mode === 'protect' && ['games','allBackgrounds'].includes(key)))) fail('retirement_invalid_selection');
    for (const key of FIELDS) {
      const values = section[key] ?? [];
      if (!Array.isArray(values) || values.some(item => key === 'filePathnames' ? !pathValid(item) : !stableId(item)) || new Set(values).size !== values.length) fail('retirement_invalid_selection', key);
      result[mode][key] = sorted(values);
    }
  }
  result.protect.games = sorted(value.protect?.games ?? []);
  if (result.protect.games.some(game => !['blackjack','roulette'].includes(game))) fail('retirement_invalid_selection', 'games');
  if (value.protect?.allBackgrounds !== undefined && typeof value.protect.allBackgrounds !== 'boolean') fail('retirement_invalid_selection', 'allBackgrounds');
  result.protect.allBackgrounds = value.protect?.allBackgrounds === true;
  if (value.replacements !== undefined) {
    if (!object(value.replacements) || Object.keys(value.replacements).some(key => !['dealerDefaults','layerDefaults'].includes(key))) fail('retirement_invalid_selection');
    for (const key of ['dealerDefaults','layerDefaults']) {
      if (value.replacements[key] !== undefined && !object(value.replacements[key])) fail('retirement_invalid_selection');
      result.replacements[key] = value.replacements[key] ?? {};
    }
  }
  return result;
}
function snapshotValue(input) {
  const state = copy(input);
  if (!object(state) || state.schemaVersion !== 1 || !object(state.coverage) || !object(state.documents) || !object(state.forge)) fail('retirement_invalid_snapshot');
  validateStudioScope(state.scope);
  if (state.holds !== undefined && (!Array.isArray(state.holds) || state.holds.some(row => !object(row) || !stableId(row.code) || !FIELDS.includes(row.field) || !stableId(row.id)))) fail('retirement_invalid_snapshot', 'holds');
  for (const kind of ['project','administration']) if (!state.documents[kind]) fail('retirement_invalid_snapshot', kind);
  for (const [kind, doc] of Object.entries(state.documents)) {
    if (!object(doc)) fail('retirement_invalid_snapshot', kind);
    validateDocumentValue(kind, doc.value, doc.revision, {allowLegacyRead:true});
    if (kind === 'project' && doc.value.revision !== doc.revision) fail('retirement_invalid_snapshot', 'project revision');
  }
  uniqueRows(state.media, 'id', 'media'); uniqueRows(state.operators, 'id', 'operators');
  uniqueRows(state.packages, 'key', 'packages'); uniqueRows(state.history, 'id', 'history');
  uniqueRows(state.forge.profiles, 'dealerId', 'forge profiles'); uniqueRows(state.forge.jobs, 'jobId', 'forge jobs');
  uniqueRows(state.references, 'id', 'references');
  for (const row of state.media) {
    validateRevision(row.revision);
    validateStudioMedia(row.record);
    if (!object(row.record) || row.record.id !== row.id || !stableId(row.record.classification?.dealerId) || !pathValid(row.record.pathname)) fail('retirement_invalid_snapshot', 'media record');
  }
  for (const row of state.packages) {
    if (!stableId(row.operatorId) || !['string','number'].includes(typeof row.revision) || typeof row.current !== 'boolean') fail('retirement_invalid_snapshot', 'package');
    row.value = packageValue(row.value);
  }
  for (const row of state.history) if (!stableId(row.kind) || !stableId(row.revision) || !object(row.value)) fail('retirement_invalid_snapshot', 'history');
  for (const row of state.forge.profiles) if (!Number.isSafeInteger(row.revision) || row.revision < 1 || !object(row.profile)) fail('retirement_invalid_snapshot', 'forge profile');
  for (const row of state.forge.jobs) if (!stableId(row.dealerId) || !stableId(row.status)
    || ['request','result'].some(key => row[key] !== undefined && row[key] !== null && !object(row[key]))) fail('retirement_invalid_snapshot', 'forge job');
  forgeAnchors(state.forge);
  if (!Array.isArray(state.files)) fail('retirement_invalid_snapshot', 'files');
  const paths = new Set();
  for (const file of state.files) {
    if (!object(file) || !pathValid(file.pathname) || paths.has(file.pathname) || typeof file.present !== 'boolean'
      || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0 || !Array.isArray(file.owners)
      || file.owners.some(owner => !object(owner) || !['dealer','media','layerAsset','package','history','forgeProfile','forgeJob','external'].includes(owner.kind) || !stableId(owner.id))) fail('retirement_invalid_snapshot', 'file ownership');
    paths.add(file.pathname);
  }
  return state;
}
function prepare(input, rawSelection) {
  const state = snapshotValue(input), selection = selectionValue(rawSelection), next = copy(state);
  const remove = Object.fromEntries(FIELDS.map(key => [key, new Set(selection.remove[key])]));
  const protect = Object.fromEntries(FIELDS.map(key => [key, new Set(selection.protect[key])]));
  const blockers = [], add = (code, subject, details = []) => blockers.push({code, subject, details});
  for (const key of COVERAGE) if (state.coverage[key] !== true) add('coverage_incomplete', key);
  const project = next.documents.project.value, administration = next.documents.administration.value;
  const mediaDealer = row => row.record.classification.dealerId;
  const layers = layerRows(project), allDealers = [...project.dealers, ...(project.dealerTrash ?? []).map(row => row.dealer)];
  const known = {
    dealerIds: new Set([...allDealers.map(row => row.id), ...state.media.map(mediaDealer), ...state.forge.profiles.map(row => row.dealerId)]),
    operatorIds:new Set(state.operators.map(row => row.id)), roomIds:new Set((administration.rooms ?? []).map(row => row.id)),
    gameLaneIds:new Set((administration.gameLanes ?? []).map(row => row.id)), compositionIds:new Set((project.lanes ?? []).map(row => row.id)),
    mediaIds:new Set(state.media.map(row => row.id)), layerAssetIds:new Set(layers.map(row => row.id)), animationAssetIds:new Set(project.assets.map(row => row.id)),
    triggerIds:new Set(project.triggers.map(row => row.id)), packageKeys:new Set(state.packages.map(row => row.key)), historyIds:new Set(state.history.map(row => row.id)),
    forgeProfileIds:new Set(state.forge.profiles.map(row => row.dealerId)), forgeJobIds:new Set(state.forge.jobs.map(row => row.jobId)), filePathnames:new Set(state.files.map(row => row.pathname)),
  };
  // A missing removal ID is stale intent. A protected future dealer may not exist yet.
  for (const key of FIELDS) for (const id of remove[key]) if (!known[key].has(id)) add('selected_resource_missing', `${key}:${id}`);
  for (const row of state.media) {
    if (remove.dealerIds.has(mediaDealer(row))) remove.mediaIds.add(row.id);
    if (remove.mediaIds.has(row.id) && row.record.deletion?.state === 'pending') add('media_deletion_pending', row.id);
    if (protect.dealerIds.has(mediaDealer(row)) || selection.protect.games.includes(row.record.classification.game)) protect.mediaIds.add(row.id);
  }
  for (const row of layers) if (selection.protect.allBackgrounds && row.role === 'background' || row.role === 'table' && selection.protect.games.some(game => layerAssetFitsGame(row,game))) protect.layerAssetIds.add(row.id);
  for (const row of administration.rooms ?? []) if (remove.operatorIds.has(row.operatorId) || remove.dealerIds.has(row.dealer)) remove.roomIds.add(row.id);
  for (const row of administration.gameLanes ?? []) if (remove.dealerIds.has(row.dealer)) remove.gameLaneIds.add(row.id);
  for (const row of state.packages) if (remove.operatorIds.has(row.operatorId)) remove.packageKeys.add(row.key);
  for (const row of state.forge.profiles) {
    if (remove.dealerIds.has(row.dealerId)) remove.forgeProfileIds.add(row.dealerId);
    if (protect.dealerIds.has(row.dealerId)) protect.forgeProfileIds.add(row.dealerId);
  }
  for (const row of state.forge.jobs) {
    if (remove.dealerIds.has(row.dealerId)) remove.forgeJobIds.add(row.jobId);
    if (protect.dealerIds.has(row.dealerId) || selection.protect.games.includes(row.request?.game)) protect.forgeJobIds.add(row.jobId);
    if (remove.forgeJobIds.has(row.jobId) && !TERMINAL.has(row.status)) add('forge_job_not_terminal', row.jobId, [row.status]);
  }

  const sharedCompositions = [];
  for (const lane of project.lanes ?? []) {
    const dealers = laneDealerIds(lane), retired = dealers.filter(id => remove.dealerIds.has(id)), retained = dealers.filter(id => !remove.dealerIds.has(id));
    if (retired.length && !retained.length) remove.compositionIds.add(lane.id);
    if (retired.length && retained.length) sharedCompositions.push({id:lane.id, removedDealerIds:retired, retainedDealerIds:retained});
    if (dealers.some(id => protect.dealerIds.has(id))) protect.compositionIds.add(lane.id);
  }
  for (const key of FIELDS) for (const id of remove[key]) if (protect[key].has(id)) add('protected_resource', `${key}:${id}`);

  const protectedHistoryTargets = new Set(['dealerIds','mediaIds','layerAssetIds','animationAssetIds','filePathnames'].flatMap(key => [...protect[key]]));
  for (const row of state.media) if (protect.mediaIds.has(row.id)) protectedHistoryTargets.add(row.record.pathname);
  for (const row of layers) if (protect.layerAssetIds.has(row.id)) protectedHistoryTargets.add(row.pathname);
  for (const file of state.files) if (file.owners.some(owner => owner.kind !== 'external' && protect[OWNER_FIELDS[owner.kind]].has(owner.id))) protectedHistoryTargets.add(file.pathname);
  for (const row of state.history) if (remove.historyIds.has(row.id)) {
    const targets = new Set(protectedHistoryTargets);
    if (row.kind === 'project') {
      const historicalLayers = [...(Array.isArray(row.value.layerAssets) ? row.value.layerAssets : []), ...(Array.isArray(row.value.layerAssetTrash) ? row.value.layerAssetTrash.map(entry => entry?.asset) : [])];
      for (const asset of historicalLayers) if (asset && (selection.protect.allBackgrounds && asset.role === 'background'
        || asset.role === 'table' && selection.protect.games.some(game => layerAssetFitsGame(asset,game)))) {
        if (typeof asset.id === 'string') targets.add(asset.id);
        if (typeof asset.pathname === 'string') targets.add(asset.pathname);
      }
    }
    const protectedReferences = referencePaths(row.value, targets);
    if (protectedReferences.length) add('protected_history', row.id, sorted(protectedReferences.map(ref => ref.target)));
  }

  project.dealers = project.dealers.filter(row => !remove.dealerIds.has(row.id));
  project.lines = project.lines.filter(row => !remove.dealerIds.has(row.dealerId));
  for (const key of ['dealerIdlePolicies','dealerSets','legacyClipPolicy']) if (project[key]) project[key] = project[key].filter(row => !remove.dealerIds.has(row.dealerId));
  if (project.dealerTrash) project.dealerTrash = project.dealerTrash.filter(row => !remove.dealerIds.has(row.dealer.id));
  if (project.mediaPolicy) project.mediaPolicy = project.mediaPolicy.flatMap(row => {
    const variants = row.variants.filter(item => !remove.mediaIds.has(item.videoId));
    if (variants.length === row.variants.length) return [row];
    if (!remove.dealerIds.has(familyDealers.get(row.familyId))) {
      add('shared_media_policy', row.familyId, row.variants.filter(item => remove.mediaIds.has(item.videoId)).map(item => item.videoId));
      return [row];
    }
    return variants.length ? [{...row, variants}] : [];
  });
  if (project.clipLabels) for (const id of remove.mediaIds) delete project.clipLabels[id];
  if (project.layerAssets) project.layerAssets = project.layerAssets.filter(row => !remove.layerAssetIds.has(row.id));
  if (project.layerAssetTrash) project.layerAssetTrash = project.layerAssetTrash.filter(row => !remove.layerAssetIds.has(row.asset.id));
  project.assets = project.assets.filter(row => !remove.animationAssetIds.has(row.id));
  project.triggers = project.triggers.filter(row => !remove.triggerIds.has(row.id));
  if (project.lanes) project.lanes = project.lanes.filter(row => !remove.compositionIds.has(row.id)).map(lane => {
    lane.dealers = lane.dealers.filter(id => !remove.dealerIds.has(id));
    lane.layers.dealer.allowed = lane.layers.dealer.allowed.filter(id => !remove.dealerIds.has(id));
    if (remove.dealerIds.has(lane.layers.dealer.default)) {
      const chosen = selection.replacements.dealerDefaults[lane.id];
      if (!lane.layers.dealer.allowed.includes(chosen) || !lane.dealers.includes(chosen)) add('dealer_default_required', lane.id, lane.layers.dealer.allowed);
      else lane.layers.dealer.default = chosen;
    }
    // Never silently remove a retained dealer's selected idle film, speech or pose.
    for (const id of lane.idle?.variants ?? []) if (remove.mediaIds.has(id)) add('shared_composition_media', lane.id, [id]);
    for (const role of ['table','background']) {
      const layer = lane.layers[role];
      layer.allowed = layer.allowed.filter(id => !remove.layerAssetIds.has(id));
      if (remove.layerAssetIds.has(layer.default)) {
        const choices = selection.replacements.layerDefaults[lane.id] ?? {};
        if (!Object.hasOwn(choices, role) || choices[role] !== null && !layer.allowed.includes(choices[role])) add('layer_default_required', `${lane.id}:${role}`);
        else layer.default = choices[role];
      }
    }
    return lane;
  });
  if (administration.rooms) administration.rooms = administration.rooms.filter(row => !remove.roomIds.has(row.id));
  if (administration.gameLanes) administration.gameLanes = administration.gameLanes.filter(row => !remove.gameLaneIds.has(row.id));
  if (remove.gameLaneIds.has(administration.gameLane)) administration.gameLane = null;
  next.media = next.media.filter(row => !remove.mediaIds.has(row.id));
  next.operators = next.operators.filter(row => !remove.operatorIds.has(row.id));
  next.packages = next.packages.filter(row => !remove.packageKeys.has(row.key));
  next.history = next.history.filter(row => !remove.historyIds.has(row.id));
  next.forge.profiles = next.forge.profiles.filter(row => !remove.forgeProfileIds.has(row.dealerId));
  next.forge.jobs = next.forge.jobs.filter(row => !remove.forgeJobIds.has(row.jobId));

  const ownerField = OWNER_FIELDS;
  const ownerRemoved = owner => owner.kind !== 'external' && remove[ownerField[owner.kind]].has(owner.id);
  const filesByPath = new Map(state.files.map(row => [row.pathname,row]));
  const retainedSharedFiles = [], deleteFiles = [];
  for (const row of state.media) {
    if (!remove.mediaIds.has(row.id)) continue;
    const file = filesByPath.get(row.record.pathname);
    if (!file && row.record.deletion?.state !== 'deleted') add('file_evidence_missing', row.id, [row.record.pathname]);
    if (file && !file.owners.some(owner => owner.kind === 'media' && owner.id === row.id)) add('file_owner_missing', row.id, [file.pathname]);
    if (file && (file.sha256 !== row.record.sha256 || file.size !== row.record.size)) add('file_integrity_mismatch', row.id, [file.pathname]);
  }
  for (const row of layers) if (remove.layerAssetIds.has(row.id)) {
    const file = filesByPath.get(row.pathname);
    if (!file) add('file_evidence_missing', row.id, [row.pathname]);
    else if (!file.owners.some(owner => owner.kind === 'layerAsset' && owner.id === row.id)) add('file_owner_missing', row.id, [row.pathname]);
    if (file && (file.sha256 !== row.sha256 || file.size !== row.size)) add('file_integrity_mismatch', row.id, [row.pathname]);
  }
  for (const {anchor,subject,kind,id} of forgeAnchors(state.forge)) if (remove[ownerField[kind]].has(id)) {
    const file = filesByPath.get(anchor.pathname);
    if (!file) add('file_evidence_missing', subject, [anchor.pathname]);
    else if (!file.owners.some(owner => owner.kind === kind && owner.id === id)) add('file_owner_missing', subject, [anchor.pathname]);
    if (file && (file.sha256 !== anchor.sha256 || file.size !== anchor.size)) add('file_integrity_mismatch', subject, [anchor.pathname]);
  }
  for (const file of state.files) {
    for (const owner of file.owners) if (owner.kind !== 'external' && !known[ownerField[owner.kind]].has(owner.id)) add('unknown_file_owner', file.pathname, [owner]);
    const removedOwners = file.owners.filter(ownerRemoved), retainedOwners = file.owners.filter(owner => !ownerRemoved(owner));
    const explicit = remove.filePathnames.has(file.pathname), candidate = explicit || removedOwners.length > 0;
    if (!candidate) continue;
    if (!file.owners.length) { add('file_ownership_unknown', file.pathname); continue; }
    if (retainedOwners.length) {
      retainedSharedFiles.push({pathname:file.pathname, retainedOwners, removedOwners});
      if (explicit) add('shared_file', file.pathname, retainedOwners);
      continue;
    }
    if (protect.filePathnames.has(file.pathname)) { add('protected_resource', `filePathnames:${file.pathname}`); continue; }
    remove.filePathnames.add(file.pathname);
    if (file.present) deleteFiles.push({pathname:file.pathname, sha256:file.sha256, size:file.size, owners:file.owners});
  }
  next.files = next.files.filter(file => !remove.filePathnames.has(file.pathname)).map(file => ({...file,owners:file.owners.filter(owner => !ownerRemoved(owner))}));

  for (const hold of state.holds ?? []) {
    const affected = remove[hold.field].has(hold.id) || hold.field === 'dealerIds' && (
      state.media.some(row => mediaDealer(row) === hold.id && remove.mediaIds.has(row.id))
      || remove.forgeProfileIds.has(hold.id) || state.forge.jobs.some(row => row.dealerId === hold.id && remove.forgeJobIds.has(row.jobId)));
    if (affected) add(hold.code, `${hold.field}:${hold.id}`);
  }
  // Exact values/keys are a final residue guard, never ownership inference.
  // No substring/label match can turn an unrelated resource into a candidate.
  const targets = new Set(FIELDS.flatMap(key => [...remove[key]]));
  const retained = {...next, files:undefined, coverage:undefined, scope:undefined};
  delete retained.files; delete retained.coverage; delete retained.scope; delete retained.holds;
  for (const ref of referencePaths(retained, targets, 'snapshot')) add('retained_reference', ref.path, [ref.target]);
  for (const [kind, doc] of Object.entries(next.documents)) {
    try { validateDocumentValue(kind, doc.value, doc.revision, {allowLegacyRead:true}); }
    catch { add('invalid_result_document', kind); }
  }
  const uniqueBlockers = [...new Map(blockers.map(row => [canonical(row),row])).values()].sort((a,b) => canonical(a).localeCompare(canonical(b)));
  const plan = {
    schemaVersion:1, purpose:'offline-studio-retirement-plan', scope:state.scope, ready:uniqueBlockers.length === 0,
    snapshotHash:retirementSnapshotHash(state), selection,
    preconditions:{documents:Object.fromEntries(Object.entries(state.documents).map(([kind,row]) => [kind,row.revision])),
      media:state.media.map(row => ({id:row.id,revision:row.revision})).sort((a,b) => a.id.localeCompare(b.id))},
    remove:Object.fromEntries(FIELDS.map(key => [key,sorted(remove[key])])),
    inventory:{sharedCompositions, retainedSharedFiles, deleteFiles,
      media:state.media.filter(row => remove.mediaIds.has(row.id)).map(row => ({id:row.id, dealerId:mediaDealer(row), pathname:row.record.pathname, state:row.record.deletion?.state ?? 'active'})),
      packages:state.packages.filter(row => remove.packageKeys.has(row.key)).map(row => ({key:row.key,operatorId:row.operatorId,revision:row.revision,current:row.current})),
      history:state.history.filter(row => remove.historyIds.has(row.id)).map(row => ({id:row.id,kind:row.kind,revision:row.revision})),
      forgeJobs:state.forge.jobs.filter(row => remove.forgeJobIds.has(row.jobId)).map(row => ({jobId:row.jobId,dealerId:row.dealerId,status:row.status}))},
    blockers:uniqueBlockers,
  };
  return {plan:{...plan,token:retirementSnapshotHash(plan)},next};
}
export function planStudioRetirement(snapshot, selection = {}) {
  return prepare(snapshot, selection).plan;
}
export function transformStudioRetirement(snapshot, plan, {expectedToken} = {}) {
  if (!object(plan) || typeof expectedToken !== 'string' || expectedToken !== plan.token) fail('retirement_conflict');
  const current = prepare(snapshot, plan.selection);
  if (current.plan.token !== expectedToken || canonical(current.plan) !== canonical(plan)) fail('retirement_conflict');
  if (!current.plan.ready) fail('retirement_blocked', current.plan.blockers);
  // Revisions deliberately remain CAS preconditions. Only a storage transaction
  // can allocate new revisions; this is a candidate value, never a saved record.
  return {snapshot:current.next, deleteFiles:current.plan.inventory.deleteFiles, token:current.plan.token};
}
