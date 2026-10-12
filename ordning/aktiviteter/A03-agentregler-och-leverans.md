# A03 · Agentregler, leveransmodell och branchhygien

| Fält | Värde |
| --- | --- |
| Våg | 1 · parallell med A01, A02, A04–A06 |
| Väntar på | B1 för verktyg och regeltext, B13 för radering av brancher/worktrees |
| Branch / worktree | `jakob/ordning-a03` · `C:\Users\jakem\.cursor\worktrees\croupier\ordning-a03` |
| Modell | grok-4.7-xhigh-fast |
| Risk | 20 % · leveransverktyg och hooks |

## Mål

En enda, aktuell uppsättning agentregler och leveransregler som stämmer med
GitHubs regel för `main`, och ett beslutsunderlag för gamla brancher och
worktrees.

## Fakta (00ea55c5)

- GitHub-regel 24642403 "main: pull requests only" (sedan 2026-10-07): PR
  krävs, 0 godkännanden, merge eller squash, ingen radering, ingen
  non-fast-forward. Admin får alltid kringgå.
- Lokalt: `.githooks/pre-push` → `tools/check-push-target.mjs` tillåter bara
  `refs/heads/main`, nekar radering och icke-fast-forward, och kör
  `docs/system-map/verify.mjs --check --ref <sha>` per pushad commit.
  `tools/repository-policy.json`: `{mode, repository, branch: "main", gitlabPaused, checkpointTag, checkpointCommit}`.
- Feature-brancher har pushats med `--no-verify` (PR #15, #17). Dokumenten
  säger "work only on main; deliver with `node tools/push-github-work.mjs`":
  `AGENTS.md` ("GitHub-only work on main"), `CLAUDE.md`,
  `.cursor/rules/work-branch-mirror.mdc`, `.cursor/rules/chef.mdc`, README
  (A02) och `tools/push-github-work.mjs` / `push-work-mirrors.mjs`.
  Testfilen är `test/github-workflow.mjs`.
- `CLAUDE.md` listar den gamla `/control`-menyn och "Branches on GitHub: main,
  kevin, john, emil only". Verkligt läge: se BASLINJE §1 (åtta remote-brancher
  utöver `main`).
- Dubbla agentresurser: `.agents/skills/{chef,ping-croupier,source-command-chef}`,
  `.cursor/skills/{chef,ping-croupier}`, `.cursor/commands/{chef,ping}.md`.
  Dubbleringen kan vara avsiktlig (Codex läser `.agents/`, Cursor läser
  `.cursor/`). Ospårad lokal fil: `.agents/skills/source-command-ping/` (Jakobs,
  ska inte committas).

## Ägda filer

`AGENTS.md` (sektionerna om leverans, brancher och agentregler), `CLAUDE.md`,
`.cursor/rules/**`, `.cursor/commands/**`, `.cursor/skills/**`,
`.agents/skills/**` (spårade), `tools/check-push-target.mjs`,
`tools/repository-policy.json`, `tools/push-github-work.mjs`,
`tools/push-work-mirrors.mjs`, `test/github-workflow.mjs`, ny testfil för
push-spärren om den behövs, `.githooks/pre-push`, `.githooks/pre-commit-full`
(bara raden för en ny testfil), `ordning/rapporter/A03-*.md`.

**Rör inte:** `README.md` (A02), `docs/**`, `lab/AGENTS.md` (genereras av
`next dev`) och `lab/CLAUDE.md`.

## Steg

0. Steg 0 enligt ORKESTRERING §4. Läs regeln med
   `gh api repos/Jakeminator123/scoutgaming/rulesets/24642403` (läsning).
1. **Underlag** `ordning/rapporter/A03-leveransmodell.md`: nuläge mot förslag,
   med alternativen för B1:
   - (a) PR via `jakob/*`, `codex/*` och `cursor/*`; direkt-push till `main`
     endast som uttrycklig admin-nödväg;
   - (b) PR-only, där pre-push nekar `main`;
   - (c) som i dag, med `--no-verify`.

   Ange för- och nackdelar, berörda filer och vad agenter ska göra.
2. **När B1 finns i prompten:**
   - `check-push-target.mjs`: tillåt nya och uppdaterade brancher som matchar
     mönster i `repository-policy.json` (t.ex. `featureBranches: ["jakob/*","codex/*","cursor/*"]`).
     Behåll förbud mot radering, icke-fast-forward, andra repo och taggar. Behåll
     systemkartekontrollen. Behandla `main` enligt B1.
   - Prov för spärren: ny branch, uppdatering, radering, force-push, fel
     remote, `main`. Lägg dem i befintlig testfil eller en ny. En ny testfil ska
     in i `.githooks/pre-commit-full` (orphan-kontrollen).
   - `push-github-work.mjs`: anpassa till B1. Vid (a): pusha feature-branchen
     och skriv ut `gh pr create`-kommandot, utan att skapa PR automatiskt.
   - Samma regeltext i `AGENTS.md`, `CLAUDE.md`, `work-branch-mirror.mdc` och
     `chef.mdc`.
3. **CLAUDE.md:** synka sidlistan och brancherna med AGENTS.md och
   verkligheten. Ta bort påståenden som inte längre stämmer.
4. **Dubbletter:** jämför `.agents/skills/*` med `.cursor/skills/*`. Rapportera
   avvikande innehåll. Radera inget utan B-beslut.
5. **Branch- och worktree-underlag** `ordning/rapporter/A03-brancher.md`:
   - remote-brancher: före/efter `main`, senaste commit, mergad PR, förslag;
   - lokala worktrees (`git worktree list` och `git -C <wt> status --short | Measure-Object`):
     branch, osparade poster, förslag.

   Radera ingenting. Efter B13 raderar orkestratorn remote-brancher med
   `gh api -X DELETE repos/Jakeminator123/scoutgaming/git/refs/heads/<branch>`
   (pre-push nekar `git push --delete`) och worktrees med
   `git worktree remove` när de är tomma.
6. **Prov:** `node --test test/github-workflow.mjs <ny testfil>`,
   `node tools/check-orphan-tests.mjs` och
   `node docs/system-map/verify.mjs --check`.

## Klart när

- [ ] Rapporterna finns, och B1/B13 kan beslutas utifrån dem.
- [ ] (efter B1) Hooken, verktygen, testerna och de fyra regeldokumenten säger
      samma sak.
- [ ] CLAUDE.md beskriver dagens sidor och brancher.

## Tveksamt att lyfta

- Varje regeländring. Reglerna är Jakobs.
- `jakob-export` (78 egna commits): syfte okänt, rör den inte.
- Om dubblerade skills ska slås ihop.
