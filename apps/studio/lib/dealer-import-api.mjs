import { canonicalStudioJson, StudioStorageError, validateActor, validateStudioScope } from '../../../packages/studio-registry/server/document-contract.mjs';
import { assertNativeStudioRequest, nativeStudioErrorResponse, studioNativeRuntime } from './studio-native-runtime.mjs';
import { normalizeNativeStudioRequest } from './studio-native-request.mjs';
import { readStudioDocumentJson } from './studio-document-api.mjs';
import { dealerImportCatalog, validateDealerImportInput, filenameDealerImportRows, validateDealerImportAdvice, finishDealerImportRows, frozenImportNoteRepairs, DEALER_IMPORT_STORAGE_WARNING } from './dealer-import-catalog.mjs';
import { dealerImportModelConfiguration, dealerImportProviderStatus, dealerImportSelectedModel, askDealerImportModel } from './dealer-import-model.mjs';
import { frozenImportSourcesSummary } from './dealer-import-sources.mjs';

// Files recognised by a frozen Kevin source are placed from that source, not
// from the model. Say so, and say which of them still lack a slot in the map.
export function frozenImportNote(rows) {
  const recognised = rows.filter(row => row.evidence?.source);
  if (!recognised.length) return null;
  const placed = recognised.filter(row => row.slotId).length, missing = recognised.length - placed;
  const sources = [...new Set(recognised.map(row => row.evidence.source))].join(', ');
  return `${recognised.length} av ${rows.length} filer känns igen på namn och storlek i ${sources}. ${placed} fick fack automatiskt enligt källan`
    + (missing ? `; ${missing} saknar fack i klippkartan och väntar på ett nytt fack eller manuellt val` : '')
    + '. Källträffar ersätter filnamns- och AI-förslag för de filerna; innehållet är fortfarande inte verifierat, och dealern får ingen operatörs- eller rumstilldelning av importen.';
}

