# A00 · Start, integrationsbranch och omgångar

| Fält | Värde |
| --- | --- |
| Våg | 0 och före varje omgång · körs av orkestratorn, inte av en agent |
| Integrationsbranch | `jakob/repo-ordning` · worktree `C:\Users\jakem\.cursor\worktrees\croupier\repo-ordning` · utkast-PR #19 |
| Risk | 5 % |

## Mål

Varje omgång startar från färsk `main`, med briefar som stämmer med läget,
och alla agentresultat landar på integrationsbranchen, aldrig direkt på `main`.

## Gjort 2026-10-12

- Planen skapad, committad (`d4212e94`) och pushad. Utkast-PR #19 är öppen.
- Den lokala branchen `ORCHISTRATOR` (`4ecedd72`) är raderad. Dess patch finns på
  `main` som `e160af12`, och den var inte utcheckad i någon worktree.
- `origin/main` (`e160af12`) är mergad in (`c0827abc`).
- B1, B2, B3 och B13 är beslutade, och B4, B7 och B9 provisoriska (README §4).
- Codex-överlämningen och fynden om ignorerade mappar är införda
  (BASLINJE §6, §8, §9; A18 och A19 är nya).

## Rutin före varje omgång

1. `node tools/agent-talk.mjs status masterplan`, `gh pr list --state open` och
   `node tools/inbox.mjs list --to me`.
2. Integrationssynk enligt ORKESTRERING §2: fetch, `merge origin/main`,
   kontroll av låsfiler, Studio-bygge.
3. **Justera briefar:** för varje aktivitet i omgången, läs det som ändrats
   sedan förra omgången (`git log --stat <förra-synk>..origin/main`) och
   uppdatera ägda filer, fakta och beslut i aktivitetsfilen. Lägg
   omgångsspecifika ändringar i promptens fält "Justeringar för denna omgång".
4. Full svit (`node tools/precommit-checks.mjs --full` eller via commit),
   systemkartan och `node tools/security-status.mjs`. Committa och pusha.
5. Starta molnagenterna i ett meddelande (ORKESTRERING §3).
6. Registret i README: `körs`. Påminn Jakob om integrationsbranchen.

## Omgång 1 (startad 2026-10-12)

| Aktivitet | Beslut i prompten |
| --- | --- |
| A01, A02, A03, A04, A05, A06 | B1, B2, B3, B13 |
| A10 | B4 provisoriskt ja |
| A13 | B7 provisoriskt: bryt ut och isolera, ta inte bort |
| A15 | B9 provisoriskt ja, läppsynkkedjan behålls |
| A18 | B15 öppet: utred, och flytta bara `build.mjs` |
| A30 fas 1 | – (läsande) |

## Klart när

- [x] Integrationsbranchen är synkad, och omgång 1 är startad.
- [ ] Rutinen är körd före varje senare omgång.
