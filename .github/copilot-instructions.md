# Scoutgaming: instruktioner för GitHub Copilot

Läs `START-HERE.md` (produktväg, hur man testar och levererar), `docs/NEXT-AGENT.md` (läget) och `AGENTS.md` (regler) i repots rot innan du ändrar något. Jakobs aktuella instruktioner går före.

- Egen branch `jakob/copilot-*` från färsk `origin/main`, PR mot `main`; aldrig `--no-verify`. På Jakobs uppdrag: skriv `#Jakobs agent` i PR-beskrivningen. Verifierade Jakobs agenter får inom sin tilldelning merga hans arbete till `main`/`preview` via `tools/merge-pr.mjs` efter grön CI och samtliga ägar- och SHA-kontroller i AGENTS.md; markören ersätter inte dessa.
- Rör aldrig `kevin*`, `codex/kevin-*`, `john*`, `codex/john-*`, `emil*`, `codex/emil-*`.
- Ord: se `apps/studio/docs/TERMINOLOGI.md` (referens). Terminalens `rg` följer `.gitignore` och `.ignore`, inte `.cursorignore`. Cursor använder dessutom `.cursorignore` för sin AI-åtkomst. Inventera med `git ls-files` och följ sekretessgränserna i AGENTS.md även där.
