import { resolve, basename } from 'node:path';
import { readSettings } from '../../open-claw/lab/src/settings.mjs';
import { chatWithDirector } from '../../open-claw/lab/src/openclaw.mjs';
import { validateProject } from './studio-model.mjs';
import { createProjectStore, StudioError } from './project-store.mjs';
import { loadVideoRegistry } from './video-registry.mjs';
import { selectPresentation, remoteRequest } from '../../presentation-runtime/selection.mjs';
import { buildOperatorCatalog } from './operator-catalog.mjs';
import { studioRenderPersistence, assertRenderStudioWritable } from './studio-render-persistence.mjs';

const LAB_DIR = basename(process.cwd()) === 'lab' ? process.cwd() : resolve(process.cwd(), 'lab');
export function studioStore() {
  const legacy = () => createProjectStore(process.env.LAB_STUDIO_DATA_DIR || resolve(LAB_DIR,'data'));
  return {
    async load() {const shared = await studioRenderPersistence();return shared ? shared.projectStore.load() : legacy().load();},
    async save(next,revision) {assertRenderStudioWritable();return legacy().save(next,revision);},
  };
}
export async function studioVideoRegistry() {
  const shared = await studioRenderPersistence();
  return shared ? shared.videoRegistry() : loadVideoRegistry();
}
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
  const [project, videos] = await Promise.all([studioStore().load(), studioVideoRegistry()]);
  return { project, videos, status: connectionStatus() };
}

export { remoteRequest, decisionCatalog, validateVideoBindings } from '../../presentation-runtime/selection.mjs';
export async function simulateStudio(body, options = {}) {
  return selectPresentation(body, { settings: settingsNow(),...options,videoRegistry: options.videoRegistry ?? await studioVideoRegistry() });
}

export async function studioChat(body, { settings = settingsNow(), fetchImpl = fetch, project, videoRegistry } = {}) {
  if (typeof body?.message !== 'string' || !body.message.trim() || body.message.length > 4000 || !/^[a-zA-Z0-9_-]{8,100}$/.test(body?.conversationId || '')) throw new StudioError('Ogiltigt chattmeddelande eller samtals-ID.');
  const draft = Object.hasOwn(body, 'project');
  project = draft ? validateProject(body.project) : project ?? await studioStore().load();
  videoRegistry ??= await studioVideoRegistry();
  const catalog = buildOperatorCatalog(project, videoRegistry, body.dealerId, { scope: draft ? 'draft' : 'saved' });
  const input = { event: catalog.events[0].exampleEvent, mode: 'active' };
  if (settings.remoteUrl) return remoteRequest('/api/studio/chat', { catalog, input, message: body.message, conversationId: body.conversationId }, settings, fetchImpl, 32000);
  return chatWithDirector(body, settings, fetchImpl, catalog);
}
