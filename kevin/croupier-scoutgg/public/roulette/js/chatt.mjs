// Chatten med dealern (bara text tills läppsynken kommer): panelen uppe till höger, som blackjackens desktopläge.
// Namnet som i blackjacken (Emil 1 Nov): en liten Nickname-ruta i chattraden, Enter eller att lämna rutan byter namn, Escape
// ångrar. Det sparas under samma nyckel som blackjacken (astrid.name, samma webbplats), så den som döpt sig där heter
// likadant här. Utan sparat namn är man "Guest NNN" tills man skriver ett. Varje rad går till POST /api/roulette/chat med
// bordets läge (fas, senaste nummer, om spelaren vann förra rundan, aldrig belopp).
const NYCKEL = "astrid.name";
const las = () => { try { return localStorage.getItem(NYCKEL); } catch { return null; } };
const spara = (n) => { try { localStorage.setItem(NYCKEL, n); } catch {} };

export function skapaChatt(rot, { dealer = "Astrid", bord = "", lage = () => ({}) } = {}) {
  try { localStorage.removeItem("roulette_namn"); } catch {}           // den första versionens nyckel (första raden blev namnet)
  let namn = las() || `Guest ${100 + Math.floor(Math.random() * 900)}`;
  const el = document.createElement("div");
  el.className = "abs chatt glas";
  el.innerHTML = `<div class="chatt-rader" aria-live="polite"></div>
    <form class="chatt-rad"><input class="chatt-namn" maxlength="18" placeholder="Nickname" title="Change your nickname" aria-label="Your nickname. Type a new one and press Enter" enterkeyhint="done">
    <input class="chatt-text" maxlength="280" autocomplete="off" spellcheck="false" placeholder="Chat with ${dealer}…" aria-label="Message"><button type="submit" aria-label="Send">➤</button></form>`;
  rot.append(el);
  const rader = el.querySelector(".chatt-rader"), form = el.querySelector("form"), input = el.querySelector(".chatt-text"), who = el.querySelector(".chatt-namn");
  who.value = namn;
  const rad = (vem, text, cls) => {
    const d = document.createElement("div"); d.className = `chatt-msg ${cls}`;
    const b = document.createElement("b"); b.textContent = vem; d.append(b, document.createTextNode(" " + text));
    rader.append(d); rader.scrollTop = rader.scrollHeight; return d;
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
  return { el, namn: () => namn };
}
