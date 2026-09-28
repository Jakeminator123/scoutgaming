// Astrid — utdelningsdemo, klient (bygger på demo 2.0).
//
// Scenen: stillbild + två <video> som växlar. Alla klipp (idle, prat, utdelning) börjar och slutar i
// startbilden, så ett byte vid klippgräns syns inte. Utdelningarna visar ett ritat kort (kort.js). När inget annat spelas går idle-klippen i en viktad
// slumpföljd så att Astrid lever. Svar och spelhändelser köas och spelas vid nästa klippgräns.
// Medan Astrid "tänker" startas ingen ny idle efter det pågående — svaret ska inte behöva vänta på ett
// helt idle-klipp. Blir tänkandet långt (kallstart) går idle igång igen.

import { createKort } from "/kort.js";

const $ = (s) => document.querySelector(s);
const A = $("#va"), B = $("#vb");
const logEl = $("#log"), caption = $("#caption"), statusEl = $("#status"), here = $("#here");
const thinkingEl = $("#thinking"), input = $("#input"), who = $("#who"), soundChip = $("#soundChip");

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
                set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

let manifest = { idle: [], repliker: [], deal: [] };
let me = "";
let unlocked = false;       // har besökaren rört sidan (ljud tillåtet)
const kort = createKort($("#stage"));

// ------------------------------------------------------------------ spelaren ---
const queue = [];           // { url, sound, text, kind }
let cur = null;             // synlig video
let loading = null;         // videon som laddar nästa klipp (blir cur när det startar)
let running = false;        // ett klipp spelas
let holdUntil = 0;          // ingen ny idle före denna tid (Astrid tänker)
let lastIdle = "";

function pickIdle() {
  const pool = manifest.idle.filter((c) => !(c.id === lastIdle && c.vikt < 10));   // aldrig samma gest två gånger i rad
  let r = Math.random() * pool.reduce((s, c) => s + c.vikt, 0);
  for (const c of pool) { if ((r -= c.vikt) <= 0) { lastIdle = c.id; return c; } }
  return pool[0];
}

function next() {
  let item = queue.shift();
  if (!item) {
    if (!manifest.idle.length || Date.now() < holdUntil) { running = false; return; }   // står på stillbilden
    const c = pickIdle();
    item = { url: c.url, sound: false, kind: "idle" };
  }
  running = true;
  play(item);
}

function play(item) {
  const v = cur === A ? B : A;
  loading = v;
  v.onended = v.oncanplay = v.onerror = null;
  v.muted = !(item.sound && unlocked);
  v.src = item.url;
  v.load();                                         // mobilen hämtar inte om src byts utan detta
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    v.play().then(() => {
      v.classList.add("on");
      if (cur && cur !== v) { cur.classList.remove("on"); cur.pause(); }
      cur = v;
      if (loading === v) loading = null;
      showCaption(item.text);
      if (item.kind === "answer" && !item.shown) { item.shown = true; render({ who: "astrid", text: item.text, ms: item.ms, lang: item.lang }); }
      if (item.kind === "deal") { kort.clear(); watchDeal(v, item); }
      if (item.sound && !unlocked) soundChip.hidden = false;
    }).catch(() => {
      // ljud nekades (ingen gest än) — spela tyst och erbjud ljud
      if (!v.muted) { v.muted = true; started = false; start(); soundChip.hidden = false; }
      else { v.onended = v.onerror = null; showCaption(null); setTimeout(next, 1000); }   // ingen snurr om uppspelning nekas helt
    });
  };
  const finish = () => {
    v.onended = v.onerror = null;
    showCaption(null);
    if (item.kind === "deal" && !item.dealt) { item.dealt = true; kort.show(item.card, item.kort); }
    next();
  };
  v.oncanplay = start;
  v.onended = finish;
  v.onerror = () => { if (item.kind !== "idle") sys("kunde inte spela klippet"); finish(); };
}

// Enkel visning (Emil 2026-09-25): kortet — valör och färg — visas först när det ligger på plats. Att låta valören
// följa kortet i handen redan när det vänds (kort.follow, verktyg/bygg-kortlage.py) fungerar men gjorde demot
// mer komplicerat än det behöver vara; true slår på det igen.
const FOLLOW_HAND = false;

