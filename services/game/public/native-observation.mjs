// Explicit opt-in, read-only Lab observation. No network, storage, player
// identity, cookies or launch credentials leave the game through this channel.
export function createNativeObservation({ href = '', opener = null, now = () => new Date().toISOString() } = {}) {
  let target = null, channel = null, sequence = 0, context = {}, lastClip = null;
  try {
    const url = new URL(href), raw = url.searchParams.get('labObserverOrigin');
    const origin = new URL(raw);
    const id = url.searchParams.get('labObserverChannel');
    const loopback = ['http:', 'https:'].includes(origin.protocol)
      && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
    const sameCloudOrigin = url.protocol === 'https:' && origin.origin === url.origin;
    if (opener && raw === origin.origin && (loopback || sameCloudOrigin)
      && /^[a-zA-Z0-9_-]{16,128}$/.test(id?.replaceAll('-', '') ?? '')) {
      target = origin.origin; channel = id;
    }
  } catch { /* An ordinary game launch has no observer. */ }
  const scrub = (value, depth = 0) => {
    if (depth > 20) throw new Error('Observation nesting limit');
    if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') return value.replace(/\b(?:ck_live_|cs_|gen_)[A-Za-z0-9_-]{20,}\b/g, '[redacted]')
      .replace(/https?:\/\/[^\s<>"']+/g, address => { try { const u = new URL(address); return u.origin + u.pathname; } catch { return '[url]'; } });
    if (Array.isArray(value)) return value.map(item => scrub(item, depth + 1));
    if (typeof value !== 'object') return null;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !/authorization|cookie|password|secret|token|api.?key|playerId|partnerKeyId|holeCard|burn|history/i.test(key))
      .map(([key, item]) => [key, value.faceDown === true && key === 'card' ? null : scrub(item, depth + 1)]));
  };
  function emit(kind, payload = {}, correlation = context) {
    if (!target || !['command', 'playback', 'chat', 'status'].includes(kind)) return false;
    try {
      const message = { type: 'croupier-native-observation', version: 1, channel, sequence: sequence + 1, at: now(), kind,
        payload: scrub({ ...correlation, ...payload }) };
      if (new TextEncoder().encode(JSON.stringify(message)).byteLength > 256 * 1024) return false;
      opener.postMessage(message, target); sequence++;
      return true;
    } catch { return false; }
  }
  return {
    enabled: Boolean(target), emit,
    context: () => ({ ...context }),
    clip(clip, playbackRequestId, dealer) {
      // Continuous repeats of the same idle are not new decisions. Keep the
      // transition into idle, and every explicitly requested action/speech.
      const repeatedIdle = clip === lastClip && clip.includes('/idle/');
      lastClip = clip;
      return !repeatedIdle && emit('playback', { event: 'clip', state: 'start', clip, playbackRequestId, dealer, evidence: 'presented-frame' });
    },
    command(request, view, previousView, dealer) {
      context = { requestId: request.requestId, version: view.version, op: request.op, dealer };
      return emit('command', { action: request.action ?? null, previousView, view, presentation: view.presentation ?? [], source: 'native' });
    },
  };
}
