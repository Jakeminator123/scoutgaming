// Explicit, registered media only. Pose names describe joins, never filenames.
const fields = ['videoId', 'phase', 'from', 'to', 'weight', 'head', 'calm'];
const poses = new Set(['rest', 'clasped']);
export function validateIdleRotation(rotation, policy) {
  const fail = () => { throw new Error('Ogiltig vilosekvens: kontrollera klipp, poser och återgång till vila.'); };
  if (!rotation || Object.keys(rotation).join(',') !== 'clips' || !Array.isArray(rotation.clips)
    || policy.base.length !== 1 || policy.variants.some(row => row.use !== 'rotation')
    || rotation.clips.length !== policy.base.length + policy.variants.length) fail();
  const members = new Set([...policy.base, ...policy.variants].map(row => row.videoId)), seen = new Set();
  for (const row of rotation.clips) {
    if (!row || fields.some(key => !Object.hasOwn(row, key)) || Object.keys(row).some(key => !fields.includes(key))
      || !members.has(row.videoId) || seen.has(row.videoId) || !['any', 'bets', 'decide'].includes(row.phase)
      || !poses.has(row.from) || !poses.has(row.to) || !Number.isFinite(row.weight) || row.weight <= 0 || row.weight > 100
      || typeof row.head !== 'boolean' || typeof row.calm !== 'boolean') fail();
    if ((row.from === 'clasped' || row.to === 'clasped') && (row.phase !== 'bets' || !row.calm || row.head)) fail();
    if (row.head && (row.phase !== 'any' || row.calm)) fail();
    seen.add(row.videoId);
  }
  const primary = rotation.clips.find(row => row.videoId === policy.base[0].videoId);
  if (primary?.from !== 'rest' || primary.to !== 'rest' || primary.phase !== 'any' || !primary.calm || primary.head) fail();
  for (const pose of poses) if (pose !== 'rest' && rotation.clips.some(row => row.from === pose || row.to === pose)) {
    if (!rotation.clips.some(row => row.from === 'rest' && row.to === pose)
      || !rotation.clips.some(row => row.from === pose && row.to === 'rest')) fail();
  }
  return rotation;
}

// Kevin's phase weighting and four-clip head spacing, with an explicit exit when
// the phase changes or speech needs the standard pose. Missing exits forbid entry.
export function chooseRotationClip(clips, { pose = 'rest', phase = 'bets', speechReady = false,
  last = null, sinceHead = Infinity, primaryId, random = Math.random } = {}) {
  if (speechReady && pose === 'rest') return clips.find(row => row.videoId === primaryId) ?? null;
  const exits = clips.filter(row => row.from === pose && row.to === 'rest');
  if (pose !== 'rest' && (speechReady || phase !== 'bets')) return weighted(exits, last, random);
  let pool = clips.filter(row => row.from === pose && (row.phase === 'any' || row.phase === phase)
    && (phase !== 'decide' || row.calm) && (row.to === 'rest' || clips.some(exit => exit.from === row.to && exit.to === 'rest')));
  const quiet = pool.filter(row => !row.head || sinceHead >= 4);
  if (quiet.length) pool = quiet;
  if (pose === 'rest') {
    const share = phase === 'decide' ? 0.7 : 0.32;
    const plain = pool.filter(row => row.phase === 'any').reduce((sum, row) => sum + row.weight, 0);
    const special = pool.filter(row => row.phase === phase).reduce((sum, row) => sum + row.weight, 0);
    if (plain && special) pool = pool.map(row => row.phase === phase ? { ...row, weight: row.weight * plain * share / ((1 - share) * special) } : row);
  }
  return weighted(pool, last, random);
}
function weighted(pool, last, random) {
  const fresh = pool.filter(row => row.videoId !== last), choices = fresh.length ? fresh : pool;
  let value = random() * choices.reduce((sum, row) => sum + row.weight, 0);
  return choices.find(row => (value -= row.weight) < 0) ?? choices.at(-1) ?? null;
}

