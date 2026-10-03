const returns = new Set(['/studio','/studio/administration']);
export function studioLoginReturnTo(value) { return typeof value === 'string' && returns.has(value) ? value : '/studio'; }
export function studioLoginDestination(value,authBase = '/studio/api/auth') {
  const target = studioLoginReturnTo(value);
  return authBase === '/api/auth' ? target.slice('/studio'.length) || '/' : target;
}
export function studioPasswordToken(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(value) ? value : null; }
export class StudioLoginUiError extends Error {
  constructor(status = 503) {
    super(({400:'Kontrollera uppgifterna eller öppna en ny aktiverings-/återställningslänk.',401:'Inloggningen kunde inte verifieras.',
      403:'Studio kräver administratörsbehörighet och rätt inloggningsadress.',429:'För många försök. Vänta 15 minuter och försök igen.',
      503:'Inloggningstjänsten är tillfälligt otillgänglig.'})[status] || 'Åtgärden kunde inte bekräftas. Försök igen senare.');
    this.name = 'StudioLoginUiError'; this.status = status;
  }
}

// Explicit event transport only. Passwords and bearer links remain in the
// caller's temporary event data, never client storage or a response cache.
export function createStudioLoginClient({ authBase = '/studio/api/auth',fetchImpl = fetch } = {}) {
  if (!['/studio/api/auth','/api/auth'].includes(authBase) || typeof fetchImpl !== 'function') throw new StudioLoginUiError(400);
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
