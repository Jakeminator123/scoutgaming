import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireGeneratedSpeechRuntime } from '../../packages/presentation/server/generated-speech-runtime.mjs';
import { assertLocalRequest } from './http-guard.mjs';
import { StudioError } from './project-store.mjs';

const { getGeneratedSpeechService, generatedSpeechStatus } = acquireGeneratedSpeechRuntime({
  repositoryRoot: resolve(dirname(fileURLToPath(import.meta.url)), '../..'),
});

export { getGeneratedSpeechService, generatedSpeechStatus };
export function speechVisitor(request, { create = false } = {}) {
  const existing = (request.headers.get('cookie') ?? '').match(/(?:^|;\s*)lab_speech_session=([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})(?:;|$)/)?.[1];
  const id = existing ?? (create ? randomUUID() : null);
  return { owner: id ? `lab-${id}` : null, cookie: id && !existing ? `lab_speech_session=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}` : null };
}
export async function generatedSpeechMediaResponse(request, { id, kind }) {
  assertLocalRequest(request);
  const visitor = speechVisitor(request), service = getGeneratedSpeechService();
  if (!visitor.owner || !service) throw new StudioError('Talprovet finns inte i denna labbsession.', 404);
  try {
    const media = await service.media({ id, kind, owner: visitor.owner });
    return new Response(request.method === 'HEAD' ? null : new Uint8Array(media.bytes), { headers: {
      'Content-Type': media.contentType, 'Content-Length': String(media.bytes.length), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch { throw new StudioError('Talprovet saknas eller matchar inte sessionen.', 404); }
}
