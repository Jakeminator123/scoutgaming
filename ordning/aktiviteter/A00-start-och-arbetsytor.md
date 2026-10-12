# A00 · Start, plan-PR och arbetsytor

| Fält | Värde |
| --- | --- |
| Våg | 0 · körs av orkestratorn, inte av en underagent |
| Väntar på | – |
| Leder till | B1–B3 och start av våg 1 |
| Branch | `jakob/repo-ordning` (planen) |
| Risk | 5 % |

## Mål

Planen ligger där alla aktivitetsbrancher ser den, Jakob har tagit de beslut
som våg 1 behöver, och våg 1 är startad.

## Steg

1. **Plan-PR.** Pusha `jakob/repo-ordning` och öppna en PR mot `main`.
   Pre-push blockerar andra brancher, så gör som i ORKESTRERING §6 punkt 7.
   Merga efter Jakobs ok (B2). Merging startar en vanlig Render- och
   Vercel-deploy. Planen innehåller ingen körbar produktkod.
2. **Beslut.** Be Jakob ta ställning till B1, B2, B3 och B13 i
   [README §4](../README.md#4-beslut-som-jakob-tar). Övriga beslut kan vänta
   till våg 2, men B4–B10 bör tas när A04 och A05 har levererat.
3. **Läget just nu.**
   - `node tools/agent-talk.mjs status <orkestrator-id>`: kontrollera aktiva
     claims (vid planens start: `dealer-forge`, `shoe-transitions`,
     `side-play-directory` och `codex-cloud-blob-browser`). Gamla claims på
     mergat arbete frigörs av sina ägare, aldrig av orkestratorn.
   - `gh pr list --state open`. PR #16 Dealer Forge mergades som `234614e3` efter
     baslinjen (BASLINJE §6).
   - `node tools/inbox.mjs list --to me`: #10 (Kevin) och #4 (testping).
   - `node tools/security-status.mjs`: inga nya öppna incidenter.
4. **Arbetsytor för våg 1** enligt ORKESTRERING §2:

   | Worktree | Branch | Aktiviteter |
   | --- | --- | --- |
   | `ordning-a01` | `jakob/ordning-a01` | A01 + A02 (samma PR, olika filer) |
   | `ordning-a03` | `jakob/ordning-a03` | A03 |
   | `ordning-inventering` | `jakob/ordning-inventering` | A04, A05, A06 (bara `ordning/rapporter/`) |

   A01 och A02 får två separata underagenter i samma worktree. Filistorna är
   disjunkta.
5. **Starta** sex underagenter med promptmallen i ORKESTRERING §3, högst fyra
   åt gången:
   - omgång 1 i ett meddelande: A04, A05, A06 (läsande) och A03;
   - omgång 2 när platser frigörs: A01 och A02. A02 kan då använda A04:s svar
     på T1.
6. Uppdatera registret i README: våg 1 = `pågår`.

## Klart när

- [ ] Plan-PR:en är mergad (eller B2 = planen stannar på branchen, och basen i
      ORKESTRERING §2 är `origin/jakob/repo-ordning`).
- [ ] B1–B3 och B13 är besvarade.
- [ ] Våg 1 är startad och registret uppdaterat.
