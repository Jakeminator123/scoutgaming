# Scoutgaming: instruktioner för Gemini CLI och Antigravity

Läs `START-HERE.md` (produktväg, hur man testar och levererar), `docs/NEXT-AGENT.md` (läget) och `AGENTS.md` (regler) i repots rot innan du ändrar något. Jakobs aktuella instruktioner går före.

- Egen branch `jakob/gemini-*` från färsk `origin/main`, PR mot `main`; aldrig `--no-verify`. Merga aldrig själv: orkestratorn mergar via `tools/merge-pr.mjs` efter grön CI.
- Rör aldrig `kevin*`, `codex/kevin-*`, `john*`, `codex/john-*`, `emil*`, `codex/emil-*`.
- Ord: se `apps/studio/docs/TERMINOLOGI.md` (referens). Sök hoppar över `.gitignore`, `.ignore` och `.cursorignore`; inventera med `git ls-files` (AGENTS.md).
