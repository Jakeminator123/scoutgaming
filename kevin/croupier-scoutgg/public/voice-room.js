// The dealer's voice in the room (Kevin 14 Oct: Dragge and Paow sound like a studio mic close to the mouth; let them sound
// as if they were in the casino). What the player HEARS goes through a filter: high-pass, low-pass, a small dip at 3 kHz
// and a few early reflections, with the casino left under the voice. The lip sync never hears it: the server sends the dry voice to the worker
// (rorlig-lipsync.mjs) and the mouth follows video frames, not this sound.
// "studio" touches nothing: no AudioContext, no crossOrigin, today's playback exactly. It is every dealer's default
// when no preset is chosen; ?voice=studio|space tries one on this page.
export const ROOM_PRESETS = Object.freeze({
  studio: null,
  // Kevin 14 Oct, sample 3 of /root/qa/ai-casino-voicerooms/v2 ("sista va vinnaren"): a little further from the mic, a little
  // air and no reverb tail (three early reflections), and the casino stays under her voice instead of dipping to 32 %.
  space: Object.freeze({ hp: 100, lp: 10000, eq: -1.5, eqHz: 3000, taps: [[0.011, 0.26], [0.019, 0.18], [0.031, 0.12]], master: 0.8, duck: 1 }),
});
// Kevin's choice per dealer (dealer id → preset name).
export const DEALER_ROOM = Object.freeze({ paow: 'space', dragge: 'space', marten: 'space' });

export function roomFor(dealerId, search = '') {
  const asked = new URLSearchParams(search).get('voice');
  if (asked && Object.hasOwn(ROOM_PRESETS, asked)) return asked;
  return DEALER_ROOM[dealerId] ?? 'studio';
}

export function createVoiceRoom(dealerId, { search = typeof location === 'undefined' ? '' : location.search,
  createContext = () => new (window.AudioContext || window.webkitAudioContext)() } = {}) {
  const name = roomFor(dealerId, search), preset = ROOM_PRESETS[name];
  const sources = new WeakMap();
  let ctx = null, input = null;
  function build() {
    // its own context, never closed: a media element bound to a context plays only through it, and the game's effects
    // context (table-audio.js) is closed on Sound off
    ctx = createContext();
    const hp = new BiquadFilterNode(ctx, { type: 'highpass', frequency: preset.hp, Q: 0.707 });
    const lp = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: preset.lp, Q: 0.707 });
    const eq = new BiquadFilterNode(ctx, { type: 'peaking', frequency: preset.eqHz, Q: 1, gain: preset.eq });
    // the voice and its early reflections; the mix comes down a little, and a limiter just under full scale catches the rest
    const master = new GainNode(ctx, { gain: preset.master });
    const limit = new DynamicsCompressorNode(ctx, { threshold: -3, knee: 0, ratio: 20, attack: 0.002, release: 0.08 });
    master.connect(limit).connect(ctx.destination);
    hp.connect(lp).connect(eq).connect(master);
    for (const [delay, gain] of preset.taps) eq.connect(new DelayNode(ctx, { delayTime: delay, maxDelayTime: 0.1 })).connect(new GainNode(ctx, { gain })).connect(master);
    input = hp;
  }
  // Only a running context takes an element: bound to a suspended one it would be silent. Until then it plays as today.
  function attach(el) {
    if (!preset || !ctx || ctx.state !== 'running' || !el) return false;
    if (sources.has(el)) return true;
    try { const s = ctx.createMediaElementSource(el); s.connect(input); sources.set(el, s); return true; } catch { return false; }
  }
  return {
    name, active: Boolean(preset),
    /** How far the casino dips while the dealer speaks (game-audio.js): 0.32 as before, or the preset's. */
    duck: preset?.duck ?? 0.32,
    /** Before an element gets its first src: CDN media must be fetched with CORS, or the room would hear silence. */
    prepare(el) { if (preset && el && !el.crossOrigin) el.crossOrigin = 'anonymous'; return el; },
    /** In the user's gesture (app.js unlock): make or wake the context, then take these elements. */
    unlock(elements = []) {
      if (!preset) return;
      try {
        if (!ctx) build();
        const take = () => { for (const el of elements) attach(el); };
        if (ctx.state === 'running') take(); else ctx.resume().then(take).catch(() => {});
      } catch { ctx = null; }
    },
    attach,
    /** new Audio(url) for a line or an answer, through the room when it can be. */
    audio(url) { const a = new Audio(); this.prepare(a); a.src = url; attach(a); return a; },
  };
}
