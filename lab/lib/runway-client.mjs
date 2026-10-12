// Thin REST client for the Runway Dev API (https://docs.dev.runwayml.com).
// No SDK dependency, no automatic retry of paid POSTs, no credential ever
// attached to provider download URLs. Prices are estimated in dealer-forge-catalog.

export const RUNWAY_API_BASE = 'https://api.dev.runwayml.com';
export const RUNWAY_API_VERSION = '2024-11-06';
const DATA_URI_LIMIT = 4_700_000; // Runway accepts base64 data URIs up to ~5 MB.
const MAX_DOWNLOAD = 1024 * 1024 * 1024;

export class RunwayError extends Error {
  constructor(message, { status = 503, code = 'runway_error', submitUnknown = false } = {}) {
    super(message); this.name = 'RunwayError'; this.statusCode = status; this.code = code; this.submitUnknown = submitUnknown;
  }
}

export function runwayConfigured(env = process.env) {
  return typeof env.RUNWAY_API_KEY === 'string' && env.RUNWAY_API_KEY.trim().length >= 16;
}

const safeText = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 500) : '';

function normalizeTask(task) {
  if (!task || typeof task !== 'object' || typeof task.id !== 'string' || typeof task.status !== 'string') throw new RunwayError('Runway returnerade ett ogiltigt task-svar.');
  const status = task.status.toUpperCase();
  const cost = task.cost?.credits ?? task.estimatedCost?.credits ?? null;
  return Object.freeze({
    id: task.id, status,
    progress: typeof task.progress === 'number' && Number.isFinite(task.progress) ? Math.max(0, Math.min(1, task.progress)) : null,
    output: status === 'SUCCEEDED' && Array.isArray(task.output) ? task.output.filter(url => typeof url === 'string') : [],
    failure: status === 'FAILED' ? safeText(task.failure) || 'Runway avslutade jobbet utan orsak.' : '',
    failureCode: status === 'FAILED' ? safeText(task.failureCode) : '',
    credits: Number.isFinite(cost) ? cost : null,
    createdAt: typeof task.createdAt === 'string' ? task.createdAt : null,
  });
}

