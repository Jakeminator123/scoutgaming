// Chatten med dealern (bara text tills läppsynken kommer): panelen uppe till höger, som blackjackens desktopläge.
// Namnet som i blackjacken (Emil 1 Nov): en liten Nickname-ruta i chattraden, Enter eller att lämna rutan byter namn, Escape
// ångrar. Det sparas under samma nyckel som blackjacken (astrid.name, samma webbplats), så den som döpt sig där heter
// likadant här. Utan sparat namn är man "Guest NNN" tills man skriver ett. Varje rad går till POST /api/roulette/chat med
// bordets läge (fas, senaste nummer, om spelaren vann förra rundan, aldrig belopp).
// Minimera (Emil 1 Nov): knappen uppe i panelens hörn fäller ihop chatten till en liten flik på samma plats, fliken fäller ut
// den igen. Chatten är alltid utfälld vid start (läget sparas inte). Svar som kommer medan den är ihopfälld räknas på fliken.
const NYCKEL = "astrid.name";
const las = () => { try { return localStorage.getItem(NYCKEL); } catch { return null; } };
const spara = (n) => { try { localStorage.setItem(NYCKEL, n); } catch {} };
// ikonerna som SVG (tecknet ➤ satt snett i knappen: glyfens ruta är inte centrerad i Segoe UI); viewBox centrerad på formen
const PIL = `<svg viewBox="1.5 2 20 20" aria-hidden="true"><path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a1 1 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z"/></svg>`;
const MINUS = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>`;
const BUBBLA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z"/></svg>`;

export function skapaChatt(rot, { dealer = "Astrid", bord = "", lage = () => ({}) } = {}) {
  try { localStorage.removeItem("roulette_namn"); } catch {}           // den första versionens nyckel (första raden blev namnet)
  let namn = las() || `Guest ${100 + Math.floor(Math.random() * 900)}`;
  const el = document.createElement("div");
  el.className = "abs chatt glas";
  el.innerHTML = `<div class="chatt-inne"><div class="chatt-rader" aria-live="polite"></div>
    <form class="chatt-rad"><input class="chatt-namn" maxlength="18" placeholder="Nickname" title="Change your nickname" aria-label="Your nickname. Type a new one and press Enter" enterkeyhint="done">
    <input class="chatt-text" maxlength="280" autocomplete="off" spellcheck="false" placeholder="Chat with ${dealer}…" aria-label="Message"><button type="submit" class="chatt-skicka" aria-label="Send">${PIL}</button></form></div>
    <button type="button" class="chatt-min" aria-label="Minimise chat" title="Minimise chat" aria-expanded="true">${MINUS}</button>
    <button type="button" class="chatt-flik" aria-label="Open chat with ${dealer}" title="Open chat" tabindex="-1">${BUBBLA}<span>Chat with ${dealer}</span><b class="chatt-ny" hidden></b></button>`;
  rot.append(el);
  const rader = el.querySelector(".chatt-rader"), form = el.querySelector("form"), input = el.querySelector(".chatt-text"), who = el.querySelector(".chatt-namn");
  const minKnapp = el.querySelector(".chatt-min"), flik = el.querySelector(".chatt-flik"), ny = el.querySelector(".chatt-ny");
  who.value = namn;
  // ihopfälld/utfälld: panelen krymper mot sitt övre högra hörn, innehållet tonar (CSS). Olästa svar räknas medan den är liten.
  let liten = false, olasta = 0;
  const fall = (pa) => {
    liten = pa; el.classList.toggle("liten", pa);
    minKnapp.setAttribute("aria-expanded", String(!pa));
    minKnapp.tabIndex = pa ? -1 : 0; flik.tabIndex = pa ? 0 : -1;
    el.querySelector(".chatt-inne").inert = pa;
    if (pa) { if (el.contains(document.activeElement)) document.activeElement.blur(); }
    else {
      olasta = 0; ny.hidden = true; rader.scrollTop = rader.scrollHeight;
      if (matchMedia("(pointer:fine)").matches) setTimeout(() => !liten && input.focus({ preventScroll: true }), 260);
    }
  };
  minKnapp.addEventListener("click", () => fall(true));
  flik.addEventListener("click", () => fall(false));
  // Escape i meddelanderutan fäller ihop chatten
  input.addEventListener("keydown", (e) => { if (e.key === "Escape" && !input.value) { e.preventDefault(); fall(true); } });
  const rad = (vem, text, cls) => {
    const d = document.createElement("div"); d.className = `chatt-msg ${cls}`;
    const b = document.createElement("b"); b.textContent = vem; d.append(b, document.createTextNode(" " + text));
    rader.append(d); rader.scrollTop = rader.scrollHeight;
    if (liten && cls === "dealer") { olasta++; ny.textContent = olasta > 9 ? "9+" : String(olasta); ny.hidden = false; }
    return d;
  };
  // namnrutan: Enter sparar (skickar aldrig chattraden), Escape behåller det gamla
  who.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); who.blur(); } else if (e.key === "Escape") { who.value = namn; who.blur(); }
  });
  who.addEventListener("change", () => {
    const n = who.value.trim().replace(/\s+/g, " ").slice(0, 18);
    if (!n || n === namn) { who.value = namn; return; }
    namn = n; who.value = n; spara(n);
  });
  let skickar = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim(); if (!text || skickar) return;
    input.value = "";
    rad(namn, text, "spelare");
    const skriver = rad(dealer, "…", "dealer skriver");
    skickar = true;
    try {
      const r = await fetch("/api/roulette/chat", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: bord, text, name: namn, state: lage() }) });
      const j = await r.json().catch(() => ({}));
      skriver.remove();
      rad(dealer, j.text ?? (r.status === 429 ? "One moment, I'm keeping up with the wheel." : "Sorry, I missed that."), "dealer");
    } catch { skriver.remove(); rad(dealer, "Sorry, I missed that.", "dealer"); }
    skickar = false;
  });
  // tangenter i chatten ska inte nå spelet (mellanslag, siffror)
  input.addEventListener("keydown", (e) => e.stopPropagation());
  return { el, namn: () => namn, minimera: () => fall(true), maximera: () => fall(false), liten: () => liten };
}
