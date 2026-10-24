import { randomBytes } from 'node:crypto';
// Läppsynk över RunPod Serverless (repot astrid-gpu-worker, avatar astrid_spel2x) — oförändrad från demo 1,
// men GPU:n startar när någon är i rummet och släcks när det varit tomt en stund.
// Port av ServerlessLipsync i jep-live-blackjack (server/brain.js), trimmad till demots behov.
//
// Två vägar till arbetaren:
//
//   session   Vi beställer ett jobb "session" av endpointen. Arbetaren ringer då UPP oss
//             (wss://<publik adress>/lipsync-worker?token=…) och kör poddens protokoll över
//             en stående socket tills ttl gått ut → pod-latens, ~2 s per svar. 150 s före ttl
//             beställs nästa; den nya arbetaren parkeras tills pågående svar är klart.
//             Kräver publik adress: SESSION_URL i .env, annars den som `npm run share`
//             skriver till public-url.txt (läses vid varje beställning — adressen byter
//             namn varje gång tunneln startas om).
//
//   jobb      /run + statuspoll med hela wav:en i base64. Reserv när ingen session är uppe:
//             första svaret efter vila (rymmer kallstarten, ~35–60 s) eller helt utan publik
//             adress. Fungerar alltid, kostar ett jobb (~0,5–1 s) extra per svar.
//
// Livscykel: GPU:n följer AKTIVITET, inte anslutning. notifyActivity() vid varje chattmeddelande
// (och notifyPlayers(n>0) vid anslutning) startar/håller sessionen. 10 min utan handling → bye
// till arbetaren, kön rensas, inga fler jobb — även om flikar står öppna (en glömd flik ska inte
// kosta). Nästa meddelande väcker GPU:n igen ("Astrid vaknar"). Kostnad i vila: 0.

import { readFileSync, writeFileSync } from "node:fs";
import { WebSocket } from "ws";

export class ServerlessLipsync {
  /**
   * @param {object} o
   * @param {string} o.endpointId       RunPod endpoint-id
   * @param {string} o.apiKey           RunPod API-nyckel
   * @param {() => string} o.sessionUrl ger publik wss-adress till /lipsync-worker, eller "" om ingen finns
   * @param {(s: string) => void} [o.log]
   * @param {(text: string) => void} [o.onStatus]  lägesrad till rummet ("Astrid vaknar …"), "" = rensa
   */
  constructor({ endpointId, apiKey, sessionUrl, log = console.log, onStatus = () => {}, fetchImpl = fetch, ordersFile = null }) {
    this.endpointId = endpointId;
    this.apiKey = apiKey;
    this.sessionUrlFn = sessionUrl;
    this.log = log;
    this.onStatus = onStatus;
    this.fetch = fetchImpl;

    this.jobTimeoutMs = 120_000;      // rymmer kallstart + avatarbygge + klippet
    this.sessionTimeoutMs = 25_000;   // ett yttrande över en varm session
    this.sessionWaitMs = 300_000;     // så länge första svaret väntar på en beställd session (färsk image-pull uppmätt 3,5–4 min 2026-09-24;
                                      // kortare → jobbvägen startar en ANDRA GPU mitt i kallstarten)
    this.sessionTtlS = 540;           // < endpointens execution timeout (600 s)
    this.inactivityMs = 600_000;      // så länge utan chattmeddelande/anslutning → släck, flikar eller ej
    this.sessionGraceMs = 600_000;    // tomt rum så länge → släck (täcks i praktiken av inaktiviteten)
    this.keepWarmMs = 60_000;
    this.lastActivity = 0;

    this.token = randomBytes(32).toString("hex");
    this.orders = [];               // jobb-id:n på VÅRA sessionsbeställningar — bara de avbryts vid nedsläckning
    // Beställningarna sparas i en fil: dör servern hårt (kill, krasch) hinner den inte säga bye, och den gamla
    // sessionen håller en GPU-arbetare i upp till ttl (9 min) medan nästa server får kallstarta en till —
    // uppmätt 2026-09-24: första svaret efter omstart 3,7 min. Vid start avbryts det som ligger kvar.
    this.ordersFile = ordersFile;
    this.#cancelLeftovers();
    this.session = null;        // arbetarens socket när en session är uppe
    this.nextSession = null;    // ersättare som väntar på pågående svar
    this.sessionAt = 0;
    this.sessionAskedAt = 0;
    this.pending = null;        // pågående yttrande över sessionen
    this.busy = false;
    this.wanted = false;
    this.graceTimer = null;
    this.tick = null;
    this.info = { avatar: null, encoder: null };
    // Arbetare utan NVENC (videokodaren på grafikkortet) kodar på processorn: uppmätt 2026-09-25 14–17 s per
    // svar mot 3,5–4 s med NVENC, på samma image (en RunPod-maskin vars 4090 inte gav NVENC). RunPod startar om
    // en terminerad arbetare på SAMMA maskin, så den går inte att bli av med utifrån — i stället: en långsam
    // arbetare används bara om inget bättre finns, och hålls upptagen medan en till beställs, så att den nya
    // sessionen måste hamna på en annan maskin.
    this.parked = new Set();    // långsamma arbetare som hålls upptagna medan en snabb letas fram
    this.hunts = [];            // tidpunkter för extra beställningar (högst 3 per 10 min)
  }

