# Scoutgaming
Läs [START-HERE.md](START-HERE.md) (produktväg, identiteter, läge, hur man testar och levererar) och [AGENTS.md](AGENTS.md) (regler) i repots rot innan du ändrar något. Jakobs aktuella instruktioner går före.

- Egen branch `jakob/claude-*` från färsk `origin/main`; PR mot `main`.
- Aldrig `--no-verify`. Merga aldrig utan Jakob.
- Rör inte brancherna `kevin*`, `codex/*`, `john` och `emil`.
- Ord enligt [TERMINOLOGI](apps/studio/docs/TERMINOLOGI.md).
- Sök utgår från `git ls-files`: `.ignore` och `.cursorignore` döljer filer för ripgrep och editorns AI.

Claude Code: underagenter arbetar i `.claude/worktrees` på `jakob/claude-*` och mergar inte; den orkestrerande sessionen mergar efter grön CI.