/** Kortet ritas när klippets vita kort ligger stilla — styrt av exakt den bildruta som visas (requestVideoFrameCallback). */
function watchDeal(v, item) {
  const done = (t) => {
    if (item.dealt || v !== cur) return true;
    if (t < item.visas - 0.01) { if (FOLLOW_HAND) kort.follow(item.id, item.card, Math.round(t * 24)); return false; }
    item.dealt = true; kort.show(item.card, item.kort);
    return true;
  };
  if (v.requestVideoFrameCallback) {
    const cb = (_now, meta) => { if (!done(meta.mediaTime)) v.requestVideoFrameCallback(cb); };
    v.requestVideoFrameCallback(cb);
  } else {
    const tick = () => { if (!done(v.currentTime)) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
}

function enqueue(item) {
  queue.push(item);
  if (!running) next();
}

// Vakten: har vi stått still (tänkande) längre än hold-tiden, starta idle igen.
setInterval(() => { if (!running && Date.now() >= holdUntil) next(); }, 400);
// Vakt nummer två: ett klipp som står pausat mitt i (webbläsaren eller något annat pausade det) kommer aldrig till
// sitt slut — då får kön aldrig nästa klipp. Starta det igen.
let stuckSince = 0;
setInterval(() => {
  const stuck = running && cur && cur.paused && !cur.ended && cur.readyState >= 2 && loading !== cur;
  if (!stuck) { stuckSince = 0; return; }
  if (!stuckSince) { stuckSince = Date.now(); return; }
  if (Date.now() - stuckSince > 1200) { stuckSince = 0; cur.play().catch(() => { cur.muted = true; cur.play().catch(() => next()); }); }
}, 400);

function showCaption(text) {
  caption.textContent = text ?? "";
  caption.classList.toggle("on", Boolean(text));
}

// ------------------------------------------------------------------ ljud och grind ---
/** iOS knyter ljudrätten till element som spelats under en riktig gest — båda videorna låses upp här.
 *  Första tryckningen (var som helst) är också då Astrid hälsar: webbläsaren tillåter inget ljud före den, och
 *  hälsningen ska aldrig spelas tyst — rösten och munnen är hela poängen. */
function unlock() {
  if (unlocked) return;
  unlocked = true;
  soundChip.hidden = true;
  greet();
  // Den som spelar eller håller på att starta rörs inte: pausades den här (första tryckningen mitt i ett klippbyte)
  // kom aldrig något ended-event och Astrid stod still för gott (uppmätt 2026-09-25).
  for (const v of [A, B]) {
    v.muted = false;
    if (v === cur || v === loading) continue;
    if (v.paused && v.src) v.play().then(() => { if (v !== cur && v !== loading) v.pause(); }).catch(() => {});
  }
}

/** Hälsningen, bara för den som kom in: man kommer direkt in vid bordet, och Astrid hälsar vid första tryckningen. */
function greet() {
  // på besökarens språk om hälsningen finns inspelad på det, annars engelska; en av varianterna, slumpad
  const own = manifest.repliker_sprak?.[lang]?.filter((l) => l.event === "greeting");
  const gs = own?.length ? own : manifest.repliker.filter((l) => l.event === "greeting");
  const g = gs[Math.floor(Math.random() * gs.length)];
  if (g) enqueue({ url: g.url, sound: true, text: g.text, kind: "line" });
}
soundChip.addEventListener("click", () => {
  unlock();
  soundChip.hidden = true;
  if (cur) { cur.muted = false; cur.play().catch(() => {}); }
});
for (const ev of ["pointerdown", "keydown"]) document.addEventListener(ev, unlock, { passive: true });

// ------------------------------------------------------------------ chatten ---

function bubble(cls, html) {
  const near = logEl.scrollTop + logEl.clientHeight > logEl.scrollHeight - 80;
  const d = document.createElement("div");
  d.className = "msg " + cls;
  d.innerHTML = html;
  logEl.append(d);
  if (near) logEl.scrollTop = logEl.scrollHeight;
  return d;
}
function sys(t, cls = "sys") { const d = document.createElement("div"); d.className = cls; d.textContent = t; logEl.append(d); logEl.scrollTop = logEl.scrollHeight; }

const secs = (ms) => ms == null ? "–" : (ms / 1000).toFixed(1) + " s";
function metaLine(ms) {
  if (!ms) return "";
  const parts = ms.llm != null ? [`text ${secs(ms.llm)}`] : [];
  parts.push(`röst ${secs(ms.tts)}`, `läppsynk ${secs(ms.lipsync)}`, `totalt ${secs(ms.total)}`);
  return `<div class="meta">${parts.join(" · ")}</div>`;
}

const LANG_LABEL = { en: "EN", es: "ES", fr: "FR", zh: "中文" };
function render(m) {
  const tag = m.lang && m.lang !== "en" ? ` · ${LANG_LABEL[m.lang] ?? ""}` : "";
  if (m.who === "astrid") return bubble("her", `<span class="name">Astrid${tag}</span>${esc(m.text)}${metaLine(m.ms)}`);
  const mine = m.who === me;
  return bubble(mine ? "me" : "them", (mine ? "" : `<span class="name">${esc(m.who)}</span>`) + esc(m.text));
}

function setThinking(on, queued) {
  thinkingEl.textContent = on ? (queued ? `tänker · ${queued} i kö` : "tänker…") : (queued ? `${queued} i kö` : "");
  if (on) holdUntil = Math.max(holdUntil, Date.now() + 8000);   // max 8 s stillbild, sedan idle igen
  else holdUntil = Date.now() + 600;                             // svaret är på väg (kommer strax efter)
}

// ------------------------------------------------------------------ rummet ---
let ws, tries = 0;
function connect() {
  ws = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host);
  ws.onopen = () => { tries = 0; const n = store.get("astrid.name"); if (n) ws.send(JSON.stringify({ t: "name", name: n })); };
  ws.onmessage = (ev) => {
    const j = JSON.parse(ev.data);
    switch (j.t) {
      case "hello":
        me = j.name; if (!who.value) who.value = me;
        logEl.innerHTML = ""; j.log.forEach(render);
        if (!j.log.length) sys("Alla vid bordet delar samma chatt — svaret hörs för alla.");
        setThinking(j.thinking, j.queued);
        break;
      case "said": render(j); break;
      case "reply":   // texten är klar men visas först när hon säger den (se play())
        break;
      case "answer":  // svaret skrivs i chatten när klippet BÖRJAR spelas — text, röst och mun samtidigt
        enqueue({ url: j.url, sound: true, text: j.text, kind: "answer", ms: j.ms, lang: j.lang });
        break;
      case "play":    // förproducerat klipp för alla vid bordet: en utdelning eller en replik
        if (j.card) enqueue({ url: j.url, sound: false, kind: "deal", id: j.id, card: j.card, kort: j.kort, visas: j.visas });
        else enqueue({ url: j.url, sound: j.sound, text: j.text, kind: "event" });
        break;
      case "thinking": setThinking(j.on, j.queued); break;
      case "here": here.textContent = j.count === 1 ? "1 vid bordet" : `${j.count} vid bordet`; break;
      case "status": statusEl.textContent = j.text; statusEl.classList.toggle("on", Boolean(j.text)); break;
      case "error": sys(j.text, "err"); break;
    }
  };
  ws.onclose = () => { setThinking(false, 0); sys("tappade kontakten, återansluter…"); setTimeout(connect, Math.min(800 * ++tries, 5000)); };
  ws.onerror = () => { try { ws.close(); } catch {} };
}

who.addEventListener("change", () => {
  const n = who.value.trim().slice(0, 18);
  if (!n) return;
  store.set("astrid.name", n);
  if (ws?.readyState === 1) ws.send(JSON.stringify({ t: "name", name: n }));
});
$("#form").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || ws?.readyState !== 1) return;
  unlock();
  input.value = "";
  ws.send(JSON.stringify({ t: "say", text, lang }));
});

