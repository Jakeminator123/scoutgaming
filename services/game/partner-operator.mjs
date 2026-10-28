// Nyckel → bolag (docs/plans/NYCKEL-BOLAG.md, PR A). A partner key belongs to one company:
// croupier_auth.api_keys.operator_id, the croupier_studio.operators id in the engine's scope.
// The engine checks that binding after a verified signature; the public bridge only forwards
// ?operator=. Reads are tolerant until PR C: before migration 012 no key has a company, the
// column reads as null and today's behaviour holds. A key with a company is held to it here.
import { requestedOperator } from '../../packages/navigation/operator-entry.mjs';

const OPERATOR_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/;
export const PARTNER_OPERATOR_MISMATCH = 'partner_operator_mismatch';
export const PARTNER_KEY_UNBOUND = 'partner_key_unbound';
export const PARTNER_KEY_OPERATOR_INVALID = 'partner_key_operator_invalid';
// Refusals that a signed-in partner sees by name, also on the shared-table socket.
export const PARTNER_ROOM_REFUSALS = Object.freeze(new Set([PARTNER_OPERATOR_MISMATCH, PARTNER_KEY_UNBOUND]));

export function partnerRefusal(code, statusCode = 403) {
  return Object.assign(new Error(code), { code, statusCode });
}

// The key row's company. Callers read it as to_jsonb(k)->>'operator_id' (or SELECT *), which is
// null before 012 and for a key without a company; a malformed stored value is never trusted.
export function keyOperator(row) {
  const value = row?.operator_id ?? null;
  if (value !== null && (typeof value !== 'string' || !OPERATOR_ID.test(value))) throw partnerRefusal(PARTNER_KEY_OPERATOR_INVALID, 503);
  return value;
}

// The company named in verified launch claims: null when the token names none.
export function claimedOperator(claims) {
  const value = claims?.operator ?? null;
  if (value !== null && (typeof value !== 'string' || !OPERATOR_ID.test(value))) throw partnerRefusal(PARTNER_KEY_OPERATOR_INVALID);
  return value;
}

// A bound key's company must exist and be active in the engine's scope at every launch.
export async function activeKeyOperator(operatorId, operatorById) {
  const operator = operatorId !== null && typeof operatorById === 'function' ? await operatorById(operatorId) : null;
  if (!operator || operator.id !== operatorId || operator.status !== 'active') throw partnerRefusal(PARTNER_KEY_OPERATOR_INVALID);
  return operator;
}

/** The engine's launch route, after jwtVerify and before a session is issued. Returns the slug
 * of the key's company (the launch lands there), or null for a token without a company, which
 * keeps today's landing. ?operator= naming another or an invalid company is refused. */
export async function partnerLaunchOperator(claims, params, { operatorById } = {}) {
  const operatorId = claimedOperator(claims);
  if (operatorId === null) return null;
  const operator = await activeKeyOperator(operatorId, operatorById);
  const requested = requestedOperator(params);
  if (requested !== undefined && requested !== operator.slug) throw partnerRefusal(PARTNER_OPERATOR_MISMATCH);
  return operator.slug;
}

/** The shared-table page: a partner binding whose key belongs to another company than the
 * room's gets the refusal page instead of a game whose socket would only be refused. */
export async function partnerRoomRefusal(binding, operatorSlug, { operatorBySlug } = {}) {
  if (!binding || binding.partnerKeyId === null || binding.partnerKeyId === undefined) return null;
  if (binding.operatorId === null || binding.operatorId === undefined) return PARTNER_KEY_UNBOUND;
  const operator = typeof operatorBySlug === 'function' ? await operatorBySlug(operatorSlug) : null;
  return operator?.id === binding.operatorId ? null : PARTNER_OPERATOR_MISMATCH;
}

const TEXT = new Map([
  [PARTNER_OPERATOR_MISMATCH, ['Nyckeln gäller ett annat bolag', 'Spelet öppnades med en partnernyckel som hör till ett annat spelbolag än det här bordet. Öppna spelet från ditt eget spelbolag.']],
  [PARTNER_KEY_UNBOUND, ['Nyckeln saknar bolag', 'Partnernyckeln är inte kopplad till något spelbolag och kan inte öppna det här bordet.']],
  [PARTNER_KEY_OPERATOR_INVALID, ['Bolaget är inte tillgängligt', 'Spelbolaget som partnernyckeln hör till finns inte eller är pausat.']],
]);

export function partnerRefusalHtml(code) {
  const [title, text] = TEXT.get(code) ?? TEXT.get(PARTNER_KEY_OPERATOR_INVALID);
  return '<!doctype html><html lang="sv"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title></head>'
    + '<body><main><h1>' + title + '</h1><p>' + text + '</p></main></body></html>';
}
