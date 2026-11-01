// Chatten med dealern (bara text tills läppsynken kommer): panelen uppe till höger, som blackjackens desktopläge.
// Första meddelandet frågar efter namnet (sparas i webbläsaren); sedan går varje rad till POST /api/roulette/chat
// tillsammans med bordets läge (fas, senaste nummer, om spelaren vann förra rundan, aldrig belopp).
export function skapaChatt(rot, { dealer = "Astrid", bord = "", lage = () => ({}) } = {}) {
  const el = document.createElement("div");
  el.className = "abs chatt glas";
  el.innerHTML = `<div class="chatt-rader" aria-live="polite"></div>
    <form class="chatt-rad"><input maxlength="280" autocomplete="off" spellcheck="false"><button type="submit" aria-label="Send">➤</button></form>`;
  rot.append(el);
  const rader = el.querySelector(".chatt-rader"), form = el.querySelector("form"), input = el.querySelector("input");
  let namn = ""; try { namn = localStorage.getItem("roulette_namn") ?? ""; } catch {}
  const rad = (vem, text, cls) => {
    const d = document.createElement("div"); d.className = `chatt-msg ${cls}`;
    const b = document.createElement("b"); b.textContent = vem; d.append(b, document.createTextNode(" " + text));
    rader.append(d); rader.scrollTop = rader.scrollHeight; return d;
  };
  const platshallare = () => { input.placeholder = namn ? `Chat with ${dealer}…` : `What should ${dealer} call you?`; };
  platshallare();
  if (!namn) rad(dealer, "Hi there! What should I call you?", "dealer");
  let skickar = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim(); if (!text || skickar) return;
    input.value = "";
    const nytt = !namn;
    if (nytt) { namn = text.slice(0, 24); try { localStorage.setItem("roulette_namn", namn); } catch {} platshallare(); }
    const fraga = nytt ? `Hi, I'm ${namn}.` : text;
    rad(namn, text, "spelare");
    const skriver = rad(dealer, "…", "dealer skriver");
    skickar = true;
    try {
      const r = await fetch("/api/roulette/chat", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: bord, text: fraga, name: namn, state: lage() }) });
      const j = await r.json().catch(() => ({}));
      skriver.remove();
      rad(dealer, j.text ?? (r.status === 429 ? "One moment, I'm keeping up with the wheel." : "Sorry, I missed that."), "dealer");
    } catch { skriver.remove(); rad(dealer, "Sorry, I missed that.", "dealer"); }
    skickar = false;
  });
  // tangenter i chatten ska inte nå spelet (mellanslag, siffror)
  input.addEventListener("keydown", (e) => e.stopPropagation());
  return { el };
}
