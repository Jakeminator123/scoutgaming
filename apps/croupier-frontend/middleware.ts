import { NextRequest, NextResponse } from 'next/server';
import { platformConfiguration, platformRoute, platformBackendHeaders } from '../../packages/navigation/server/platform-routing.mjs';

export function middleware(request: NextRequest) {
  const config = platformConfiguration();
  if (!config) return NextResponse.next();
  const route = platformRoute(new URL(request.url), config, request);
  if (route.kind === 'reject') return new NextResponse(null, {status: 400});
  if (route.kind === 'frontend') return NextResponse.next();
  if (route.kind === 'redirect') return NextResponse.redirect(route.destination, 307);
  if (route.kind === 'socket') {
    // Same project, native Node upgrade. The handler constructs a fresh
    // backend handshake after validating the original cookie/ticket or bearer.
    const response = NextResponse.rewrite(route.destination);
    response.headers.set('x-vercel-enable-rewrite-caching', '0');
    response.headers.set('CDN-Cache-Control', 'no-store');
    return response;
  }
  const headers = route.kind === 'backend' ? platformBackendHeaders(request.headers, config) : new Headers(request.headers);
  if (route.kind === 'lab') {
    // Neither a browser nor the UI zone receives the backend ingress credential.
    for (const name of [...headers.keys()]) if (name.startsWith('x-croupier-')) headers.delete(name);
    headers.set('x-forwarded-host', new URL(config.publicOrigin).host);
    headers.set('x-forwarded-proto', 'https');
  }
  const response = NextResponse.rewrite(route.destination, {request: {headers}});
  // External rewrite caching is enabled by default on new Vercel projects.
  // Authenticated APIs, SSR and SSE must retain their per-request checks.
  response.headers.set('x-vercel-enable-rewrite-caching', '0');
  response.headers.set('CDN-Cache-Control', 'no-store');
  return response;
}

// Services deploy routing in the regional Node runtime.
export const config = {runtime: 'nodejs', matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']};
