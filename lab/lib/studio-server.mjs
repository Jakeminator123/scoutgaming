import { resolve, basename } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { readSettings } from '../../open-claw/lab/src/settings.mjs';
import { askDirector, chatWithDirector, boundedJson } from '../../open-claw/lab/src/openclaw.mjs';
import { prepareDecision, finalizeDecision } from '../../open-claw/lab/src/engine.mjs';
import { buildRuntimeCatalog, validateProject } from './studio-model.mjs';
import { createProjectStore, StudioError } from './project-store.mjs';
import { loadVideoRegistry } from './video-registry.mjs';

const LAB_DIR = basename(process.cwd()) === 'lab' ? process.cwd() : resolve(process.cwd(), 'lab');
export function studioStore() { return createProjectStore(process.env.LAB_STUDIO_DATA_DIR || resolve(LAB_DIR, 'data')); }
const settingsNow = () => readSettings({ envFiles: [resolve(LAB_DIR, '../.env'), resolve(LAB_DIR, '.env.local')] });

export function connectionStatus(settings = settingsNow()) {
  const remote = Boolean(settings.remoteUrl && settings.remoteToken);
  const direct = Boolean(settings.baseUrl && settings.gatewayKey);
  return {
    configured: remote || direct,
    provider: remote ? 'render-relay' : direct ? 'openclaw' : 'none',
    message: remote ? 'Render-anslutning inställd. Studio-endpoints måste finnas i driftsatt Director; inget hälsotest är gjort.' : direct ? 'Gateway inställd. Inget modellanrop är verifierat.' : 'Ingen lokal modellanslutning. Regler, editor och videobank fungerar utan OpenClaw.',
    dashboardUrl: 'https://croupier-lab-director.onrender.com/openclaw/',
  };
}

export async function studioInitialData() {
  const [project, videos] = await Promise.all([studioStore().load(), loadVideoRegistry()]);
  return { project, videos, status: connectionStatus() };
}

export async function remoteRequest(path, body, settings, fetchImpl, timeoutMs) {
  let url;
  try { url = new URL(settings.remoteUrl); } catch { throw new StudioError('Ogiltig Render-adress.', 503); }
  if (url.username || url.password || url.search || url.hash || !(url.protocol === 'https:' || url.protocol === 'http:' && ['127.0.0.1','localhost'].includes(url.hostname))) throw new StudioError('Render-anslutningen kräver HTTPS.', 503);
  if (!settings.remoteToken) throw new StudioError('LAB_REMOTE_TOKEN saknas.', 503);
  try {
    const response = await fetchImpl(new URL(path, url), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.remoteToken}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new StudioError(response.status === 404 ? 'Render kör ännu inte studio-protokollet. Standardlinjen behålls.' : `Render svarade ${response.status}.`, 503);
    }
    return await boundedJson(response);
  } catch (error) {
    if (error instanceof StudioError) throw error;
    throw new StudioError('OpenClaw kunde inte nås inom tidsgränsen.', 503);
  }
}

// All AI advice is scoped to the exact draft, not merely its last saved revision.
export function decisionCatalog(project, dealerId) {
  const catalog = buildRuntimeCatalog(validateProject(project), dealerId);
  catalog.revision = `draft-${createHash('sha256').update(JSON.stringify({ project, dealerId })).digest('hex')}`;
  return catalog;
}

export async function validateVideoBindings(project, { registry } = {}) {
  const bound = project.lines.flatMap(line => line.variants).filter(variant => variant.videoGenerationId !== null);
  if (!bound.length) return;
  registry ??= await loadVideoRegistry();
  const known = new Set(registry.videos.map(video => video.id));
  if (bound.some(variant => !known.has(variant.videoGenerationId))) throw new StudioError('En videokoppling saknas i det kända registret. Välj en fil i Videobanken.', 422);
}

export async function simulateStudio(body, { settings = settingsNow(), fetchImpl = fetch, videoRegistry } = {}) {
  if (!['off', 'rules', 'shadow', 'active'].includes(body?.mode)) throw new StudioError('Välj standard, regler, shadow eller active.');
  const project = validateProject(body.project);
  await validateVideoBindings(project, { registry: videoRegistry });
  const event = project.events.find(item => item.id === body.eventId);
  if (!event) throw new StudioError('Eventet finns inte i kontraktet.');
  const catalog = decisionCatalog(project, body.dealerId);
  const input = { requestId: randomUUID(), event: event.exampleEvent, context: body.context, mode: body.mode === 'rules' ? 'active' : body.mode };
  const prepared = prepareDecision(catalog, input);
  if (prepared.node.id !== body.eventId) throw new StudioError('Exemplet matchar inte valt event.');
  let reply = { advice: null, provider: { status: 'off' } };
  if (body.mode === 'rules') {
    reply = { advice: { requestId: prepared.requestId, catalogRevision: prepared.catalogRevision, variantId: prepared.eligible[0].id }, provider: { status: 'deterministic_rules' } };
  } else if (body.mode !== 'off') {
    if (settings.remoteUrl) {
      try { reply = await remoteRequest('/api/studio/advice', { catalog, input: { ...input, event: prepared.event, context: prepared.context } }, settings, fetchImpl, Math.max(500, settings.adviceTimeoutMs + 1500)); }
      catch { reply = { advice: null, provider: { status: 'remote_unavailable_baseline' } }; }
    } else reply = await askDirector(prepared, settings, fetchImpl);
  }
  const result = finalizeDecision(prepared, reply?.advice ?? null, input.mode);
  const line = project.lines.find(item => item.eventId === event.id && item.dealerId === body.dealerId);
  const variant = line.variants.find(item => item.id === result.selected.id);
  if (body.mode === 'rules') {
    result.trace = result.trace.map(step => step.stage === 'advice' ? { stage: 'rules', status: 'selected', detail: 'Regelmotorn väljer högst prioriterade tillåtna variant. Inget modellanrop.' } : step);
    result.gate.reason = 'deterministic_rules';
  }
  return {
    decision: { variantId: variant.id, reason: result.gate.reason, mode: body.mode, sourceEvent: prepared.event, simulated: true },
    trace: result.trace, eligible: result.eligible, variant, asset: result.asset,
    videoGenerationId: variant.videoGenerationId, provider: typeof reply?.provider?.status === 'string' ? reply.provider.status : 'unknown',
  };
}

export async function studioChat(body, { settings = settingsNow(), fetchImpl = fetch, project } = {}) {
  project ??= await studioStore().load();
  const catalog = decisionCatalog(project, body?.dealerId);
  const input = { event: catalog.events[0].exampleEvent, mode: 'active' };
  if (typeof body?.message !== 'string' || !body.message.trim() || body.message.length > 4000 || !/^[a-zA-Z0-9_-]{8,100}$/.test(body?.conversationId || '')) throw new StudioError('Ogiltigt chattmeddelande eller samtals-ID.');
  if (settings.remoteUrl) return remoteRequest('/api/studio/chat', { catalog, input, message: body.message, conversationId: body.conversationId }, settings, fetchImpl, 32000);
  return chatWithDirector(body, settings, fetchImpl, catalog);
}
