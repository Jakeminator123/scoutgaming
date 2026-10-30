import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { isAbsolute, resolve } from 'node:path';
import { createGeneratedSpeechService, requireGeneratedSpeechArtifacts } from './generated-speech-service.mjs';
import { GENERATED_SPEECH_DEFAULTS } from './generated-speech-provider.mjs';
import { requireSpeechJournal } from './speech-journal-lease.mjs';

// One module graph owns the facade, journal, service and exact provider identities.
// App compositions supply the original repository root; acquisition never resets state.
let repositoryRoot = null;
export function acquireGeneratedSpeechRuntime({ repositoryRoot: root } = {}) {
  if (typeof root !== 'string' || !isAbsolute(root)) throw new TypeError('Explicit repositoryRoot required');
  const resolved = resolve(root);
  const same = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
  if (repositoryRoot !== null && !same(repositoryRoot, resolved)) throw new TypeError('Generated speech repositoryRoot mismatch');
  repositoryRoot ??= resolved;
  return runtimeFacade;
}

const digest = value => createHash('sha256').update(value).digest('hex');
const budgetAmount = (value, maximum = 10000000) => {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d?)(?:\.\d{1,6})?$/.test(value)) return undefined;
  const amount = Math.round(Number(value) * 1000000);
  return Number.isSafeInteger(amount) && amount > 0 && amount <= maximum ? amount : undefined;
};
function configuration(env) {
  const localPreview = env.CROUPIER_GENERATED_SPEECH_PREVIEW === '1'
    && ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(env.HOST);
  let cloudPreview = false;
  const cloudHost = ['0.0.0.0', '::', '[::]'].includes(env.HOST)
    || (env.CROUPIER_CLOUD_RUNTIME === '1' && env.HOST === '127.0.0.1');
  if (env.CROUPIER_CLOUD_GENERATED_SPEECH === '1' && env.NODE_ENV === 'production'
    && env.DEMO_GUEST_ACCESS !== '1' && cloudHost) {
    try {
      const url = new URL(env.PUBLIC_URL);
      cloudPreview = url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
        && url.pathname === '/' && !url.port && !isIP(url.hostname) && url.hostname.includes('.')
        && !url.hostname.endsWith('.local') && url.hostname !== 'localhost';
    } catch { /* Invalid cloud origins cannot enable paid generation. */ }
  }
  // Managed cloud conversations must use the session cost ledger. A legacy
  // client or Probe may not bypass it by asking for an unbudgeted file job.
  const managedStreaming = cloudPreview && env.CROUPIER_GENERATED_SPEECH_STREAMING === '1';
  const enabled = env.CROUPIER_GENERATED_SPEECH === '1' && (localPreview || cloudPreview)
    && !managedStreaming;
  // Every paid file job is journaled in Neon; the retired private disk directory is never read.
  const value = { cartesiaApiKey: env.CARTESIA_API_KEY,
    runpodApiKey: env.RUNPOD_API_KEY, runpodEndpointId: env.CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID,
    voiceId: GENERATED_SPEECH_DEFAULTS.voiceId, modelId: GENERATED_SPEECH_DEFAULTS.modelId,
    reserveMicroUsd: budgetAmount(env.CROUPIER_SPEECH_FULLFILE_RESERVE_USD),
    dailyBudgetMicroUsd: budgetAmount(env.CROUPIER_SPEECH_RUNPOD_DAILY_BUDGET_USD, 20000000) };
  const token = input => typeof input === 'string' && input.length > 0 && input.length <= 2048 && !/\s/.test(input);
  const configured = enabled
    && token(value.cartesiaApiKey) && token(value.runpodApiKey) && /^[A-Za-z0-9_-]{1,100}$/.test(value.runpodEndpointId ?? '');
  return { enabled, configured, value };
}

function generatedSpeechStatus(env = process.env) {
  const { enabled, configured } = configuration(env);
  return { enabled, configured, preview: true, dealerId: 'astrid', reviewStatus: 'pending' };
}

let singleton = null;
let singletonKey = null;
let speechJournal = null;
let speechArtifacts = null;
let speechProviderFetch = null;
function configureGeneratedSpeechJournal(journal, { artifacts = null, providerFetch = null } = {}) {
  if (journal !== null) requireSpeechJournal(journal);
  if (journal !== null) requireGeneratedSpeechArtifacts(artifacts);
  if (speechJournal !== journal || speechArtifacts !== artifacts || speechProviderFetch !== providerFetch) {
    singleton = null; singletonKey = null; speechJournal = journal; speechArtifacts = artifacts; speechProviderFetch = providerFetch;
  }
}
function getGeneratedSpeechService() {
  const { configured, value } = configuration(process.env);
  if (!configured) return null;
  requireSpeechJournal(speechJournal);
  const key = digest(JSON.stringify(value));
  if (key !== singletonKey) { singleton = createGeneratedSpeechService(value, { repositoryRoot, journal:speechJournal, artifacts:speechArtifacts, fetchImpl:speechProviderFetch ?? fetch }); singletonKey = key; }
  return singleton;
}

const runtimeFacade = Object.freeze({ getGeneratedSpeechService, generatedSpeechStatus,
  configureGeneratedSpeechJournal });
