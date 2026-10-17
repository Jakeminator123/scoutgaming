import {studioRoots} from './studio-roots.mjs';
import { lstat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

// Same cwd rule as the other lab servers (zone-reference): the
// bundled import.meta.url does not point at the traced preview-build on Vercel.
const labRoot = studioRoots().appRoot;
export const previewBuildDirectory = resolve(labRoot, 'preview-build');

const segmentPattern = /^[A-Za-z0-9._-]+$/;
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript'],
  ['.css', 'text/css'],
  ['.json', 'application/json'],
  ['.mp4', 'video/mp4'],
  ['.webp', 'image/webp'],
  ['.png', 'image/png'],
]);

export function previewRelativePath(segments) {
  if (!Array.isArray(segments) || segments.length === 0 || segments.length > 8) return null;
  for (const segment of segments) {
    if (typeof segment !== 'string' || !segmentPattern.test(segment) || segment === '.' || segment === '..' || segment.includes('..')) return null;
  }
  return segments.join('/');
}

export function previewContentType(name) {
  const text = String(name);
  const dot = text.lastIndexOf('.');
  if (dot < 1) return null;
  return contentTypes.get(text.slice(dot).toLowerCase()) ?? null;
}

export async function openPreviewFile(root, segments) {
  const relativePath = previewRelativePath(segments);
  if (!relativePath) return null;
  const base = resolve(root);
  const file = resolve(base, relativePath);
  const fromBase = relative(base, file);
  if (!fromBase || fromBase === '..' || fromBase.startsWith(`..${sep}`) || isAbsolute(fromBase)) return null;
  const contentType = previewContentType(file);
  if (!contentType) return null;
  let info;
  try { info = await lstat(file); }
  catch { return null; }
  if (!info.isFile() || info.isSymbolicLink()) return null;
  return { file, size: info.size, contentType };
}

/**
 * @param {string | null | undefined} header
 * @param {number} size
 * @returns {null | { status: 'invalid' | 'unsatisfiable' } | { status: 'ok', start: number, end: number }}
 */
export function parseByteRange(header, size) {
  if (header == null || header === '') return null;
  if (typeof header !== 'string' || typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0) return { status: 'invalid' };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return { status: 'invalid' };
  if (match[1] === '') {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return { status: 'invalid' };
    if (size === 0) return { status: 'unsatisfiable' };
    const length = Math.min(suffix, size);
    return { status: 'ok', start: size - length, end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] === '' ? size - 1 : Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end) return { status: 'invalid' };
  if (start >= size) return { status: 'unsatisfiable' };
  return { status: 'ok', start, end: Math.min(end, size - 1) };
}

// The studio page embeds this player. authorizeUiPage's local guard rejects every
// iframe destination, including our own same-origin frame. A cross-site embed keeps
// that rejection. HEAD is authorized as the same GET page request.
export function previewAuthorizationRequest(request) {
  const headers = new Headers(request.headers);
  const site = headers.get('sec-fetch-site');
  const dest = headers.get('sec-fetch-dest');
  if (site === 'same-origin' && (dest === 'iframe' || dest === 'frame')) headers.delete('sec-fetch-dest');
  return new Request(request.url, { method: 'GET', headers });
}