// ------------------------------------------------------------------ språk ---
// Språket Astrid svarar på: väljs per besökare (sparas i webbläsaren) och följer med varje fråga. Chatten är
// gemensam — svaret hörs för alla, på frågeställarens språk. Förinspelade repliker och hälsningen är på engelska.
const LANG_PH = { en: "Säg något till Astrid…", es: "Säg något — Astrid svarar på spanska…",
                  fr: "Säg något — Astrid svarar på franska…", zh: "Säg något — Astrid svarar på kinesiska…" };
let lang = LANG_LABEL[store.get("astrid.lang")] ? store.get("astrid.lang") : "en";
function setLang(l) {
  lang = l;
  store.set("astrid.lang", l);
  for (const b of document.querySelectorAll(".lang-bar [data-lang]")) b.setAttribute("aria-checked", String(b.dataset.lang === l));
  input.placeholder = LANG_PH[l];
}
for (const b of document.querySelectorAll(".lang-bar [data-lang]")) b.addEventListener("click", () => { setLang(b.dataset.lang); input.focus(); });
setLang(lang);

// ------------------------------------------------------------------ spelhändelser ---
// Replikerna syns direkt (alla demots funktioner på en gång) — utom på mobil, där panelen skulle täcka bordet
// där korten landar; där öppnas de med knappen.
if (matchMedia("(max-width: 820px)").matches) { $("#events").hidden = true; $("#toggleEvents").setAttribute("aria-expanded", "false"); }
$("#toggleEvents").addEventListener("click", (e) => {
  const open = $("#events").hidden;
  $("#events").hidden = !open;
  e.currentTarget.setAttribute("aria-expanded", String(open));
});

