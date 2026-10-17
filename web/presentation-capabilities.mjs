import {
  PRESENTATION_CAPABILITY_VERSION_HEADER, negotiatePresentationCapabilityVersion, presentationCapabilitiesForVersion,
} from '../packages/presentation/capability-contract.mjs';

export function presentationCapabilitiesResponse(request) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/presentation/capabilities') return null;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: PRESENTATION_CAPABILITY_VERSION_HEADER };
  if (url.search) return new Response(null, { status: 400, headers });
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
  let version;
  try { version = negotiatePresentationCapabilityVersion(request.headers.get(PRESENTATION_CAPABILITY_VERSION_HEADER)); }
  catch { return new Response(null, { status: 406, headers }); }
  return new Response(request.method === 'HEAD' ? null : JSON.stringify(presentationCapabilitiesForVersion(version)), { status: 200, headers });
}