  get sessionReady() { return Boolean(this.session && this.session.readyState === WebSocket.OPEN); }

  get status() {
    if (this.sessionReady) return `session uppe (${this.info.avatar ?? "?"})`;
    return this.wanted ? "session beställd — väntar på arbetare" : "vilar (ingen i rummet)";
  }

  // ---------------------------------------------------------------- livscykel ---

  /** Någon gjorde något (skrev i chatten). Startar GPU:n om den är släckt, annars håller den vid liv. */
  notifyActivity(what = "aktivitet") {
    this.lastActivity = Date.now();
    if (this.graceTimer) { clearTimeout(this.graceTimer); this.graceTimer = null; }
    if (!this.wanted) { this.wanted = true; this.log(`läppsynk: ${what} — startar GPU:n`); }
    this.#startTick();
    this.ensureSession();
  }

  /** Rummet rapporterar antal anslutna (anropas vid varje anslutning/frånkoppling). Kevin 24 Oct: att någon öppnar
   *  sidan startar ingen GPU längre (beställs bara när ett svar behöver den); en uppe hålls vid liv medan någon är kvar. */
  notifyPlayers(n) {
    if (n > 0) {
      if (this.wanted && this.graceTimer) { clearTimeout(this.graceTimer); this.graceTimer = null; }
    } else if (this.wanted && !this.graceTimer) {
      this.graceTimer = setTimeout(() => this.#shutdown(), this.sessionGraceMs);
      this.graceTimer.unref?.();
    }
  }

  #shutdown(reason = `tomt i ${Math.round(this.sessionGraceMs / 60000)} min`) {
    if (this.graceTimer) clearTimeout(this.graceTimer);
    this.graceTimer = null;
    this.wanted = false;
    this.log(`läppsynk: ${reason} — släcker GPU:n`);
    for (const w of [this.session, this.nextSession, ...this.parked]) {
      if (w) { try { w.send(JSON.stringify({ t: "bye" })); w.close(); } catch {} }
    }
    this.session = null; this.nextSession = null; this.parked.clear();
    this.sessionAskedAt = 0;   // annars spärrar kallstartsvakten nästa beställning i upp till 150 s
    if (this.tick) { clearInterval(this.tick); this.tick = null; }
    // beställningar som ligger i RunPods kö skulle annars starta en GPU i onödan senare
    this.#cancelOrders();
  }

