// Roulette beside the blackjack (Emil 30 Oct): its pages, its Table Studio tables and its share links, in one place so
// server.mjs only wires it in and the blackjack's routes, tables (studio-tables.json) and page policy stay untouched.
//   /studio/roulette/                 the roulette Table Studio (public/studio/roulette/, the same back office sign-in)
//   GET  /api/studio/roulette-table?slug=   a table's choices without its owner (the game reads them with ?table=)
//   POST /api/studio/roulette-table         builds a table (signed in, same origin, rate limited, like /api/studio/table)
//   /t/<slug>                         302 to the game when the slug is a roulette table (blackjack tables are matched first)
//   /roulette/                        the game page, behind the same demo gate as the blackjack page
// The game page gets its own Content-Security-Policy: the global one plus the hash of its inline import map (three.js)
// and blob: for the wheel module (js/hjul.mjs runs the wheel file's module as a blob). Every other page keeps the global one.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { createRouletteTables } from "./roulette-tables.mjs";

// A roulette that cannot start (catalogue or page missing) turns itself off and never takes the blackjack server down.
export function createRouletteRoutes(opts) {
  try { return rouletteRoutes(opts); }
  catch (e) { console.error("roulette off:", e.message); return { api: async () => false, http: async () => false, tables: { get: () => null } }; }
}

function rouletteRoutes({ publicDir, tablesFile, reserved = () => false, isOtherTable = () => false, sendFile, json, body, bo,
  sameOrigin = () => true, apiLimit = () => true, clientAddress = () => "", onCreated = () => {}, gate = null, strict = false, denied = null }) {
  const katalog = JSON.parse(readFileSync(path.join(publicDir, "roulette", "katalog.json"), "utf8"));
  const tables = createRouletteTables(tablesFile, katalog, { reserved });
  const index = path.join(publicDir, "roulette", "index.html");
  const hashes = [...readFileSync(index, "utf8").matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => `'sha256-${createHash("sha256").update(m[1]).digest("base64")}'`).join(" ");
  const pagePolicy = res => {
    const c = res.getHeader("Content-Security-Policy");
    if (typeof c === "string") res.setHeader("Content-Security-Policy", c.replace("script-src 'self'", `script-src 'self' blob: ${hashes}`));
  };
  const redirect = (res, to) => { res.writeHead(302, { Location: to, "Cache-Control": "no-store" }); res.end(); };
  const user = async req => { try { return await bo.user(req.headers); } catch { return null; } };
  const gateOn = () => Boolean(gate?.on);

  // true when the route was roulette's
  async function api(req, res, route) {
    if (route !== "studio/roulette-table") return false;
    if (req.method === "GET") {
      const t = tables.get(new URL(req.url, "http://x").searchParams.get("slug") ?? "");
      if (!t) { json(res, 404, { error: "No such table" }); return true; }
      const { owner, ...pub } = t;
      json(res, 200, { ...pub, url: tables.gameUrl(pub) }); return true;
    }
    if (req.method !== "POST") { json(res, 405, { error: "Use GET or POST" }); return true; }
    if (!sameOrigin(req)) { json(res, 403, { error: "Invalid origin" }); return true; }
    let who;
    try { who = await bo.user(req.headers); } catch { json(res, 503, { error: "Sign-in is unavailable. Try again shortly." }); return true; }
    if (!who) { json(res, 401, { error: "Sign in required" }); return true; }
    if (!apiLimit(clientAddress(req))) { json(res, 429, { error: "Please try again later" }); return true; }
    try {
      const input = await body(req);
      if ((who.hiddenDealers ?? []).includes(input?.dealer)) { json(res, 403, { error: "That dealer is not available for this account" }); return true; }
      const { owner, ...t } = tables.create(input, who.user);
      onCreated(req, who, t);
      json(res, 201, { ...t, url: tables.gameUrl(t) });
    } catch (e) { json(res, 400, { error: e.message }); }
    return true;
  }

  // true when the request was roulette's
  async function http(req, res) {
    const url = new URL(req.url, "http://x"), p = url.pathname;
    if (p === "/roulette") { redirect(res, "/roulette/" + url.search); return true; }
    if (p === "/studio/roulette") { redirect(res, "/studio/roulette/"); return true; }
    if (p === "/studio/roulette/") { sendFile(req, res, path.join(publicDir, "studio", "roulette", "index.html")); return true; }
    const share = /^\/t\/([a-z0-9_-]{1,40})\/?$/.exec(p);
    if (share && !isOtherTable(share[1]) && tables.get(share[1])) {
      if (strict && gateOn() && !(await user(req))) { denied(res); return true; }
      redirect(res, tables.gameUrl(tables.get(share[1]))); return true;
    }
    let file = null;
    try { file = path.normalize(path.join(publicDir, decodeURIComponent(p))); } catch { return false; }
    if (p !== "/roulette/" && file !== index) return false;
    // the gate as on the blackjack page: a table built in the studio, or a signed-in back office account
    if (gateOn()) {
      const table = tables.get(url.searchParams.get("table") ?? "");
      const who = strict || !table ? await user(req) : null;
      if (strict && !who) { denied(res); return true; }
      if (!table && !who) { redirect(res, gate.passwordPage); return true; }
    }
    pagePolicy(res);
    sendFile(req, res, index);
    return true;
  }

  return { api, http, tables };
}
