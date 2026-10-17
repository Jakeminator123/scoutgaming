import {StudioError} from '../../shared/studio-error.mjs';
import {isDealerId} from '../../presentation/contracts/dealer-identity.mjs';
export const MAX_BYTES = 1024 * 1024 * 1024;
export const MEDIA_MIME = { mp4:'video/mp4', webm:'video/webm', mov:'video/quicktime', mkv:'video/x-matroska', mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg', flac:'audio/flac', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', gif:'image/gif', svg:'image/svg+xml', ico:'image/x-icon', json:'application/json', glb:'model/gltf-binary', gltf:'model/gltf+json', h264:'application/octet-stream', bin:'application/octet-stream', webpseq:'application/octet-stream', blend:'application/octet-stream', fbx:'application/octet-stream', obj:'application/octet-stream', stl:'application/octet-stream', usdz:'model/vnd.usdz+zip', zip:'application/zip', '7z':'application/x-7z-compressed' };
const MIME = MEDIA_MIME;
const PATH = /^croupier\/(videos|zones)\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/([a-f0-9]{64})\.(mp4|webm)$/;
const UUID='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const NEW_PATH=new RegExp('^croupier/media/((?:dealers/[a-z][a-z0-9-]{0,39}|game|site)/(?:source|runtime|review|staging)/(?:[^/]+/)*|backgrounds/|tables/)('+UUID+')/([a-f0-9]{64})\\.([a-z0-9]+)$');
const validDealerPath=path=>!path.startsWith('croupier/media/dealers/')||isDealerId(path.split('/')[3]);
const safeSegments=path=>path.split('/').every(part=>part&&part!=='.'&&part!=='..'&&!/[\\%?#:\u0000-\u0020\u007f]/.test(part));
export function mediaBlobPath(directory,id,sha256,extension){const path=`croupier/media/${directory}/${id}/${sha256}.${extension}`;if(!NEW_PATH.test(path)||!safeSegments(path)||!validDealerPath(path)||!MIME[extension])fail('Ogiltig logisk mediasökväg.',422);return path;}
const fail = (message, status = 503) => { throw new StudioError(message, status); };
export function privateContentTypeMatches(actual,expected){
  if(typeof actual!=='string')return false;
  const [essence,...parameters]=actual.split(';').map(part=>part.trim().toLowerCase());
  return essence===expected.toLowerCase()&&(!parameters.length||(['application/json','model/gltf+json','image/svg+xml'].includes(essence)&&parameters.length===1&&/^charset\s*=\s*(?:utf-8|"utf-8")$/.test(parameters[0])));
}
export function isCloudMediaConfigured(env = process.env) {
  return env.CROUPIER_MEDIA_STORAGE === 'blob' && Boolean(env.BLOB_READ_WRITE_TOKEN?.trim());
}
/** Persist this server-owned reference, never a client-supplied URL or token. */
export function validatePrivateMedia(record) {
  const old=typeof record?.pathname==='string'&&PATH.exec(record.pathname),current=typeof record?.pathname==='string'&&NEW_PATH.exec(record.pathname);
  const match=old?{hash:old[2],extension:old[3]}:current&&safeSegments(record.pathname)&&validDealerPath(record.pathname)?{hash:current[3],extension:current[4]}:null;
  if (!match || Object.keys(record).some(key => !['provider', 'pathname', 'sha256', 'size', 'contentType'].includes(key))
    || record.provider !== 'vercel-blob' || record.sha256 !== match.hash
    || !MIME[match.extension] || record.contentType !== MIME[match.extension] || !Number.isSafeInteger(record.size)
    || record.size < (old?16:1) || record.size > (old?128*1024*1024:MAX_BYTES)) fail('Ogiltig privat mediareferens.', 422);
  return record;
}
