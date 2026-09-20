import { StudioError } from './project-store.mjs';
import { StudioValidationError } from './studio-model.mjs';
import { LabInputError } from '../../open-claw/lab/src/engine.mjs';
import { GatewayError } from '../../open-claw/lab/src/openclaw.mjs';

function localHost(request) {
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.host;
  let parsed;
  try { parsed = new URL(`http://${host}`); } catch { throw new StudioError('Ogiltig lokal adress.', 403); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'];
  if (!loopback.includes(parsed.hostname) || !loopback.includes(url.hostname) || !['http:', 'https:'].includes(url.protocol)) throw new StudioError('Studion är endast tillgänglig lokalt.', 403);
  return host;
}

export function assertLocalRequest(request) {
  const host = localHost(request);
  const origin = request.headers.get('origin');
  if (origin) {
    let from;
    try { from = new URL(origin); } catch { throw new StudioError('Ogiltigt ursprung.', 403); }
    if (from.host !== host || !['http:', 'https:'].includes(from.protocol)) throw new StudioError('Begäran måste komma från labbet.', 403);
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw new StudioError('Begäran måste komma från labbet.', 403);
}

// Opening the page from a bookmark, extension or external link is not an API call.
// Only top-level document GET navigation gets the cross-site exception. Fetch/RSC
// requests retain the strict origin checks, and this guard is never used by APIs.
export function assertLocalPageRequest(request) {
  localHost(request);
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
