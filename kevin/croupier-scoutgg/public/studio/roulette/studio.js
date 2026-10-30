// Table Studio för roulette. Flödet är som Kevins studio.js: stegen öppnas ett i taget, valen sparas i localStorage,
// förhandsvisningen byts direkt, och "Skapa bord" skickar POST /api/studio/roulette-table (egen bordsfil, rör inte blackjackens). Klart-skärmen visar delningslänken
// /t/<slug>, och "Öppna bordet" går dit. Valen, namnen, miniatyrerna och förhandsbilderna kommer ur /roulette/katalog.json.
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const K = await (await fetch("/roulette/katalog.json")).json();
const KEY = "scout-rl-studio";
const LIMITS = Object.fromEntries(Object.entries(K.limits).filter(([k]) => k !== "rl-motor"));
let st = { game: "roulette", dealer: "astrid2", wheel: "champagne", room: "champagne", limit: "rl-classic", name: "Roulette", open: "dealer", slug: "" };
try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch {}
for (const [k, lista] of [["dealer", K.dealers], ["wheel", K.wheels], ["room", K.rooms], ["limit", LIMITS]]) if (!Object.hasOwn(lista, st[k])) st[k] = Object.keys(lista)[0];
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };
const sek = (v) => Number(v).toLocaleString("en-US");
const range = (L) => `${sek(L.min)} – ${sek(L.maxPerBet)}`;
// marker som i Kevins studio (färgerna följer spelets valörer)
const CHIP = { 1: ["#e8e2d4", "#a9a294", "#5a554c", "#1c1a16"], 5: ["#b3202a", "#5e1016"], 25: ["#1d7a46", "#0d3d22"], 100: ["#424a51", "#181c20"],
  500: ["#7852b3", "#402957"], 1000: ["#d6b46a", "#7d6230", "#fff5da", "#201c13"], 5000: ["#2f6496", "#163252"] };
function chipEl(v) {
  const e = document.createElement("span"), c = CHIP[v] ?? CHIP[100]; e.className = "chip";
  e.style.setProperty("--c", c[0]); e.style.setProperty("--s", c[1]); if (c[2]) e.style.setProperty("--r", c[2]); if (c[3]) e.style.setProperty("--t", c[3]);
  e.textContent = v >= 1000 ? v / 1000 + "K" : String(v); return e;
}
const opt = (k, val, inner, cls) => `<button class="opt ${cls}" type="button" role="radio" data-k="${k}" data-val="${val}" aria-checked="false">${inner}</button>`;

// ---------- valen ur katalogen ----------
$("#dealerGrid").innerHTML = Object.entries(K.dealers).map(([id, d]) => opt("dealer", id, `<img src="${d.thumb}" alt=""><div class="meta"><strong>${d.namn}</strong><span>AI dealer · Roulette</span></div>`, "dealer-opt")).join("")
  + [["Dragan", "assets/dragge.jpg"], ["Paow", "assets/paow.jpg"]].map(([n, img]) => `<div class="opt dealer-opt snart" aria-disabled="true"><img src="${img}" alt=""><div class="meta"><strong>${n}</strong><span>Coming soon</span></div></div>`).join("");
$("#wheelGrid").innerHTML = Object.entries(K.wheels).map(([id, w]) => opt("wheel", id, `<img src="${w.thumb}" alt=""><span>${w.namn}<small>${w.beskrivning}</small></span>`, "room-opt")).join("");
$("#roomGrid").innerHTML = Object.entries(K.rooms).map(([id, r]) => opt("room", id, `<img src="${r.thumb}" alt=""><span>${r.namn}</span>`, "room-opt")).join("");
$("#limitList").innerHTML = Object.entries(LIMITS).map(([id, L]) => opt("limit", id, `<span class="lt">${L.namn}<span class="tag">${id === "rl-high" ? "VIP" : "Standard"}</span></span>
  <span class="range">${range(L)}</span><span class="ld">Per bet · max ${sek(L.maxTotal)} per round · balance ${sek(L.balance)}</span><span class="mini" data-chips="${id}"></span>`, "limit-opt")).join("");
$$("[data-chips]").forEach((m) => LIMITS[m.dataset.chips].chips.forEach((v) => m.append(chipEl(v))));

// ---------- förhandsvisningen: spelets egen bild för valt hjul och rum (verktyg/miniatyrer.mjs), byts med en övertoning ----------
const forhand = (w, r) => `/media/roulette/preview/${w}_${r}.jpg`;
function swapImg(img, src) {
  if (img.getAttribute("src") === src) return;
  if (!img.getAttribute("src")) { img.src = src; return; }
  img.classList.add("fading"); const n = new Image();
  n.onload = () => setTimeout(() => { img.src = src; img.classList.remove("fading"); }, 160); n.src = src;
}
for (const w of Object.keys(K.wheels)) for (const r of Object.keys(K.rooms)) new Image().src = forhand(w, r);   // förladda

