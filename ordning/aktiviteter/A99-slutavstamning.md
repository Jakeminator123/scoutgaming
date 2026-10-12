# A99 · Slutavstämning, drift och avveckling av `ordning/`

| Fält | Värde |
| --- | --- |
| Våg | 4 · sist · orkestratorn med en underagent för mätning och dokument |
| Väntar på | Alla andra aktiviteter `klar` eller `struken` |
| Branch / worktree | `jakob/ordning-a99` · `C:\Users\jakem\.cursor\worktrees\croupier\ordning-a99` |
| Modell | grok-4.7-xhigh-fast (mätning och dokument), orkestratorn (drift) |
| Risk | 20 % |

## Mål

Det som faktiskt blev gjort är mätt mot baslinjen. Det som rört sig på `main`
under arbetet är avstämt. Dokumenten beskriver slutläget och
planmappen är borta.

## Steg

0. Steg 0 enligt ORKESTRERING §4.
1. **Vad hände på main?** `git log --stat 00ea55c5..origin/main`, uppdelat på
   plan-PR:er och annat (t.ex. Dealer Forge #16 och Kevin-importer). Kontrollera
   för varje icke-plan-ändring:
   - har den lagt till kod eller media i ett område som planen avvecklat?
   - pekar den på borttagna filer?
   - ligger nya arbetsanteckningar utanför `docs/`?

   Åtgärda små fynd direkt. Större fynd blir punkter i `docs/CLOUD-MIGRATION.md`.
2. **Mät om** med alla fem verktyg, `node tools/check-orphan-tests.mjs`,
   `node docs/system-map/verify.mjs --check` och `node tools/security-status.mjs`.
   Gör en tabell före (BASLINJE) och efter, för samma mått.
3. **Systemkartan** (orkestratorn, en gång): `node docs/system-map/verify.mjs --refresh-baseline`,
   sedan `node docs/system-map/build.mjs`, på samma sätt som CI bygger kartan.
   Committa de uppdaterade katalogerna och `index.html`.
4. **Hela kedjan:** hela pre-commit, CI på PR:en, Studio- och frontendbygge.
   Efter merge (orkestratorn, läsande):
   - Vercel READY och Render live för slut-SHA:n;
   - röktest av `/`, `/play`, `/play/blackjack?operator=<ett aktivt bolag>`,
     `/control/login`, `/partner/login` och `/casino.html` (omdirigering, om A11
     är gjord);
   - rehearsal `?dealer=<namn>&rehearsal=1` för fyra dealers, två uppspelningar i
     rad, samt `?lane=layer-preview&rehearsal=1`.
5. **Dokument:**
   - `docs/JOHN-HANDOFF.md`: avsnittet "Ordning 2026-10" med vad som ändrats, prov,
     vad som är kvar och före/efter-tabellen.
   - `docs/CLOUD-MIGRATION.md`: bocka bara av det som är verifierat.
   - `README.md` och `AGENTS.md`: inga hänvisningar till `ordning/`.
6. **Reserv för sen drift:** buffert för det steg 1–4 hittar. Fynd som tar mer än
   cirka en timme blir punkter i CLOUD-MIGRATION i stället för nya aktiviteter.
7. **Avveckla planen:** `git rm -r ordning` i samma PR. Ta bort kvarvarande
   `ordning-*`-worktrees (`git worktree remove`) och radera mergade
   `jakob/ordning-*`-brancher med `gh api -X DELETE …/git/refs/heads/<branch>`
   efter Jakobs ok. Avsluta med `node tools/agent-talk.mjs done`.

## Klart när

- [ ] Före/efter-tabellen finns i handoffen.
- [ ] CI, byggen, deploy och röktest är gröna för slut-SHA:n.
- [ ] `ordning/` och alla `ordning`-worktrees är borta.

## Tveksamt att lyfta

- Allt som rört sig på main och krockar med planens resultat.
- Skillnader mellan förväntad och faktisk vinst (README §7).