const fail = (code, status = 403) => { throw new StudioStorageError(code, status); };
const json = value => Response.json(value, { headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
const warnings = ['Assistenten läser filnamn, din kontext och en kort samtalshistorik. Chatten får även sparade dealernamn och klippfack. Inga filer eller bildrutor skickas till modellen.',
  'Sorteringen ger förslag. Klippbanken sparar via den separata uppladdningen när du väljer OK eller skickar ett importuppdrag i Adminroboten.', DEALER_IMPORT_STORAGE_WARNING];

// This limiter is deliberately process-local; it bounds accidental duplicate
// requests without creating shared data or claiming a global provider budget.
export function createDealerImportLimiter({ now = Date.now } = {}) {
  let active = 0; const actors = new Map();
  return { enter(actor) {
    const time = now();
    for (const [key, entry] of actors) if (entry.until <= time) actors.delete(key);
    const entry = actors.get(actor) ?? { count: 0, until: time + 60_000 };
    if (active >= 2 || entry.count >= 6 || !actors.has(actor) && actors.size >= 256) fail('studio_import_busy', 429);
    entry.count++; actors.set(actor, entry); active++;
    let closed = false;
    return () => { if (!closed) { closed = true; active--; } };
  } };
}
const limiter = createDealerImportLimiter();

export function createDealerImportApi({ repository, authorize, config, videoRegistry }, { env = process.env, fetchImpl = fetch, limit = limiter } = {}) {
  const model = dealerImportModelConfiguration(env), provider = dealerImportProviderStatus(model);
  if (typeof authorize !== 'function' || !config || !['/api/admin', '/studio/api/admin'].includes(config.apiBase)) fail('studio_invalid_configuration', 503);
  const scope = validateStudioScope(config.scope), base = config.apiBase === '/api/admin' ? '/api' : '/studio/api';
  async function principal(request) {
    const session = await authorize(request);
    if (!session || !['admin', 'superadmin'].includes(session.role)
      || canonicalStudioJson(validateStudioScope(session.scope)) !== canonicalStudioJson(scope)) fail('studio_request_rejected');
    return { actor: validateActor(session.user), role: session.role };
  }
  async function readCatalog() {
    const saved = await repository.readDocument('project');
    if (!saved?.value) fail('studio_document_missing', 404);
    return dealerImportCatalog(saved.value);
  }
  return { async handle(request) {
    let release;
    try {
      request = normalizeNativeStudioRequest(request, config); assertNativeStudioRequest(request, config);
      const url = new URL(request.url);
      if (url.pathname !== `${base}/dealers/import-proposal`) fail('studio_dealer_unknown', 404);
      if (!['GET', 'POST'].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, POST', 'Cache-Control': 'private, no-store' } });
      const original = await principal(request);
      request.signal.throwIfAborted();
      if (request.method === 'GET') return json({ ...await readCatalog(), provider, warnings, frozenSources: frozenImportSourcesSummary() });
      if (request.headers.get('origin') !== url.origin || !['same-origin', 'none'].includes(request.headers.get('sec-fetch-site'))) fail('studio_request_rejected');
      const catalog = await readCatalog(), body = await readStudioDocumentJson(request);
      if (body?.operation === 'repair-notes') {
        if (Object.keys(body).sort().join(',') !== 'dealerId,operation') fail('studio_invalid_request', 400);
        if (!catalog.dealers.some(row => row.id === body.dealerId)) fail('studio_dealer_unknown', 404);
        if (typeof videoRegistry !== 'function') fail('studio_media_registry_unavailable', 503);
        const inventory = await videoRegistry(), current = await principal(request);
        if (current.actor !== original.actor || current.role !== original.role) fail('studio_request_rejected');
        if (canonicalStudioJson(await readCatalog()) !== canonicalStudioJson(catalog)) fail('studio_conflict', 409);
        request.signal.throwIfAborted();
        return json(frozenImportNoteRepairs(body.dealerId, inventory, catalog));
      }
      const input = validateDealerImportInput(body, catalog);
      request.signal.throwIfAborted();
      release = limit.enter(original.actor);
      const chat = input.intent === 'chat', selectedModel = dealerImportSelectedModel(input.intent);
      let rows = chat ? [] : filenameDealerImportRows(input, catalog), source = chat ? 'unavailable' : 'filename-rules';
      let assistantMessage = chat ? 'AI-chatten är inte tillgänglig just nu. Frågan har inte besvarats och inga placeringar har ändrats.'
        : 'Det här är förslag från filnamnsregler, inte AI. Kontrollera varje fack. Plats 1–7 motsvarar box0–box6; utdelning av dolt kort och vändning är olika klipp.';
      const notes = [...warnings];
      if (chat) notes.push('Chatten har inga data om ekonomi, drift, spelare eller spelrum. Den kan förklara sådana ämnen allmänt.');
      if (model) {
        try {
          const advice = validateDealerImportAdvice(await askDealerImportModel(model, input, catalog, { fetchImpl, signal: request.signal }), input, catalog);
          rows = advice.rows; assistantMessage = advice.assistantMessage; source = 'ai';
        } catch {
          request.signal.throwIfAborted();
          notes.push(chat ? 'AI-chatten gav inget verifierat svar. Ingen filnamnsmappning görs; anropet försöks inte automatiskt igen.'
            : 'AI-anropet gav inget verifierat förslag. Endast filnamnsregler används; anropet försöks inte automatiskt igen.');
        }
      } else notes.push(provider.label);
      const current = await principal(request);
      if (current.actor !== original.actor || current.role !== original.role) fail('studio_request_rejected');
      // Revalidate the current saved dealer and slot set after the provider wait.
      const fresh = await readCatalog();
      if (canonicalStudioJson(fresh) !== canonicalStudioJson(catalog)) fail('studio_conflict', 409);
      request.signal.throwIfAborted();
      const finished = chat ? [] : finishDealerImportRows(rows, input, fresh);
      const frozenNote = frozenImportNote(finished);
      if (frozenNote) notes.push(frozenNote);
      return json({ dealerId: input.dealerId, intent: input.intent, selectedModel, source, assistantMessage,
        rows: finished, warnings: notes, provider });
    } catch (error) {
      if (request.signal.aborted) return Response.json({ error: 'studio_import_cancelled' },
        { status: 499, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
      if (error?.code === 'studio_import_busy') return Response.json({ error: 'studio_import_busy', message: 'Flera förslag har begärts. Vänta en minut och försök igen.' },
        { status: 429, headers: { 'Cache-Control': 'private, no-store', 'Retry-After': '60', 'X-Content-Type-Options': 'nosniff' } });
      return nativeStudioErrorResponse(error);
    }
    finally { release?.(); }
  } };
}

export async function handleNativeDealerImport(request) {
  try { return await createDealerImportApi(await studioNativeRuntime()).handle(request); }
  catch (error) { return nativeStudioErrorResponse(error); }
}
