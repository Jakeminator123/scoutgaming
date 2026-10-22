export const PLATFORM_SOCKET_ENDPOINTS = Object.freeze({
  '/speech-stream': '/api/platform-speech-stream',
  '/lipsync-worker': '/api/platform-lipsync-worker',
  '/moving-speech-stream': '/api/platform-moving-speech-stream',
});

export function canonicalPlatformPath(value) {
  if (typeof value !== 'string') return null;
  const path = value.split('?')[0];
  if (!path.startsWith('/') || /[%\\\x00-\x20]/.test(path) || path.includes('//')) return null;
  if (path.split('/').some(part => part === '.' || part === '..')) return null;
  return path;
}

// Room identity is one literal, bounded path segment; no queries or aliases.
export const SHARED_ROOM_SOCKET = '/shared-room/';
export function sharedRoomSocketPath(path) {
  return typeof path === 'string' && /^\/shared-room\/[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(path);
}

// Dynamic callbacks stay on the speech service; their one-use capability is
// private to the worker and is rechecked by the product server before101.
export const MOVING_WORKER_SOCKET = '/lipsync-moving/';
export function movingWorkerSocketPath(path) {
  return canonicalPlatformPath(path) === path && /^\/lipsync-moving\/[a-f0-9]{48}$/.test(path);
}
