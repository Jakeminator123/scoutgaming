# Prompt N3.4: spelarens val av bordsfärg, bakgrund och dealer inom paketet

Kör i en egen agent/chatt. **Modell: grok 4.7 xhigh fast räcker** – det är klientlogik
+ en liten serverdel, inga kort/wallet. Orkestratorn granskar före merge. Beroende:
L8 är mergad (`19f8073a`): servern lägger `gameOperator`, `gamePackageRevision`,
`gameBranding` och den paketbegränsade lanen/dealern i `/blackjack`-dokumentets dataset.

Skriven 8 okt 2026 av orkestrator 2 efter `7445b5a5`. Checklista: N3.4, T3, T4, T5.
Beslut J3/F2/F4: valet sker **inom vad paketet och lanen tillåter**; sparas i
webbläsaren först, på kontot när profilen (N3.3) har kolumner för det.

---

Du arbetar i `C:\Users\jakob\dev\projects\scoutgame` på `main`. Läs `AGENTS.md`,
`docs/JOHN-HANDOFF.md` (avsnitten 8 oktober), `random/checklista-2026-10-08.md` (N3, T3–T5),
`random/k1-fakta-spelvagen-2026-10-08.md` (tabell 2: full-frame mp4 i prod-vägen),
`lab/lib/studio-model.mjs` rad 76–165 (`layers.background/table/dealer` med `enabled`,
`default`, `allowed`), `web/game-entry-operator.mjs` + `web/public/game-lanes.mjs`
(`laneDealerSelection`, vilka dataset-fält som sätts), `web/public/game-entry-contract.mjs`
(`gameLaneFromDocument`), `web/public/app.mjs` (sök `table-pick`, `setTable`, `DEALERS`,
`dealerVersionPath`, `rehearsal`), `web/public/table-scene*.mjs` (bordspalett/felt),
`apps/croupier-frontend/lib/player-operator.mjs` (N3:s `localStorage['croupier.operator']`).
Ingen commit/push/branch utan orkestratorns ord. Inget mot produktion. Agent-talk-id
`n34-val`: `node tools/agent-talk.mjs status n34-val` vid start, var 30:e sekund, före rapport.

## Fakta att respektera

- Produktionsvägen spelar en full-frame mp4 där bakgrund + dealer + bord är inbakade
  (Astrid). "Bakgrund" och "bord" som separata lager finns bara i `/v2`-grenen och i
  Jakobs `test-video-jakob`. **Du bygger därför valet som data + UI + det som går att
  styra i dag**, inte en ny renderare.
- Vad som går att styra i dag utan nytt media: **dealer** (byte inom lanens
  `layers.dealer.allowed`, via samma väg som `?dealer=`), **bordsfärg** på DOM/SVG-lagret
  (`table-scene`-palett, chips/HUD), och bakgrund **bara** om lanen har
  `layers.background.mode !== 'baked'` (då finns inget i prod-vägen än → visa valet
  inaktiverat med texten `Kommer med nya dealerpaket`).
- Servern äger kort, shoe, wallet. Rör inte `shoe-game.mjs`, `blackjack.mjs`, auth.

## Mål

1. **Server exponerar tillåtna val.** I `web/game-entry-operator.mjs` (eller där
   datasetet byggs): lägg `gameChoices` = `{ dealers: [...allowed], dealerDefault,
   tableColors: [...allowed] eller [], tableDefault, background: { enabled, mode,
   allowed, default } }` härlett från Studio-projektets lane (`project.lanes[]`) för den
   valda lanen; saknas lanen i projektet → standardlanen. Escapa som övriga
   dataset-fält; validera i `gameLaneFromDocument`. Utan `?operator=` → `gameChoices`
   utifrån aktiv lane ändå (så valet fungerar även före bolag), men inga andra
   fält ändras (dagens byte-jämförelsetest i `test/game-entry-operator.mjs` ska uppdateras
   medvetet, inte tyst – kommentera varför).
2. **Klient: panelen `Ditt bord`.** I `web/public/app.mjs`: en `<details>` nära
   `#table-pick` med tre val: Dealer (knappar, bara `gameChoices.dealers`), Bordsfärg
   (swatchar ur `tableColors`; tom lista → fältet dolt), Bakgrund (inaktiverad när
   `mode === 'baked'`). Val sparas i `localStorage['croupier.choices.<operator||'default'>']`
   och appliceras: dealerbyte = navigering via befintlig `dealerVersionPath` med
   bevarad `?operator=` (ingen ny spelväg), bordsfärg = `table-scene`-palettbyte för
   DOM/SVG utan att röra videon, bakgrund = inget i detta pass. `?dealer=`/`?table=`
   i URL vinner över lagrat val. Ett val utanför `gameChoices` ignoreras tyst och
   rensas.
3. **Vercel-lobbyn** (`apps/croupier-frontend/app/play`): visa under `Spelar hos`
   vilket bord/dealer spelaren valt senast (läs samma localStorage-nyckel), bara text.
4. **Branding steg 1.** Om `gameBranding.color` är satt (bolagets bordsfärg från L4)
   och spelaren inte valt något: använd den som bordets standardfärg. Spelarens val
   vinner över bolagets, bolagets över lanens default.

## Tester

- `test/game-entry-operator.mjs`: `gameChoices` för sg-test-paketet med fixture-lane;
  standardlane utan operatör; escaping; `gameLaneFromDocument` avvisar ogiltigt.
- `test/local-presentation.mjs` eller nytt `test/player-choices.mjs` (node:test + jsdom
  om det används annars; annars ren funktionstest på en utbruten
  `web/public/player-choices.mjs`): val utanför tillåtet rensas; prioritetsordning
  URL > spelare > bolag > lane; `baked` → bakgrund inaktiverad.
- `apps/croupier-frontend/test/player-profile.mjs` (eller nytt): lobbyn visar senaste val.
- `node test/fuzz-blackjack.mjs` orört och grönt; `.githooks/pre-commit`-testerna gröna;
  `node pipeline/audit-dealer-sync.mjs --probe` PASS (du rör inte media, men kör den).

## Rapport

Tabell Åtgärd | Status | Verifierat hur | Risk %. Vilka fält som tillkom i datasetet.
**Tveksamt**: vad som bara är data tills lagerspelaren finns, hur bordsfärgen appliceras
(vilka element), och om byte-jämförelsen utan `?operator=` fick ändras.
