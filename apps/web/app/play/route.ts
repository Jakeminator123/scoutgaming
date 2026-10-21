import {playerLobbyPath} from '../../../../packages/navigation/player-lobby.mjs';
export const dynamic = 'force-dynamic';
function redirect(request: Request) {
  const url = new URL(request.url);
  return new Response(null, {status:308, headers:{Location:playerLobbyPath(url.searchParams),
    'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff'}});
}
export {redirect as GET, redirect as HEAD};
