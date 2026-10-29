// Bolag › Tilldelat: Admins fält för bolagets `assignment` (allow, insatsprofiler
// och språk). Publiceras som en ny paketrevision genom paketets vanliga väg
// (POST operator-package, action publish-assignment, CAS på revisionen).
// Servern avgör allt: fältet erbjuder bara det miljön ger bolaget och
// skickar ändå hela tilldelningen, som servern validerar igen.
import { publishOperatorPackage, publishedPackageMessage } from './operator-package-client.mjs';

export const ASSIGNMENT_ALLOW_KEYS = Object.freeze(['dealer', 'tableAsset', 'background', 'language', 'limit', 'pause']);
export const ASSIGNMENT_LAYER_KEYS = Object.freeze(['dealer', 'tableAsset', 'background']);
export const ASSIGNMENT_LABELS = Object.freeze({
  dealer: 'Dealer', tableAsset: 'Bordsgrafik', background: 'Bakgrund',
  language: 'Bordsspråk', limit: 'Insatsprofil', pause: 'Pausa och öppna spelbord',
  casual: 'Casual', prive: 'Privé', high: 'High', sv: 'Svenska', en: 'Engelska',
});
const label = id => ASSIGNMENT_LABELS[id] ?? id;
export { label as assignmentLabel };

/** Utkastet ur katalogens tilldelning (design-preview-catalog.mjs → adminAssignmentView). */
export function assignmentDraft(view) {
  return {
    allow: Object.fromEntries(ASSIGNMENT_ALLOW_KEYS.map(key => [key, view?.allow?.[key] === true])),
    limitPresets: [...(view?.limitPresets ?? [])],
    languages: [...(view?.languages ?? [])],
  };
}

// Ett lager som miljön inte ger bolaget kan inte låsas upp här (servern nekar också).
export const allowLocked = (view, key) => ASSIGNMENT_LAYER_KEYS.includes(key) && view?.adjustable?.[key] !== true;

export function toggleAllow(draft, key, on) {
  return { ...draft, allow: { ...draft.allow, [key]: on === true } };
}
export function toggleListItem(draft, list, id, on, order = []) {
  const next = on ? [...new Set([...draft[list], id])] : draft[list].filter(item => item !== id);
  return { ...draft, [list]: order.length ? order.filter(item => next.includes(item)) : next };
}

const canonical = draft => JSON.stringify({ allow: ASSIGNMENT_ALLOW_KEYS.map(key => draft.allow[key] === true),
  limitPresets: [...draft.limitPresets].sort(), languages: [...draft.languages].sort() });
export const assignmentDirty = (view, draft) => canonical(assignmentDraft(view)) !== canonical(draft);

// Det som stoppar publiceringen innan något skickas.
export function assignmentProblem(view, draft) {
  if (!view) return 'Bolaget har ingen publicerad miljö ännu. Tilldela en miljö och publicera först.';
  if (ASSIGNMENT_LAYER_KEYS.some(key => draft.allow[key] && allowLocked(view, key))) return 'Ett val som miljön inte ger bolaget kan inte låsas upp.';
  if (draft.allow.limit && !draft.limitPresets.length) return 'Välj minst en insatsprofil när insatsprofilen är upplåst.';
  if (draft.allow.language && !draft.languages.length) return 'Välj minst ett språk när bordsspråket är upplåst.';
  return '';
}

export function assignmentPublishError(status) {
  if (status === 403) return 'Du saknar rätt att ändra bolagets tilldelning. Inget publicerades.';
  if (status === 409) return 'Bolagets paket har ändrats sedan du läste det. Inget publicerades; läs in bolaget igen.';
  if (status === 422) return 'Tilldelningen godtogs inte: ett val går utöver miljön eller saknar alternativ. Inget publicerades.';
  if (status === 404) return 'Bolaget eller dess paket finns inte längre. Inget publicerades.';
  return 'Publiceringen gick inte igenom. Inget publicerades.';
}

/**
 * @returns {Promise<{ok:true;revision:number;view:object}|{ok:false;error:string;needsRefresh:boolean}>}
 */
export async function publishAssignment({ endpoint, operatorId, revision, draft, fetchImpl = fetch }) {
  try {
    const response = await fetchImpl(endpoint, { method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ action: 'publish-assignment', operatorId, expectedPackageRevision: revision,
        assignment: { allow: { ...draft.allow }, limitPresets: [...draft.limitPresets], languages: [...draft.languages] } }) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, error: assignmentPublishError(response.status), needsRefresh: response.status === 409 };
    // Kvittot ska gälla det här bolaget och nästa revision.
    if (payload?.ok !== true || payload.operatorId !== operatorId || payload.packageRevision !== revision + 1 || !payload.assignment)
      return { ok: false, error: 'Publiceringen kunde inte bekräftas. Läs in bolaget igen.', needsRefresh: true };
    return { ok: true, revision: payload.packageRevision, view: payload.assignment };
  } catch {
    return { ok: false, error: 'Publiceringen kunde inte bekräftas. Läs in bolaget igen.', needsRefresh: true };
  }
}

/**
 * Bolag › Tilldelning har en knapp, Publicera: urvalet (`lanes`) först och sedan vad bolaget får ändra (`draft`),
 * var och en bara när den är ändrad (null hoppar över). Det andra anropet tar revisionen ur det första kvittot
 * (CAS). Ett stopp avbryter utan nytt försök; `done` säger vad som hann publiceras och `revision` gäller efter det.
 * @param {{endpoint:string;operatorId:string;revision:number|null;lanes?:string[]|null;fetchImpl?:typeof fetch;
 *   draft?:{allow:Record<string,boolean>;limitPresets:string[];languages:string[]}|null}} options
 * @returns {Promise<{ok:true;revision:number;done:string[];message:string}|{ok:false;revision:number|null;done:string[];error:string;needsRefresh:boolean}>}
 */
export async function publishCompanyAssignment({ endpoint, operatorId, revision, lanes = null, draft = null, fetchImpl = fetch }) {
  let current = revision;
  const done = [];
  if (lanes) {
    const result = await publishOperatorPackage({ endpoint, operatorId, lanes, revision: current, fetchImpl });
    if (!result.ok) return { ...result, revision: current, done };
    current = result.revision; done.push('lanes');
  }
  if (draft) {
    const result = await publishAssignment({ endpoint, operatorId, revision: current, draft, fetchImpl });
    if (!result.ok) return { ok: false, needsRefresh: result.needsRefresh, revision: current, done,
      error: done.length ? `Urvalet är publicerat som version ${current}. Vad bolaget får ändra publicerades inte: ${result.error}` : result.error };
    current = result.revision; done.push('assignment');
  }
  const message = done.length === 2 ? `Urvalet och vad bolaget får ändra är publicerade. Version ${current}.`
    : done[0] === 'assignment' ? `Tilldelningen är publicerad. Version ${current}.` : publishedPackageMessage(current);
  return { ok: true, revision: current, done, message };
}
