// Kortlagret: ett ritat kort per utdelning, bara för att visa animationen.
//
// Utdelningsklippet vänder upp ett vitt kort i handen och lägger det på platsen. Från rutan där det vänts upp
// ritas valör och färg PÅ klippets kort: kortets hörn ruta för ruta (verktyg/bygg-kortlage.py, "spar") ger
// läget och lutningen, och en mask per ruta håller tummen framför valören. När kortet ligger stilla
// ("visas") byts det mot det ritade kortet exakt ovanpå — det ligger kvar när nästa klipp (som börjar i
// startbilden utan kort) tar vid. Efter en stund tonar det bort. Börjar en ny
// utdelning innan dess tonas det gamla kortet bort direkt, så handen aldrig passerar under ett ritat kort.
//
// Canvasen är i startbildens koordinater (1080×1920) och skalas exakt som videon (object-fit: cover).

const W = 1080, H = 1920;
const CARD_W = 63, CARD_H = 85;   // = kortpositioner.json
const SHOW_MS = 1600;             // så länge kortet ligger kvar
const FADE_MS = 450, FAST_MS = 180;

export function createKort(stageEl) {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H; canvas.className = "cards";
  stageEl.querySelector("#vb").after(canvas);
  const ctx = canvas.getContext("2d");

  function layout() {
    const w = stageEl.clientWidth, h = stageEl.clientHeight, k = Math.max(w / W, h / H);
    canvas.style.transform = `translate(${(w - W * k) / 2}px, ${(h - H * k) / 2}px) scale(${k})`;
  }
  new ResizeObserver(layout).observe(stageEl);
  layout();

  /** Hela kortet, eller bara valör och färg (ink) — samma layout, så bytet mellan dem inte syns. */
  function sprite(card, inkOnly = false, scale = 1) {
    const c = new OffscreenCanvas((CARD_W + 16) * scale, (CARD_H + 16) * scale), x = c.getContext("2d");
    x.scale(scale, scale);
    if (!inkOnly) ink(x, card, true);
    else ink(x, card, false);
    return c;
  }
  function ink(x, card, face) {
    if (face) {
    x.shadowColor = "rgba(0,0,0,.42)"; x.shadowBlur = 4; x.shadowOffsetX = 1; x.shadowOffsetY = 2;
    const g = x.createLinearGradient(0, 8, 0, 8 + CARD_H); g.addColorStop(0, "#efefec"); g.addColorStop(1, "#e5e4e1");
    x.fillStyle = g; x.beginPath(); x.roundRect(8, 8, CARD_W, CARD_H, 4.5); x.fill();
    x.shadowColor = "transparent";
    }
    const red = card.s === "♥" || card.s === "♦";
    x.fillStyle = red ? "#b3202a" : "#1b1b1d";
    x.textBaseline = "top";
    x.font = `700 ${card.r === "10" ? 16 : 18}px Georgia, serif`; x.fillText(card.r, 13, 12);
    x.font = "13px Georgia, serif"; x.fillText(card.s, 14, 31);
    x.font = "34px Georgia, serif"; x.textAlign = "center"; x.fillText(card.s, 8 + CARD_W / 2, 8 + 30);
  }

  // Kortets spår per utdelningsklipp: { fran, box, q, mask: Image }
  const spar = {};
  function load(id, s) {
    if (!s?.spar || spar[id]) return;
    const img = new Image();
    img.src = `/media/deal/${id.replace("deal_", "")}.kort.png?v=${s.spar.fran}-${s.spar.q.length}-${s.spar.box.join("-")}`;   // nytt spår → ny mask
    spar[id] = { ...s.spar, mask: img };
  }
  const INK = 2;                                     // valören ritas i dubbel upplösning (kortet är större i handen)
  const tmp = new OffscreenCanvas(8, 8), tctx = tmp.getContext("2d");

  let shown = null;   // { sprite, x, y, t0, fadeAt, fadeMs }
  let live = null;    // { ink, sp, i } — valören på klippets kort i ruta i av spåret
  let raf = 0;

  function drawLive() {
    const { ink: sp0, sp, i } = live;
    const [bx, by, bw, bh] = sp.box, [tlx, tly, trx, try_, blx, bly] = sp.q[i];
    if (tmp.width !== bw || tmp.height !== bh) { tmp.width = bw; tmp.height = bh; }
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.clearRect(0, 0, bw, bh);
    // kortets rektangel (8, 8, CARD_W, CARD_H) i spriten → klippets kort (övre vänster, övre höger, nedre vänster)
    const a = (trx - tlx) / CARD_W, b = (try_ - tly) / CARD_W, c = (blx - tlx) / CARD_H, d = (bly - tly) / CARD_H;
    tctx.setTransform(a / INK, b / INK, c / INK, d / INK, tlx - bx - 8 * a - 8 * c, tly - by - 8 * b - 8 * d);
    tctx.drawImage(sp0, 0, 0);
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    if (sp.mask.complete && sp.mask.naturalWidth) {
      tctx.globalCompositeOperation = "destination-in";   // bara där kortet syns (tummen framför)
      tctx.drawImage(sp.mask, 0, i * bh, bw, bh, 0, 0, bw, bh);
      tctx.globalCompositeOperation = "source-over";
    }
    ctx.drawImage(tmp, bx, by);
  }

  function draw() {
    raf = 0;
    ctx.clearRect(0, 0, W, H);
    if (live) { drawLive(); return; }
    if (!shown) return;
    const now = performance.now();
    const a = now < shown.fadeAt ? 1 : 1 - (now - shown.fadeAt) / shown.fadeMs;
    if (a <= 0) { shown = null; return; }
    ctx.globalAlpha = a;
    ctx.drawImage(shown.sprite, shown.x - 8, shown.y - 8);
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(draw);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(draw); };

  return {
    /** Förladdar kortens spår (kortlage.json) och masker. */
    load() {
      fetch("/media/deal/kortlage.json").then((r) => r.json())
        .then((all) => { for (const [id, s] of Object.entries(all)) load(id, s); }).catch(() => {});
    },
    /** Klippets bildruta f (24 fps) visas: valören på kortet i handen, om kortet är uppvänt i den rutan. */
    follow(id, card, f) {
      const sp = spar[id];
      const i = sp ? f - sp.fran : -1;
      if (!sp || i < 0 || i >= sp.q.length) return;
      if (live?.card !== card) live = { card, ink: sprite(card, true, INK), sp, i };
      live.i = i;
      kick();
    },
    /** Kortet ligger stilla på platsen (kort = { cx, cy } i 1080×1920). */
    show(card, kort) {
      live = null;
      const now = performance.now();
      shown = { sprite: sprite(card), x: Math.round(kort.cx - CARD_W / 2), y: Math.round(kort.cy - CARD_H / 2),
                fadeAt: now + SHOW_MS, fadeMs: FADE_MS };
      kick();
    },
    /** Ny utdelning börjar: ett kort som fortfarande syns tonas bort direkt. */
    clear() {
      if (live) { live = null; kick(); }
      if (!shown) return;
      const now = performance.now();
      if (shown.fadeAt > now) { shown.fadeAt = now; shown.fadeMs = FAST_MS; }
      kick();
    },
  };
}
