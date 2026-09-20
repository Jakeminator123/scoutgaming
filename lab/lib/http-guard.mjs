import { StudioError } from './project-store.mjs';
import { StudioValidationError } from './studio-model.mjs';
import { LabInputError } from '../../open-claw/lab/src/engine.mjs';
import { GatewayError } from '../../open-claw/lab/src/openclaw.mjs';

export function assertLocalRequest(request) {
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.host;
  let parsed;
  try { parsed = new URL(`http://${host}`); } catch { throw new StudioError('Ogiltig lokal adress.', 403); }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) throw new StudioError('Studion är endast tillgänglig lokalt.', 403);
  const origin = request.headers.get('origin');
  if (origin) {
    let from;
    try { from = new URL(origin); } catch { throw new StudioError('Ogiltigt ursprung.', 403); }
    if (from.host !== host || !['http:', 'https:'].includes(from.protocol)) throw new StudioError('Begäran måste komma från labbet.', 403);
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw new StudioError('Begäran måste komma från labbet.', 403);
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
