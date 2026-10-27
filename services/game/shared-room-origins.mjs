/** Origins for the shared room service, command, upgrade and presentation bridge.
 * engineOrigin is the canonical public engine origin requests are addressed to;
 * origin is the exact browser Origin those adapters accept. The separate-hosts
 * layout keeps its explicit frontend origin. In the single-origin Vercel-ingress
 * layout CROUPIER_VERCEL_FRONTEND_ORIGIN is unset (cloud config refuses it when
 * it equals the game origin), so the browser origin IS the canonical public
 * origin. Exactness (scheme, no path or trailing slash) stays with the adapters.
 */
export function sharedRoomOrigins({ qaOrigin, frontendOrigin, env = process.env } = {}) {
  const engineOrigin = qaOrigin ?? env.CROUPIER_PUBLIC_ORIGIN ?? env.PUBLIC_URL;
  return Object.freeze({ engineOrigin, origin: frontendOrigin || engineOrigin });
}
