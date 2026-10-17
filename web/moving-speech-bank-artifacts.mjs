import { randomBytes } from 'node:crypto';
import { validatePrivateMedia, getPrivateMedia, withVerifiedPrivateMediaFile } from './blob-media.mjs';
import { validateMovingSpeechSourceSet } from './moving-speech-bank.mjs';

const fail = () => { throw Error('moving_bank_artifacts_invalid'); };
const PREFIX = '/api/moving-speech/bank/';

/** Derived bank bytes are private Blob artifacts. Original registry media is
 * independently checked on admission; this immutable manifest grants no access. */
export function validateMovingBankArtifacts(value) {
  if (value?.schemaVersion !== 1) fail();
  const sourceSet = validateMovingSpeechSourceSet(value.sourceSet);
  const archive = validatePrivateMedia(value.archive), receipt = validatePrivateMedia(value.receipt);
  const prefix = `croupier/media/dealers/${sourceSet.dealerId}/runtime/moving-bank/`;
  if (!archive.pathname.startsWith(prefix) || !receipt.pathname.startsWith(prefix)
    || archive.contentType !== 'application/octet-stream' || receipt.contentType !== 'application/json'
    || receipt.size > 128 * 1024) fail();
  return Object.freeze({schemaVersion:1, sourceSet, archive:Object.freeze({...archive}), receipt:Object.freeze({...receipt})});
}

/** Keep large derived-bank downloads uncompressed without changing other media clients. */
export function movingBankStorageOptions(blobClient) {
  if (typeof blobClient?.get !== 'function') fail();
  return {blobClient:{...blobClient, get(pathname, options = {}) {
    const headers = new Headers(options.headers);
    headers.set('Accept-Encoding', 'identity');
    return blobClient.get(pathname, {...options, headers:Object.fromEntries(headers)});
  }}};
}

export async function loadMovingBankArtifacts(record, options = {}) {
  validatePrivateMedia(record);
  if (record.contentType !== 'application/json' || record.size > 128 * 1024) fail();
  return withVerifiedPrivateMediaFile(record, async handle =>
    validateMovingBankArtifacts(JSON.parse(await handle.readFile({encoding:'utf8'}))), options);
}

// An upstream read may ignore AbortSignal. Return promptly on revocation and
// cancel any response body that arrives late, so it cannot retain a file handle.
function beforeAbort(work, signal, discard = () => {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const end = (callback, value) => {
      if (settled) return;
      settled = true; signal.removeEventListener('abort', abort); callback(value);
    };
    const abort = () => end(reject, Error('moving_bank_capability_revoked'));
    signal.addEventListener('abort', abort, {once:true});
    Promise.resolve().then(() => {signal.throwIfAborted();return work();}).then(value => {
      if (settled) {Promise.resolve().then(() => discard(value)).catch(() => {});return;}
      end(resolve, value);
    }, error => end(reject, error));
    if (signal.aborted) abort();
  });
}

/** Short-lived, exact-file capabilities go only to our admitted RunPod job.
 * No Blob credential or general download proxy leaves the product server. */
export function createMovingBankDownloads({origin, bank, read = getPrivateMedia, options = {}, now = Date.now} = {}) {
  bank = validateMovingBankArtifacts(bank);
  const base = new URL(origin);
  if (base.protocol !== 'https:' || base.origin !== origin) fail();
  const pending = new Map();
  return Object.freeze({
    issue({signal, authorize, ttlMs = 180000} = {}) {
      if (typeof authorize !== 'function' || !(signal instanceof AbortSignal) || signal.aborted
        || !Number.isSafeInteger(ttlMs) || ttlMs < 1000 || ttlMs > 180000) fail();
      const token = randomBytes(32).toString('hex'), expiresAt = now() + ttlMs;
      const controller = new AbortController();
      const revoke = () => {pending.delete(token);clearTimeout(timer);signal.removeEventListener('abort', revoke);controller.abort();};
      const timer = setTimeout(revoke, ttlMs);timer.unref?.();
      const entry = {expiresAt, signal:controller.signal, authorize, revoke};
      pending.set(token, entry); signal.addEventListener('abort', revoke, {once:true});
      const item = kind => ({url:origin + PREFIX + token + '/' + kind, sha256:bank[kind].sha256, bytes:bank[kind].size});
      return {descriptor:{schemaVersion:1, archive:item('archive'), receipt:item('receipt')}, revoke};
    },
    async response(request) {
      const url = new URL(request.url);
      if (!url.pathname.startsWith(PREFIX)) return null;
      const denied = status => new Response(null,{status,headers:{'Cache-Control':'private, no-store'}});
      const match = /^\/api\/moving-speech\/bank\/([a-f0-9]{64})\/(archive|receipt)$/.exec(url.pathname);
      if (!match || url.search || request.method !== 'GET' || request.headers.has('range')
        || request.headers.has('origin') || request.headers.get('sec-fetch-site') === 'cross-site') return denied(403);
      const entry = pending.get(match[1]);
      if (!entry || entry.signal.aborted || entry.expiresAt <= now()) {entry?.revoke(); return denied(403);}
      try {
        const signal = AbortSignal.any([entry.signal,request.signal]);
        const check = () => {if(entry.expiresAt <= now())entry.revoke();signal.throwIfAborted();};
        check();await beforeAbort(() => entry.authorize(),signal);check();
        const record = bank[match[2]], scoped = new Request(request,{signal});
        const result = await beforeAbort(() => read(record,scoped,options),signal,value => value.body?.cancel());
        try {check();} catch(error) {await result.body?.cancel().catch(() => {});throw error;}
        if (result.status !== 200 || !result.body || result.headers.get('content-length') !== String(record.size)
          || result.headers.has('content-encoding')) {await result.body?.cancel();return denied(503);}
        let bytes = 0;
        const bounded = new TransformStream({
          transform(chunk,controller) {
            check();
            if (!(chunk instanceof Uint8Array) || bytes + chunk.byteLength > record.size) fail();
            bytes += chunk.byteLength;controller.enqueue(chunk);
          },
          flush() {check();if(bytes !== record.size)fail();},
        });
        // pipeTo propagates revocation/expiry and downstream cancellation to the
        // source while bounding queued bytes. Never leave its rejection unhandled.
        void result.body.pipeTo(bounded.writable,{signal}).catch(() => {});
        return new Response(bounded.readable,{status:result.status,headers:result.headers});
      } catch {return denied(403);}
    },
    close() {for (const entry of pending.values()) entry.revoke();},
  });
}
