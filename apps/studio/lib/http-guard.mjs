import { timingSafeEqual } from 'node:crypto';
import { stripLabBasePath } from './lab-url.mjs';
import { StudioError } from './project-store.mjs';
import { StudioValidationError } from '../../../packages/presentation/contracts/studio-model.mjs';
import { LabInputError } from '../../../packages/director/engine.mjs';
import { GatewayError } from '../../../packages/director/openclaw.mjs';

function localHost(request) {
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.host;
  let parsed;
  try { parsed = new URL(`http://${host}`); } catch { throw new StudioError('Ogiltig lokal adress.', 403); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'];
  if (!loopback.includes(parsed.hostname) || !loopback.includes(url.hostname) || !['http:', 'https:'].includes(url.protocol)) throw new StudioError('Studion är endast tillgänglig lokalt.', 403);
  return host;
}

function requestBoundary(request) {
  const cloudConfigured = Boolean(process.env.LAB_PUBLIC_URL || process.env.CROUPIER_LAB_INTERNAL_SECRET);
  let local;
  try { local = localHost(request); } catch (error) { if (!cloudConfigured) throw error; }
  if (local) {
    if (cloudConfigured) {
      const url = new URL(request.url);
      if (request.method !== 'GET' || stripLabBasePath(url.pathname) !== '/api/health') throw new StudioError('Lokal åtkomst är avstängd i molnläget.', 403);
    }
    return { mode: 'local', host: local };
  }
  const publicUrl = process.env.LAB_PUBLIC_URL;
  const secret = process.env.CROUPIER_LAB_INTERNAL_SECRET;
  let expected;
  try { expected = new URL(publicUrl); } catch { throw new StudioError('Molnåkomst är inte konfigurerad.', 403); }
  if (expected.protocol !== 'https:' || publicUrl !== expected.origin || !secret || Buffer.byteLength(secret) < 32) {
    throw new StudioError('Molnåkomst är inte konfigurerad.', 403);
  }
  const url = new URL(request.url);
  const host = request.headers.get('host');
  const provided = request.headers.get('x-croupier-lab-authorized');
  const actual = typeof provided === 'string' ? Buffer.from(provided) : Buffer.alloc(0);
  const key = Buffer.from(secret);
  // Next's route Request.url uses its bind address (even with forwarded Host).
  // NextURL normalizes 127.0.0.1 to localhost before route handlers receive it.
  // Only the fixed cloud Lab listener is an internal URL alias. Authorization
  // still requires the exact public headers and gateway's private secret below.
  const routedHost = url.host === expected.host || url.host === '127.0.0.1:4188' || url.host === 'localhost:4188';
  if (host !== expected.host || !routedHost || url.username || url.password || !['http:', 'https:'].includes(url.protocol)
    || request.headers.get('x-forwarded-host') !== expected.host
    || request.headers.get('x-forwarded-proto') !== 'https'
    || actual.length !== key.length || !timingSafeEqual(actual, key)) {
    throw new StudioError('Labbåtkomst kräver giltig autentisering.', 403);
  }
  return { mode: 'cloud', host, origin: expected.origin };
}

export function assertLocalRequest(request) {
  const boundary = requestBoundary(request);
  const origin = request.headers.get('origin');
  if (origin) {
    let from;
    try { from = new URL(origin); } catch { throw new StudioError('Ogiltigt ursprung.', 403); }
    if (boundary.mode === 'cloud') {
      if (origin !== boundary.origin || from.origin !== boundary.origin) throw new StudioError('Begäran måste komma från labbet.', 403);
    } else if (from.host !== boundary.host || !['http:', 'https:'].includes(from.protocol)) {
      throw new StudioError('Begäran måste komma från labbet.', 403);
    }
  }
  if (boundary.mode === 'cloud' && !['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !origin) {
    throw new StudioError('Begäran kräver samma ursprung som labbet.', 403);
  }
  const site = request.headers.get('sec-fetch-site');
  if (site === 'cross-site' || (boundary.mode === 'cloud' && site === 'same-site')) {
    throw new StudioError('Begäran måste komma från labbet.', 403);
  }
}

// Opening the page from a bookmark, extension or external link is not an API call.
// Only top-level document GET navigation gets the cross-site exception. Fetch/RSC
// requests retain the strict origin checks, and this guard is never used by APIs.
export function assertLocalPageRequest(request) {
  requestBoundary(request);
  if (request.method !== 'GET' || request.headers.has('next-action')) throw new StudioError('Labbsidan öppnas med en vanlig GET-navigering.', 403);
  const destination = request.headers.get('sec-fetch-dest');
  if (['iframe', 'frame', 'embed', 'object'].includes(destination)) throw new StudioError('Öppna labbet som en egen sida.', 403);
  if (request.headers.get('sec-fetch-mode') === 'navigate' && destination === 'document') return;
  assertLocalRequest(request);
}

export async function readLocalJson(request) {
  assertLocalRequest(request);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new StudioError('JSON krävs.', 415);
  if (Number(request.headers.get('content-length')) > 1024 * 1024) throw new StudioError('Projektet är för stort.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new StudioError('JSON saknas.');
  let size = 0; const chunks = [];
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 1024 * 1024) { await reader.cancel(); throw new StudioError('Projektet är för stort.', 413); }
      chunks.push(Buffer.from(chunk.value));
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new StudioError('Ogiltig JSON.'); }
}

export function jsonResponse(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export function errorResponse(error) {
  // Generic system errors may contain filesystem paths or upstream details.
  const expected = error instanceof StudioError || error instanceof StudioValidationError || error instanceof LabInputError || error instanceof GatewayError;
  const known = expected && Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode < 600;
  return jsonResponse({ error: known ? error.message : 'Ett lokalt serverfel uppstod.', ...(known && Array.isArray(error.errors) ? { errors: error.errors.slice(0, 12) } : {}) }, known ? error.statusCode : 500);
}
