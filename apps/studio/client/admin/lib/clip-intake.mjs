// Clip intake for the clip map: dropped files or folders become draggable rows,
// the server proposes exact catalogue slots, the user moves rows between map
// cards and approves. Only MP4/WebM video is saved; model text, filenames and
// folder paths are advice. Upload rights always come from the registered
// catalogue through importClassification, never from a proposal.
import { applyImportProposals, compatibleImportSlot, importContentType, importFileError, importRowError, slotAcceptsPoses } from './dealer-import.mjs';
import { slotCaption } from './studio-layout.mjs';

export const INTAKE_DRAG_TYPE = 'application/x-scout-intake';
export const INTAKE_PATH_LIMIT = 240;
export const INTAKE_MAX_DROPPED_FILES = 400;

export function intakeFileKind(name) {
  const type = importContentType(name);
  return type.startsWith('video/') ? 'video' : type.startsWith('audio/') ? 'audio' : type.startsWith('image/') ? 'image' : '';
}

// Folder-relative path from a dropped or selected folder. The server accepts a
// `/`-separated path of at most 240 characters that ends with the file's own
// name; anything else (or a bare name) is omitted rather than repaired.
export function intakeRelativePath(file, path = file?.webkitRelativePath) {
  if (typeof path !== 'string' || !path || path.length > INTAKE_PATH_LIMIT) return null;
  const name = String(file?.name ?? '');
  if (/[\\\u0000-\u001f]/.test(path) || path.startsWith('/') || !name) return null;
  const segments = path.split('/');
  if (segments.length < 2 || segments.some(segment => !segment || segment === '.' || segment === '..') || segments.at(-1) !== name) return null;
  return path;
}

const fileKey = (file, path) => JSON.stringify([file.name, file.size, file.lastModified ?? 0, path ?? '']);
const unsupported = kind => kind === 'image'
  ? 'Bilder sparas inte i klippbanken. Referensbilder hanteras separat; ta bort filen ur listan.'
  : kind === 'audio' ? 'Ljudfiler sparas inte här. Tal med text, ljud och video hanteras i Röst & tal; ta bort filen ur listan.'
    : 'Bara MP4 och WebM kan sparas. Ta bort filen ur listan.';

// Plan newly added files: dedupe against the list and within the batch, keep
// the server's file limit for unsaved rows, and explain every file that cannot
// be saved instead of dropping it silently. Saved receipts no longer count.
export function planIntakeFiles(entries, rows, limits, { id = () => crypto.randomUUID(), slotId = '', background = 'green-screen' } = {}) {
  const maxFiles = Number.isInteger(limits?.maxFiles) && limits.maxFiles > 0 ? Math.min(limits.maxFiles, 30) : 30;
  const seen = new Set(rows.map(row => fileKey(row.file, row.path)));
  let pending = rows.filter(row => row.state !== 'saved').length, duplicates = 0, overflow = 0;
  const added = [];
  for (const entry of entries) {
    const file = entry instanceof Blob ? entry : entry.file;
    if (!file) continue;
    const path = intakeRelativePath(file, entry instanceof Blob ? undefined : entry.path ?? file.webkitRelativePath);
    const key = fileKey(file, path);
    if (seen.has(key)) { duplicates++; continue; }
    if (pending >= maxFiles) { overflow++; continue; }
    seen.add(key); pending++;
    const kind = intakeFileKind(file.name), invalid = kind === 'video' ? importFileError(file, limits?.maxFileBytes) : '';
    const blocked = kind !== 'video' ? unsupported(kind) : invalid;
    added.push({ id: id(), file, ...(path ? { path } : {}), kind, label: file.name.replace(/\.[^.]+$/, '').slice(0, 120),
      slotId: blocked ? '' : slotId, background, state: blocked ? 'error' : 'ready', ...(blocked ? { blocked: true, message: blocked } : {}),
      ...(slotId && !blocked ? { reason: 'Släppt på facket i kartan.', confidence: 'user' } : {}) });
  }
  return { rows: added, duplicates, overflow, maxFiles };
}

export function intakeDescriptors(rows) {
  return rows.filter(row => row.state === 'ready').map(row => ({ id: row.id, name: row.file.name, size: row.file.size,
    type: importContentType(row.file.name), ...(row.path ? { path: row.path } : {}) }));
}

