// Läppsynk mot en DEDIKERAD RunPod-pod (persistent_orange_toucan) i stället för RunPod Serverless.
//
// PodLipsyncPool (längst ner) är det spelet använder: en pod, en motor per dealer, pool.for("<avatar>") ger dealerns
// läppsynk med samma gränssnitt som ServerlessLipsync (server/serverless.mjs). PodLipsync är en enskild dealers anslutning.
//
// Hur det fungerar: poddens startskript (pod-lipsync/pod/starta.sh) startar en uppringare per avatar som själv kopplar upp sig mot
//   wss://<spelets publika adress>/lipsync-worker?token=<LIPSYNC_POD_TOKEN>&avatar=<avatar>
// och håller anslutningen öppen dygnet runt — samma protokoll som serverless-arbetarens session
// (pong med kodare, start/binär PCM/end → done + binär mp4). Bryts den ringer podden upp igen inom
// några sekunder. Spelet beställer aldrig något hos RunPod och släcker aldrig GPU:n: podden är
// alltid varm och betalas per timme oavsett.
//
// Skillnader mot ServerlessLipsync, med avsikt:
//   - fast token ur miljön (LIPSYNC_POD_TOKEN), inte en slumpad per serverstart — podden måste känna till den
//   - ingen livscykel: notifyActivity/notifyPlayers gör inget, inaktivitet säger aldrig bye
//   - ingen jobbväg: är podden inte uppkopplad väntar svaret upp till waitMs och fallerar sedan
//   - ringer podden upp en gång till (t.ex. efter omstart) ersätter den nya anslutningen den gamla

import { WebSocket } from "ws";

export class PodLipsync {
  /**
   * @param {object} o
   * @param {string} o.token        delad hemlighet, samma som podden har (LIPSYNC_POD_TOKEN)
   * @param {string} [o.name]       för loggen, t.ex. poddens namn
   * @param {(s: string) => void} [o.log]
   * @param {(text: string) => void} [o.onStatus]  lägesrad till rummet, "" = rensa
   */
  constructor({ token, name = "dedikerad pod", log = console.log, onStatus = () => {} }) {
    if (!token || token.length < 16) throw new Error("PodLipsync: LIPSYNC_POD_TOKEN saknas eller är för kort (minst 16 tecken)");
    this.token = token;
    this.endpointId = `pod (${name})`;   // server.mjs loggar detta vid start
    this.log = log;
    this.onStatus = onStatus;
    this.session = null;
    this.pending = null;
    this.busy = false;
    this.info = { avatar: null, encoder: null };
    this.sessionTimeoutMs = 25_000;   // ett yttrande
    this.waitMs = 20_000;             // så länge ett svar väntar om podden just håller på att ringa upp igen
    this.everConnected = false;
  }

  /** server.mjs frågar efter publik adress vid start; podden behöver ingen beställning, så svara icke-tomt. */
  sessionUrlFn = () => "pod";

  get sessionReady() { return Boolean(this.session && this.session.readyState === WebSocket.OPEN); }

  get status() {
    return this.sessionReady ? `pod uppkopplad (${this.info.avatar ?? "?"}, ${this.info.encoder ?? "?"})` : "väntar på att podden ringer upp";
  }

  // Podden är alltid på: inget att starta eller släcka.
  notifyActivity() {}
  notifyPlayers() {}

  /** Kopplas in från servern på uppgraderingar mot /lipsync-worker (samma rad som i dag). */
  adoptWorker(ws, url) {
    if (url.searchParams.get("token") !== this.token) { ws.close(4403, "fel token"); this.log("läppsynk: uppringning med fel token avvisad"); return; }
    const old = this.session;
    this.session = ws;
    this.info = { avatar: null, encoder: null };
    if (old && old !== ws) {
      // ett pågående svar på den gamla anslutningen kan inte räddas — låt det falla så att nästa svar går nya vägen
      this.#fail("läppsynk: podden ringde upp på nytt");
      try { old.close(); } catch {}
      this.log("läppsynk: podden ringde upp på nytt — ny anslutning tar över");
    }
    this.log(`läppsynk: podden uppkopplad${this.everConnected ? " igen" : ""}`);
    this.everConnected = true;
    this.onStatus("");

    ws.on("message", (m, isBinary) => {
      if (ws !== this.session) return;
      const p = this.pending;
      if (isBinary) {
        if (p?.meta) { this.pending = null; clearTimeout(p.timer); p.resolve({ mp4: Buffer.from(m), meta: p.meta }); }
        return;
      }
      let j; try { j = JSON.parse(m.toString()); } catch { return; }
      if (j.t === "pong") {
        const first = !this.info.encoder;
        this.info = { avatar: j.avatar ?? null, encoder: j.encoder ?? "?" };
        if (first) {
          this.log(`läppsynk: pod ${j.avatar} · ${j.encoder}`);
          // Prime: första yttrandet betalar cudnn-autotune (~12 s) — det ska inte drabba en besökare.
          try {
            ws.send(JSON.stringify({ t: "start", id: "_prime", rate: 24000 }));
            ws.send(Buffer.alloc(14400));
            ws.send(JSON.stringify({ t: "end", id: "_prime" }));
          } catch {}
        }
        return;
      }
      if (!p || j.id !== p.id) return;
      if (j.t === "done") { p.meta = j; this.log(`läppsynk: arbetartid ${JSON.stringify(j.ms)} (${j.frames} rutor)`); }
      else if (j.t === "error") { this.#fail(`läppsynk: ${j.reason}`); }
    });
    ws.on("close", () => {
      if (ws !== this.session) return;
      this.session = null;
      this.#fail("läppsynk: podden kopplade ner");
      this.log("läppsynk: podden nere — väntar på att den ringer upp igen");
    });
    ws.on("error", () => {});
  }

  #fail(msg) {
    const p = this.pending;
    if (!p) return;
    this.pending = null; clearTimeout(p.timer); p.reject(new Error(msg));
  }

