# A01 · Avveckla `random/` och `planes/`

| Fält | Värde |
| --- | --- |
| Våg | 1 · parallell med A02–A06 · levereras i samma PR som A02, eller efter A02 |
| Väntar på | B3 (för själva raderingen; kartläggningen kan börja direkt) |
| Branch / worktree | `jakob/ordning-a01` · `C:\Users\jakem\.cursor\worktrees\croupier\ordning-a01` |
| Modell | grok-4.7-xhigh-fast |
| Risk | 15 % · spärrar i systemkartan |

## Mål

Inga spårade arbetsanteckningar i `random/` eller `planes/`. Allt som
fortfarande gäller finns i ordinarie dokument eller i maskinläsbar spärrdata.
Systemkartan, pre-commit, pre-push och CI är lika gröna eller gula som före.

## Fakta (00ea55c5)

- `random/`: 30 spårade filer (29 `.md` + `random-kartor.txt`), 0,32 MB.
  `planes/`: README + 8 `PLAN.md`.
- **Levande beroenden:**
  - `docs/system-map/verify.mjs` rad ~318–329 läser
    `random/checklista-2026-10-08.md` och kräver att varje `plannedRef` i
    katalogerna finns som tabellrad `| <id> |`. I dag finns en planerad rad:
    `docs/system-map/routes.json` `"plannedRef": "N2.4"`. Checklistans rad:
    `| N2.4 | Spelare, transaktioner, rapporter från spelmotorn (L10) | kvar | …`.
  - `test/system-map.mjs` rad ~363–372 skriver en fixtur till samma sökväg.
  - `docs/system-map/catalog.json` refererar `planes/01-slutratningar/PLAN.md`
    (tre ställen), `planes/07-produktionsacceptans/PLAN.md` och listan `plans`
    (`planes/02`, `03`, `04`, `01`). `refs()` i `verify.mjs` kräver att filerna
    finns (prefixet `planes/` finns i regexen).
- **Textreferenser:** `docs/CLOUD-MIGRATION.md` rad ~148 och ~220,
  `docs/LOCAL-PRESENTATION-RUNTIME.md` rad ~381 och cirka 17 rader i
  `docs/JOHN-HANDOFF.md`. JOHN-HANDOFF ägs av A02.
- **Lokala, ignorerade mappar som ska finnas kvar:** `.gitignore` har
  `/random/env-backup-*/` och `/random/bilder-*/`. `docs/ENVIRONMENT-VARIABLES.md`
  rad ~81 hänvisar till env-backuper där. `lab/next.config.mjs` utesluter
  `../random/**` ur bundlen. Behåll alla tre: mappen används lokalt för privata
  kopior.

## Ägda filer

`random/**` (spårade), `planes/**`, `docs/system-map/verify.mjs`,
`docs/system-map/catalog.json`, ny `docs/system-map/planned.json`,
`test/system-map.mjs`, `test/system-map-verify.mjs` (bara om den berörs),
`docs/CLOUD-MIGRATION.md`, `docs/LOCAL-PRESENTATION-RUNTIME.md` (bara rader om
`random/`/`planes/`), `ordning/rapporter/A01-karta.md`.

**Rör inte:** `docs/JOHN-HANDOFF.md` och `README.md` (A02),
`docs/system-map/index.html` (genereras, A99), `.gitignore`, `lab/next.config.mjs`,
`docs/ENVIRONMENT-VARIABLES.md`.

## Steg

0. Steg 0 enligt ORKESTRERING §4. Kör
   `rg -l --glob '!random/**' --glob '!planes/**' --glob '!ordning/**' '(^|[^-\w])(random|planes)/' .`
   och jämför med listan ovan.
1. **Kartlägg innehållet.** Klassa varje fil i `random/` och `planes/`:
   - (a) öppen uppgift → punkt i `docs/CLOUD-MIGRATION.md`, den enda trackern
     enligt AGENTS.md;
   - (b) bestående regel eller beslut → rätt referensdokument (runtime-regler i
     `docs/LOCAL-PRESENTATION-RUNTIME.md`);
   - (c) historik → ingen flytt. Git bevarar filen; ange `sökväg@00ea55c5`.

   Skriv tabellen fil → klass → ny plats till `ordning/rapporter/A01-karta.md`.
   Utgå från checklistans status `kvar`/`väntar`, `losa-tradar-2026-10-07.md`
   (19 trådar) och `beslutsmatris-2026-10-07.md`. Flytta bara det som
   fortfarande är öppet enligt koden eller handoffen.
2. **Spärrdata.** Skapa `docs/system-map/planned.json`
   (`{"schemaVersion":1,"items":[{"id":"N2.4","label":"…","status":"kvar","tracker":"docs/CLOUD-MIGRATION.md"}]}`).
   Ändra `verify.mjs` så att planerade rader valideras mot filen, med samma
   felkoder (`planned.checklist`, `planned.ref`) och motsvarande meddelanden.
   Uppdatera fixturen i `test/system-map.mjs`. Lägg till `planned.json` bland
   indata där katalogerna listas (`captureSystemMapInputs`), så att
   bevisbindningen följer med.
3. **Katalogen.** Ersätt `planes/*`-referenser i `catalog.json` med det
   dokumentavsnitt som nu bär innehållet, eller ta bort posten i `plans` om
   inget motsvarande finns. Kör inte `--refresh-baseline`.
4. **Textreferenser** i `docs/CLOUD-MIGRATION.md` och
   `docs/LOCAL-PRESENTATION-RUNTIME.md`.
5. **Radera** med `git rm -r` de spårade filerna i `random/` och `planes/`.
   Ignorerade lokala undermappar rörs inte.
6. **Prov:** `node docs/system-map/verify.mjs --check` (0 röda),
   `node --test test/system-map.mjs test/system-map-verify.mjs`,
   `node tools/check-orphan-tests.mjs` och en ny `rg`-sökning enligt steg 0.
   Kvar får bara vara JOHN-HANDOFF (A02), `.gitignore`, `lab/next.config.mjs`
   och `ENVIRONMENT-VARIABLES.md`.

## Klart när

- [ ] Inga spårade filer under `random/` eller `planes/`.
- [ ] `verify.mjs` läser `docs/system-map/planned.json`, och provet täcker både
      saknad fil och saknat id.
- [ ] Öppna punkter finns i `docs/CLOUD-MIGRATION.md`, och kartan i rapporten
      visar var resten tog vägen.
- [ ] Systemkartan har 0 röda.

## Tveksamt att lyfta

- Om öppna trådar hellre ska bli GitHub-issues med etiketten `inbox` än punkter
  i CLOUD-MIGRATION.
- Varje punkt där det är oklart om den fortfarande är öppen.