const order = ["game", "dealer", "wheel", "room", "limit", "name"];
function render() {
  const d = K.dealers[st.dealer], w = K.wheels[st.wheel], r = K.rooms[st.room], L = LIMITS[st.limit];
  swapImg($("#previewImg"), forhand(st.wheel, st.room));
  $("#ovName").textContent = st.name || "Roulette"; $("#ovRange").textContent = range(L); $("#ovBal").textContent = sek(L.balance) + ".00";
  $("#ovBadge").textContent = `${d.namn} · AI dealer · ${w.namn}`;
  const oc = $("#ovChips"); oc.innerHTML = ""; L.chips.forEach((v, i) => { const c = chipEl(v); if (i === 2) c.classList.add("sel"); oc.append(c); });
  const vals = { game: "Roulette", dealer: d.namn, wheel: w.namn, room: r.namn, limit: `${L.namn} · ${range(L)}`, name: st.name || "Roulette" };
  for (const k in vals) $(`[data-v="${k}"]`).textContent = vals[k];
  $$(".opt[data-k]").forEach((o) => o.setAttribute("aria-checked", String(st[o.dataset.k] === o.dataset.val)));
  $$(".step").forEach((s) => { s.classList.toggle("open", s.dataset.step === st.open); s.classList.toggle("done", order.indexOf(s.dataset.step) < order.indexOf(st.open)); });
  $("#pnSpec").textContent = `${d.namn} · ${w.namn} · ${r.namn}`;
  $("#readyName").textContent = st.name || "Roulette"; $("#rsDealer").textContent = d.namn; $("#rsWheel").textContent = w.namn; $("#rsRoom").textContent = r.namn;
  $("#rsLimit").textContent = `${L.namn} · ${range(L)}`;
  $("#shareUrl").textContent = `${location.host}/t/${st.slug || "…"}`;
  save();
}
$$(".step-h").forEach((h) => (h.onclick = () => { const s = h.parentElement.dataset.step; st.open = st.open === s ? "" : s; render(); }));
$$(".opt[data-k]").forEach((o) => (o.onclick = () => {
  st[o.dataset.k] = o.dataset.val;
  const i = order.indexOf(o.closest(".step").dataset.step); if (o.dataset.k !== "game") st.open = order[i + 1] ?? st.open;   // nästa steg öppnas
  render();
}));
$("#tableName").value = st.name;
$("#tableName").oninput = (e) => { st.name = e.target.value.slice(0, 28); render(); };

// ---------- skärmarna ----------
function go(s) { $$(".screen").forEach((e) => e.classList.toggle("on", e.id === s)); if (s === "ready") $("#readyHome").append($("#stage")); else $("#previewHome").prepend($("#stage")); }
const loaded = (src) => new Promise((ok) => { const i = new Image(); i.onload = i.onerror = () => ok(); i.src = src; });
$("#createBtn").onclick = async () => {
  const L = $("#launch"), sp = $$(".launch-steps span"); sp.forEach((s) => s.classList.remove("done")); L.classList.add("on");
  const fel = (m) => { L.classList.remove("on"); $("#createBtn").textContent = m; setTimeout(() => ($("#createBtn").textContent = "Create table →"), 2600); };
  let t;
  try {
    const r = await fetch("/api/studio/roulette-table", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: "roulette", name: (st.name || "Roulette").trim(), dealer: st.dealer, wheel: st.wheel, room: st.room, limit: st.limit, lang: "en" }) });
    t = await r.json(); if (r.status === 401) { L.classList.remove("on"); return go("login"); } if (!r.ok) return fel(t.error || "Could not create the table");
  } catch { return fel("Could not reach the server"); }
  st.slug = t.slug; save(); sp[0].classList.add("done");
  await loaded(K.dealers[st.dealer].thumb); sp[1].classList.add("done");
  await loaded(K.rooms[st.room].s1); sp[2].classList.add("done");
  setTimeout(() => { render(); go("ready"); L.classList.remove("on"); }, 350);
};
$("#playBtn").onclick = () => { location.href = `/t/${st.slug}`; };
$("#editBtn").onclick = () => go("builder");
$("#newBtn").onclick = () => { Object.assign(st, { slug: "", dealer: "astrid2", wheel: "champagne", room: "champagne", limit: "rl-classic", name: "Roulette", open: "dealer" }); $("#tableName").value = st.name; render(); go("builder"); };
$("#copyBtn").onclick = () => { navigator.clipboard?.writeText(location.protocol + "//" + $("#shareUrl").textContent).catch(() => {}); $("#copyBtn").textContent = "Copied"; setTimeout(() => ($("#copyBtn").textContent = "Copy link"), 1600); };
// ---------- inloggningen: Kevins back office-konto (samma session som blackjackens studio) ----------
const inloggad = (me) => { $("#userEmail").textContent = me.user; $("#avatar").textContent = (me.user[0] || "R").toUpperCase(); go("builder"); };
$("#pwToggle").onclick = () => { const p = $("#pw"); p.type = p.type === "password" ? "text" : "password"; $("#pwToggle").textContent = p.type === "password" ? "Show" : "Hide"; };
$("#loginForm").onsubmit = async (e) => {
  e.preventDefault(); const em = $("#email").value.trim(), pw = $("#pw").value;
  $("#fEmail").classList.toggle("err", !em); $("#fPw").classList.toggle("err", !pw);
  if (!em || !pw) { $("#formErr").textContent = "Enter your back office login and password."; return; }
  $("#formErr").textContent = "Signing in…";
  try {
    const r = await fetch("/api/studio/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user: em, pass: pw }) });
    const me = await r.json();
    if (!r.ok || !me.user) { $("#fEmail").classList.add("err"); $("#fPw").classList.add("err"); $("#formErr").textContent = me.error || "Sign-in failed."; return; }
    $("#pw").value = ""; $("#formErr").textContent = ""; inloggad(me);
  } catch { $("#formErr").textContent = "Sign-in is unavailable. Try again shortly."; }
};
$("#signOut").onclick = async () => { await fetch("/api/studio/logout", { method: "POST" }).catch(() => {}); go("login"); };
render();
let me = {};
try { const r = await fetch("/api/studio/session"); if (r.ok) me = await r.json(); } catch {}
if (me.user) inloggad(me); else go("login");
document.body.dataset.klar = "1";
