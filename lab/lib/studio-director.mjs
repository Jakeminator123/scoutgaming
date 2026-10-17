import { askDirector, boundedJson } from '../../packages/director/openclaw.mjs';
import { prepareDecision, finalizeDecision } from '../../packages/director/engine.mjs';
import { StudioError } from '../../packages/shared/studio-error.mjs';

// Shared Director adapter for presentation selection and Studio's other relay calls.
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

export const presentationDirector = Object.freeze({ prepareDecision, finalizeDecision, askDirector, remoteRequest });
