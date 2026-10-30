// Vilan mellan rundorna: idle-klipp i följd (gröna, pixellåsta, alla börjar och slutar i samma vilopose).
// Mest andas/blinka, ibland en gest, aldrig samma klipp två gånger i rad. Klippen byts bara vid klippets slut (samma pose),
// så det syns ingen skarv. koa(["le_valkommen", "nick"]) gör att ett av dem spelas härnäst (efter en vinst).
// Finns inga klipp används stillbilden. I inspelningsläget styrs klippen av den egna klockan (ruta = tid · 24).
//   klippnamn: idle_<handling>_f73_s84xx_gron.mp4 → handlingen styr vikten
import { videoKalla } from "./dealer.mjs";

const VIKT = { andas: 6, blinka: 5, djupt_andetag: 3 };   // övriga handlingar (gester) väger 1
const LUGN = new Set(["andas", "blinka", "djupt_andetag"]);   // kan brytas för kastet (posen ändras knappt)
export const handling = (fil) => (/idle_(.+?)_f\d+/.exec(fil) ?? [, "andas"])[1];

export function skapaVila(H, { filer, bas, adress, stillbild, inspelning, slump = Math.random, skarm = [33, 201, 68] }) {
  const fps = 24;
  let cur = null, nasta = null, ko = null, start = 0, senaste = null;
  const ladda = (fil) => {
    const k = videoKalla(H, adress?.(fil) ?? new URL(fil, bas).href, { hojd: 1088, beskarTopp: 4, skarm });   // förladdad blob om den finns
    k.fil = fil; k.handling = handling(fil);
    k.klar = k.klar.then(() => {                        // höjden ur klippet (1088 grönt, 1080 förhandsvisning)
      k.hojd = k.video.videoHeight; k.beskarTopp = Math.max(0, (k.hojd - 1080) >> 1);
      k.rutor = Math.round(k.video.duration * fps); if (!k.slappt) k.tex.needsUpdate = true; k.redo = true;
    }, (e) => { k.fel = true; if (!k.slappt) console.error("idle-klippet laddas inte:", fil, k.video.error?.code, k.video.error?.message ?? e.message); });
    k.video.addEventListener("seeked", () => { if (!k.slappt) k.tex.needsUpdate = true; });
    return k;
  };
  const slapp = (k) => { if (!k) return; k.slappt = true; k.video.pause(); k.video.removeAttribute("src"); k.video.load(); k.tex.dispose(); };
  let bara = null;                                       // t.ex. bara lugna klipp medan rundan pågår
  function valj() {
    let kand = filer.filter((f) => f !== senaste && (!bara || bara.includes(handling(f))));
    if (ko) { const k = kand.filter((f) => ko.includes(handling(f))); ko = null; if (k.length) kand = k; }
    if (!kand.length) kand = filer;
    const v = kand.map((f) => VIKT[handling(f)] ?? 1), sum = v.reduce((a, b) => a + b, 0);
    let r = slump() * sum;
    for (let i = 0; i < kand.length; i++) if ((r -= v[i]) < 0) return kand[i];
    return kand[kand.length - 1];
  }
  const forbered = () => { slapp(nasta); senaste = valj(); nasta = ladda(senaste); };
  // spelar klippet? Webbläsaren kan avvisa eller stoppa play() (sparläge, avkodaren, en annan flik); då försöker vi igen
  let forsokt = 0;
  const spela = (k) => k.video.play().catch((e) => console.error("idle-klippet startar inte:", k.fil, e.name, e.message));
  const vakta = (nu) => {
    if (inspelning || !cur || cur.video.ended || nu - forsokt < 700) return;
    if (cur.video.paused) { forsokt = nu; spela(cur); }
  };

  return {
    finns: filer.length > 0,
    get kalla() { return cur ?? stillbild; },
    get handling() { return cur?.handling ?? "stilla"; },
    // ett lugnt klipp (andas/blinka) från ruta 0: vid start och efter kastet. Det laddas redan när kastet börjar (pausa).
    borja(nu) {
      if (!filer.length) return false;
      this.pausad = false;
      if (!nasta || nasta.fel || !LUGN.has(nasta.handling)) { ko = [...LUGN]; forbered(); }
      if (nasta.redo) { this.byt(nu); return true; }
      return nasta.klar.then(() => {
        if (nasta?.redo) { this.byt(nu); return true; }
        if (cur) { cur.video.currentTime = 0; spela(cur); }            // nästa klipp gick inte att ladda: nuvarande om från början
        forbered(); return false;
      });
    },
    byt(nu) {                                            // nästa (laddade) klipp tar över; posen är densamma vid skarven
      const ny = nasta;
      slapp(cur); cur = ny; nasta = null; start = nu;
      if (!inspelning) { cur.video.currentTime = 0; spela(cur); }
      forbered();
      return cur;
    },
    // varje bildruta: true när ett klipp just bytts (anroparen visar då this.kalla), annars false
    uppdatera(nu) {
      if (!cur) { if (this.pausad === false && nasta?.redo) { this.byt(nu); return true; } return false; }   // startade utan klipp
      if (this.pausad) return false;
      const slut = inspelning ? nu - start >= cur.rutor * 1000 / fps : cur.video.ended || cur.video.currentTime >= cur.video.duration - 0.004;
      if (slut && nasta?.redo) { this.byt(inspelning ? start + cur.rutor * 1000 / fps : nu); return true; }
      if (slut && !inspelning) {                         // nästa är inte klar (eller trasig): samma klipp en gång till, aldrig stilla
        if (!nasta || nasta.fel) forbered();
        cur.video.currentTime = 0; spela(cur); start = nu;
        return false;
      }
      vakta(nu);
      return false;
    },
    // ruta i inspelningsläget
    ruta(nu) { return cur ? Math.min(cur.rutor - 1, Math.max(0, Math.floor((nu - start) * fps / 1000))) : 0; },
    kvarMs(nu) { return cur ? (inspelning ? start + cur.rutor * 1000 / fps - nu : (cur.video.duration - cur.video.currentTime) * 1000) : 0; },
    kanBrytas() { return !cur || LUGN.has(cur.handling); },
    koa(h) { ko = h; if (nasta && !h.includes(nasta.handling)) forbered(); },
    // under rundan (kastet till vinsten) bara andas och blinka, så att hon inte ler eller nickar före resultatet
    lugn(pa) { bara = pa ? [...LUGN] : null; if (pa && nasta && !LUGN.has(nasta.handling)) forbered(); },
    pausa() { this.pausad = true; cur?.video.pause(); this.koa([...LUGN]); },
    vacka() { if (cur && !this.pausad && !inspelning && cur.video.paused) spela(cur); },   // vid klick: en riktig användargest
    status() { const v = cur?.video; return v ? { fil: cur.fil, t: +v.currentTime.toFixed(2), paus: v.paused, slut: v.ended, rs: v.readyState, ns: v.networkState, fel: v.error?.code ?? null, nasta: nasta ? (nasta.redo ? "redo" : nasta.fel ? "fel" : "laddar") : null, pausad: !!this.pausad } : null; },
    get cur() { return cur; },
  };
}
