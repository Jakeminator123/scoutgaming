# Prompt: en klipplogik (klistra in i en ny chatt, orkestrator på hög nivå)

Du arbetar i `C:\Users\jakob\dev\projects\scoutgame` på `main`. Läs i ordning: `AGENTS.md`,
`CLAUDE.md`, `lab/docs/TERMINOLOGI.md`, `random/beslutsmatris-2026-10-07.md` (rad 37, 38, 44),
`random/losa-tradar-2026-10-07.md` (L1–L4, L16, L19). Underagenter kör `grok-4.7-xhigh-fast`
för sökning och inventering; omskrivningen gör du själv. Rapporter slutar med `Tveksamt`.
Startrutin: `node tools/agent-talk.mjs status <id>`, `node tools/inbox.mjs list --to me`.

## Jakobs målbild

Nivå 1 äger klipplogiken. Den har fyra delar: (1) klipp i idle-läge, (2) action-sekvenser
när kort delas ut, (3) klipp när bakgrunden ändras, (4) sekvenser som spelas utifrån probe.
OpenClaw är hjärnan som ger råd om val och kan skriva till spelaren. En administratör
skapar en **lane** (paketet av allt detta för en dealer), exporterar den till ett bolag,
och bolaget får en begränsad yta för egna justeringar (bordsfärg, branding) och egna spelare.

## Läget i koden, 8 oktober

| Del | Var | Problem |
|---|---|---|
| 1 Idle | `idlePolicy`, `lab/components/idle-policy-editor.tsx`, Dealers & klipp → Idle | Fungerar för Astrid. Vera, Amira, Mei delvis (L19) |
| 2 Deal | **Två system.** A: `project.events` med `lines`/`variants`/`triggers`, redigeras på Händelser (`/control/events`) och överblickas på Händelser → klipp (`/control/tree`); spelas via `web/presentation-api.mjs`. B: `legacyClipPolicy`, fliken Kort & deal på Dealers & klipp, frekvens per klipp; spelas via `web/clip-mapping.mjs` | Samma behov, två datamodeller, två spelvägar. Oklart vilken spelet i produktion faktiskt följer |
| 3 Bakgrund | `/control/zones` (`background-zones.tsx`), eget skal | Zonerna styr inte spelets bakgrund (L16) |
| 4 Probe | `probePolicy`, `/control/probe`, `web/probe-runtime.mjs`, `web/storage/async-probe-runtime.mjs` | Ej verifierad i produktion (L4) |
| OpenClaw | `lab/components/openclaw-workspace.tsx`, `gateway-panel.tsx`, `social-chat-panel.tsx`, `lab/lib/idle-advice-server.mjs` | Råd finns i labbet; produktionskopplingen enligt L-listan |
| Lane | `lanes` är en id-lista i `operator_packages`; innehållet är Studio-projektet | Ingen yta skapar en lane av delarna 1–4; ingen export (L1, L2); ingen bolagsyta (L3) |

## Steg, i ordning. Steg 1 och 2 innan någon kod ändras.

**1. Avgör spelvägen.** Vilken av system A och B läser spelmotorn på Render i produktion
när ett kort delas? Läs `web/server.mjs`, `web/presentation-api.mjs`, `web/clip-mapping.mjs`,
`web/public/local-presentation.mjs` och testerna `test/clip-mapping.mjs`, `test/game-entry-contract.mjs`.
Leverera: en tabell per presentationshändelse (deal, reveal, turn, settle, speak, idle):
vilket system väljer klipp, vilken fil, vilket test skyddar det. Ingen gissning; citera rad.

**2. Föreslå ett system.** Utifrån steg 1: vilket system blir kvar, hur det andras data
flyttas in (frekvens per klipp från B blir urvalsregel i A, eller tvärtom), vad som försvinner
för användaren och vad som ersätter det. Händelser och Händelser → klipp blir en sida
(rad 37) om John sagt A, annars två sidor på samma data. Tabell: funktion | i dag | efter |
vad användaren förlorar | ersättning. **Stanna här och vänta på Jakobs go.**

**3. Genomför**, en commit per flytt. Datamigrering av sparade projekt sker i
`lab/lib/studio-model.mjs` med version och test; inget sparat projekt får bli ogiltigt.
Spelvägen som försvinner tas bort först när testerna visar att den nya vägen spelar samma
klipp för samma händelse (`test/clip-mapping.mjs` och `pipeline/audit-dealer-sync.mjs --probe`
ska vara gröna före och efter). Media rörs inte.

**4. Bakgrund och probe in i samma modell** som delar av en lane, utan ny funktion:
bakgrund blir en del av projektet som lane-exporten kan ta med; probe-policy likaså.
L16 (zoner styr spelet) och L4 (probe i produktion) förblir lösa trådar om de inte löses av
sig själva; flagga.

**5. Lane som begrepp i koden.** En lane = projektets delar 1–4 för en dealer, med id.
`operator_packages.lanes` pekar på sådana. Ingen exportyta ännu; det är nästa pass. Men
datamodellen ska göra exporten möjlig utan ny migrering. En intern demo-operatör
("SG test game provider", rad 44) får finnas i fixturen för att prova.

## Regler

- Ingenting får bli sämre: samma klipp för samma händelse före och efter. Fyra dealers på
  samma uppspelningsväg. Rehearsal `?dealer=<namn>&rehearsal=1` med två spel i rad på alla fyra.
- Rör inte `web/shoe-game.mjs`, plånbok, `pipeline/`, `media/`, dealer-synk-tester. En
  Studio-migration körs först mot produktions-Neon, sedan kod (CI-grinden kräver det).
- Bevarandelistan i `random/handoff-2026-10-07-kvall.md` gäller. De 39 ljudfilerna och
  repliklistan är del av lane, tas inte bort.
- Design följer John; använd sidmallen. Terminologi enligt `lab/docs/TERMINOLOGI.md`:
  Villkor, Urvalsregler, Klippuppsättning i ny text; byt gamla ord bara i filer du ändå rör.
- Kevins kod (`lab/components/kevin-bo/`) rörs inte; bolagets justeringsyta är nästa pass.
- Efter varje push: test, typecheck, build, `node docs/system-map/verify.mjs`, grön CI,
  verifiering i produktion som `LLM`. Uppdatera `docs/JOHN-HANDOFF.md` (översta tabellen),
  matrisen (en rad per avvikelse) och `random/losa-tradar-2026-10-07.md`.
- Rapport: kort, tabeller, sist `Tveksamt`. Steg 1 och 2 levereras innan steg 3 börjar.

## Frågor som troligen dyker upp, med svar

- "Vilket system är bättre?" Det spelet använder i produktion, om inte steg 1 visar att det
  är trasigt. Jakob avgör i steg 2.
- "Får frekvens per klipp försvinna?" Nej. Den blir en urvalsregel med samma effekt.
- "Ska jag bygga exportytan?" Nej. Bara datamodellen som gör den möjlig.
