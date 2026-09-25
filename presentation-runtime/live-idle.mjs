import { validateIdlePolicy } from './idle-policy.mjs';

const clone = value => structuredClone(value);
const sceneDefaults = Object.freeze({ active: false, visible: true, actionBusy: false, speechReady: false, speechPlaying: false, identity: 'initial', revision: '0' });
const blocked = scene => !scene.active || !scene.visible || scene.actionBusy || scene.speechPlaying;
function sceneValue(value) {
  if (!value || typeof value !== 'object' || typeof value.identity !== 'string' || !value.identity || value.identity.length > 256
    || typeof value.revision !== 'string' || !value.revision || value.revision.length > 128
    || ['active', 'visible', 'actionBusy', 'speechReady', 'speechPlaying'].some(key => typeof value[key] !== 'boolean')
    || Object.keys(value).some(key => !Object.hasOwn(sceneDefaults, key))) throw Error('Invalid live idle scene');
  return { ...value };
}
function randomSource(seed) {
  let value = seed >>> 0;
  return () => { value = value + 0x6D2B79F5 >>> 0; let next = value; next = Math.imul(next ^ next >>> 15, next | 1);
    next ^= next + Math.imul(next ^ next >>> 7, next | 61); return ((next ^ next >>> 14) >>> 0) / 4294967296; };
}

/** A timer-free, renderer-driven idle controller. Selection is not playback:
 * started accounts for real starts; only presented proves standard position.
 * No promise here can delay the independent game or speech action queues. */