  #ordered(id) {
    this.log(`läppsynk: session beställd (jobb ${id})`);
    this.orders.push(id);
    if (this.orders.length > 10) this.orders.shift();
    this.#saveOrders();
  }

  #saveOrders() {
    if (!this.ordersFile) return;
    try { writeFileSync(this.ordersFile, JSON.stringify(this.orders)); } catch {}
  }

  #cancelLeftovers() {
    if (!this.ordersFile) return;
    let ids = [];
    try { ids = JSON.parse(readFileSync(this.ordersFile, "utf8")); } catch {}
    try { writeFileSync(this.ordersFile, "[]"); } catch {}
    if (!ids.length) return;
    for (const id of ids) this.#api(`cancel/${id}`, { method: "POST" }).catch(() => {});
    this.log(`läppsynk: ${ids.length} kvarlämnad(e) session(er) från förra körningen avbrutna`);
  }

  /** Avbryter våra egna beställningar. INTE purge-queue: den är global för endpointen och skulle
   *  kasta en annan servers (t.ex. Jakobs) beställning om endpointen delas. Att avbryta ett jobb
   *  som redan är klart eller avslutat är ofarligt. */
  #cancelOrders() {
    const ids = this.orders.splice(0);
    this.#saveOrders();
    for (const id of ids) this.#api(`cancel/${id}`, { method: "POST" }).catch(() => {});
    if (ids.length) this.log(`läppsynk: ${ids.length} beställning(ar) avbrutna`);
  }

  #startTick() {
    if (this.tick) return;
    this.tick = setInterval(() => {
      if (!this.wanted) return;
      if (Date.now() - this.lastActivity > this.inactivityMs) {
        this.#shutdown(`ingen aktivitet på ${Math.round(this.inactivityMs / 60000)} min`);
        return;
      }
      // förnya i god tid före ttl så nästa arbetare hinner ringa upp
      if (this.session && Date.now() - this.sessionAt > (this.sessionTtlS - 150) * 1000) this.ensureSession(true);
      else if (!this.session) this.ensureSession();
    }, this.keepWarmMs);
    this.tick.unref?.();
  }

  /** Beställer en session (fire-and-forget /run — jobbet ÄR sessionen). */
  ensureSession(force = false) {
    if (!this.wanted) return;
    const base = this.sessionUrlFn();
    if (!base) return;   // ingen publik adress — jobbvägen får duga
    // en beställning utan session uppe får hela kallstarten (150 s) på sig innan en ny läggs —
    // annars startar två GPU:er vid varje kallstart (hände 2026-09-22: ny beställning efter 60 s)
    if ((this.session && !force) || this.nextSession || Date.now() - this.sessionAskedAt < (this.session ? 60_000 : 150_000)) return;
    this.#order();
  }

  /** Lägger beställningen (utan vakterna i ensureSession — #hunt har egen gräns). */
  #order() {
    const base = this.sessionUrlFn();
    if (!base) return;
    this.sessionAskedAt = Date.now();
    const url = `${base}${base.includes("?") ? "&" : "?"}token=${this.token}`;
    if (!this.session) this.onStatus("Astrid vaknar — första svaret kan ta upp till en minut");
    // Faller beställningen (RunPods API svarade inte i tid 2026-09-22) får den INTE blockera
    // kallstartsvakten i 150 s: nollställ och försök igen om två sekunder.
    const fell = (why) => {
      this.log(`läppsynk: beställning föll (${why}) — nytt försök om 2 s`);
      this.sessionAskedAt = 0;
      setTimeout(() => this.ensureSession(), 2000).unref?.();
    };
    this.#api("run", { method: "POST", body: JSON.stringify({ input: { op: "session", ws_url: url, ttl: this.sessionTtlS } }) }, 20_000)
      .then((j) => j.id ? this.#ordered(j.id) : fell(j.error ?? "?"))
      .catch((e) => fell(e.message));
  }

  // ---------------------------------------------------------------- arbetaren ringer upp ---

  #swapTo(ws) {
    const old = this.session;
    this.session = ws;
    this.sessionAt = ws.adoptedAt ?? Date.now();
    if (old && old !== ws) {
      try { old.send(JSON.stringify({ t: "bye" })); old.close(); } catch {}
      this.log("läppsynk: växlad till ny arbetare");
    }
  }

  #drainSwap() {
    if (this.nextSession?.readyState === WebSocket.OPEN) { const n = this.nextSession; this.nextSession = null; this.#swapTo(n); }
    else if (this.nextSession) this.nextSession = null;
  }

  /** Kopplas in från servern på uppgraderingar mot /lipsync-worker. */
  adoptWorker(ws, url) {
    if (url.searchParams.get("token") !== this.token) { ws.close(4403, "fel token"); return; }
    if (!this.wanted) {
      // en köad beställning hann starta efter nedsläckningen — tacka av, annars står GPU:n och kostar
      try { ws.send(JSON.stringify({ t: "bye" })); } catch {}
      ws.close();
      this.log("läppsynk: arbetare avvisad (ingen i rummet)");
      return;
    }
    ws.adoptedAt = Date.now();
    this.sessionAskedAt = 0;
    // Arbetaren skickar en pong med sin kodare direkt när den ringt upp — var den ska stå avgörs först då.
    ws.encoder = undefined;
    ws.placeTimer = setTimeout(() => { if (ws.encoder === undefined) { ws.encoder = "?"; this.#place(ws); } }, 3000);
    ws.placeTimer.unref?.();

    ws.on("message", (m, isBinary) => {
      const p = this.pending;
      if (isBinary) {
        if (p?.meta && ws === this.session) { this.pending = null; clearTimeout(p.timer); this.busy = false; p.resolve({ mp4: Buffer.from(m), meta: p.meta }); this.#drainSwap(); }
        return;
      }
      let j; try { j = JSON.parse(m.toString()); } catch { return; }
      if (j.t === "pong") {
        const first = ws.encoder === undefined;
        ws.encoder = j.encoder ?? "?";
        ws.avatar = j.avatar;
        if (ws === this.session) this.info = { avatar: j.avatar, encoder: ws.encoder };
        if (first) this.#place(ws);
        return;
      }
      if (ws !== this.session) return;
      if (!p || j.id !== p.id) return;
      if (j.t === "done") { p.meta = j; this.log(`läppsynk: arbetartid ${JSON.stringify(j.ms)} (${j.frames} rutor)`); }
      else if (j.t === "error") { this.pending = null; clearTimeout(p.timer); this.busy = false; p.reject(new Error(`läppsynk: ${j.reason}`)); this.#drainSwap(); }
    });
    ws.on("close", () => {
      clearTimeout(ws.placeTimer);
      if (this.parked.delete(ws)) return;
      if (this.nextSession === ws) { this.nextSession = null; return; }
      if (this.session !== ws) return;
      this.session = null;
      const p = this.pending;
      if (p) { this.pending = null; clearTimeout(p.timer); this.busy = false; p.reject(new Error("läppsynk: sessionen stängdes")); }
      if (this.nextSession?.readyState === WebSocket.OPEN) { const n = this.nextSession; this.nextSession = null; this.#swapTo(n); return; }
      if (this.wanted) {
        this.log("läppsynk: session nere — beställer ny");
        setTimeout(() => this.ensureSession(), 1500).unref?.();
      } else this.log("läppsynk: session nere (ingen i rummet)");
    });
    ws.on("error", () => {});
  }

  static #fast(ws) { return /nvenc/.test(ws?.encoder ?? "") || ws?.encoder === "?"; }   // "?" = okänt (gammal arbetare): ge den chansen

  /** Arbetaren har sagt vilken kodare den har: använd den, eller håll den upptagen och leta vidare. */
  #place(ws) {
    clearTimeout(ws.placeTimer);
    if (ws.readyState !== WebSocket.OPEN) return;
    const cur = this.sessionReady ? this.session : null;
    if (!ServerlessLipsync.#fast(ws)) {
      this.log(`läppsynk: arbetare utan NVENC (${ws.encoder}) — kodar på processorn, ~15 s per svar`);
      if (cur && ServerlessLipsync.#fast(cur)) {
        this.parked.add(ws);   // upptagen → nästa beställning kan inte hamna på den
        this.#hunt("behåller den snabba som redan är uppe");
        return;
      }
      this.#use(ws);           // bättre än ingenting (jobbvägen hamnar på samma sorts maskin)
      this.#hunt("används tills en snabbare är uppe");
      return;
    }
    this.#use(ws);
    for (const w of this.parked) { try { w.send(JSON.stringify({ t: "bye" })); w.close(); } catch {} }
    if (this.parked.size) this.log(`läppsynk: ${this.parked.size} långsam(ma) arbetare släppt(a)`);
    this.parked.clear();
  }

  #use(ws) {
    if (this.session && this.pending) {
      if (this.nextSession && this.nextSession !== ws) { try { this.nextSession.send(JSON.stringify({ t: "bye" })); this.nextSession.close(); } catch {} }
      this.nextSession = ws;
      this.log(`läppsynk: ny arbetare (${ws.encoder}) väntar på pågående svar`);
    } else {
      this.#swapTo(ws);
      this.info = { avatar: ws.avatar ?? null, encoder: ws.encoder };
      this.log(`läppsynk: arbetare uppkopplad (${ws.encoder})`);
      this.onStatus("");
    }
    // Prime: arbetarens allra första yttrande betalar cudnn-autotune (~12 s) — det ska inte drabba en besökare.
    try {
      ws.send(JSON.stringify({ t: "start", id: "_prime", rate: 24000 }));
      ws.send(Buffer.alloc(14400));
      ws.send(JSON.stringify({ t: "end", id: "_prime" }));
    } catch {}
  }

  /** Beställer en session till medan den långsamma hålls upptagen — högst 3 gånger per 10 min. */
  #hunt(why) {
    const now = Date.now();
    this.hunts = this.hunts.filter((t) => now - t < 600_000);
    if (this.hunts.length >= 3) {
      this.log(`läppsynk: ingen arbetare med NVENC efter 3 försök — kör vidare med den som finns (${why})`);
      for (const w of this.parked) { try { w.send(JSON.stringify({ t: "bye" })); w.close(); } catch {} }
      this.parked.clear();
      return;
    }
    this.hunts.push(now);
    this.log(`läppsynk: letar efter en arbetare med NVENC (${why}) — beställer en till`);
    this.#order();
  }

  // ---------------------------------------------------------------- ett yttrande ---

  /** PCM s16le mono → { mp4, meta }. Sessionen om den är uppe, annars jobbvägen. */
  async lipsync(pcm, rate) {
    if (this.busy) throw new Error("läppsynk: upptagen");
    this.busy = true;
    try {
      // Session beställd men inte uppe än (kallstart): vänta in den. Ett eget jobb nu skulle
      // kräva EN ARBETARE TILL — en andra kallstart — och slog i tidsgränsen 2026-09-22 så att
      // allra första repliken efter vila aldrig fick svar. Sessionen är redan på väg.
      if (!this.sessionReady && this.wanted && this.sessionAskedAt && this.sessionUrlFn()) {
        this.log("läppsynk: väntar in sessionen för första svaret");
        await this.#awaitSession(this.sessionWaitMs);
      }
      if (!this.sessionReady) return await this.#viaJob(pcm, rate);
      try {
        return await this.#viaSession(pcm, rate);
      } catch (e) {
        // Svarar arbetaren inte i tid är sessionen inte att lita på: släpp den (en ny beställs av
        // tick/close-hanteraren) och gör DET HÄR svaret via jobbvägen — besökaren ska få sitt svar.
        if (!/tidsgräns/.test(e.message)) throw e;
        this.log(`läppsynk: ${e.message} — släpper sessionen, svaret går jobbvägen`);
        const dead = this.session;
        this.session = null;
        try { dead?.send(JSON.stringify({ t: "bye" })); dead?.close(); } catch {}
        setTimeout(() => this.ensureSession(), 500).unref?.();
        return await this.#viaJob(pcm, rate);
      }
    } finally {
      this.busy = false;
    }
  }

  /** Väntar tills en session är uppe, eller tills tiden gått (då får jobbvägen ta över). */
  async #awaitSession(ms) {
    const t0 = Date.now();
    while (!this.sessionReady && this.wanted && Date.now() - t0 < ms) {
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!this.sessionReady) this.log(`läppsynk: ingen session efter ${Math.round((Date.now() - t0) / 1000)} s — svaret går jobbvägen`);
  }

  #viaSession(pcm, rate) {
    const ws = this.session;
    const id = `d${Date.now().toString(36)}`;
    return new Promise((resolve, reject) => {
      const p = { id, resolve, reject, meta: null, timer: null };
      p.timer = setTimeout(() => {
        if (this.pending === p) { this.pending = null; reject(new Error("läppsynk: tidsgräns (session)")); this.#drainSwap(); }
      }, this.sessionTimeoutMs);
      this.pending = p;
      ws.send(JSON.stringify({ t: "start", id, rate }));
      for (let i = 0; i < pcm.length; i += 32768) ws.send(pcm.subarray(i, i + 32768));
      ws.send(JSON.stringify({ t: "end", id }));
    });
  }

  async #viaJob(pcm, rate) {
    const t0 = Date.now();
    if (this.wanted && !this.session) this.onStatus("Astrid vaknar — första svaret kan ta upp till en minut");
    const out = await this.#call({ op: "lipsync", wav_b64: ServerlessLipsync.wav(pcm, rate).toString("base64"), crf: 13, preset: "ultrafast" });
    if (!this.session) this.onStatus("");
    const frames = out.frames ?? 0;
    return { mp4: Buffer.from(out.mp4_b64, "base64"), meta: { dur: frames / 24, frames, ms: { ...(out.t ?? {}), job: Date.now() - t0 } } };
  }

  /** /run + statuspoll i stället för /runsync: en lång /runsync bryts av abort-timern mitt i
   *  en kallstart och då tappas jobb-id:t. Varm arbetare kostar detta ~0,3 s. */
  async #call(input) {
    const t0 = Date.now();
    let j = await this.#api("run", { method: "POST", body: JSON.stringify({ input }) });
    if (!j.id) throw new Error(`läppsynk: ${j.error ?? "inget jobb-id"}`);
    while (j.status !== "COMPLETED") {
      if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(j.status)) throw new Error(`läppsynk: ${j.output?.error ?? j.error ?? j.status}`);
      if (Date.now() > t0 + this.jobTimeoutMs) {
        this.#api(`cancel/${j.id}`, { method: "POST" }).catch(() => {});
        throw new Error("läppsynk: tidsgräns (kallstart?)");
      }
      await new Promise((r) => setTimeout(r, 250));
      j = await this.#api(`status/${j.id}`, {});
    }
    if (j.output?.error) throw new Error(`läppsynk: ${j.output.error}`);
    return j.output;
  }

  async #api(path, init, timeoutMs = 8000) {
    const r = await this.fetch(`https://api.runpod.ai/v2/${this.endpointId}/${path}`, {
      ...init,
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return r.json();
  }

  /** s16le mono-PCM → wav i minnet */
  static wav(pcm, rate) {
    const h = Buffer.alloc(44);
    h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8);
    h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
    h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32);
    h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([h, pcm]);
  }

  close() {
    if (this.tick) { clearInterval(this.tick); this.tick = null; }
    if (this.graceTimer) { clearTimeout(this.graceTimer); this.graceTimer = null; }
    for (const w of [this.session, this.nextSession, ...this.parked]) {
      if (w) { try { w.send(JSON.stringify({ t: "bye" })); w.close(); } catch {} }
    }
    this.session = null; this.nextSession = null; this.parked.clear();
    // en beställning som ligger i kön skulle annars starta en GPU mot en död adress
    if (this.wanted) { this.wanted = false; this.#cancelOrders(); }
  }
}

/** Publik adress till /lipsync-worker: SESSION_URL i miljön, annars den share.mjs skrev. */
export function sessionUrlFrom(urlFile) {
  return () => {
    const env = process.env.SESSION_URL;
    if (env) return env.replace(/\/+$/, "").replace(/\/lipsync-worker$/, "") + "/lipsync-worker";
    try {
      const u = readFileSync(urlFile, "utf8").trim();
      if (!u) return "";
      return u.replace(/^http/, "ws").replace(/\/+$/, "") + "/lipsync-worker";
    } catch { return ""; }
  };
}
