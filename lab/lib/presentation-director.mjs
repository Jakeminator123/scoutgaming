import { createHash, randomUUID } from 'node:crypto';
import { simulateStudio } from './studio-server.mjs';
import { StudioError } from './project-store.mjs';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const canonical = value => JSON.stringify(value, (_key, item) => record(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value);

function sourceReference(body) {
  const observed = Object.hasOwn(body, 'sourceEvent');
  const source = body.sourceRef ?? { kind: observed ? 'observed' : 'example' };
  if (!record(source) || Object.keys(source).some(key => !['kind', 'channel', 'requestId', 'version', 'presentationIndex'].includes(key))
    || !['example', 'observed', 'import'].includes(source.kind)
    || (source.kind === 'example') === observed) throw new StudioError('Källreferensen måste stämma med eventets ursprung.');
  const result = { kind: source.kind };
  for (const key of ['channel', 'requestId']) {
    if (source[key] == null) continue;
    if (typeof source[key] !== 'string' || !source[key].length || source[key].length > 200 || /[\u0000-\u001f\u007f]/.test(source[key])) throw new StudioError(`Ogiltigt ${key} i källreferensen.`);
    result[key] = source[key];
  }
  for (const key of ['version', 'presentationIndex']) {
    if (source[key] == null) continue;
    if (!Number.isSafeInteger(source[key]) || source[key] < 0) throw new StudioError(`Ogiltigt ${key} i källreferensen.`);
    result[key] = source[key];
  }
  return result;
}

// One decision boundary for examples and received instructions. This never
// executes game commands, plays media or gives the model access to the wallet.
// Cache scope is this server process, not a distributed production guarantee.
export function createPresentationDirector({ decide = simulateStudio, now = Date.now, ttlMs = 300000, capacity = 128, concurrency = 4 } = {}) {
  const jobs = new Map();
  let active = 0;
  return async function decision(body) {
    if (!record(body)) throw new StudioError('Beslutet behöver ett JSON-objekt.');
    const requestId = body.requestId ?? randomUUID();
    if (!identifier(requestId)) throw new StudioError('Ogiltigt besluts-ID.');
    const sourceRef = sourceReference(body);
    // Snapshot the draft before waiting; a caller cannot mutate a queued job.
    const input = structuredClone({ ...body, requestId, sourceRef });
    const fingerprint = createHash('sha256').update(canonical(input)).digest('hex');
    for (const [id, job] of jobs) if (job.expires <= now()) jobs.delete(id);
    let job = jobs.get(requestId);
    const reused = Boolean(job);
    if (job && job.fingerprint !== fingerprint) throw new StudioError('Besluts-ID:t har redan använts med andra data. Starta ett nytt prov.', 409);
    if (!job) {
      if (active >= concurrency) throw new StudioError('Fyra variantbeslut pågår. Försök igen strax.', 429);
      if (jobs.size >= capacity) throw new StudioError('Beslutscachen är full. Försök igen efter fem minuter.', 429);
      job = { fingerprint, expires: Infinity, promise: null };
      jobs.set(requestId, job); active++;
      job.promise = Promise.resolve().then(() => decide(input)).then(result => {
        job.expires = now() + ttlMs;
        return structuredClone(result);
      }).catch(error => { jobs.delete(requestId); throw error; }).finally(() => { active--; });
    }
    const result = structuredClone(await job.promise);
    const reason = result.decision?.reason;
    const owner = input.mode === 'rules' ? 'rules' : input.mode === 'random' ? 'random' : reason === 'accepted' ? 'openclaw' : 'baseline';
    const director = { contractVersion: 1, scope: 'lab-presentation', owner, reused, sourceRef,
      playbackConfirmed: false, candidateCount: result.eligible?.length ?? 0 };
    return { ...result, decision: { ...result.decision, requestId, director },
      trace: [{ stage: 'director', status: reused ? 'reused' : 'decided', detail: `${reused ? 'Samma beslut återanvänds utan nytt modellval.' : 'Gemensamt presentationsbeslut.'} Ägare: ${owner}. Inga spelkommandon eller uppspelning utförs här.` }, ...(result.trace ?? [])] };
  };
}

// Next can bundle the compatibility route separately. Keep one cache even
// when this module is loaded twice in the same Node process.
const directorKey = Symbol.for('croupier.lab.presentation-director.v1');
export const decidePresentation = globalThis[directorKey] ??= createPresentationDirector();
