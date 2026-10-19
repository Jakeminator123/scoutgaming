// Rösten: Cartesia sonic-3.5 över EN stående WebSocket (handskakningen kostar ~1,1 s — betalas en gång).
// Varje svar är en `context` som matas med text ord för ord medan LLM:en skriver (continue: true) och
// avslutas med sista biten (continue: false). Ljudet kommer som rå PCM s16le 24 kHz — exakt det
// läppsynken vill ha. Samma mönster som jep-live-blackjack (server/brain.js CartesiaTTS).

import { WebSocket } from "ws";

export const FREJA = "bcdcad6d-4eb6-4a71-89fd-1ae2ce9f95d8";     // Freja – Informative Host (svensk brytning) — vald 2026-09-24
export const VICTORIA = "dc30854e-e398-4579-9dc8-16f6cb2c19b9";  // Victoria – Refined Coordinator (brittisk) — föregående val

// Språk Astrid kan svara på. Freja är en svensk röst: på engelska har hon den svenska brytning som valdes, men på
// andra språk ska hon låta infödd — därför lokaliserade kopior av Freja (metodik/lappsynk/verktyg/lokalisera-rost.mjs,
// 2026-09-25), samma röstkaraktär med språkets eget uttal. Prov: croupier-consult/lipsync-spel/09_2026-09-25_sprakprov/.
export const LANGS = {
  en: { voice: FREJA, name: "English", label: "EN" },
  es: { voice: "8f57cf2c-e650-4e10-a784-cd93d23ee7f4", name: "Spanish", label: "ES" },   // Freja (spanska)
  fr: { voice: "a7d6a620-ee74-422b-bd31-61b0b1bf6718", name: "French", label: "FR" },    // Freja (franska)
  zh: { voice: "cef8def7-8d39-40bd-992b-71bf57bbed86", name: "Chinese", label: "中文" }, // Freja (kinesiska, mandarin)
  pt: { voice: "25a07829-a967-4cc2-b450-77712701a9a0", name: "Portuguese", label: "PT" },  // Freja (brasiliansk portugisiska, dialect br, 2026-10-15)
  ko: { voice: "97348d60-343d-4ea2-baa7-e9486ebebdfa", name: "Korean", label: "KO" },      // Freja (koreanska, 2026-10-19)
};
export const lang = (l) => (Object.hasOwn(LANGS, l) ? l : "en");

export class CartesiaTTS {
  constructor({ key, voiceId = FREJA, model = "sonic-3.5", rate = 24000, timeoutMs = 15000, log = console.log }) {
    Object.assign(this, { key, voiceId, model, rate, timeoutMs, log });
    this.ws = null; this.opening = null; this.contexts = new Map(); this.n = 0; this.closed = false;
  }

  /** Öppnar socketen i förväg; öppnas igen av sig själv när Cartesia stänger en tyst socket. */
  connect() {
    if (this.ws && this.ws.readyState <= 1) return this.opening ?? Promise.resolve();
    const ws = new WebSocket(`wss://api.cartesia.ai/tts/websocket?api_key=${this.key}&cartesia_version=2025-04-16`);
    this.ws = ws;
    this.opening = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("cartesia: handskakning tog för lång tid")), 8000);
      ws.once("open", () => { clearTimeout(t); resolve(); });
      ws.once("error", (e) => { clearTimeout(t); reject(e); });
    });
    this.opening.catch(() => {});
    ws.on("message", (m) => this.#onMessage(m));
    ws.on("close", () => {
      if (this.ws === ws) this.ws = null;
      for (const c of this.contexts.values()) c.reject(new Error("cartesia: socketen stängdes"));
      this.contexts.clear();
      if (!this.closed) setTimeout(() => this.connect().catch(() => {}), 1000).unref?.();
    });
    ws.on("error", (e) => this.log(`cartesia: ${e.message}`));
    return this.opening;
  }

  close() { this.closed = true; this.ws?.close(); }

  #onMessage(raw) {
    let j; try { j = JSON.parse(raw.toString()); } catch { return; }
    const c = this.contexts.get(j.context_id);
    if (!c) return;
    if (j.type === "chunk") c.pcm.push(Buffer.from(j.data, "base64"));
    else if (j.type === "done") { this.contexts.delete(j.context_id); clearTimeout(c.timer); c.resolve(Buffer.concat(c.pcm)); }
    else if (j.type === "error") { this.contexts.delete(j.context_id); clearTimeout(c.timer); c.reject(new Error(`cartesia: ${j.error ?? j.message ?? "fel"}`)); }
  }

  /**
   * Startar ett yttrande: { push(text), end(text?), done } — `done` löses med hela PCM-bufferten.
   * push() tar hela ord (se words()); aldrig mitt i ett ord, aldrig bara blanksteg.
   */
  async start(l = "en") {
    await this.connect();
    const id = `ctx_${Date.now().toString(36)}_${++this.n}`;
    l = lang(l);
    const base = {
      model_id: this.model, voice: { mode: "id", id: l === "en" ? this.voiceId : LANGS[l].voice }, language: l,
      output_format: { container: "raw", encoding: "pcm_s16le", sample_rate: this.rate },
      context_id: id, max_buffer_delay_ms: 120,
    };
    const ctx = { pcm: [], resolve: null, reject: null, timer: null };
    const done = new Promise((resolve, reject) => { ctx.resolve = resolve; ctx.reject = reject; });
    ctx.timer = setTimeout(() => { this.contexts.delete(id); ctx.reject(new Error("cartesia: tidsgräns")); }, this.timeoutMs);
    this.contexts.set(id, ctx);
    const send = (transcript, more) => {
      if (!this.ws || this.ws.readyState !== 1) throw new Error("cartesia: ingen socket");
      this.ws.send(JSON.stringify({ ...base, transcript, continue: more }));
    };
    let sent = false;
    return {
      push: (text) => { if (text && text.trim()) { send(text, true); sent = true; } },
      end: (text = "") => send(text || (sent ? "" : " "), false),
      done,
    };
  }

  /** Hela texten på en gång (förproducerat, /api/speak). */
  async say(text, l = "en") {
    const u = await this.start(l);
    u.end(text);
    return u.done;
  }
}

/** Tar ut hela ord ur en växande textbuffert: { ord: [...], rest }. Kinesiska har inga mellanslag — där är
 *  bitarna fraser fram till skiljetecken (。，！？、；：), annars skulle rösten vänta in hela svaret. */
export function words(buffer, l = "en") {
  const out = [];
  let m;
  const re = l === "zh" ? /^[^。，！？、；：,.!?;:]*[。，！？、；：,.!?;:]+\s*/ : /^\s*\S+\s+/;
  while ((m = re.exec(buffer)) && m[0].trim()) { out.push(m[0]); buffer = buffer.slice(m[0].length); }
  return { ord: out, rest: buffer };
}
