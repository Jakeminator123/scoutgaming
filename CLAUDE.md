# Scoutgaming

Läs `START-HERE.md` (produktväg, hur man testar och levererar), `docs/NEXT-AGENT.md` (läget) och `AGENTS.md` (regler) i repots rot innan du ändrar något. Jakobs aktuella instruktioner går före.

- Egen branch `jakob/claude-*` från färsk `origin/main`, PR mot `main`; aldrig `--no-verify`. Merga aldrig själv: orkestratorn mergar via `tools/merge-pr.mjs` efter grön CI.
- Rör aldrig `kevin*`, `codex/kevin-*`, `john*`, `codex/john-*`, `emil*`, `codex/emil-*`.
- Ord: se `apps/studio/docs/TERMINOLOGI.md` (referens). Sök hoppar över `.gitignore`, `.ignore` och `.cursorignore`; inventera med `git ls-files` (AGENTS.md).

Claude Code: underagenter arbetar i `.claude/worktrees` på `jakob/claude-*` och mergar inte; den orkestrerande sessionen mergar efter grön CI.

Spärr (Jakob 2026-10-29): en underagent startas alltid med tom kontext och en kort brief (uppgift, fil:rad, prov). Återuppta aldrig en avslutad underagent (SendMessage/resume) och använd aldrig fork; uppföljning och rättning görs av en ny agent med en ny brief. Underagenter läser bara det uppgiften kräver, och väntar inte på CI i sin egen tråd.
