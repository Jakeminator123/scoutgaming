import {legacyGameStartRedirect} from '../../../../../packages/navigation/game-entry.mjs';
export const dynamic = 'force-dynamic';
// Retired document address: one release of permanent redirects to /game with approved selectors.
function redirect(request: Request) {
  const headers = {'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff'};
  const location = legacyGameStartRedirect(new URL(request.url));
  if (!location) return new Response(null, {status: 404, headers});
  return new Response(null, {status: 308, headers: {...headers, Location: location}});
}
export {redirect as GET, redirect as HEAD};