const ROLES = new Set(['standard', 'variant']);
const cleanText = (value, max) => typeof value === 'string' && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value : '';
function alternativesFor(proposal, row, catalog, chosenSlotId) {
  const seen = new Set([chosenSlotId]);
  const candidates = [...(proposal.confidence === 'low' && proposal.slotId ? [{ slotId: proposal.slotId, reason: cleanText(proposal.reason, 600) || 'Modellens osäkra förslag.' }] : []),
    ...(Array.isArray(proposal.alternatives) ? proposal.alternatives : [])];
  const result = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || seen.has(candidate.slotId)) continue;
    const slot = catalog.slots.find(item => item.id === candidate.slotId);
    if (!slot || slot.pose || !compatibleImportSlot(row.file, slot)) continue;
    seen.add(slot.id);
    result.push({ slotId: slot.id, reason: cleanText(candidate.reason, 600) });
    if (result.length === 2) break;
  }
  return result;
}

// Server rows become local placements through the existing guarded mapper.
// Low confidence leaves the row unassigned with its candidates as quick choices.
// Role, group, language and take are display advice and are validated here.
export function applyIntakeProposals(rows, proposals, catalog) {
  const byId = new Map((Array.isArray(proposals) ? proposals : []).filter(proposal => proposal && typeof proposal === 'object').map(proposal => [proposal.fileId, proposal]));
  const mapped = applyImportProposals(rows, [...byId.values()].map(proposal => ({ ...proposal, slotId: proposal.confidence === 'low' ? null : proposal.slotId })), catalog.slots);
  return mapped.map((row, index) => {
    const proposal = byId.get(row.id);
    if (!proposal || rows[index].state !== 'ready') return row;
    const { role: _role, group: _group, alternatives: _alternatives, language: _language, take: _take, ...rest } = row;
    const slot = catalog.slots.find(item => item.id === row.slotId);
    return { ...rest, alternatives: alternativesFor(proposal, row, catalog, row.slotId),
      ...(slot && ROLES.has(proposal.role) ? { role: proposal.role } : {}),
      ...(slot && typeof proposal.group === 'string' && /^[a-z]{1,16}$/.test(proposal.group) ? { group: proposal.group } : {}),
      ...(slot && typeof proposal.language === 'string' && /^[a-z]{2,3}$/.test(proposal.language) ? { language: proposal.language } : {}),
      ...(slot && Number.isInteger(proposal.take) && proposal.take >= 0 && proposal.take < 1000 ? { take: proposal.take } : {}) };
  });
}

// Compatibility of one row with one catalogue slot, for drag targets and
// quick choices. Pose slots are local references and never upload targets.
export function intakeDropCheck(row, slot) {
  if (!row || row.state !== 'ready' || row.blocked) return { accepted: false, reason: row?.kind && row.kind !== 'video' ? unsupported(row.kind) : 'Filen kan inte placeras just nu.' };
  if (!slot) return { accepted: false, reason: 'Facket finns inte i importkatalogen.' };
  if (slot.pose) return { accepted: false, reason: 'Referensbilder är lokala och kan inte ta emot klipp.' };
  if (!compatibleImportSlot(row.file, slot)) return { accepted: false, reason: row.kind === 'audio' ? 'Ljud passar bara talfack.' : 'Bara MP4- eller WebM-video passar detta fack.' };
  return { accepted: true, reason: slot.category === 'speech' ? 'Sparas som tagning i talfacket; talgranskning sker separat.' : '' };
}

// A user placement replaces the proposal. Pose chains follow only into slots
// that accept them; the shoe transitions carry their fixed chain.
export function placeIntakeRow(rows, rowId, slotId, catalog) {
  const slot = catalog.slots.find(item => item.id === slotId);
  return rows.map(row => {
    if (row.id !== rowId || !intakeDropCheck(row, slot).accepted) return row;
    const { poses, alternatives: _alternatives, ...rest } = row;
    const keepPoses = poses && slotAcceptsPoses(slot) && slot.eventId !== 'transition.shoe';
    return { ...rest, slotId: slot.id, reason: 'Du valde facket.', confidence: 'user', warnings: [], ...(keepPoses ? { poses } : {}) };
  });
}

export function intakeRole(row, catalog, dealerId, hasStandard = () => false) {
  if (!row?.slotId) return null;
  if (ROLES.has(row.role)) return row.role;
  const saved = catalog?.standards?.[dealerId];
  if (saved && typeof saved === 'object' && Object.hasOwn(saved, row.slotId)) return saved[row.slotId] ? 'variant' : 'standard';
  return hasStandard(row.slotId) ? 'variant' : 'standard';
}

