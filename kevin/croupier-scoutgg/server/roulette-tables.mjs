// Roulette tables built in the roulette Table Studio. The same record and file format as server/studio-tables.mjs
// ({dealer, room, felt, lang, limit, logoPos, name<=28, layout, tempo, custom, logo, logoName, slug, created, owner}) plus
// game: "roulette" and wheel. The choices are checked against the catalogue (public/roulette/katalog.json). The tables live
// in a file of their own (roulette-tables.json beside studio-tables.json), so the blackjack's tables are never rewritten.
// reserved(slug): true when the address is already a blackjack table or a room, so two tables never share /t/<slug>.
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import path from "node:path";

// the same slug as studio-tables.mjs
const slugOf = (name) => name.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim()
  .replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 32).replace(/^-|-$/g, "") || "table";

export function createRouletteTables(file, katalog, { reserved = () => false } = {}) {
  let tables = {};
  try { tables = JSON.parse(readFileSync(file, "utf8")); } catch {}
  const persist = () => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file + ".tmp", JSON.stringify(tables)); renameSync(file + ".tmp", file); };
  const CHOICES = { dealer: Object.keys(katalog.dealers), wheel: Object.keys(katalog.wheels), room: Object.keys(katalog.rooms),
    limit: Object.keys(katalog.limits).filter((k) => k !== "rl-motor"), lang: ["en", "sv"] };

  function create(input = {}, owner = null) {
    if ((input.game ?? "roulette") !== "roulette") throw new Error("Invalid game");
    const config = { game: "roulette" };
    for (const [key, allowed] of Object.entries(CHOICES)) {
      const v = input[key] ?? (key === "lang" ? "en" : undefined);
      if (!allowed.includes(v)) throw new Error(`Invalid ${key}`);
      config[key] = v;
    }
    if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 28) throw new Error("Invalid table name");
    config.name = input.name.trim();
    // the blackjack record's fields roulette does not use yet: same names, neutral values
    Object.assign(config, { felt: "prive", logoPos: "both", layout: "desk", tempo: 1, custom: null, logo: null, logoName: null });
    const base = slugOf(config.name);
    let slug = base;
    for (let n = 2; tables[slug] || reserved(slug); n++) slug = `${base}-${n}`;
    tables[slug] = { ...config, slug, created: new Date().toISOString(), ...(owner ? { owner } : {}) };
    persist();
    return tables[slug];
  }
  const get = (slug) => (Object.hasOwn(tables, slug) ? tables[slug] : null);
  // the game's address for a table: its own session, the choices along as a fallback if the table lookup does not answer
  const gameUrl = (t) => `/roulette/?${new URLSearchParams({ session: t.slug, table: t.slug, dealer: t.dealer, wheel: t.wheel, room: t.room, limit: t.limit })}`;
  return { create, get, gameUrl };
}
