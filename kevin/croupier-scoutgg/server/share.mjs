// Publik länk till Astrid-demot 2.0 via en Cloudflare-tunnel.
//
//   node share.mjs
//
// Startar demoservern (om den inte redan kör) och en trycloudflare-tunnel mot
// den. Adressen är ny varje gång och lever så länge processen gör det.
//
// Befintliga cloudflared-processer dödas INTE — kör du en annan tunnel
// samtidigt ska den få vara kvar.
//
// Adressen skrivs till public-url.txt — servern läser den därifrån och ger den till
// GPU-arbetaren, som ringer upp oss på /lipsync-worker (sessionsläget, ~1 s snabbare per svar).

import { spawn } from "node:child_process";
import { existsSync, createWriteStream, writeFileSync } from "node:fs";
import { loadEnv } from "./env.mjs";
import net from "node:net";
import path from "node:path";

const HERE = path.resolve(import.meta.dirname);          // server/
const ROOT = path.dirname(HERE);
const URLFILE = path.join(ROOT, "public-url.txt");

loadEnv();   // PORT m.m. ur .env
// cloudflared letas i paketets bin/, därefter i PATH. Binären checkas inte in
// (55 MB) — se README för nedladdningslänk.
const CF = [
  path.join(ROOT, "bin", process.platform === "win32" ? "cloudflared.exe" : "cloudflared"),
].find((p) => existsSync(p)) ?? (process.platform === "win32" ? "cloudflared.exe" : "cloudflared");
const PORT = Number(process.env.PORT ?? 8600);

if (!existsSync(CF) && !CF.startsWith("cloudflared")) {
  console.error(`\ncloudflared saknas: ${CF}\n`);
  process.exit(1);
}

/** Lyssnar något på porten redan? */
const portOpen = (port) => new Promise((ok) => {
  const s = net.connect({ host: "127.0.0.1", port }, () => { s.destroy(); ok(true); });
  s.on("error", () => ok(false));
  s.setTimeout(1500, () => { s.destroy(); ok(false); });
});

// gammal adress ska inte ligga kvar och lura servern medan tunneln startar
try { writeFileSync(URLFILE, ""); } catch {}

const children = [];
if (await portOpen(PORT)) {
  console.log(`demoservern kör redan på ${PORT}`);
} else {
  console.log(`startar demoservern på ${PORT}`);
  const srv = spawn(process.execPath, [path.join(HERE, "server.mjs")],
    { cwd: ROOT, stdio: "inherit", env: process.env });
  children.push(srv);
  for (let i = 0; i < 40 && !(await portOpen(PORT)); i++) {
    await new Promise((r) => setTimeout(r, 250));
  }
}

// Cloudflareds egen logg sparas. En trycloudflare-tunnel kan tappa kanten utan
// att processen dör — da svarar besokaren "Error 1033" medan allt ser friskt ut
// harifran. Loggen ar enda stallet det syns.
const LOG = path.join(ROOT, "tunnel.log");
const logfile = createWriteStream(LOG, { flags: "a" });

let cf = null;
let url = "";
let restarts = 0;

function announce(u) {
  url = u;
  console.log("\n" + "=".repeat(60));
  console.log("  DELA DEN HÄR LÄNKEN:");
  console.log("  " + u);
  console.log("=".repeat(60));
  console.log(`\n  logg: ${LOG}   ·   Ctrl+C stänger tunneln\n`);
}

function startTunnel() {
  // 127.0.0.1, inte "localhost": cloudflared slår upp localhost till IPv6 [::1]
  // och kan missa en server som bara lyssnar på IPv4.
  cf = spawn(CF, ["tunnel", "--url", `http://127.0.0.1:${PORT}`,
                  "--no-autoupdate", "--protocol", "http2"],
             { stdio: ["ignore", "pipe", "pipe"] });

  let found = false;
  const scan = (buf) => {
    const s = String(buf);
    logfile.write(s);
    // "api.trycloudflare.com" förekommer i cloudflareds egna felrader och är INTE vår adress —
    // fångades som sådan 2026-09-22 och sessionen beställdes mot fel adress (3 min "kallstart").
    const m = s.match(/https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/i);
    if (m && !found) {
      found = true;
      announce(m[0]);
      writeFileSync(URLFILE, m[0] + "\n");
    }
    // Starta BARA om när tunneln själv tappat kanten. "Unable to reach the
    // origin" betyder att vår Node-server är nere — tunneln är frisk, och att
    // starta om den då byter bara adress i onödan (trycloudflare delar ut ett
    // nytt slumpnamn varje gång). Det felet ska loggas, inte åtgärdas här.
    if (/Lost connection|no more connections active|Unregistered tunnel/i.test(s)) {
      logfile.write("\n>>> tunneln tappade kanten, startar om\n");
      try { cf.kill(); } catch {}
    }
  };
  cf.stdout.on("data", scan);
  cf.stderr.on("data", scan);   // cloudflared skriver adressen till stderr

  cf.on("exit", (code) => {
    if (stopping) return;
    console.error(`\ncloudflared avslutades (${code}) — startar om (${++restarts})`);
    setTimeout(startTunnel, 2000);
  });
}

let stopping = false;
const stop = () => {
  stopping = true;
  for (const c of [...children, cf]) { try { c?.kill(); } catch {} }
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

startTunnel();
