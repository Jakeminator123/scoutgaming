// Operator package editor: which saved compositions a company may use. The
// server-read package revision is a CAS precondition; a stale tab can never
// replace a newer selection. Shared by Spelbolag & rum and the older
// publication page so both keep one publish contract.
import {AI_TABLE_MISFIT_CODE,aiTableMisfitMessage} from './ai-image-contract.mjs';

/** @typedef {{chosen:string[];baseline:string[];revision:number|null;message:string;error:string;needsRefresh:boolean}} PackageEditor */

const sorted = ids => JSON.stringify([...ids].sort());

export function packageEditor(operator) {
  const lanes = operator?.publishedPackage?.lanes ?? [];
  return { chosen: [...lanes], baseline: [...lanes], revision: operator?.publishedPackage?.revision ?? null,
    message: '', error: '', needsRefresh: operator?.publishedPackage === undefined };
}

export const packageSelectionDirty = editor => sorted(editor.chosen) !== sorted(editor.baseline);

export function togglePackageLane(editor, laneId, checked) {
  return { ...editor, chosen: checked ? [...new Set([...editor.chosen, laneId])] : editor.chosen.filter(id => id !== laneId), message: '', error: '' };
}

// A fresh lifecycle snapshot rebases every company's draft additions and
// removals onto its published lanes. An older package revision never rolls the
// editor back, and a receipt only survives while its revision is current.
export function rebasePackageEditors(current, operators) {
  const next = { ...current };
  for (const operator of operators) {
    const previous = current[operator.id] ?? packageEditor();
    if ((operator.packageRevision ?? 0) < (previous.revision ?? 0)) continue;
    const removed = new Set(previous.baseline.filter(id => !previous.chosen.includes(id)));
    const added = previous.chosen.filter(id => !previous.baseline.includes(id));
    next[operator.id] = { ...previous, chosen: [...new Set([...operator.lanes.filter(id => !removed.has(id)), ...added])],
      baseline: [...operator.lanes], revision: operator.packageRevision,
      message: operator.packageRevision === previous.revision ? previous.message : '', needsRefresh: false, error: '' };
  }
  return next;
}

export function markPackagesStale(current) {
  return Object.fromEntries(Object.entries(current).map(([id, editor]) => [id, { ...editor, needsRefresh: true }]));
}

export function packagePublishError(status, payload) {
  if (payload?.code === 'studio_presentation_runtime_update_required') return 'Spelmotorn behöver uppdateras innan ändringen kan publiceras. Dina val finns kvar.';
  // A refused AI table graphic names the scene template and the fixed reason.
  if (payload?.code === AI_TABLE_MISFIT_CODE) return (typeof payload.compositionId === 'string' && /^[a-z][a-z0-9-]{0,62}$/.test(payload.compositionId) ? 'Miljön ' + payload.compositionId + ': ' : '')
    + aiTableMisfitMessage({code:payload.reason}) + ' Inget publicerades.';
  if (status === 413) return 'Publiceringspaketet är för stort. Inget publicerades; dina sparade val finns kvar.';
  if (status === 422) return 'Kontrollera lagerfiler, vald grundloop och tillåtna val. Spara miljön och försök igen.';
  if (status === 409) return 'Paketet kunde inte uppdateras. Uppgifterna kan ha ändrats, eller så påverkar urvalet ett befintligt spelrum. Läs in bolagets publicerade paket och behåll miljöer som används av spelrum.';
  // A fixed server code (never provider text) lets support find the failing layer.
  const code = typeof payload?.code === 'string' && /^[a-z][a-z0-9_]{0,100}$/.test(payload.code) ? payload.code : '';
  return code ? 'Publiceringen gick inte igenom: ' + code : 'Publiceringen gick inte igenom.';
}

// The receipt must name this company, exactly these lanes and the next revision.
export function verifiedPackageRevision(payload, { operatorId, lanes, revision }) {
  const next = payload?.packageRevision;
  const sameLanes = Array.isArray(payload?.lanes) && payload.lanes.length === lanes.length && new Set(payload.lanes).size === lanes.length
    && payload.lanes.every(id => typeof id === 'string' && lanes.includes(id));
  if (payload?.ok !== true || payload.operatorId !== operatorId || !sameLanes || !Number.isSafeInteger(next) || next !== (revision ?? 0) + 1
    || (payload.package_revision !== undefined && payload.package_revision !== next)) return null;
  return next;
}

export const PACKAGE_RECEIPT_MISMATCH = 'Publiceringskvittot stämmer inte med bolaget, urvalet eller versionen. Dina val finns kvar. Läs in aktuella uppgifter innan du fortsätter.';
export const PACKAGE_UNCONFIRMED = 'Publiceringen kunde inte bekräftas. Läs in bolagets aktuella publicering innan du försöker igen.';

/**
 * Publishes the selection and returns the editor update. Network and receipt
 * failures keep the draft and require a readback before the next attempt.
 * @returns {Promise<{ok:true;revision:number}|{ok:false;error:string;needsRefresh:boolean}>}
 */
export async function publishOperatorPackage({ endpoint, operatorId, lanes, revision, fetchImpl = fetch }) {
  try {
    const response = await fetchImpl(endpoint, { method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ operatorId, lanes, expectedPackageRevision: revision }) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, needsRefresh: response.status === 409, error: packagePublishError(response.status, payload) };
    const next = verifiedPackageRevision(payload, { operatorId, lanes, revision });
    if (next === null) return { ok: false, needsRefresh: true, error: PACKAGE_RECEIPT_MISMATCH };
    return { ok: true, revision: next };
  } catch {
    return { ok: false, needsRefresh: true, error: PACKAGE_UNCONFIRMED };
  }
}

export function publishedPackageMessage(revision) {
  return 'Bolagets miljöer är publicerade. Version ' + revision + '.';
}