export function createRunwayClient({ env = process.env, fetchImpl = fetch, timeoutMs = 90_000, baseUrl = RUNWAY_API_BASE } = {}) {
  if (!runwayConfigured(env)) throw new RunwayError('RUNWAY_API_KEY saknas i miljön.', { status: 503, code: 'runway_key_missing' });
  const key = env.RUNWAY_API_KEY.trim();
  const headers = (extra = {}) => ({ Authorization: `Bearer ${key}`, 'X-Runway-Version': RUNWAY_API_VERSION, Accept: 'application/json', ...extra });

  async function request(method, path, body, { submit = false } = {}) {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method, headers: headers(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs), redirect: 'error',
      });
    } catch (error) {
      // A paid POST that timed out may still have started a task; callers must not resubmit blindly.
      throw new RunwayError(submit ? 'Runway svarade inte i tid; jobbet kan ha startats. Kontrollera Runway-portalen innan du skickar om.' : 'Runway kunde inte nås.',
        { status: 503, code: submit ? 'runway_submit_unknown' : 'runway_unreachable', submitUnknown: submit });
    }
    const text = await response.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!response.ok) {
      const detail = safeText(data?.error ?? data?.message ?? text) || `HTTP ${response.status}`;
      const code = response.status === 401 || response.status === 403 ? 'runway_unauthorized' : response.status === 429 ? 'runway_rate_limited' : response.status === 402 ? 'runway_credits' : 'runway_request_failed';
      throw new RunwayError(`Runway avvisade anropet: ${detail}`, { status: response.status >= 500 ? 503 : 422, code });
    }
    return data;
  }

  async function uploadEphemeral(bytes, filename, contentType) {
    const started = await request('POST', '/v1/uploads', { filename, type: 'ephemeral' });
    if (!started || typeof started.uploadUrl !== 'string' || typeof started.runwayUri !== 'string') throw new RunwayError('Runway returnerade ingen uppladdningsadress.');
    const form = new FormData();
    for (const [name, value] of Object.entries(started.fields ?? {})) form.append(name, String(value));
    form.append('file', new Blob([bytes], { type: contentType }), filename);
    let response;
    try { response = await fetchImpl(started.uploadUrl, { method: 'POST', body: form, signal: AbortSignal.timeout(timeoutMs) }); }
    catch { throw new RunwayError('Referensfilen kunde inte laddas upp till Runway.'); }
    if (!response.ok && response.status !== 204) throw new RunwayError(`Runway tog inte emot referensfilen (HTTP ${response.status}).`);
    return started.runwayUri;
  }

  return Object.freeze({
    /** Encode reference bytes as a data URI when small enough, otherwise as an ephemeral upload. */
    async asset(bytes, contentType, filename = 'reference') {
      if (!(bytes instanceof Uint8Array) || !bytes.byteLength) throw new RunwayError('Tom referensfil.', { status: 422, code: 'runway_bad_reference' });
      if (!['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'audio/mpeg', 'audio/wav'].includes(contentType)) throw new RunwayError('Referenser ska vara PNG/JPEG/WebP, MP4 eller MP3/WAV.', { status: 422, code: 'runway_bad_reference' });
      if (4 * Math.ceil(bytes.byteLength / 3) < DATA_URI_LIMIT) return `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}`;
      return uploadEphemeral(bytes, filename, contentType);
    },
    async imageToVideo(params) { const task = await request('POST', '/v1/image_to_video', params, { submit: true }); if (typeof task?.id !== 'string') throw new RunwayError('Runway returnerade inget task-ID.'); return task.id; },
    async textToImage(params) { const task = await request('POST', '/v1/text_to_image', params, { submit: true }); if (typeof task?.id !== 'string') throw new RunwayError('Runway returnerade inget task-ID.'); return task.id; },
    async createAvatar(params) { const avatar = await request('POST', '/v1/avatars', params, { submit: true }); if (typeof avatar?.id !== 'string') throw new RunwayError('Runway returnerade inget avatar-ID.'); return avatar; },
    async avatar(id) { return request('GET', `/v1/avatars/${encodeURIComponent(id)}`); },
    async avatarVideo(params) { const task = await request('POST', '/v1/avatar_videos', params, { submit: true }); if (typeof task?.id !== 'string') throw new RunwayError('Runway returnerade inget task-ID.'); return task.id; },
    async task(id) {
      if (typeof id !== 'string' || !/^[A-Za-z0-9._:-]{1,120}$/.test(id)) throw new RunwayError('Ogiltigt task-ID.', { status: 422, code: 'runway_bad_task' });
      return normalizeTask(await request('GET', `/v1/tasks/${encodeURIComponent(id)}`));
    },
    async cancelTask(id) { await request('DELETE', `/v1/tasks/${encodeURIComponent(id)}`); },
    async organization() { return request('GET', '/v1/organization'); },
    /** Download provider output over HTTPS without any API authorization header. */
    async download(url, { maxBytes = MAX_DOWNLOAD } = {}) {
      let parsed; try { parsed = new URL(url); } catch { throw new RunwayError('Runway returnerade ingen giltig resultatadress.'); }
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new RunwayError('Resultatadressen är inte säker HTTPS.');
      let response;
      try { response = await fetchImpl(parsed.href, { method: 'GET', signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' }); }
      catch { throw new RunwayError('Resultatet kunde inte hämtas från Runway.'); }
      if (!response.ok || !response.body) throw new RunwayError(`Resultatet kunde inte hämtas (HTTP ${response.status}).`);
      if (response.url && !response.url.startsWith('https:')) throw new RunwayError('Osäker omdirigering vid hämtning.');
      const reader = response.body.getReader(), chunks = []; let size = 0;
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength; if (size > maxBytes) { await reader.cancel().catch(() => {}); throw new RunwayError('Resultatet överskrider storleksgränsen.', { status: 413, code: 'runway_output_too_large' }); }
        chunks.push(value);
      }
      return Buffer.concat(chunks.map(chunk => Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)));
    },
  });
}
