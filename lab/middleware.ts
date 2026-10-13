import { NextRequest, NextResponse } from 'next/server';
import { platformConfiguration, platformRoute, platformBackendHeaders } from '../apps/croupier-frontend/lib/platform-routing.mjs';
import { studioDocumentNavigationHeaders, studioDocumentNavigationMetadata } from './lib/studio-native-request.mjs';

// Services route Studio documents directly to this app. Retain the same exact
// transport boundary that the separate frontend previously enforced.
export function middleware(request: NextRequest) {
  const metadata = studioDocumentNavigationMetadata(request);
  if (metadata.controlDocument && metadata.crossSite) console.info('studio_document_transport', {
    stage: 'middleware', ...metadata,
  });
  if (process.env.CROUPIER_VERCEL_UNIFIED_UI !== '1') return NextResponse.next();
  const config = platformConfiguration();
  if (!config?.unifiedUi) return new NextResponse(null, { status: 503 });
  const route = platformRoute(new URL(request.url), config, request);
  if (route.kind === 'reject') return new NextResponse(null, { status: 400 });
  if (route.kind === 'frontend' || route.kind === 'socket') return new NextResponse(null, { status: 404 });
  if (route.kind === 'redirect') return NextResponse.redirect(route.destination, 307);

  const headers = route.kind === 'backend' ? platformBackendHeaders(request.headers, config)
    : route.kind === 'lab' ? studioDocumentNavigationHeaders(request) : new Headers(request.headers);
  if (route.kind === 'lab') {
    for (const name of [...headers.keys()]) if (name.startsWith('x-croupier-') || name === 'forwarded') headers.delete(name);
    headers.set('x-forwarded-host', new URL(config.publicOrigin).host);
    headers.set('x-forwarded-proto', 'https');
  }
  const destination = new URL(route.destination);
  const response = route.kind === 'backend' ? NextResponse.rewrite(destination, { request: { headers } })
    : destination.pathname === new URL(request.url).pathname ? NextResponse.next({ request: { headers } })
    : NextResponse.rewrite(new URL(destination.pathname + destination.search, request.url), { request: { headers } });
  response.headers.set('x-vercel-enable-rewrite-caching', '0');
  response.headers.set('CDN-Cache-Control', 'no-store');
  return response;
}

export const config = { runtime: 'nodejs', matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
