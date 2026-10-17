import { resolveWorkspaceSurfacePath } from '../../packages/navigation/workspace-surfaces.mjs';
import { partnerLoginReturnTo } from './partner-login-return.mjs';
import { canonicalControlHref } from '../../packages/navigation/control-flow.mjs';
import { designPreviewReturnTo } from './design-preview-paths.mjs';

// Exact current document routes only; query values are narrowly allowlisted below.
// Keep login and bearer-entry pages out of this list to avoid auth redirect loops.
const returns = new Set(['/studio','/studio/administration','/studio/openclaw','/studio/operator-chat',
  '/studio/tree','/studio/activity','/studio/guide','/studio/zones','/studio/videos','/studio/events','/studio/probe']);
const handoff = /^\/api\/bo\/(?:game|lab)-login\?state=[a-f0-9]{64}$/;
function partnerSelectionReturn(value) {
  if (typeof value !== 'string' || !value.includes('?')) return null;
  const target = partnerLoginReturnTo(value);
  return target === '/partner' ? null : target;
}
function publicationReturn(value) {
  if (typeof value !== 'string' || value.length > 900 || /[#\\\x00-\x20]/.test(value)) return null;
  const parts = value.split('?');
  if (parts.length !== 2 || resolveWorkspaceSurfacePath(parts[0])?.surface !== 'control') return null;
  const query = new URLSearchParams(parts[1]);
  if (!query.size || query.size > 8) return null;
  for (const [key, entry] of query) {
    if (query.getAll(key).length !== 1) return null;
    if (key === 'tab' && ['publish','companies','tables','operations','finance','accounts','partners','media-review','chat'].includes(entry)) continue;
    if (key === 'view' && ['idle','clips','generate','speech','settings'].includes(entry)) continue;
    if (key === 'category' && ['all','deal','speech','reaction','action','idle'].includes(entry)) continue;
    if (['lane','composition','operator','dealer','table','event','variant','situation'].includes(key) && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(entry)) continue;
    return null;
  }
  return canonicalControlHref(parts[0] + '?' + query);
}
export function studioLoginReturnTo(value) {
  if (typeof value !== 'string' || value === '/partner/set-password' || value === '/studio/partner/set-password') return '/admin';
  const preview = designPreviewReturnTo(value);
  if (preview) return preview;
  if (returns.has(value) || handoff.test(value)) return value;
  const room = partnerSelectionReturn(value);
  if (room) return room;
  const publication = publicationReturn(value);
  if (publication) return publication;
  return resolveWorkspaceSurfacePath(value)?.publicPath || '/admin';
}
export function studioLoginDestination(value,authBase = '/studio/api/auth') {
  const target = studioLoginReturnTo(value);
  if (authBase !== '/api/auth') return target;
  if (designPreviewReturnTo(target)) return target;
  if (returns.has(target)) return target.slice('/studio'.length) || '/';
  if (resolveWorkspaceSurfacePath(target) || publicationReturn(target) || partnerSelectionReturn(target)) return target;
  // Host-only authentication must not be forwarded to a different origin.
  return '/';
}
export function studioPasswordToken(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(value) ? value : null; }
export class StudioLoginUiError extends Error {
  constructor(status = 503) {
    super(({400:'Kontrollera uppgifterna eller öppna en ny aktiverings-/återställningslänk.',401:'Inloggningen kunde inte verifieras.',
      403:'Studio kräver administratörsbehörighet och rätt inloggningsadress.',422:'Lösenordet måste vara 8–128 tecken.',429:'För många försök. Vänta 15 minuter och försök igen.',
      503:'Inloggningstjänsten är tillfälligt otillgänglig.'})[status] || 'Åtgärden kunde inte bekräftas. Försök igen senare.');
    this.name = 'StudioLoginUiError'; this.status = status;
  }
}

// Explicit event transport only. Passwords and bearer links remain in the
// caller's temporary event data, never client storage or a response cache.
export function createStudioLoginClient({ authBase = '/studio/api/auth',fetchImpl = fetch } = {}) {
  if (!['/studio/api/auth','/api/auth','/studio/api/partner','/api/partner'].includes(authBase) || typeof fetchImpl !== 'function') throw new StudioLoginUiError(400);
  async function request(action,body) {
    if (!['login','logout','reset-request','set-password'].includes(action)
      || !body || typeof body !== 'object' || Array.isArray(body)) throw new StudioLoginUiError(400);
    let response;
    try {
      response = await fetchImpl(`${authBase}/${action}`,{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',
        headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(body)});
    } catch { throw new StudioLoginUiError(503); }
    if (!response.ok) throw new StudioLoginUiError(response.status);
    let value; try { value = await response.json(); } catch { throw new StudioLoginUiError(503); }
    if (!value || typeof value !== 'object' || value.ok !== true || value.error) throw new StudioLoginUiError(503);
    return {ok:true}; // No arbitrary server response reaches UI state.
  }
  return Object.freeze({ request });
}
