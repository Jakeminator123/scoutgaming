import {playerLobbyPath} from '../../../../packages/navigation/player-lobby.mjs';
export const dynamic = 'force-dynamic';

const headers = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function location(request: Request) {
  return playerLobbyPath(new URL(request.url).searchParams);
}

export function GET(request: Request) {
  return new Response(null, {status: 308, headers: {...headers, Location: location(request)}});
}

export function HEAD(request: Request) {
  return new Response(null, {status: 308, headers: {...headers, Location: location(request)}});
}
