import {measureClipsInOrder, unmeasuredClips} from './media-timing.mjs';
import {blockerKey, blockerText} from './blocker-text.mjs';
import {appearanceBranding, appearanceReceipt, sameAppearance} from '../../../components/partner-appearance-state.mjs';

// Automatiska åtgärder för hinder som Admin kan lösa själv (Enkel väg 2). Rena funktioner:
// fetch kommer som argument. Varje steg görs en gång; vid 409 stannar steget utan nytt försök
// (samma regel som room-release.tsx): användaren läser in igen. Ett utkast kastas aldrig.

export const CHANGED_MESSAGE = 'Något ändrades medan spelbordet förbereddes. Läs in igen.';
const VIDEOS_URL = '/studio/api/videos';
const CATALOG_URL = '/admin/_data/catalog';
const BRANDING_URL = '/studio/api/partner/branding';
const changed = () => ({handled:false, message:CHANGED_MESSAGE});
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);

async function readJson(fetchImpl, url, init = {}) {
  const response = await fetchImpl(url, {credentials:'same-origin', cache:'no-store', redirect:'error', ...init,
    headers:{accept:'application/json', ...(init.body ? {'content-type':'application/json'} : {})}});
  return {status:response.status, ok:response.ok, data:await response.json().catch(() => null)};
}

/** Mäter dealerns omätta klipp i registrets ordning. `clips` är registrets klipp; saknas de läses registret. */
export async function measureUnmeasured({dealerId, clips, fetch:fetchImpl = globalThis.fetch, signal} = {}) {
  if (!id(dealerId)) return {handled:false, message:'Spelbordets dealer är inte känd. Öppna dealerns klipp och välj Mät omätta klipp.'};
  let videos = Array.isArray(clips) ? clips : Array.isArray(clips?.videos) ? clips.videos : null;
  if (!videos) {
    const read = await readJson(fetchImpl, VIDEOS_URL, {signal});
    if (read.status === 409) return changed();
    if (!read.ok || !Array.isArray(read.data?.videos)) return {handled:false, message:'Klippregistret kunde inte läsas. Läs in igen.'};
    videos = read.data.videos;
  }
  const pending = unmeasuredClips({videos}, dealerId);
  if (!pending.length) return {handled:false, message:'Det finns inga omätta klipp att mäta. Öppna dealerns klipp och kontrollera mätningen.'};
  // Ett 409 stoppar resten: signalen avbryts och measureClipsInOrder mäter inget mer.
  const stop = new AbortController();
  let conflict = false;
  const guarded = async (url, init) => {
    const response = await fetchImpl(url, init);
    if (response.status === 409) { conflict = true; stop.abort(); }
    return response;
  };
  const {measured, failed} = await measureClipsInOrder(pending, {fetchImpl:guarded, signal:signal ? AbortSignal.any([signal, stop.signal]) : stop.signal});
  if (conflict) return changed();
  if (failed.length) return {handled:false, message:failed[0].message};
  return {handled:true, measured:measured.length};
}

/**
 * Sparar om bolagets utseendeutkast på paketets nya revision (`revision`) med samma save-draft
 * som Utseende (partner-appearance.tsx). Utkastets val sparas oförändrade; inget kastas.
 */
export async function refreshStaleDraft({operatorId, operatorSlug, revision, fetch:fetchImpl = globalThis.fetch, signal} = {}) {
  if (!id(operatorId) || !Number.isSafeInteger(revision) || revision < 1) return {handled:false, message:'Bolaget eller dess version är inte känd. Läs in igen.'};
  let slug = typeof operatorSlug === 'string' && operatorSlug ? operatorSlug : null;
  if (!slug) {
    const catalog = await readJson(fetchImpl, CATALOG_URL, {signal});
    if (catalog.status === 409) return changed();
    slug = (catalog.data?.administration?.operators ?? []).find(row => row?.id === operatorId)?.slug ?? null;
    if (!catalog.ok || typeof slug !== 'string' || !slug) return {handled:false, message:'Bolaget kunde inte läsas. Läs in igen.'};
  }
  const endpoint = BRANDING_URL + '?operator=' + encodeURIComponent(slug);
  const read = await readJson(fetchImpl, endpoint, {signal});
  if (read.status === 409) return changed();
  if (!read.ok || !appearanceReceipt(read.data, operatorId)) return {handled:false, message:'Utseendet kunde inte läsas. Öppna Utseende.'};
  const state = read.data;
  if (state.packageRevision !== revision || !state.draft) return changed();
  if (state.draft.basePackageRevision === revision) return {handled:false, message:'Utseendeutkastet är redan sparat på senaste versionen. Publicera det under Utseende.'};
  const branding = appearanceBranding(state.draft.branding);
  const saved = await readJson(fetchImpl, endpoint, {method:'POST', signal,
    body:JSON.stringify({action:'save-draft', expectedDraftRevision:state.draft.revision, expectedPackageRevision:revision, branding})});
  if (saved.status === 409) return changed();
  if (!saved.ok) return {handled:false, message:'Utkastet kunde inte sparas om. Det finns kvar; öppna Utseende.'};
  const receipt = saved.data;
  if (!appearanceReceipt(receipt, operatorId) || receipt.packageRevision !== revision || receipt.draft?.basePackageRevision !== revision
    || !sameAppearance(receipt.draft.branding, branding)) return {handled:false, message:'Svaret kunde inte bekräftas. Utkastet finns kvar; läs in igen.'};
  return {handled:true, draftRevision:receipt.draft.revision};
}

const AUTOMATIC = Object.freeze({
  native_material_measurement_missing:(release, blocker, deps) => measureUnmeasured({...deps,
    dealerId:deps.dealerId ?? release?.candidate?.dealerId ?? release?.live?.dealerId}),
  studio_room_choices_draft_pending:(release, blocker, deps) => refreshStaleDraft({...deps,
    operatorId:deps.operatorId ?? release?.operatorId, roomId:release?.roomId, revision:deps.revision ?? release?.revisions?.package}),
});
/** Om hindret kan åtgärdas automatiskt (bara spelbordets eget hinder, inte ett annat spelbords). */
export const automaticBlocker = blocker => Object.hasOwn(AUTOMATIC, blockerKey(blocker) ?? '') && blocker?.area !== 'rooms';

/**
 * Löser förhandsvisningens (`release`) automatiska hinder i ordning, ett försök var. Stannar vid
 * första steg som inte lyckas. Inga automatiska hinder: {handled:false, message} med första hindrets text.
 * `deps`: {fetch, signal?, dealerId?, clips?, operatorSlug?}.
 */
export async function resolveBlocker({release, deps = {}} = {}) {
  const blockers = Array.isArray(release?.blockers) ? release.blockers : [];
  const steps = blockers.filter(automaticBlocker);
  if (!steps.length) return {handled:false, message:blockerText(blockers[0], {}).text};
  const done = [];
  for (const blocker of steps) {
    const result = await AUTOMATIC[blockerKey(blocker)](release, blocker, deps);
    if (!result?.handled) return {handled:false, message:result?.message ?? CHANGED_MESSAGE, done};
    done.push(blockerKey(blocker));
  }
  return {handled:true, done};
}
