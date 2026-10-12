# A03 · Brancher

Mätt 2026-10-12 mot `origin/main` `919691072212c044ccaf5aeaa8f0b2fbf99b1bf5`.
`git fetch origin` är körd. Ingen branch och ingen worktree är raderad.
Före = commits som finns på branchen men inte på `main`. Efter = commits som
finns på `main` men inte på branchen.

Historiken skrevs om 2026-10-12. Talen går därför inte att jämföra rakt av med
baslinjens 113/83, 1/62, 0/178 och 78/83.

## Remote

| Branch | Före | Efter | Spets | PR | Förslag till orkestratorn |
| --- | ---: | ---: | --- | --- | --- |
| `main` | – | – | `91969107` 2026-10-12 Pin Studio migration 008 | – | behåll |
| `kevin` | 115 | 96 | `204ddf87` 2026-10-12 dealer clips load 4 at a time | ingen | behåll. Egen app. Baslinjen hade `eea5e40b` |
| `john` | 1 | 75 | `47af5385` 2026-10-10 partner portal sketch | ingen | behåll. En egen commit |
| `emil` | 0 | 191 | `01b5aa49` 2026-10-07 operator tenants | ingen | innehållet ligger i `main`, men radera inte ännu. `inbox/people.json` pekar Emil på branchen `emil` |
| `jakob-export` | 78 | 96 | `1842d550` 2026-10-10 export dealer material | ingen | behåll. Syfte okänt (T5) |
| `jakob/repo-ordning` | 3 | 2 | `43bb429c` 2026-10-12 ordning plan | #19 öppen | behåll. De två på `main` som saknas här är `12a12fd6` och `91969107` |
| `codex/dealer-desktop-framing` | 0 | 29 | `52db8f2e` 2026-10-12 | #14 mergad | radera. `git branch --merged origin/main` |
| `codex/john-n2-admin-partners` | 0 | 48 | `48cf02c5` 2026-10-11 | #12 mergad | radera. Samma |
| `jakob/dealer-forge` | 878 | 896 | `a1ea8064` 2026-10-12 06:19 +0200 | #16 mergad | inte radera på talen. `git merge-base` mot `main` saknas. PR-mergen `234614e3` är anfader till `main`, och Dealer Forge-filerna finns där. 878/896 är historiken före omskrivningen, inte 878 nya commits |
| `jakob/shoe-transition-slots` | 875 | 896 | `6e2ad64f` 2026-10-12 06:07 +0200 | #17 mergad | samma läge. `main` har `40c38c49` "Merge pull request #17" och `de0bcf7b` med samma ämne. GitHubs merge-SHA `1667d25e` finns inte i den nya historiken |

Redan borta på remote, inget att radera: `jakob/dealer-forge-seed` (PR #18 mergad), `jakob/dealer-forge-pin-008` (PR #20 stängd; samma ämne är `91969107` på `main`), `jakob/play-lobby-polish` (PR #15 mergad), `cursor/n22-partner-team-writes-9f24` (PR #5 mergad), `ci/migration-readiness-gate` (PR #1 mergad).

B13: orkestratorn raderar, med
`gh api -X DELETE repos/Jakeminator123/scoutgaming/git/refs/heads/<branch>`.
Pre-push nekar `git push --delete`.

## Worktrees

Lokala worktrees syns inte i molnet. Orkestratorn fyller i tabellen med
`git worktree list` och osparade poster per worktree. Radera bara tomma.

| Sökväg | Branch | Osparade poster | Förslag |
| --- | --- | --- | --- |