function eventButtons() {
  // en knapp per spelhändelse — servern slumpar bland varianterna (aldrig samma två gånger i rad)
  const ev = manifest.handelser ?? Object.fromEntries(manifest.repliker.map((l) => [l.id, { handelse: l.handelse, varianter: [l.id] }]));
  $("#lines").innerHTML = Object.entries(ev).map(([id, e]) =>
    `<button data-id="${esc(id)}" title="${e.varianter.length} varianter">${esc(id)}<small>${esc(e.handelse ?? "används inte i spelet")}</small></button>`).join("");
  for (const b of document.querySelectorAll(".grid button")) b.addEventListener("click", () => sendEvent(b.dataset.id));
}

// Repliken spelas på språket den som klickar valt (om den finns inspelad på det) — för alla vid bordet.
function sendEvent(id) { unlock(); if (ws?.readyState === 1) ws.send(JSON.stringify({ t: "event", id, lang })); }

// ------------------------------------------------------------------ utdelning ---
// En knapp per plats, i samma ordning som på bordet (plats 1 längst till vänster), dealern överst.
// "Dela en runda": som vid ett riktigt bord — plats 7 (dealerns vänster) till 1, sist dealern.
function dealButtons() {
  const has = (id) => manifest.deal.some((d) => d.id === id);
  const seat = (n) => has(`deal_pos${n}`) ? `<button class="seat s${n}" data-deal="deal_pos${n}"><b>${n}</b><small>Plats</small></button>` : "";
  $("#dealPad").innerHTML =
    `<div class="pad-dealer">${has("deal_posdealer") ? `<button class="seat dealer" data-deal="deal_posdealer"><b>Dealer</b></button>` : ""}</div>` +
    `<div class="pad-seats">${[1, 2, 3, 4, 5, 6, 7].map(seat).join("")}</div>`;
  for (const b of document.querySelectorAll("[data-deal]")) b.addEventListener("click", () => sendEvent(b.dataset.deal));
  $("#dealRound").onclick = () => { for (const id of ["7", "6", "5", "4", "3", "2", "1", "dealer"].map((s) => `deal_pos${s}`).filter(has)) sendEvent(id); };
}

// ------------------------------------------------------------------ start ---
fetch("/api/clips").then((r) => r.json()).then((m) => {
  manifest = m;
  eventButtons();
  dealButtons();
  if (FOLLOW_HAND) kort.load();
  next();
  if (unlocked) greet();   // tryckte redan innan klipplistan kom
  // Förhämta ETT klipp i taget (idle först, sedan utdelningarna): över en tunnel från en hemdator räcker
  // bandbredden inte till allt på en gång, och parallell förhämtning strypte klippen som skulle spelas nu.
  (async () => { for (const u of [...m.idle.map((c) => c.url), ...m.deal.map((d) => d.url)]) await fetch(u).then((r) => r.blob()).catch(() => {}); })();
}).catch(() => sys("kunde inte läsa klipplistan", "err"));
connect();
