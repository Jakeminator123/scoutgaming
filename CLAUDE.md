# Scoutgaming

Läs `START-HERE.md` (produktväg, hur man testar och levererar), `docs/NEXT-AGENT.md` (läget) och `AGENTS.md` (regler) i repots rot innan du ändrar något. Jakobs aktuella instruktioner går före.

- Egen branch `jakob/claude-*` från färsk `origin/main`, PR mot `main`; aldrig `--no-verify`. Skriv exakt `#Jakobs agent` på en egen synlig rad i PR-beskrivningen för verkliga uppdrag från Jakob; märkningen bevisar inte ägarskap.
- Alla verifierade Jakobs agenter får merga hans arbete inom sin tilldelning. Läs färskt PR-nummer, författare/konto (`Jakeminator123`), källrepo, headbranch och full SHA; verifiera ägare mot `inbox/people.json` från betrodd aktuell main samt känt Jakob-uppdrag och rapporterad SHA. Följ övriga grindar i `AGENTS.md` och använd endast `node tools/merge-pr.mjs <nr> --head <full-sha>` efter grön CI på exakt head (`--base preview` för preview).
- Rör aldrig `kevin*`, `codex/kevin-*`, `john*`, `codex/john-*`, `emil*`, `codex/emil-*`.
- Ord: se `apps/studio/docs/TERMINOLOGI.md` (referens). Terminalens `rg` använder `.gitignore` och `.ignore`; Cursor använder även `.cursorignore` för AI-åtkomst. Inventera spårade filer med `git ls-files` och följ sekretessgränserna i AGENTS.md.

Claude Code: underagenter arbetar i `.claude/worktrees` på `jakob/claude-*`. En avgränsad tilldelning kan begränsa leveransen till implementation och PR utan merge.

Spärr (Jakob 2026-10-29): en underagent startas alltid med tom kontext och en kort brief (uppgift, fil:rad, prov). Återuppta aldrig en avslutad underagent (SendMessage/resume) och använd aldrig fork; uppföljning och rättning görs av en ny agent med en ny brief. Underagenter läser bara det uppgiften kräver, och väntar inte på CI i sin egen tråd.
