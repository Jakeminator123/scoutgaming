// Bordet: katalogen (dealers, hjul, rum, gränser) plus bordets val. Valen kommer från ett sparat bord (?table=<slug>, hämtas
// med GET /api/studio/roulette-table?slug=, rouletteborden i kevin-staging) och kan ersättas eller kompletteras med ?dealer=&wheel=&room=&limit=.
// Saknas ett val används katalogens standard (astrid2, champagne, champagne, rl-motor).
const KATALOG = new URL("../katalog.json", import.meta.url).href;

export async function laddaBord(Q = new URLSearchParams(location.search)) {
  const katalog = await (await fetch(KATALOG)).json();
  let sparat = null;
  const slug = Q.get("table");
  if (slug) {
    try { const r = await fetch(`/api/studio/roulette-table?slug=${encodeURIComponent(slug)}`); if (r.ok) sparat = await r.json(); } catch {}
    if (!sparat) console.warn("bordet hittades inte:", slug);
  }
  const val = {};
  for (const [k, lista] of [["dealer", "dealers"], ["wheel", "wheels"], ["room", "rooms"], ["limit", "limits"]]) {
    const v = Q.get(k) ?? sparat?.[k];
    val[k] = Object.hasOwn(katalog[lista], v ?? "") ? v : katalog.standard[k];
  }
  const limit = katalog.limits[val.limit];
  return {
    katalog, val, slug: sparat?.slug ?? null,
    namn: sparat?.name ?? Q.get("name") ?? "Roulette",
    lang: Q.get("lang") ?? (sparat?.lang === "sv" ? "en" : sparat?.lang) ?? "en",   // bara engelska finns än (js/text.mjs)
    dealer: katalog.dealers[val.dealer], wheel: katalog.wheels[val.wheel], room: katalog.rooms[val.room],
    limit, granser: { min: limit.min, maxPerBet: limit.maxPerBet, maxTotal: limit.maxTotal },
  };
}
