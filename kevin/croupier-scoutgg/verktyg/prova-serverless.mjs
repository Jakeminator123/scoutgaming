// Provar serverless-läppsynken från grunden, utan demoservern:
//
//   npm run prova:serverless
//
//   1. health-jobb          → hur lång är kallstarten just nu?
//   2. lipsync-jobb         → ett riktigt klipp på Astrids stillbild (testljud i verktyg/prov.wav)
//   3. lipsync-jobb igen    → så här snabbt går det varmt
//
// Klippen sparas i answers/ och sökvägarna skrivs ut — öppna dem och titta.
// Kräver RUNPOD_ENDPOINT_ID och RUNPOD_API_KEY i .env. Kostar ett par minuters GPU-tid.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const HERE = path.resolve(import.meta.dirname);
const ROOT = path.dirname(HERE);
// .env i paketet först, sedan croupier-consult/.env (Emils nycklar) som reserv; satta variabler vinner
const ENVFILES = [path.join(ROOT, ".env"), path.join(path.dirname(ROOT), ".env")];
for (const f of ENVFILES) try {
  for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m || line.trimStart().startsWith("#")) continue;
    const v = m[2].trim().replace(/^["']|["']$/g, "");
    if (v && process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
} catch {}

const ID = process.env.RUNPOD_ENDPOINT_ID, KEY = process.env.RUNPOD_API_KEY;
if (!ID || !KEY) { console.error("RUNPOD_ENDPOINT_ID och RUNPOD_API_KEY måste stå i .env"); process.exit(1); }
const BASE = `https://api.runpod.ai/v2/${ID}`;
const headers = { "content-type": "application/json", authorization: `Bearer ${KEY}` };

async function api(p, init = {}) {
  const r = await fetch(`${BASE}/${p}`, { ...init, headers, signal: AbortSignal.timeout(10000) });
  return r.json();
}

/** /run + statuspoll (som servern gör). Returnerar { output, ms, delayMs, execMs }. */
async function job(input, budgetMs = 180_000) {
  const t0 = Date.now();
  let j = await api("run", { method: "POST", body: JSON.stringify({ input }) });
  if (!j.id) throw new Error(j.error ?? "inget jobb-id");
  process.stdout.write(`  jobb ${j.id} `);
  let last = "";
  while (j.status !== "COMPLETED") {
    if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(j.status)) throw new Error(j.output?.error ?? j.error ?? j.status);
    if (Date.now() - t0 > budgetMs) { await api(`cancel/${j.id}`, { method: "POST" }).catch(() => {}); throw new Error("tidsgräns"); }
    if (j.status !== last) { process.stdout.write(`${j.status.toLowerCase()} `); last = j.status; }
    await new Promise((r) => setTimeout(r, 500));
    j = await api(`status/${j.id}`);
  }
  process.stdout.write("\n");
  if (j.output?.error) throw new Error(j.output.error);
  return { output: j.output, ms: Date.now() - t0, delayMs: j.delayTime, execMs: j.executionTime };
}

const fmt = (ms) => `${(ms / 1000).toFixed(1)} s`;

// 0. läget just nu
const h = await api("health").catch(() => null);
if (h?.workers) console.log(`arbetare nu: ${JSON.stringify(h.workers)}  ·  jobb: ${JSON.stringify(h.jobs ?? {})}`);
const cold = !h?.workers || (h.workers.idle ?? 0) + (h.workers.running ?? 0) + (h.workers.ready ?? 0) === 0;
console.log(cold ? "ingen varm arbetare — det här blir en kallstart (räkna med 35–90 s)\n" : "det finns en varm arbetare\n");

// 1. health-jobbet
console.log("1. health");
const h1 = await job({ op: "health" }, 420_000);   // ny image på ny maskin: pull av ~10 GB kan ta minuter
console.log(`   klart på ${fmt(h1.ms)} (kö ${fmt(h1.delayMs ?? 0)}, körning ${fmt(h1.execMs ?? 0)})`);
console.log(`   motor: ${JSON.stringify(h1.output?.warm ?? h1.output)}\n`);
if (h1.output?.error) { console.error(`motorn rapporterar fel: ${h1.output.error}`); process.exit(1); }

// 2 + 3. två riktiga klipp
const wav = readFileSync(path.join(HERE, "prov.wav"));
const outDir = path.join(ROOT, "answers");
mkdirSync(outDir, { recursive: true });
const files = [];
for (const [n, label] of [[2, "första klippet"], [3, "varmt klipp"]]) {
  console.log(`${n}. ${label}`);
  const r = await job({ op: "lipsync", wav_b64: wav.toString("base64"), crf: 13, preset: "ultrafast" });
  const file = path.join(outDir, `prov-serverless-${n - 1}.mp4`);
  writeFileSync(file, Buffer.from(r.output.mp4_b64, "base64"));
  files.push(file);
  console.log(`   ${r.output.frames} rutor (${(r.output.frames / 24).toFixed(1)} s) på ${fmt(r.ms)}  ·  arbetarens steg: ${JSON.stringify(r.output.t)}`);
  console.log(`   ${file}\n`);
}

console.log("Klart. Öppna klippen och kontrollera: rätt ansikte, stilla bakgrund, munnen i takt.");
for (const f of files) console.log("  " + f);
