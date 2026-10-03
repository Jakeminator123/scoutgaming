import { labUrl } from './lab-url.mjs';
import { MAX_VIDEO_BYTES } from './video-intake.mjs';

// Only the file goes browser -> private Blob. The Vercel route receives small
// grant/commit JSON. Classification and draft bindings remain separate actions.
export async function uploadNativeVideo(file,classification,contentType,{fetchImpl=fetch,
  putImpl=async (...args) => (await import('@vercel/blob/client')).put(...args), cryptoImpl=globalThis.crypto,signal,onUploadProgress,
} = {}) {
  signal?.throwIfAborted();
  if (!(file instanceof Blob) || file.size < 16 || file.size > MAX_VIDEO_BYTES || !['video/mp4','video/webm'].includes(contentType)) throw new Error('Välj en MP4- eller WebM-video upp till 128 MB.');
  const hash = new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',await file.arrayBuffer()));
  signal?.throwIfAborted();
  const sha256 = [...hash].map(byte => byte.toString(16).padStart(2,'0')).join('');
  async function post(body) {
    signal?.throwIfAborted();
    const response = await fetchImpl(labUrl('/api/videos/upload'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
    let value; try {value=await response.json();} catch {throw new Error('Uppladdningen gav inget giltigt svar.');}
    if (!response.ok) throw new Error(value.error || 'Videon kunde inte sparas.');
    return value;
  }
  const grant = await post({operation:'prepare',sha256,size:file.size,contentType,classification});
  if (typeof grant.id !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(grant.id)
    || grant.pathname !== `croupier/media/dealers/${classification.dealerId}/review/uploads/${grant.id}/${sha256}.${contentType.slice(6)}`
    || typeof grant.clientToken !== 'string' || !grant.clientToken || typeof grant.ticket !== 'string' || !grant.ticket) throw new Error('Uppladdningens behörighet kunde inte verifieras.');
  signal?.throwIfAborted();
  const stored = await putImpl(grant.pathname,file,{access:'private',token:grant.clientToken,contentType,multipart:file.size > 5*1024*1024,abortSignal:signal,onUploadProgress});
  signal?.throwIfAborted();
  if (stored.pathname !== grant.pathname || stored.contentType !== contentType) throw new Error('Videons privata mål kunde inte verifieras.');
  const committed = await post({operation:'commit',ticket:grant.ticket});
  if (committed.id !== grant.id || typeof committed.duplicate !== 'boolean') throw new Error('Videon har laddats upp men registersvaret kunde inte verifieras. Läs om banken.');
  return committed;
}
