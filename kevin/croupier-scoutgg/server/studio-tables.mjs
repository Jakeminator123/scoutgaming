// Table Studio (John's demo flow): an operator's table config, saved per slug. The share
// link /t/<slug> opens the real game on its own table with that dealer, room and language.
import { readFileSync, writeFileSync, renameSync } from "node:fs";

// Betting limits per table preset. The server enforces them (shared-table.mjs and the engine);
// the studio and the game only show them. A refill adds the preset's starting balance again.
const preset = (name, min, max, sideMax, balance, chips) => Object.freeze({ name, min, max, sideMax, balance, chips: Object.freeze(chips) });
export const LIMIT_PRESETS = Object.freeze({
  casual: preset("Casual", 1, 500, 50, 500, [1, 5, 10, 25, 50, 100]),
  prive: preset("Privé", 5, 2000, 200, 1000, [5, 10, 25, 50, 100, 500]),
  high: preset("High Roller", 100, 25000, 1000, 50000, [100, 500, 1000, 5000, 10000, 25000]),
});
// Tables that were not built in the studio keep the demo's original limits.
export const DEFAULT_LIMITS = preset("Privé", 5, 2000, 2000, 1000, [5, 10, 25, 50, 100, 500]);
// An operator logo: a PNG/JPEG/WebP data URL (the studio rasterises SVG first), never a remote URL.
const LOGO = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export const LOGO_MAX = 400000;

export const STUDIO_CHOICES = Object.freeze({
  dealer: ["astrid", "dragge", "paow", "astrid2"],
  room: ["darkhall", "mahogany", "golden", "azure"],
  felt: ["prive", "emerald", "midnight", "burgundy", "custom"],
  lang: ["en", "es", "fr", "sv", "zh", "pt", "ko"],
  limit: Object.keys(LIMIT_PRESETS),
  logoPos: ["both", "felt", "header"],
});

// Kevin 16 Oct: Mårten is not in prod. His tables play on with Paow (he was built on her plate: same table, shoe and seats).
export const RETIRED_DEALERS = Object.freeze({ marten: "paow" });

const slugOf = name => name.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim()
  .replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 32).replace(/^-|-$/g, "") || "table";

// reserved(slug): true when a slug is already a table people play at (e.g. the public "astrid" room),
// so a studio table never takes over its wallets and bets.
// The deal tempos a studio table can have (Emil 28 Oct): Slow, Normal, Fast, Turbo.
export const TEMPOS = [1, 1.5, 2, 2.5];

export function createStudioTables(file, { reserved = () => false } = {}) {
  let tables = {};
  try { tables = JSON.parse(readFileSync(file, "utf8")); } catch {}
  for (const t of Object.values(tables)) if (Object.hasOwn(RETIRED_DEALERS, t.dealer)) t.dealer = RETIRED_DEALERS[t.dealer];
  const persist = () => { writeFileSync(file + ".tmp", JSON.stringify(tables)); renameSync(file + ".tmp", file); };

  // owner: the back office account that built it (Kevin 12 Oct: an aggregator only sees its own account).
  function create(input = {}, owner = null) {
    const config = {};
    for (const [key, allowed] of Object.entries(STUDIO_CHOICES)) {
      if (!allowed.includes(input[key])) throw new Error(`Invalid ${key}`);
      config[key] = input[key];
    }
    if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 28) throw new Error("Invalid table name");
    config.name = input.name.trim();
    // Kevin 20 Oct: a table can open in the phone layout on a computer too (desk-mode.js ?layout=mobile).
    config.layout = input.layout === "mobile" ? "mobile" : "desk";
    // Emil 28 Oct: the tempo the dealer deals at (Slow 1x, Normal 1.5x, Fast 2x, Turbo 2.5x). An old client sends none: 1x.
    config.tempo = TEMPOS.includes(Number(input.tempo)) ? Number(input.tempo) : 1;
    config.custom = /^#[0-9a-f]{6}$/i.test(input.custom ?? "") ? input.custom : null;
    if (input.logo != null && input.logo !== "" && (typeof input.logo !== "string" || input.logo.length > LOGO_MAX || !LOGO.test(input.logo)))
      throw new Error("Logo must be a PNG, JPEG or WebP image under 300 KB");
    config.logo = input.logo || null;
    config.logoName = config.logo && typeof input.logoName === "string" ? input.logoName.slice(0, 80) : null;
    const base = slugOf(config.name);
    let slug = base;
    for (let n = 2; tables[slug] || reserved(slug); n++) slug = `${base}-${n}`;
    tables[slug] = { ...config, slug, created: new Date().toISOString(), ...(owner ? { owner } : {}) };
    persist();
    return tables[slug];
  }

  const get = slug => Object.hasOwn(tables, slug) ? tables[slug] : null;
  // A table's deal tempo; tables saved before tempo existed, and rooms that are not studio tables, deal at 1x.
  const tempoFor = slug => get(slug)?.tempo ?? 1;
  // The limits a room plays with: its studio preset, or the demo's original limits.
  const limitsFor = slug => { const t = get(slug); return t ? { ...LIMIT_PRESETS[t.limit], preset: t.limit, tableName: t.name } : DEFAULT_LIMITS; };

  // The game URL for a saved table: its own shared-table session, so every table plays apart.
  const gameUrl = t => `/?${new URLSearchParams({ dealer: t.dealer, room: t.room, lang: t.lang, session: t.slug, table: t.slug, ...(t.layout === "mobile" ? { layout: "mobile" } : {}) })}`;

  // A back office account's own tables, newest first.
  const ownedBy = owner => Object.values(tables).filter(t => owner && t.owner === owner).sort((a, b) => b.created.localeCompare(a.created));

  return { create, get, gameUrl, limitsFor, ownedBy, tempoFor };
}