// "Kategori › Situation" from the server's captions when present, otherwise
// from the map's own groups and captions. Unknown slots show their id.
export function intakeDestination(slotId, catalog, groups = []) {
  if (!slotId) return null;
  const slot = catalog?.slots?.find(item => item.id === slotId);
  const mapGroup = groups.find(group => group.slots.some(item => item.id === slotId));
  const mapSlot = mapGroup?.slots.find(item => item.id === slotId);
  const groupId = slot?.group ?? mapGroup?.id ?? null;
  const title = catalog?.groups?.find(group => group.id === groupId)?.title ?? mapGroup?.title ?? (slot?.category === 'pose' ? 'Referensbild' : 'Övrigt');
  const caption = slot?.caption ?? (mapSlot ? slotCaption(mapSlot) : slot?.label ?? slotId);
  return { group: groupId, title, caption, label: `${title} › ${caption}`, explanation: slot?.explanation ?? '' };
}

export function intakeConfidenceLabel(row) {
  if (!row.slotId) return 'Osäker · välj fack';
  return ({ user: 'Ditt val', high: 'Säkert förslag', medium: 'Troligt förslag', low: 'Osäkert förslag' })[row.confidence] ?? 'Förslag';
}

export function intakeUploadRows(rows) {
  return rows.filter(row => row.state === 'ready' && !row.blocked && row.kind === 'video' && Boolean(row.slotId));
}

// Per-row problem for the list and the approval summary. Saved receipts and
// uploads in progress have none; a blocked file keeps its explanation.
export function intakeRowIssue(row, dealerId, catalog) {
  if (row.state === 'saved' || row.state === 'saving') return '';
  if (row.blocked) return row.message || unsupported(row.kind);
  if (row.state === 'error') return importRowError(row, dealerId, catalog);
  if (!row.slotId) return 'Osäker · välj fack. Dra kortet till rätt kategori i kartan eller välj ett av förslagen.';
  if (row.background === 'alpha') return 'Transparent bakgrund är spärrad för import (serverregel). Välj grön bakgrund eller ta bort filen.';
  return importRowError(row, dealerId, catalog);
}

export function intakeSummary(rows, dealerId, catalog) {
  const unsaved = rows.filter(row => row.state !== 'saved');
  const ready = intakeUploadRows(rows).filter(row => !intakeRowIssue(row, dealerId, catalog));
  const issues = unsaved.map(row => ({ row, message: intakeRowIssue(row, dealerId, catalog) })).filter(item => item.message);
  return { total: rows.length, unsaved: unsaved.length, ready: ready.length, saved: rows.filter(row => row.state === 'saved').length,
    issues, unplaced: unsaved.filter(row => row.state === 'ready' && !row.slotId).length };
}

// Dropped items may be files or folders. Folders are read recursively with the
// browser's entry API; the folder-relative path follows each file. The count
// is bounded so a stray drop of a large tree cannot stall the page.
export async function collectDroppedFiles(dataTransfer, { limit = INTAKE_MAX_DROPPED_FILES, signal } = {}) {
  signal?.throwIfAborted();
  const files = []; let truncated = false;
  const push = (file, path) => { if (files.length >= limit) { truncated = true; return false; } files.push({ file, ...(path ? { path } : {}) }); return true; };
  const readAll = reader => new Promise((resolve, reject) => {
    const batches = [];
    const next = () => reader.readEntries(entries => { if (!entries.length) resolve(batches); else { batches.push(...entries); next(); } }, reject);
    next();
  });
  async function walk(entry, prefix) {
    signal?.throwIfAborted();
    if (files.length >= limit) { truncated = true; return; }
    if (entry.isFile) {
      const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
      signal?.throwIfAborted();
      push(file, prefix ? `${prefix}/${file.name}` : '');
    } else if (entry.isDirectory) {
      const entries = await readAll(entry.createReader());
      signal?.throwIfAborted();
      for (const child of entries) await walk(child, prefix ? `${prefix}/${entry.name}` : entry.name);
    }
  }
  // Entries and loose files must be read synchronously inside the drop event;
  // the item list is emptied once the handler yields.
  const items = Array.from(dataTransfer?.items ?? []);
  const entries = items.map(item => typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null);
  const loose = items.map((item, index) => entries[index] ? null : item.getAsFile?.() ?? null);
  if (entries.some(Boolean)) {
    for (const [index, entry] of entries.entries()) {
      if (entry) await walk(entry, '');
      else if (loose[index]) push(loose[index], '');
    }
  } else for (const file of Array.from(dataTransfer?.files ?? [])) push(file, intakeRelativePath(file) ?? '');
  signal?.throwIfAborted();
  return { files, truncated };
}