  /** PCM s16le mono → { mp4, meta } över poddens stående anslutning. */
  async lipsync(pcm, rate) {
    if (this.busy) throw new Error("läppsynk: upptagen");
    this.busy = true;
    try {
      if (!this.sessionReady) {
        this.log("läppsynk: podden inte uppkopplad — väntar på den");
        const t0 = Date.now();
        while (!this.sessionReady && Date.now() - t0 < this.waitMs) await new Promise((r) => setTimeout(r, 250));
        if (!this.sessionReady) throw new Error("läppsynk: podden är inte uppkopplad");
      }
      return await this.#send(pcm, rate);
    } finally {
      this.busy = false;
    }
  }

  #send(pcm, rate) {
    const ws = this.session;
    const id = `d${Date.now().toString(36)}`;
    return new Promise((resolve, reject) => {
      const p = { id, resolve, reject, meta: null, timer: null };
      p.timer = setTimeout(() => { if (this.pending === p) { this.pending = null; reject(new Error("läppsynk: tidsgräns (pod)")); } }, this.sessionTimeoutMs);
      this.pending = p;
      ws.send(JSON.stringify({ t: "start", id, rate }));
      for (let i = 0; i < pcm.length; i += 32768) ws.send(pcm.subarray(i, i + 32768));
      ws.send(JSON.stringify({ t: "end", id }));
    });
  }

  /** Vid serveravstängning: stäng bara anslutningen. INTE bye — podden ska ringa upp nästa server direkt. */
  close() {
    this.#fail("läppsynk: servern stängs");
    try { this.session?.close(); } catch {}
    this.session = null;
  }
}

/**
 * En pod, flera dealers: podden kör en motor per avatar (astrid_spel2x, dragan_vila2x, paow_vila2x …) och varje motor
 * ringer upp /lipsync-worker?token=…&avatar=<id>. Poolen tar emot alla på samma väg och ger varje dealer ett eget
 * PodLipsync-objekt — samma gränssnitt som ServerlessLipsync, så spelet byter
 *   new ServerlessLipsync({ endpointId: <dealerns endpoint>, … })   →   pool.for("<dealerns avatar>")
 * Varje dealer har sin egen motor: Astrid och Paow kan läppsynkas samtidigt, ett yttrande i taget per dealer.
 */
export class PodLipsyncPool {
  /**
   * @param {object} o
   * @param {string} o.token        delad hemlighet, samma som podden har (LIPSYNC_POD_TOKEN)
   * @param {string} [o.name]       för loggen, t.ex. poddens namn
   * @param {string} [o.fallback]   avatar för en uppringning utan &avatar= (äldre poddskript), standard astrid_spel2x
   * @param {(s: string) => void} [o.log]
   * @param {(text: string) => void} [o.onStatus]
   */
  constructor({ token, name = "dedikerad pod", fallback = "astrid_spel2x", log = console.log, onStatus = () => {} }) {
    if (!token || token.length < 16) throw new Error("PodLipsyncPool: LIPSYNC_POD_TOKEN saknas eller är för kort (minst 16 tecken)");
    Object.assign(this, { token, name, fallback, log, onStatus });
    this.endpointId = `pod (${name})`;
    this.dealers = new Map();
  }

  /** Dealerns läppsynk. Skapas direkt även om podden inte ringt upp än: svaret väntar då upp till waitMs. */
  for(avatar) {
    if (!/^[a-z0-9_]{1,64}$/.test(avatar ?? "")) throw new Error(`PodLipsyncPool: ogiltigt avatar-id ${avatar}`);
    let d = this.dealers.get(avatar);
    if (!d) {
      d = new PodLipsync({ token: this.token, name: `${this.name}/${avatar}`, onStatus: this.onStatus,
                           log: (s) => this.log(s.replace(/^läppsynk:/, `läppsynk [${avatar}]:`)) });
      this.dealers.set(avatar, d);
    }
    return d;
  }

  /** server.mjs: samma rad som i dag — workers.handleUpgrade(…, (ws) => pool.adoptWorker(ws, url)). */
  adoptWorker(ws, url) {
    if (url.searchParams.get("token") !== this.token) { ws.close(4403, "fel token"); this.log("läppsynk: uppringning med fel token avvisad"); return; }
    const avatar = url.searchParams.get("avatar") || this.fallback;
    if (!/^[a-z0-9_]{1,64}$/.test(avatar)) { ws.close(4400, "ogiltig avatar"); return; }
    this.for(avatar).adoptWorker(ws, url);
  }

  /** Bekvämlighet: pool.lipsync(pcm, rate, avatar) = pool.for(avatar).lipsync(pcm, rate). */
  lipsync(pcm, rate, avatar = this.fallback) { return this.for(avatar).lipsync(pcm, rate); }

  sessionUrlFn = () => "pod";
  get sessionReady() { return [...this.dealers.values()].some((d) => d.sessionReady); }
  get status() {
    const up = [...this.dealers].filter(([, d]) => d.sessionReady).map(([a, d]) => `${a} ${d.info.encoder ?? ""}`.trim());
    return up.length ? `pod uppkopplad: ${up.join(", ")}` : "väntar på att podden ringer upp";
  }
  notifyActivity() {}
  notifyPlayers() {}
  close() { for (const d of this.dealers.values()) d.close(); }
}
