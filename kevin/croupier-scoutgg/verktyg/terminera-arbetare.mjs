// Terminerar endpointens arbetare så att nästa jobb startar en ny från aktuell template.
// Behövs efter ett nytt bygge: RunPod byter template men låter befintliga (även exited)
// arbetare leva kvar med den gamla imagen, och de tar nästa jobb. Motsvarar knappen
// "Terminate workers" i konsolen.
//
//   node verktyg/terminera-arbetare.mjs
//
// Kräver RUNPOD_ENDPOINT_ID och RUNPOD_API_KEY i .env. Kostar inget; inga jobb får vara igång.

import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.dirname(path.resolve(import.meta.dirname));
for (const f of [path.join(ROOT, ".env"), path.join(path.dirname(ROOT), ".env")]) try {
  for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m || line.trimStart().startsWith("#")) continue;
    const v = m[2].trim().replace(/^["']|["']$/g, "");
    if (v && process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
} catch {}

const ID = process.env.RUNPOD_ENDPOINT_ID, KEY = process.env.RUNPOD_API_KEY;
if (!ID || !KEY) { console.error("RUNPOD_ENDPOINT_ID och RUNPOD_API_KEY måste stå i .env"); process.exit(1); }
const headers = { authorization: `Bearer ${KEY}`, "content-type": "application/json" };

const r = await fetch(`https://rest.runpod.io/v1/endpoints/${ID}?includeWorkers=true`, { headers, signal: AbortSignal.timeout(20000) });
const ep = await r.json();
const workers = ep.workers ?? [];
if (!workers.length) { console.log("inga arbetare att terminera"); process.exit(0); }

let ok = 0;
for (const w of workers) {
  const tag = (w.imageName ?? "").split(":").pop();
  // REST: arbetare är poddar
  let res = await fetch(`https://rest.runpod.io/v1/pods/${w.id}`, { method: "DELETE", headers, signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    // reserv: GraphQL podTerminate
    res = await fetch(`https://api.runpod.io/graphql?api_key=${KEY}`, {
      method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ query: `mutation { podTerminate(input: { podId: "${w.id}" }) }` }),
    });
  }
  const txt = await res.text();
  const fine = res.ok && !/errors/.test(txt);
  if (fine) ok++;
  console.log(`${fine ? "terminerad" : "MISSLYCKADES"}  ${w.id}  ${w.desiredStatus ?? "?"}  ${tag}${fine ? "" : "  " + txt.slice(0, 160)}`);
}
console.log(`\n${ok}/${workers.length} terminerade. Nästa jobb startar en ny arbetare från aktuell template.`);
process.exit(ok === workers.length ? 0 : 2);
