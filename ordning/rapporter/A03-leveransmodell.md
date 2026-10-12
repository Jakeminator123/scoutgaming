# A03 · Leveransmodell

Mätt 2026-10-12 från `jakob/repo-ordning` `43bb429c`. `origin/main` är
`919691072212c044ccaf5aeaa8f0b2fbf99b1bf5` ("Pin Studio migration 008 after
production apply"). Baslinjens `00ea55c5` ligger kvar som jämförelsepunkt i
BASLINJE.md. Ingen branch är raderad.

## Regler på GitHub

Ruleset **24642403**, namn "main: pull requests only", `enforcement: active`,
gäller bara `refs/heads/main`.

| Regel | Värde |
| --- | --- |
| Pull request | krävs, 0 godkännanden, merge eller squash |
| Radering | nekad |
| Icke-fast-forward | nekad |
| `bypass_actors` | fältet saknas i API-svaret |
| Denna token | `current_user_can_bypass: never` |

Baslinjen sa att admin alltid kan kringgå. Livesvaret listar ingen bypass.
Direkt-push till `main` kan därför stoppas av GitHub även för den som tror sig
vara admin. Det är inte omprövat här.

## Nuläge före ändringen

| Lager | Beteende |
| --- | --- |
| GitHub | PR krävs till `main` |
| `.githooks/pre-push` → `tools/check-push-target.mjs` | bara `refs/heads/main`, nekade radering och force, systemkarta per commit, exakt remote-sträng |
| `tools/push-github-work.mjs` | pushade `main` |
| `AGENTS.md`, `CLAUDE.md`, `work-branch-mirror.mdc`, `chef.mdc` | "work only on main" |
| Praktiken | feature-brancher pushades med `--no-verify` (PR #15, #17) |

## Alternativ

| | (a) Beslutat B1 | (b) | (c) |
| --- | --- | --- | --- |
| Push | `jakob/*`, `codex/*`, `cursor/*` plus `main` som uttrycklig nödväg | pre-push nekar `main` | som förut, `--no-verify` |
| Fördel | samma väg som GitHub-regeln, utan att stänga admin-vägen | omöjligt att råka pusha `main` lokalt | ingen kodändring |
| Nackdel | två vägar att hålla isär | nödvägen finns bara genom att stänga av hooken | reglerna fortsätter att motsäga GitHub |
| Agent | feature-branch, `node tools/push-github-work.mjs`, öppna PR själv | samma, men `main` är lokalvägen stängd | fortsätt `--no-verify` |

B1 i prompten är (a). (b) och (c) är inte införda.

## Infört

- `tools/repository-policy.json`: `featureBranches: ["jakob/*","codex/*","cursor/*"]`. `branch` är kvar `main`.
- Pre-push tillåter ny branch och fast-forward på de mönstren och på `main`. Den nekar radering, force-push, taggar, andra brancher (`kevin`, `john`, `emil`, `jakob-export`) och andra repo. Systemkartan körs fortfarande per pushad commit.
- Remote-kontrollen känner igen samma GitHub-repo som `git@` eller `https`, med eller utan `.git`, även när URL:en har inloggning. Andra repo nekas. Inloggning skrivs inte ut.
- `node tools/push-github-work.mjs` pushar aktuell feature-branch och skriver ut `gh pr create --repo Jakeminator123/scoutgaming --base main --head <branch>`. Den skapar inte PR. `--check` pushar inte. `--admin-main` är den enda vägen för verktyget att pusha `main`, och bara från `main`.
- Samma regeltext står i `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/work-branch-mirror.mdc` och `.cursor/rules/chef.mdc`.
- `CLAUDE.md` beskriver de fyra `/control`-grupperna och dagens brancher. Den gamla menyn och "branches: main, kevin, john, emil only" är borta.
- Chef-skillen pekar inte längre på beslutet från 2026-10-02 att målbranchen är `main`.

## Vad agenter ska göra

1. Arbeta på `jakob/*`, `codex/*` eller `cursor/*`.
2. Leverera med `node tools/push-github-work.mjs`.
3. Kör det utskrivna `gh pr create`-kommandot när en PR ska öppnas. Verktyget gör det inte.
4. Direkt-push till `main` bara när Jakob uttryckligen bett om nödvägen: `node tools/push-github-work.mjs --admin-main`. GitHub kan ändå neka den.

## Dubbletter

Inget raderat. Cursor-filerna är korta pekare. Codex-filerna är utförliga. Det ser avsiktligt ut.

| Par | Skillnad |
| --- | --- |
| `.cursor/skills/chef/SKILL.md` (8 rader) | pekar på `.agents/skills/chef/SKILL.md` |
| `.agents/skills/chef/SKILL.md` (91 rader) | själva rollen. Leveranstexten är uppdaterad till B1 |
| `.cursor/skills/ping-croupier/SKILL.md` (9 rader) | pekar på `.agents/skills/ping-croupier/SKILL.md` |
| `.agents/skills/ping-croupier/SKILL.md` | full inbox-text. En mening säger nu feature-branch |
| `.cursor/commands/chef.md` och `.agents/skills/source-command-chef/SKILL.md` | samma kommando, två ytor (Cursor respektive Codex) |
| `.cursor/commands/ping.md` | Cursor-kommandot. Ingen motsvarande fil under `.agents/skills/` utöver skillen |

Ospårad lokal `.agents/skills/source-command-ping/` finns inte i den här checkouten och är inte committad.