export function createRotationIdle({ policy, inventory, dealerId, random, scene, sceneValue, blocked, now, validate }) {
  let currentPolicy, allowed = [], clip = null, suspended = null, serial = 0, closed = false;
  let pose = 'rest', last = null, sinceHead = Infinity, lastTime = -Infinity, faulted = false;
  const failed = new Set();
  const time = () => { const at = now(); if (!Number.isFinite(at) || at < 0 || at < lastTime) throw Error('Live idle clock must be monotonic'); lastTime = at; return at; };
  function configure(nextPolicy, nextInventory) {
    currentPolicy = structuredClone(validate(nextPolicy));
    const family = nextInventory?.families?.find(row => row.id === currentPolicy.familyId && row.dealerId === dealerId && row.playbackType === 'idle-pool');
    allowed = !family ? [] : currentPolicy.rotation.clips.filter(row => (nextInventory?.videos ?? []).some(video => video.id === row.videoId
      && video.available === true && video.familyId === family?.id
      && (row.videoId === currentPolicy.base[0].videoId ? video.role === 'standard' && family.standardIds.includes(video.id)
        : video.role === 'variant' && family.variantIds.includes(video.id))));
    clip = suspended = null; pose = 'rest'; last = null; sinceHead = Infinity; failed.clear(); faulted = false;
  }
  function choose(primary = false) {
    if (closed || blocked(scene) || faulted) { clip = null; return; }
    const primaryId = currentPolicy.base[0].videoId;
    const pool = allowed.filter(row => !failed.has(row.videoId));
    const next = chooseRotationClip(pool, { pose, phase: scene.phase, speechReady: primary || scene.speechReady,
      last, sinceHead, primaryId, random });
    clip = next ? { ...next, playId: ++serial, started: false, presented: false, offset: 0, standardBase: next.videoId === primaryId } : null;
  }
  function snapshot() {
    return { clip: clip ? { playId: clip.playId, kind: clip.standardBase ? 'base' : 'variant', videoId: clip.videoId,
      reason: 'pose-rotation', repeat: false, standardBase: clip.standardBase, startOffset: clip.offset } : null,
      idleReady: Boolean(clip?.standardBase && clip.presented && !blocked(scene) && !closed),
      state: closed ? 'closed' : blocked(scene) ? 'blocked' : clip ? 'idle' : 'unavailable' };
  }
  const own = id => clip?.playId === id && !blocked(scene) && !closed;
  configure(policy, inventory); time(); choose(true);
  return Object.freeze({ mode: 'rotation', snapshot,
    updateScene(patch) {
      time(); if (closed) return snapshot();
      const previous = scene; scene = sceneValue({ ...scene, ...patch });
      if (scene.identity !== previous.identity) { clip = suspended = null; pose = 'rest'; last = null; sinceHead = Infinity; failed.clear(); faulted = false; }
      if (blocked(scene)) { if (clip) suspended = clip; clip = null; }
      else if (!clip && suspended && !faulted) { clip = { ...suspended, playId: ++serial, started: false, presented: false }; suspended = null; }
      else if (!clip) choose(true);
      return snapshot();
    },
    // A different, verified film took the screen. Its existing pose contract owns
    // the return; an interrupted idle must not resume over that film's final pose.
    interruptPose() { time(); clip = suspended = null; faulted = true; return snapshot(); },
    resetPose() { time(); clip = suspended = null; pose = 'rest'; last = null; sinceHead = Infinity; faulted = false; choose(true); return snapshot(); },
    updatePolicy(next, nextInventory) { time(); if (!closed) { configure(next, nextInventory); choose(true); } return snapshot(); },
    clearOffers() { time(); return snapshot(); }, offerVariant() { time(); return false; },
    started(id) { time(); if (own(id)) clip.started = true; return snapshot(); },
    presented(id) { time(); if (own(id)) { clip.started = true; clip.presented = true; } return snapshot(); },
    progress(id, seconds) { if (own(id) && Number.isFinite(seconds) && seconds >= 0) clip.offset = seconds; },
    completed(id) {
      time(); if (!own(id) || !clip.started) return snapshot();
      pose = clip.to; last = clip.videoId; sinceHead = clip.head ? 0 : sinceHead + 1;
      clip = null; choose(); return snapshot();
    },
    failed(id) {
      time(); if (!own(id)) return snapshot();
      failed.add(clip.videoId);
      // A partly presented transition has no certified resting pose. Hold it and
      // expose failure rather than jumping to another take with incompatible hands.
      faulted = clip.presented || pose !== 'rest'; clip = null; suspended = null; choose(true); return snapshot();
    },
    close() { closed = true; clip = suspended = null; return snapshot(); },
  });
}
