// Gränssnittet: satsningsbordet B3v2 (metodik/design/ui/roulette-satsbord.html) gjort interaktivt, plus hjulvyns bricka och list.
// Markerna läggs där en croupier lägger dem: mitt i fältet, på linjen (delning), i korset (hörn), på underkanten (gata/sexrad).
// Klicket översätts till motorns satsnings-id (BET_BY_ID) ur var på fältet man träffar: nära en linje = delning, nära ett kors =
// hörn, nära underkanten = gata, underkant + linje = sexrad, mot nollan = delning/trio/första fyra.
import { WHEEL, pocketColor, LIMITS as MOTORNS, BET_BY_ID, BETS, retur, etikett, fargOrd } from "./regler.mjs";
import { FARGER } from "./konfig.mjs";
import { sprak } from "./text.mjs";

// texterna och talformatet (js/text.mjs); skapaUI byter till bordets språk
let { t: T, fmt, kort, betNamn } = sprak("en");
const FV = Object.entries(FARGER).map(([v, c]) => [+v, c]).sort((a, b) => a[0] - b[0]);
const valorFarg = (b) => [...FV].reverse().find(([v]) => b >= v)?.[1] ?? FV[0][1];
function marker(b, extra = "", stil = "", attr = "") {
  const c = valorFarg(b), txt = b >= 1000 ? (b % 1000 ? (b / 1000).toFixed(1).replace(".", ",") : b / 1000) + "k" : String(b);
  const lang = txt.length > 3 ? " langre" : txt.length > 2 ? " lang" : "";
  return `<span class="marker${c === "#e9e2d0" ? " ljus" : ""}${lang}${extra}"${attr} style="--c:${c};${stil}">${txt}</span>`;
}
const svg = (p) => `<svg viewBox="0 0 24 24">${p}</svg>`;
const LJUD_PA = '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/>';
const LJUD_AV = '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>';
const IK = { ljud: LJUD_PA,
  inst: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  hist: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>', hjalp: '<circle cx="12" cy="12" r="8"/><path d="M9.8 9.5a2.3 2.3 0 1 1 3 2.2c-.6.3-.8.7-.8 1.3M12 16h.01"/>',
  hel: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>' };
const IKTITEL = () => ({ ljud: T.sound, inst: T.settings, hist: T.stats, hjalp: T.rules, hel: T.fullscreen });
// 100 rundors historik till statistiken: de kända senaste numren plus en fast (seedad) följd bakåt
function utokaHistorik(h) {
  let a = 2026; const ut = [...h];
  while (ut.length < 100) { a = (a * 1103515245 + 12345) >>> 0; ut.push((a >>> 8) % 37); }
  return ut;
}
const KVAL = "roulette.kvalitet";
const lasKval = () => { try { return localStorage.getItem(KVAL) ?? "hog"; } catch { return "hog"; } };
const ANGRA = '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>';
const RENSA = '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>';
const PJAS_SVG = `<svg viewBox="0 0 64 100"><defs>
  <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d8"/><stop offset=".4" stop-color="#ecc97e"/><stop offset=".75" stop-color="#a87b33"/><stop offset="1" stop-color="#f3d896"/></linearGradient>
  <linearGradient id="ph" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5e3f12"/><stop offset=".28" stop-color="#f8e4ac"/><stop offset=".52" stop-color="#cf9f4c"/><stop offset=".8" stop-color="#8d6526"/><stop offset="1" stop-color="#4a3010"/></linearGradient>
  <linearGradient id="kv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c3cad6"/><stop offset="1" stop-color="#5d6474"/></linearGradient>
  <linearGradient id="km" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f6f0e2"/><stop offset="1" stop-color="#cdbf9f"/></linearGradient>
  <linearGradient id="kh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e1e5ec"/><stop offset="1" stop-color="#8b8f9a"/></linearGradient>
  <linearGradient id="gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <clipPath id="kropp"><path d="M17 84 20 52 44 52 47 84ZM17 46 20 34 26 26 32 24 38 26 44 34 47 46Z"/></clipPath></defs>
  <path d="M6 86v7a26 7.5 0 0 0 52 0v-7Z" fill="url(#ph)"/><ellipse cx="32" cy="86" rx="26" ry="7.5" fill="url(#pg)"/>
  <ellipse cx="32" cy="85.5" rx="17" ry="4.6" fill="#7a561c" opacity=".55"/>
  <path d="M17 84 20 52 27 50 26 86Z" fill="url(#kv)"/><path d="M26 86 27 50 37 50 38 86Z" fill="url(#km)"/><path d="M38 86 37 50 44 52 47 84Z" fill="url(#kh)"/>
  <path d="M31 53v31" stroke="#e6c88a" stroke-width="2.2" opacity=".75"/><path d="M22 56 21 80M42 56 43 80" stroke="#fff" stroke-opacity=".6" stroke-width=".8"/>
  <path d="M16 46v6a16 4.5 0 0 0 32 0v-6Z" fill="url(#ph)"/><ellipse cx="32" cy="46" rx="16" ry="4.5" fill="url(#pg)"/>
  <path d="M17 46 20 34 26 26 32 24 27 46Z" fill="url(#kv)"/><path d="M27 46 32 24 37 46Z" fill="url(#km)"/><path d="M37 46 32 24 38 26 44 34 47 46Z" fill="url(#kh)"/>
  <path d="M20 34 44 34M26 26 38 26" stroke="#fff" stroke-opacity=".65" stroke-width=".7"/>
  <circle cx="32" cy="20.5" r="4.2" fill="url(#pg)"/><circle cx="30.6" cy="19.2" r="1.3" fill="#fff" opacity=".85"/>
  <g clip-path="url(#kropp)"><rect class="glint" x="-30" y="0" width="22" height="100" fill="url(#gl)" transform="skewX(-18)"/></g>
  <path d="M26 29l1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2-3.2-1.3 3.2-1.3Z" fill="#fff"/><path d="M41 62l.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9Z" fill="#fff" opacity=".9"/>
  <path d="M17 84 20 52 27 50 37 50 44 52 47 84M17 46 20 34 26 26 32 24 38 26 44 34 47 46" fill="none" stroke="#4b3a22" stroke-opacity=".5" stroke-width=".8"/></svg>`;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const egenskaper = (n) => { const [f, ...r] = T.props(n).split(" · "); return `<b>${f}</b>${r.length ? " · " + r.join(" · ") : ""}`; };

// bordVal: gränser (min, maxPerBet, maxTotal), valörer, saldo vid påfyllning, bordets och dealerns namn (js/bord.mjs)
export function skapaUI(rot, { saldo, historik, nar, klocka, spela, ljud, kvalitet, pjasBild, bordVal = {} }) {
  ({ t: T, fmt, kort, betNamn } = sprak(bordVal.lang ?? "en"));
  const LIMITS = bordVal.granser ?? MOTORNS, VALORER = (bordVal.chips ?? [1, 5, 25, 100, 500]).map((v) => [v, valorFarg(v)]);
  const PAFYLLNING = bordVal.balance ?? saldo;
  const S = { saldo, historik: utokaHistorik(historik), insatser: new Map(), angra: [], senaste: null, vald: 25, fas: "satsa", resultat: null };
  const pling = (typ, d) => ljud?.spela(typ, d);
  rot.innerHTML = `
    <div class="abs titel"><div class="logo">${esc(bordVal.namn ?? "Roulette")} <b>·</b> ${esc(bordVal.dealerNamn ?? "Astrid")}</div><div class="grans glas">${T.limits(kort(LIMITS.min), kort(LIMITS.maxPerBet), kort(LIMITS.maxTotal))}</div></div>
    <div class="abs ikoner">${Object.entries(IK).map(([k, p]) => `<button class="glas" data-ikon="${k}" title="${IKTITEL()[k]}">${svg(p)}</button>`).join("")}</div>
    <div class="abs historik glas"><em>${T.last}</em><span class="hn" style="display:contents"></span></div>
    <div class="abs planbok glas"><div><small>${T.balance}</small><strong class="saldo"></strong></div><div><small>${T.totalBet}</small><strong class="insats"></strong></div></div>
    <div class="abs besked glas dold"><span class="btext"></span><button class="fyll" data-gor="fyll">${T.topUp(fmt(PAFYLLNING))}</button></div>
    <div class="vyS1">
      <div class="persp"><div class="kant2"></div><div class="filt2"><div class="bord"></div></div></div>
      <div class="abs glas markerrad"><div class="verktyg">
        <div class="grupp">
          <button class="knapp" data-gor="angra" title="${T.undo}"><i>${svg(ANGRA)}</i></button>
          ${VALORER.map(([v]) => `<button class="valor" data-valor="${v}" title="${T.chip(v)}">${marker(v)}</button>`).join("")}
          <button class="knapp" data-gor="dubbla" title="${T.double}"><i>×2</i></button>
          <button class="knapp" data-gor="rensa" title="${T.clear}"><i>${svg(RENSA)}</i></button>
        </div>
        <button class="spela" data-gor="spela">${T.play}</button>
      </div></div>
      <div class="utbetalning"></div>
    </div>
    <div class="vyHjul dold"><div class="abs insatsbar glas"><em>${T.yourBets}</em><div class="poster"></div><div class="stopp">${T.noMoreBets}</div></div></div>
    <div class="lagerVinst"></div>
    <div class="paneler dold"><div class="panel glas" role="dialog"><button class="stang" data-gor="stang" title="${T.close}">×</button><div class="pinne"></div></div></div>`;
  const $ = (s) => rot.querySelector(s), $$ = (s) => [...rot.querySelectorAll(s)];
  const bord = $(".bord");
  // ---------- bordet ----------
  let c = `<b class="f n z" data-n="0" data-bet="straight-0" style="grid-row:1/4;grid-column:1">0</b>`;
  for (let rad = 0; rad < 3; rad++) for (let k = 0; k < 12; k++) {
    const n = k * 3 + (3 - rad);
    c += `<b class="f n ${pocketColor(n) === "red" ? "r" : "k"}" data-n="${n}" data-bet="straight-${n}" style="grid-row:${rad + 1};grid-column:${k + 2}">${n}</b>`;
  }
  for (let rad = 0; rad < 3; rad++) c += `<b class="f s" data-bet="column-${3 - rad}" style="grid-row:${rad + 1};grid-column:14">2:1</b>`;
  T.dozens.forEach((t, i) => c += `<b class="f d" data-bet="dozen-${i + 1}" style="grid-row:4;grid-column:${2 + i * 4}/span 4">${t}</b>`);
  [["low", T.low], ["even", T.even], ["red", '<i class="ruta rod"></i>'], ["black", '<i class="ruta svart"></i>'], ["odd", T.odd], ["high", T.high]]
    .forEach(([id, t], i) => c += `<b class="f o" data-bet="${id}" style="grid-row:5;grid-column:${2 + i * 2}/span 2">${t}</b>`);
  bord.innerHTML = c + `<div class="lager"></div><div class="klick"></div>`;
  const lager = $(".lager"), cell = (n) => bord.querySelector(`[data-n="${n}"]`), falt = (id) => bord.querySelector(`.f[data-bet="${id}"]`);
  const rekt = (e) => ({ x: e.offsetLeft, y: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight });
  const mitt = (e) => [e.offsetLeft + e.offsetWidth / 2, e.offsetTop + e.offsetHeight / 2];

  // klickpunkt (i bordets eget plan) → satsnings-id
  function traffa(x, y) {
    const e = [...bord.querySelectorAll(".f")].find((f) => { const r = rekt(f); return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; });
    if (!e) return null;
    const n = e.dataset.n !== undefined ? +e.dataset.n : null;
    if (e.classList.contains("d") && (y - e.offsetTop) / e.offsetHeight < 0.2) return traffa(x, e.offsetTop - 1);   // linjen mot raden ovanför: gata/sexrad
    if (n === 0 && x > e.offsetLeft + e.offsetWidth * 0.88) return traffa(e.offsetLeft + e.offsetWidth + 1, y);   // nollans kant: delning/trio/första fyra
    if (n === null || n === 0) return e.dataset.bet;
    const r = rekt(e), rx = (x - r.x) / r.w, ry = (y - r.y) / r.h, E = 0.24;
    const k = Math.floor((n - 1) / 3), rad = 2 - ((n - 1) % 3);
    const L = rx < E, R = rx > 1 - E, T = ry < E && rad > 0, B = ry > 1 - E;
    const nr = (kk, rr) => kk * 3 + (3 - rr);
    if (B && rad === 2) {                                            // underkanten mot dussinen: gata eller sexrad
      if (L) return k === 0 ? "first-four" : `line-${nr(k - 1, 2)}`;
      if (R && k < 11) return `line-${nr(k, 2)}`;
      return `street-${nr(k, 2)}`;
    }
    const kk = L ? k - 1 : R ? k + 1 : null, rr = T ? rad - 1 : B ? rad + 1 : null;
    if (kk !== null && kk > 11) return rr !== null ? `split-${Math.min(n, nr(k, rr))}-${Math.min(n, nr(k, rr)) + 1}` : `straight-${n}`;
    if (kk !== null && rr !== null) {
      if (kk < 0) return Math.max(rad, rr) === 2 ? "trio-1" : "trio-2";
      return `corner-${nr(Math.min(k, kk), Math.max(rad, rr))}`;
    }
    if (kk !== null) return kk < 0 ? `split-0-${n}` : `split-${Math.min(n, nr(kk, rad))}-${Math.min(n, nr(kk, rad)) + 3}`;
    if (rr !== null) { const a = Math.min(n, nr(k, rr)); return `split-${a}-${a + 1}`; }
    return `straight-${n}`;
  }
  // markerns plats för ett id (i bordets plan)
  function plats(id) {
    const t = BET_BY_ID[id].numbers, ch = 42, f = falt(id);
    if (f) {
      let [x, y] = mitt(f);
      if (id === "straight-0") y = f.offsetTop + f.offsetHeight * 0.76;
      else if (/^(dozen|low|high|even|odd|red|black)/.test(id)) x = f.offsetLeft + f.offsetWidth - ch * 0.62 - 2;
      return [x, y];
    }
    if (t.includes(0)) {
      const z = cell(0), x = z.offsetLeft + z.offsetWidth, ys = t.filter((n) => n).map((n) => mitt(cell(n))[1]);
      return [x, id === "first-four" ? cell(1).offsetTop + cell(1).offsetHeight : (Math.min(...ys) + Math.max(...ys)) / 2];
    }
    if (/^(street|line)/.test(id)) { const e = cell(t[0]); return [(mitt(e)[0] + mitt(cell(t[t.length - 1]))[0]) / 2, e.offsetTop + e.offsetHeight]; }
    const p = t.map((n) => mitt(cell(n)));
    return [p.reduce((s, v) => s + v[0], 0) / p.length, p.reduce((s, v) => s + v[1], 0) / p.length];
  }
  const totalt = () => [...S.insatser.values()].reduce((a, b) => a + b, 0);
  let nyId = null;
  function ritaMarker() {
    const ut = [...S.insatser].map(([id, b]) => { const [x, y] = plats(id); return [y, x, id, b]; }).sort((a, b) => a[0] - b[0]);
    const N = S.resultat;
    lager.querySelectorAll(".marker").forEach((m) => m.remove());
    lager.insertAdjacentHTML("afterbegin", ut.map(([y, x, id, b]) => marker(b,
      (N !== null && S.fas === "vinst" ? (BET_BY_ID[id].numbers.includes(N) ? " vann" : " forlorade") : "") + (id === nyId ? " ny" : ""),
      `left:${x}px;top:${y}px`, ` data-bet="${id}"`)).join(""));
    nyId = null;
    $(".insats").textContent = fmt(totalt());
    if (S.fas === "satsa") visaSaldo(S.saldo - totalt());
    const rp = [...S.insatser].sort((a, b) => b[1] - a[1]);
    $(".insatsbar .poster").innerHTML = rp.slice(0, 3).map(([id, b]) => `<span>${betNamn(id)} <b>${kort(b)}</b></span>`).join("") +
      (rp.length > 3 ? `<span>+${rp.length - 3}</span>` : "");
    knappar();
  }
  function knappar() {
    const satsa = S.fas === "satsa" || S.fas === "klar";
    $(".grupp").classList.toggle("av", !satsa);
    $('[data-gor="angra"]').classList.toggle("av", !S.angra.length || S.fas !== "satsa");
    $('[data-gor="rensa"]').classList.toggle("av", !S.insatser.size || S.fas !== "satsa");
    $('[data-gor="dubbla"]').classList.toggle("av", !S.insatser.size || S.fas !== "satsa");
    const sp = $(".spela");
    sp.classList.toggle("av", !satsa); sp.classList.remove("tom");
    if (S.fas === "klar") sp.textContent = S.senaste ? T.repeat : T.play;
    else if (satsa) { sp.textContent = T.play; if (!S.insatser.size) sp.classList.add("tom"); }
    else if (S.fas === "landat" || S.fas === "vinst") sp.textContent = `${S.resultat} · ${T.colorWord(S.resultat)}`;
    else sp.textContent = T.noMoreShort;
    $$(".valor .marker").forEach((m, i) => m.classList.toggle("vald", VALORER[i][0] === S.vald));
    if (S.fas === "satsa") visaSaldo(S.saldo - totalt());
    const ledigt = ledigtSaldo();
    $$(".valor").forEach((b, i) => { const av = satsa && VALORER[i][0] > ledigt; b.classList.toggle("av", av); b.title = av ? T.chipNoFunds(VALORER[i][0]) : T.chip(VALORER[i][0]); });
    if (satsa && VALORER[VALORER.findIndex(([v]) => v === S.vald)][0] > ledigt) {   // vald valör går inte: närmaste mindre
      const ok = [...VALORER].reverse().find(([v]) => v <= ledigt); if (ok) { S.vald = ok[0]; $$(".valor .marker").forEach((m, i) => m.classList.toggle("vald", VALORER[i][0] === S.vald)); }
    }
    const slut = satsa && S.saldo < LIMITS.min && !S.insatser.size;
    $(".besked").classList.toggle("tomt", slut);
    if (slut) visaBesked(T.outOfFunds, true); else if (beskedVarSlut) dolj();
  }
  // det som går att lägga till: saldo minus lagda marker (efter en runda börjar nästa satsning från noll), inom bordets max
  const ledigtSaldo = () => S.fas === "klar" ? Math.min(S.saldo, LIMITS.maxTotal) : Math.min(S.saldo - totalt(), LIMITS.maxTotal - totalt());
  // besked till spelaren (gränser, saldo): en kort skylt ovanför markerraden; statusen i övrigt syns på knappen och brickan
  let beskedVarSlut = false;
  function visaBesked(t, kvar = false) {
    const b = $(".besked"); $(".btext").textContent = t; b.classList.remove("dold", "ny"); void b.offsetWidth; b.classList.add("ny");
    beskedVarSlut = kvar; clearTimeout(tipsTimer); if (!kvar) tipsTimer = setTimeout(dolj, 2400);
  }
  function dolj() { beskedVarSlut = false; $(".besked").classList.add("dold"); }
  const sag = () => {};
  function visaSaldo(v, upp = false) { const e = $(".saldo"); e.textContent = fmt(v); e.classList.toggle("upp", upp); }
  function ritaHistorik(ny = false) {
    $(".hn").innerHTML = S.historik.slice(0, 12).map((n, i) => `<i class="${pocketColor(n)}${ny && i === 0 ? " senast" : ""}">${n}</i>`).join("");
  }
  // ---------- satsa ----------
  let tipsTimer = null;
  function tips(t) { visaBesked(t); }
  function sparaAngra() { S.angra.push(new Map(S.insatser)); if (S.angra.length > 60) S.angra.shift(); }
  function nyttBord() {                                               // efter en runda: sopa bordet innan nästa satsning
    if (S.fas !== "klar") return;
    S.fas = "satsa"; S.resultat = null; S.insatser.clear(); S.angra = [];
    bord.classList.remove("vinst");
    bord.querySelectorAll(".vinnare,.traff,.landad").forEach((e) => e.classList.remove("vinnare", "traff", "landad"));
    rot.querySelectorAll(".pjas,.pjasskugga,.pjaskontakt,.vstapel,.belopp").forEach((e) => { e.classList.add("bort"); setTimeout(() => e.remove(), 450); });
    const vk = rot.querySelector(".vinstkort"); if (vk) { vk.classList.add("bort"); setTimeout(() => vk.remove(), 400); }

  }
  function lagg(id, belopp) {
    nyttBord();
    if (S.fas !== "satsa") return;
    const nu = S.insatser.get(id) ?? 0, tot = totalt();
    if (belopp > S.saldo - tot) { tips(S.saldo - tot < LIMITS.min ? T.noFunds : T.noFundsFor(kort(belopp))); return; }
    const b = Math.min(belopp, LIMITS.maxPerBet - nu, LIMITS.maxTotal - tot);   // fältets och bordets max: fyll upp till gränsen
    if (b < LIMITS.min) { tips(nu >= LIMITS.maxPerBet ? T.maxPerBet(kort(LIMITS.maxPerBet)) : T.maxTotal(kort(LIMITS.maxTotal))); return; }
    sparaAngra(); S.insatser.set(id, nu + b); nyId = id; pling("marker", { valor: b });
    if (b < belopp) tips(T.capped(kort(nu + b)));
    ritaMarker();
  }
  let upprepadVid = -1e9;
  function gor(vad) {
    if (vad === "fyll") { S.saldo += PAFYLLNING; pling("marker", { valor: 500 }); visaSaldo(S.saldo - (S.fas === "satsa" ? totalt() : 0)); sag("Lägg din insats"); knappar(); return; }
    if (vad === "stang") { stangPanel(); return; }
    if (vad === "spela") {
      if (S.fas === "klar" && S.senaste) {                          // UPPREPA: samma insatser igen
        nyttBord();
        const sum = [...S.senaste.values()].reduce((a, b) => a + b, 0);
        if (sum > S.saldo) { tips(T.noFundsRepeat); ritaMarker(); return; }
        sparaAngra(); S.insatser = new Map(S.senaste); ritaMarker(); pling("marker", { valor: 100 }); upprepadVid = performance.now(); return;
      }
      if (S.fas !== "satsa" || !S.insatser.size) return;
      if (performance.now() - upprepadVid < 450) return;              // dubbelklick på UPPREPA startar inte rundan
      const sum = totalt();
      if (sum > S.saldo) { tips(T.noFunds); return; }
      S.senaste = new Map(S.insatser); S.saldo -= sum; S.fas = "las";
      visaSaldo(S.saldo); sag("Inga fler insatser"); bord.classList.add("las"); hover(null); knappar();
      spela([...S.insatser].map(([id, amount]) => ({ id, amount })));
      return;
    }
    if (S.fas !== "satsa") return;
    if (vad === "angra" && S.angra.length) { S.insatser = S.angra.pop(); ritaMarker(); pling("mjuk"); }
    if (vad === "rensa" && S.insatser.size) { sparaAngra(); S.insatser.clear(); ritaMarker(); pling("mjuk"); }
    if (vad === "dubbla" && S.insatser.size) {
      const fore = new Map(S.insatser), sum = totalt();
      if (sum * 2 > Math.min(LIMITS.maxTotal, S.saldo)) { tips(sum * 2 > LIMITS.maxTotal ? T.maxTotal(kort(LIMITS.maxTotal)) : T.noFunds); return; }
      if ([...fore.values()].some((b) => b * 2 > LIMITS.maxPerBet)) { tips(T.maxPerBet(kort(LIMITS.maxPerBet))); return; }
      sparaAngra(); for (const [id, b] of fore) S.insatser.set(id, b * 2); ritaMarker(); pling("marker", { valor: 100 });
    }
  }
  // klick och hovring på bordet: offsetX/Y är i bordets eget plan även genom perspektivet
  const klick = $(".klick");
  let hovId = null;
  function hover(id) {
    if (id === hovId) return; hovId = id;
    bord.querySelectorAll(".hov").forEach((e) => e.classList.remove("hov"));
    if (!id) return;
    const f = falt(id);
    if (f && !f.dataset.n) f.classList.add("hov");                    // yttre fältet självt (kolumn, dussin, röd, udda …)
    for (const n of BET_BY_ID[id].numbers) cell(n).classList.add("hov");   // och exakt numren som ingår, som för ett rakt nummer
  }
  klick.addEventListener("pointermove", (e) => hover(S.fas === "satsa" || S.fas === "klar" ? traffa(e.offsetX, e.offsetY) : null));
  klick.addEventListener("pointerleave", () => hover(null));
  klick.addEventListener("click", (e) => { const id = traffa(e.offsetX, e.offsetY); if (id) lagg(id, S.vald); });
  rot.addEventListener("click", (e) => {
    if (e.target.classList.contains("paneler")) { stangPanel(); return; }            // klick utanför panelen
    const v = e.target.closest("[data-valor]"); if (v) { if (!v.classList.contains("av")) { S.vald = +v.dataset.valor; knappar(); } return; }
    const g = e.target.closest("[data-gor]"); if (g) { gor(g.dataset.gor); return; }
    const ik = e.target.closest("[data-ikon]"); if (ik) ikon(ik.dataset.ikon);
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") { stangPanel(); return; }
    if (oppen) return;                                                // panelen har tangentbordet
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) { gor("angra"); e.preventDefault(); }
    else if (e.key === " " || e.key === "Enter") { if (e.repeat) return; gor("spela"); e.preventDefault(); document.activeElement?.blur?.(); }
  });
  // ---------- topplistans knappar och panelerna ----------
  let oppen = null;
  function visaLjudIkon() { const b = $('[data-ikon="ljud"]'); b.innerHTML = svg(ljud?.pa === false ? LJUD_AV : LJUD_PA); b.classList.toggle("avstangd", ljud?.pa === false); b.setAttribute("aria-pressed", String(ljud?.pa !== false)); }
  function ikon(k) {
    if (k === "ljud") { ljud?.satt({ pa: !ljud.pa }); visaLjudIkon(); return; }
    if (k === "hel") { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {}); return; }
    if (oppen === k) { stangPanel(); return; }
    oppnaPanel(k);
  }
  function stangPanel() { if (!oppen) return; oppen = null; $(".paneler").classList.add("dold"); $$("[data-ikon]").forEach((b) => b.classList.remove("aktiv")); }
  function oppnaPanel(k) {
    oppen = k; const p = $(".pinne");
    p.innerHTML = k === "hjalp" ? panelRegler() : k === "hist" ? panelStatistik() : panelInstallningar();
    $(".paneler").classList.remove("dold");
    $$("[data-ikon]").forEach((b) => b.classList.toggle("aktiv", b.dataset.ikon === k));
    if (k === "inst") {
      const vol = p.querySelector('[name="volym"]');
      vol.addEventListener("input", () => { ljud?.satt({ volym: +vol.value / 100, pa: true }); visaLjudIkon(); p.querySelector(".volv").textContent = vol.value + "%"; });
      p.querySelector('[name="ljudpa"]').addEventListener("change", (e) => { ljud?.satt({ pa: e.target.checked }); visaLjudIkon(); });
      for (const r of p.querySelectorAll('[name="kval"]')) r.addEventListener("change", () => { try { localStorage.setItem(KVAL, r.value); } catch {} kvalitet?.(r.value); });
    }
  }
  function panelRegler() {
    const typ = (t, id) => { const b = BETS.find((x) => x.type === t && (!id || x.id === id)); return [b.numbers.length, b.payout]; };
    const rader = [["straight"], ["split"], ["street"], ["trio"], ["corner", "corner-1"], ["corner", "first-four"], ["line"], ["dozen"], ["column"], ["outside"]]
      .map((r, i) => [T.rulesRows[i], ...r]);
    return `<h2>${T.rulesTitle}</h2><p class="ingress">${T.rulesIntro(kort(LIMITS.min), kort(LIMITS.maxPerBet), kort(LIMITS.maxTotal))}</p>
      <table><thead><tr>${T.rulesHead.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>
      ${rader.map(([n, t, id]) => { const [k, p] = typ(t, id); return `<tr><td>${n}</td><td>${k}</td><td>${p}:1</td></tr>`; }).join("")}</tbody></table>
      <p class="not">${T.rulesNote}</p>`;
  }
  function panelStatistik() {
    const h = S.historik.slice(0, 100), n = h.length, ant = Array(37).fill(0); h.forEach((x) => ant[x]++);
    const ord = [...ant.keys()].sort((a, b) => ant[b] - ant[a] || a - b), het = ord.slice(0, 5), kall = ord.slice(-5).reverse();
    const p = (f) => Math.round((h.filter(f).length / n) * 100);
    const stapel = (namn, delar) => `<div class="fordel"><span>${namn}</span><div class="bar">${delar.map(([v, kl, t]) => `<i class="${kl}" style="width:${v}%">${v >= 9 ? `${t} ${v}%` : ""}</i>`).join("")}</div></div>`;
    const kula = (x) => `<span class="kn ${pocketColor(x)}">${x}<small>${ant[x]}</small></span>`;
    return `<h2>${T.statsTitle}</h2><p class="ingress">${T.statsIntro(n)}</p>
      <div class="hk"><div><h3>${T.hot}</h3>${het.map(kula).join("")}</div><div><h3>${T.cold}</h3>${kall.map(kula).join("")}</div></div>
      ${stapel(T.colour, [[p((x) => pocketColor(x) === "red"), "rod", T.red], [p((x) => x === 0), "noll", "0"], [p((x) => pocketColor(x) === "black"), "svart", T.black]])}
      ${stapel(T.oddEven, [[p((x) => x && x % 2), "udda", T.odd], [p((x) => x === 0), "noll", "0"], [p((x) => x && x % 2 === 0), "jamnt", T.even]])}
      ${stapel(T.lowHigh, [[p((x) => x && x <= 18), "lag", "1–18"], [p((x) => x === 0), "noll", "0"], [p((x) => x >= 19), "hog", "19–36"]])}
      <div class="senaste100">${h.slice(0, 100).map((x) => `<i class="${pocketColor(x)}">${x}</i>`).join("")}</div>`;
  }
  function panelInstallningar() {
    const v = Math.round((ljud?.volym ?? 0.7) * 100), k = lasKval();
    return `<h2>${T.settingsTitle}</h2>
      <label class="rad"><span>${T.soundLbl}</span><input type="checkbox" name="ljudpa" ${ljud?.pa !== false ? "checked" : ""}></label>
      <label class="rad"><span>${T.volume}</span><input type="range" name="volym" min="0" max="100" value="${v}"><b class="volv">${v}%</b></label>
      <div class="rad"><span>${T.quality}</span><label class="val"><input type="radio" name="kval" value="hog" ${k !== "lag" ? "checked" : ""}> ${T.qHigh}</label>
        <label class="val"><input type="radio" name="kval" value="lag" ${k === "lag" ? "checked" : ""}> ${T.qLow}</label></div>
      <p class="not">${T.saved}</p>`;
  }
  // ---------- pjäsen och vinsten ----------
  const scenSkala = () => { const s = rot.closest("#scen"); return { r: s.getBoundingClientRect(), k: s.getBoundingClientRect().width / 1920 }; };
  function stallPjas(n) {
    const [x, y] = mitt(cell(n));
    lager.insertAdjacentHTML("beforeend", `<span class="pjasskugga" style="left:${x + 34}px;top:${y + 30}px"></span>
      <span class="pjaskontakt" style="left:${x + 2}px;top:${y + 3}px"></span><span class="pjasfot" style="left:${x}px;top:${y}px"></span>`);
    const fot = lager.querySelector(".pjasfot"), c = cell(n), { r, k } = scenSkala();
    const s = c.getBoundingClientRect().width / k / c.offsetWidth, p = fot.getBoundingClientRect();
    const px = (p.x - r.x) / k, py = (p.y - r.y) / k;
    fot.remove();
    if (pjasBild) {                                                    // guldpjäsen (js/pjas.mjs), foten på numret, lyft med markerns tjocklek
      const h = Math.round(77 * s), w = Math.round(h * pjasBild.forhallande);
      rot.insertAdjacentHTML("beforeend", `<div class="pjas guld" data-n="${n}" data-h="${h}" style="left:${px - w / 2}px;top:${py - h * pjasBild.fotY - 5 * s}px;width:${w}px;height:${h}px"><img src="${pjasBild.url}" alt="" draggable="false"></div>`);
      return;
    }
    const h = Math.round(100 * s), w = Math.round(h * 64 / 100);
    rot.insertAdjacentHTML("beforeend", `<div class="pjas" style="left:${px - w / 2}px;top:${py - h * 0.86 - 4 * s}px;width:${w}px;height:${h}px">${PJAS_SVG}</div>`);
  }
  // utbetalningen: på varje vinnande fält läggs vinsten som marker ovanpå insatsen, så att stapeln visar totalen
  // (insats + vinst, motorns returned). Staplarna ritas i skärmens plan (som pjäsen) med markerna som ellipser, sedda
  // från kameran, och delas upp i 500/100/25/5/1. Fälten betalas ut ett i taget, med markerklicket för varje fält.
  const DELAR = [500, 100, 25, 5, 1];
  function delaUpp(b) { const ut = []; let kvar = Math.round(b * 100) / 100; for (const v of DELAR) while (kvar >= v && ut.length < 60) { ut.push(v); kvar = Math.round((kvar - v) * 100) / 100; } return ut; }
  function stagePunkt(id, dy = 0, dx = 0) { const [cx, cy] = skarmPunkt(id, dy, dx), { r, k } = scenSkala(); return [(cx - r.x) / k, (cy - r.y) / k]; }
  function skalaVid(id) {                                              // bordets skala vid fältet (perspektivet krymper bakre rader)
    const e = falt(id) ?? cell(BET_BY_ID[id].numbers.filter((x) => x).at(0) ?? 0), { k } = scenSkala();
    return e.getBoundingClientRect().width / k / e.offsetWidth;
  }
  function skarmPunkt(id, dy = 0, dx = 0) {                           // dx, dy: förskjutning i bordets plan (px)
    const [x0, y0] = plats(id), x = x0 + dx, y = y0 + dy, e = document.createElement("i");
    e.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0`; lager.append(e);
    const r = e.getBoundingClientRect(); e.remove(); return [r.x, r.y];
  }
  function utbetala(n, vinnare, t0) {
    const U = $(".utbetalning"); U.innerHTML = "";
    const etiketter = [];
    vinnare.forEach(([id, b, ret], i) => {
      const rakt = id === `straight-${n}` && !!pjasBild, c = cell(n), [x, y] = rakt ? stagePunkt(id, -c.offsetHeight * 0.22, -c.offsetWidth * 0.16) : stagePunkt(id);   // rakt: lite bakåt-vänster i fältet, bort från grannarnas staplar
      const s = skalaVid(id), d = 36 * s, tj = d * 0.13, start = 450 + i * 420;
      lager.querySelector(`.marker[data-bet="${id}"]`)?.classList.add("gomd");
      const ins = delaUpp(b), vin = delaUpp(ret - b), alla = [...ins, ...vin], max = rakt ? 4 : 5, visa = alla.length > max ? [...ins.slice(0, 2), ...vin.slice(0, max - Math.min(2, ins.length))] : alla;
      const tot = (v) => (v >= 1000 ? (v % 1000 ? (v / 1000).toFixed(1) : v / 1000) + "k" : kort(v));
      const marker = visa.map((v, j) => {
        const nv = visa.length - Math.min(ins.length, 2 + (alla.length > max ? 0 : 99)), c = valorFarg(v), ny = j >= visa.length - nv, topp = j === visa.length - 1;
        const fd = ny ? start + (j - (visa.length - nv)) * 65 : 0;
        return `<i class="sm${c === "#e9e2d0" ? " ljus" : ""}${ny ? " in" : ""}${topp ? " topp" : ""}" style="--c:${c};bottom:${(j * tj).toFixed(1)}px;${ny ? `animation-delay:${fd}ms` : ""}"></i>`;
      }).join("");
      const topp = y - (visa.length - 1) * tj, sista = start + (visa.length - Math.min(ins.length, 2 + (alla.length > max ? 0 : 99)) - 1) * 65;
      U.insertAdjacentHTML("beforeend", `<div class="vstapel" data-bet="${id}" data-total="${ret}" data-vinst="${ret - b}" data-delar="${alla.join(",")}" style="left:${x}px;top:${y}px;--d:${d.toFixed(1)}px;z-index:${rakt ? 19 : 20}">${marker}
        <span class="plus" style="bottom:${((visa.length - 1) * tj + d * 0.5).toFixed(1)}px;animation-delay:${sista + 120}ms">+${kort(ret - b)}</span></div>`);
      etiketter.push({ id, x, y, topp, d, start, sista, ret, rakt: id === `straight-${n}` });
      nar((t) => { if (t - t0 < start + 150) return false; pling("marker", { valor: Math.max(...vin) }); return true; });
    });
    // pjäsen lyfts upp på sin stapel (rakt nummer), som en croupier gör; totalen visas på en guldskylt bredvid.
    // Övriga staplar ritas framför pjäsen, så att deras belopp syns och pjäsens överdel sticker upp bakom.
    const pj = rot.querySelector(".pjas.guld"), rakt = etiketter.find((e) => e.rakt);
    if (pj && rakt) {
      const h = +pj.dataset.h, startTop = parseFloat(pj.style.top), nyTop = rakt.topp - h * pjasBild.fotY - 4 * (rakt.d / 36);
      pj.style.setProperty("--lyft", `${(nyTop - startTop).toFixed(1)}px`);
      pj.style.setProperty("--lyftDelay", `${rakt.sista + 150}ms`); pj.classList.add("lyft");
      pj.style.left = `${(rakt.x - parseFloat(pj.style.width) / 2).toFixed(1)}px`;                // pjäsen följer stapeln i sidled
    }
    // totalskyltarna: en per vinnande fält, intill sin stapel. Platsen väljs bland kandidater runt stapeln så att skylten
    // inte täcker pjäsen, någon stapel eller en annan skylt (rektanglar i scenens koordinater).
    const hinder = [];
    if (pj) {                                                          // pjäsens synliga del (sprajten har luft runt om)
      const w = parseFloat(pj.style.width), h = +pj.dataset.h, top = rakt ? rakt.topp - h * pjasBild.fotY - 4 * (rakt.d / 36) : parseFloat(pj.style.top);
      const x0 = rakt ? rakt.x - w / 2 : parseFloat(pj.style.left);
      hinder.push([x0 + w * 0.2, top + h * 0.05, x0 + w * 0.8, top + h * pjasBild.fotY + 6]);
    }
    for (const e of etiketter) hinder.push([e.x - e.d * 0.55, e.topp - e.d * 0.35, e.x + e.d * 0.55, e.y + e.d * 0.45]);
    const krock = (r) => hinder.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
    for (const e of [...etiketter].sort((a, b) => a.topp - b.topp)) {
      const text = kort(e.ret), w = 16 + text.length * 9.5, hh = 26, g = e.d * 0.6 + 4;
      const kand = [[e.x + g, e.topp - hh / 2], [e.x - g - w, e.topp - hh / 2], [e.x - w / 2, e.topp - e.d * 0.4 - hh - 4],
        [e.x + g, e.topp - hh - 6], [e.x - g - w, e.topp - hh - 6], [e.x + g, e.topp + 10], [e.x - g - w, e.topp + 10],
        [e.x - w / 2, e.topp - e.d * 0.4 - 2 * hh - 8], [e.x + g + 20, e.topp - 2 * hh], [e.x - g - w - 20, e.topp - 2 * hh]];
      let val = kand.find(([lx, ly]) => !krock([lx - 3, ly - 3, lx + w + 3, ly + hh + 3])) ?? kand[0];
      hinder.push([val[0] - 3, val[1] - 3, val[0] + w + 3, val[1] + hh + 3]);
      U.insertAdjacentHTML("beforeend", `<div class="belopp" data-bet="${e.id}" style="left:${val[0].toFixed(0)}px;top:${val[1].toFixed(0)}px;animation-delay:${e.sista + 350}ms"><b>${text}</b></div>`);
    }
  }
  function vinstkort(n, vinnare, vinst, insats) {
    const html = vinst > 0
      ? `<div class="abs vinstkort glas"><div class="hu"><span class="nr ${pocketColor(n)}">${n}</span><div class="egen">${esc(bordVal.dealerNamn ?? "Astrid")}<br>${egenskaper(n)}</div></div>
        <div class="du">${T.youWin}</div><div class="summa">${fmt(vinst)}</div>
        <ul>${vinnare.slice(0, 5).map(([id, b, r]) => `<li><span>${betNamn(id)} · ${kort(b)}</span>${fmt(r)}</li>`).join("")}</ul>
        ${vinnare.length > 5 ? `<div class="netto">${T.more(vinnare.length - 5)}</div>` : ""}
        <div class="netto">${T.stake} ${fmt(insats)} · ${T.net} ${vinst - insats >= 0 ? "+" : "−"}${fmt(Math.abs(vinst - insats))}</div></div>`
      : `<div class="abs vinstkort glas miste"><div class="hu"><span class="nr ${pocketColor(n)}">${n}</span><div class="egen">${esc(bordVal.dealerNamn ?? "Astrid")}<br>${egenskaper(n)}</div></div>
        <div class="summa">${T.noWin}</div><div class="netto">${T.stake} ${fmt(insats)}</div></div>`;
    $(".lagerVinst").innerHTML = html;
  }
  // hjulvyns resultatbricka: grannarna på hjulet, numret, egenskaperna och vinsten
  function resultatBricka(n, vinst) {
    const i = WHEEL.indexOf(n), v = WHEEL[(i + 36) % 37], h = WHEEL[(i + 1) % 37];
    rot.querySelector(".resultat")?.remove();
    rot.insertAdjacentHTML("beforeend", `<div class="abs resultat"><div class="rad"><span class="gr v ${pocketColor(v)}">${v}</span>
      <span class="stor ${pocketColor(n)}">${n}</span><span class="gr h ${pocketColor(h)}">${h}</span></div>
      <div class="egen2">${T.props(n)}</div>
      ${vinst > 0 ? `<div class="vbox"><small>${T.youWin}</small><strong>${fmt(vinst)}</strong></div>` : ""}</div>`);
  }

  // ---------- början ----------
  visaSaldo(S.saldo); ritaHistorik(); sag("Lägg din insats"); ritaMarker(); visaLjudIkon();
  if (lasKval() === "lag") queueMicrotask(() => kvalitet?.("lag"));
  // markerraden 12 px ovanför filtens bakkant, läppen lika bred som filten (som i mockupen)
  const passa = () => {
    const { r, k } = scenSkala(), f = $(".filt2"), m = $(".markerrad");
    $(".kant2").style.width = f.offsetWidth + "px";
    m.style.top = Math.round((f.getBoundingClientRect().top - r.y) / k - m.offsetHeight - 12) + "px";
  };

  return {
    S, passa,
    // vy: "S1" (spelvyn med bordet) eller "hjul" (S3/närbild med insatslisten)
    vy(v) {
      rot.classList.toggle("hjulvy", v !== "S1");                       // satsbordet fälls bakåt och följer med till hjulet
      $(".vyHjul").classList.add("dold");

      rot.querySelector(".resultat")?.classList.toggle("dold", v === "S1");
    },
    sagNummer(n) { sag(T.said(n)); },
    bricka(n) { const vinst = [...S.insatser].reduce((a, [id, b]) => a + retur(id, b, n), 0); resultatBricka(n, vinst); },
    brickaBort() { const b = rot.querySelector(".resultat"); if (b) { b.classList.add("bort"); setTimeout(() => b.remove(), 420); } },
    // kulan ligger i fickan: pjäsen, numret i historiken, Astrid säger numret
    landat(n) {
      S.fas = "landat"; S.resultat = n; S.historik.unshift(n); ritaHistorik(true);
      cell(n).classList.add("landad"); stallPjas(n);
      sag(T.said(n)); knappar();
    },
    // avräkning som motorn: returned per satsning, saldot räknas upp
    vinst(n) {
      const vinnare = [...S.insatser].filter(([id]) => BET_BY_ID[id].numbers.includes(n)).map(([id, b]) => [id, b, retur(id, b, n)]).sort((a, b) => b[2] - a[2]);
      const vinst = vinnare.reduce((a, v) => a + v[2], 0), insats = totalt();
      S.fas = "vinst";
      bord.classList.add("vinst"); cell(n).classList.remove("landad");
      for (const e of bord.querySelectorAll(".f[data-bet]")) {
        const id = e.dataset.bet;
        if (id === `straight-${n}`) e.classList.add("vinnare"); else if (!id.startsWith("straight") && BET_BY_ID[id].numbers.includes(n)) e.classList.add("traff");
      }
      ritaMarker(); vinstkort(n, vinnare, vinst, insats);

      const fran = S.saldo, till = S.saldo + vinst, t0 = klocka();
      utbetala(n, vinnare, t0);
      S.saldo = till;
      if (vinst > 0) nar((t) => { const u = Math.min(1, (t - t0) / 1200), e = 1 - (1 - u) ** 3; visaSaldo(fran + (till - fran) * e, u < 1); return u >= 1; });
      knappar();
      return { vinst, insats };
    },
    klar() { S.fas = "klar"; bord.classList.remove("las"); knappar(); },
    gor, lagg, traffa, plats, oppnaPanel, stangPanel, knappar, get oppen() { return oppen; },
    // skärmpunkten (klientkoordinater) där markern för ett id ligger, genom perspektivet: för inspelning och prov av klicken
    skarmPunkt,
  };
}
