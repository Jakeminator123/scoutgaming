export const dynamic = 'force-dynamic';

const headers = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function location(request: Request) {
  return '/play' + new URL(request.url).search;
}

export function GET(request: Request) {
  return new Response(null, {status: 308, headers: {...headers, Location: location(request)}});
}

export function HEAD(request: Request) {
  return new Response(null, {status: 308, headers: {...headers, Location: location(request)}});
}
