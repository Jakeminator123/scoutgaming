# Scoutgaming: instruktioner för Gemini CLI och Antigravity

Läs `START-HERE.md` (produktväg, hur man testar och levererar), `docs/NEXT-AGENT.md` (läget) och `AGENTS.md` (regler) i repots rot innan du ändrar något. Jakobs aktuella instruktioner går före.

- Egen branch `jakob/gemini-*` från färsk `origin/main`, PR mot `main`; aldrig `--no-verify`. Verifierade Jakobs agenter får merga inom sin tilldelning enligt `AGENTS.md`, endast via `tools/merge-pr.mjs` med ägar-, SHA- och CI-kontroller. En tilldelning kan begränsa uppdraget till implementation och PR.
- Rör aldrig `kevin*`, `codex/kevin-*`, `john*`, `codex/john-*`, `emil*`, `codex/emil-*`.
- Ord: se `apps/studio/docs/TERMINOLOGI.md` (referens). Sök hoppar över `.gitignore`, `.ignore` och `.cursorignore`; inventera med `git ls-files` (AGENTS.md).
