// Läser er RunPod-endpoints inställningar och säger vad som avviker från det
// arbetaren förutsätter. Ändrar ingenting — rättningar görs i RunPod-konsolen.
//
//   npm run kolla
//
// Kräver RUNPOD_ENDPOINT_ID och RUNPOD_API_KEY i .env.

import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.dirname(path.resolve(import.meta.dirname));
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

const headers = { authorization: `Bearer ${KEY}` };
const r = await fetch(`https://rest.runpod.io/v1/endpoints?includeTemplate=true&includeWorkers=true`, { headers, signal: AbortSignal.timeout(15000) });
if (!r.ok) { console.error(`RunPod svarade ${r.status}: ${(await r.text()).slice(0, 300)}`); process.exit(1); }
const list = await r.json();
const ep = (Array.isArray(list) ? list : list.endpoints ?? []).find((e) => e.id === ID);
if (!ep) {
  console.error(`Hittar ingen endpoint med id ${ID} på det här kontot. Finns:`);
  for (const e of (Array.isArray(list) ? list : list.endpoints ?? [])) console.error(`  ${e.id}  ${e.name}`);
  process.exit(1);
}

const rows = [];
const check = (label, value, ok, fix) => rows.push({ label, value: String(value ?? "—"), ok, fix });

const gpus = (ep.gpuTypeIds ?? []).map(String);
check("GPU-typer", gpus.join(", ") || "inga",
  gpus.length === 1 && /4090/.test(gpus[0]),
  "bara RTX 4090 (24 GB, snabbast). L40S var långsammare och dyrare. INTE 5090 (imagen är cu121 och startar inte på sm_120).");
check("Workers max", ep.workersMax, (ep.workersMax ?? 0) >= 4, "minst 4 — varje server behöver en för sessionen och en för förnyelsen, och endpointen delas av två servrar.");
check("Workers active (min)", ep.workersMin, (ep.workersMin ?? 0) <= 1, "0 i vila; 1 bara under bokade demon (kostar dygnet runt annars).");
check("Idle timeout", `${ep.idleTimeout} s`, (ep.idleTimeout ?? 0) >= 60, "60 s — annars kallstartar en ny fråga strax efter den förra.");
check("Execution timeout", `${ep.executionTimeoutMs} ms`, (ep.executionTimeoutMs ?? 0) >= 600_000,
  "600000 ms (600 s). Sessionen är ett jobb på 540 s + 45 s — kortare timeout dödar den mitt i ett svar.");
check("FlashBoot", ep.flashboot, ep.flashboot === true || ep.flashboot === undefined, "på — kortare kallstart.");
if (ep.template) {
  const img = ep.template.imageName ?? ep.template.containerImage ?? "";
  check("Image", img || ep.template.name, true, "");
}
// bara det man vill se — arbetarobjektet bär även RunPods interna nycklar, de ska inte i terminalen
const w = ep.workers ?? ep.workerSummary ?? null;
if (Array.isArray(w)) check("Workers nu", w.length ? w.map((x) => `${x.id} ${x.desiredStatus ?? "?"} $${x.costPerHr ?? "?"}/h ${(x.imageName ?? "").split(":").pop()}`).join(" · ") : "inga", true, "");

console.log(`\nEndpoint ${ep.name} (${ep.id})\n`);
let bad = 0;
for (const x of rows) {
  const mark = x.ok ? "OK  " : "FIX ";
  if (!x.ok) bad++;
  console.log(`${mark} ${x.label.padEnd(22)} ${x.value}`);
  if (!x.ok) console.log(`     → ${x.fix}`);
}
console.log(bad ? `\n${bad} sak(er) att rätta i RunPod-konsolen (Serverless → ${ep.name} → Edit).\n` : "\nAllt ser rätt ut.\n");
process.exit(bad ? 2 : 0);