export function createLiveIdleController({ policy, inventory, dealerId = 'astrid', seed = 1,
  now = () => performance.now(), initialScene = {} } = {}) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || typeof now !== 'function') throw Error('Invalid live idle clock or seed');
  const random = randomSource(seed);
  let currentPolicy, allowed = new Set(), signature, scene = sceneValue({ ...sceneDefaults, ...initialScene });
  let clip = null, serial = 0, closed = false, lastTime = -Infinity, offered = null, adviceStarts = [];
  const history = new Map(), failed = new Set(), offersSeen = new Set();
  function time() {
    const value = now();
    if (!Number.isFinite(value) || value < 0 || value < lastTime) throw Error('Live idle clock must be monotonic');
    lastTime = value; return value;
  }
  function nextDue(item, at) { return at + item.automatic.averageEveryMs + Math.round((random() * 2 - 1) * item.automatic.jitterMs); }
  function configure(nextPolicy, nextInventory, at, reset = false) {
    const next = clone(validateIdlePolicy(nextPolicy));
    const family = nextInventory?.families?.find(item => item.id === next.familyId && item.dealerId === dealerId && item.playbackType === 'idle-pool');
    const items = new Map((nextInventory?.videos ?? []).map(item => [item.id, item]));
    const nextAllowed = new Set();
    for (const [ids, role] of [[family?.standardIds ?? [], 'standard'], [family?.variantIds ?? [], 'variant']]) {
      for (const id of ids) { const item = items.get(id); if (item?.available === true && item.familyId === family.id && item.role === role) nextAllowed.add(id); }
    }
    // Also require the policy entry's role to agree with the manifest role.
    next.base = next.base.filter(item => nextAllowed.has(item.videoId) && items.get(item.videoId)?.role === 'standard');
    next.variants = next.variants.filter(item => nextAllowed.has(item.videoId) && items.get(item.videoId)?.role === 'variant');
    const key = JSON.stringify(next);
    if (!reset && key === signature) return false;
    currentPolicy = next; allowed = nextAllowed; signature = key; failed.clear(); clip = null; offered = null;
    const retained = new Set(next.variants.map(item => item.videoId));
    for (const id of history.keys()) if (reset || !retained.has(id)) history.delete(id);
    for (const item of next.variants) {
      const old = history.get(item.videoId);
      // Preserve paid-for playback facts across policy changes and short action
      // interruptions. Eligibility/scheduling changes never erase recent starts.
      history.set(item.videoId, { starts: old?.starts ?? [], last: old?.last ?? -Infinity,
        next: item.use === 'automatic' ? nextDue(item, at) : Infinity });
    }
    return true;
  }
  function bases() { return currentPolicy.base.filter(item => allowed.has(item.videoId) && !failed.has(item.videoId)); }
  function primary() { return bases()[0] ?? null; }
  function selectBase(reason = 'weighted-base') {
    const pool = bases(), first = pool[0];
    if (!first) { clip = null; return; }
    let selected = first;
    if (!scene.speechReady) {
      let weight = random() * pool.reduce((sum, item) => sum + item.weight, 0);
      selected = pool.at(-1);
      for (const item of pool) { weight -= item.weight; if (weight < 0) { selected = item; break; } }
    }
    clip = { playId: ++serial, kind: 'base', videoId: selected.videoId, reason,
      repeat: scene.speechReady, standardBase: selected.videoId === first.videoId, started: false, presented: false };
  }
  function missed(at) {
    for (const item of currentPolicy.variants) if (item.use === 'automatic') {
      const record = history.get(item.videoId);
      if (record.next <= at) record.next = nextDue(item, at);
    }
  }
  function selectNext(at, forceBase = false) {
    if (blocked(scene) || closed) { clip = null; return; }
    if (scene.speechReady) { selectBase('speech-ready'); return; }
    if (offered && offered.expiresAt <= at) offered = null;
    if (!forceBase && offered && primary()) {
      const candidate = offered; offered = null;
      const record = history.get(candidate.videoId);
      record.starts = record.starts.filter(start => at - start < 60000);
      adviceStarts = adviceStarts.filter(start => at - start < 60000);
      if (!failed.has(candidate.videoId) && at - record.last >= 30000 && record.starts.length < 1 && adviceStarts.length < 1) {
        clip = { playId: ++serial, kind: 'variant', videoId: candidate.videoId, requestId: candidate.requestId,
          expiresAt: candidate.expiresAt, reason: 'openclaw', repeat: false, standardBase: false, started: false, presented: false };
        return;
      }
    }
    const due = forceBase ? null : currentPolicy.variants.filter(item => {
      if (item.use !== 'automatic' || failed.has(item.videoId)) return false;
      const record = history.get(item.videoId);
      record.starts = record.starts.filter(start => at - start < 60000);
      return record.next <= at && at - record.last >= item.automatic.cooldownMs && record.starts.length < item.automatic.maxPerMinute;
    }).sort((a, b) => history.get(a.videoId).next - history.get(b.videoId).next)[0];
    if (due && primary()) clip = { playId: ++serial, kind: 'variant', videoId: due.videoId,
      reason: 'scheduled', repeat: false, standardBase: false, started: false, presented: false };
    else selectBase(forceBase ? 'base-resumed' : 'weighted-base');
  }
  function snapshot() {
    const publicClip = clip ? { playId: clip.playId, kind: clip.kind, videoId: clip.videoId, reason: clip.reason,
      repeat: clip.repeat, standardBase: clip.standardBase, ...(clip.requestId ? { requestId: clip.requestId } : {}) } : null;
    return { clip: publicClip, idleReady: Boolean(clip?.standardBase && clip.presented && !blocked(scene) && !closed),
      state: closed ? 'closed' : blocked(scene) ? 'blocked' : clip ? 'idle' : 'unavailable' };
  }
  function started(playId) {
    const at = time();
    if (!clip || clip.playId !== playId || clip.started || blocked(scene) || closed) return snapshot();
    if (clip.reason === 'openclaw' && clip.expiresAt <= at) { clip = null; selectBase('base-resumed'); return snapshot(); }
    clip.started = true;
    if (clip.kind === 'variant') {
      const record = history.get(clip.videoId), item = currentPolicy.variants.find(item => item.videoId === clip.videoId);
      record.starts = record.starts.filter(start => at - start < 60000); record.starts.push(at); record.last = at;
      record.next = item.use === 'automatic' ? nextDue(item, at) : Infinity;
      if (clip.reason === 'openclaw') { adviceStarts = adviceStarts.filter(start => at - start < 60000); adviceStarts.push(at); }
    }
    return snapshot();
  }
  configure(policy, inventory, time(), true);
  if (!blocked(scene)) selectBase(scene.speechReady ? 'speech-ready' : 'weighted-base');
  return Object.freeze({ snapshot,
    updateScene(patch) {
      const at = time(); if (closed) return snapshot();
      const previous = scene, next = sceneValue({ ...scene, ...patch }); scene = next;
      if (Object.keys(sceneDefaults).some(key => previous[key] !== next[key])) offered = null;
      if (next.revision !== previous.revision && clip?.reason === 'openclaw') clip = null;
      if (next.identity !== previous.identity) {
        history.clear(); failed.clear(); clip = null; adviceStarts = [];
        for (const item of currentPolicy.variants) history.set(item.videoId, { starts: [], last: -Infinity, next: item.use === 'automatic' ? nextDue(item, at) : Infinity });
      }
      if (blocked(scene)) clip = null;
      else if (blocked(previous) || next.identity !== previous.identity || next.speechReady !== previous.speechReady || !clip) {
        missed(at); selectBase(scene.speechReady ? 'speech-ready' : 'base-resumed');
      }
      return snapshot();
    },
    updatePolicy(nextPolicy, nextInventory) {
      const at = time(); if (closed) return snapshot();
      if (configure(nextPolicy, nextInventory, at) && !blocked(scene)) selectBase(scene.speechReady ? 'speech-ready' : 'base-resumed');
      return snapshot();
    },
    offerVariant(value) {
      const at = time();
      if (closed || !value || typeof value !== 'object' || Object.keys(value).length !== 3
        || !['videoId', 'requestId', 'expiresAt'].every(key => Object.hasOwn(value, key))
        || typeof value.requestId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value.requestId)
        || !Number.isFinite(value.expiresAt) || value.expiresAt <= at || value.expiresAt > at + 30000
        || offersSeen.has(value.requestId) || offersSeen.size >= 512) return false;
      offersSeen.add(value.requestId);
      const item = currentPolicy.variants.find(item => item.videoId === value.videoId && item.use === 'openclaw');
      if (blocked(scene) || scene.speechReady || offered || !item || !primary() || failed.has(item.videoId)) return false;
      const record = history.get(item.videoId);
      record.starts = record.starts.filter(start => at - start < 60000);
      adviceStarts = adviceStarts.filter(start => at - start < 60000);
      if (at - record.last < 30000 || record.starts.length >= 1 || adviceStarts.length >= 1) return false;
      offered = { videoId: value.videoId, requestId: value.requestId, expiresAt: value.expiresAt }; return true;
    },
    started,
    presented(playId) {
      started(playId);
      if (clip?.playId === playId && !blocked(scene) && !closed) clip.presented = true;
      return snapshot();
    },
    completed(playId) {
      const at = time();
      if (!clip || clip.playId !== playId || !clip.started || clip.repeat || blocked(scene) || closed) return snapshot();
      const wasVariant = clip.kind === 'variant'; clip = null; selectNext(at, wasVariant); return snapshot();
    },
    failed(playId) {
      const at = time();
      if (!clip || clip.playId !== playId || blocked(scene) || closed) return snapshot();
      failed.add(clip.videoId); clip = null; missed(at); selectBase(scene.speechReady ? 'speech-ready' : 'base-resumed'); return snapshot();
    },
    close() { closed = true; clip = null; offered = null; return snapshot(); },
  });
}
