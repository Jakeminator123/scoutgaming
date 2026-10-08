// .env i paketets rot → process.env. Redan satta miljövariabler vinner (PORT=8501 npm start fungerar).
// Ligger paketet i en mapp som själv har en .env (croupier-consult/) läses den som reserv.

import { readFileSync } from "node:fs";
import path from "node:path";

export const ROOT = path.dirname(path.dirname(path.resolve(import.meta.filename)));

export function loadEnv() {
  for (const f of [path.join(ROOT, ".env"), path.join(path.dirname(ROOT), ".env")]) {
    let txt;
    try { txt = readFileSync(f, "utf8"); } catch { continue; }
    for (const line of txt.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m || line.trimStart().startsWith("#")) continue;
      const v = m[2].trim().replace(/^["']|["']$/g, "");
      if (v && process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  }
}

/** Obligatorisk nyckel — begripligt fel om den saknas. */
export function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`\n${name} saknas.\nKopiera .env.example till .env och fyll i den (se README).\n`);
    process.exit(1);
  }
  return v;
}
