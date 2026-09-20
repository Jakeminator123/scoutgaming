# Studio, JSON och lagring

[Till systemkartan](../README.md) · [Nästa: OpenClaw och drift](../05-openclaw-rost-och-drift/README.md)

**Labb i dag:** den lokala studion finns i rotens `lab/`. Projektets
dealers, noder, triggers, linjer, varianter och animationsreferenser är
serialiserade tillsammans. JSON-filerna beskriver olika ansvar:

| Fil eller mapp | Ansvar |
| --- | --- |
| [project.seed.json](../../../../lab/policies/project.seed.json) | Startdata när användaren ännu inte har ett sparat projekt |
| [studio.schema.json](../../../../lab/schemas/studio.schema.json) | Struktur och tillåtna fält; innehåller inte användarens val |
| [studio-model.mjs](../../../../lab/lib/studio-model.mjs) | Extra referens-/kontraktsvalidering och katalogkonvertering |
| `lab/data/project.json` | Användarens sparade projekt, lokalt och Git-ignorerat |
| `lab/data/history/` | Tidigare sparade revisioner |
| [project-store.mjs](../../../../lab/lib/project-store.mjs) | Laddning, revisionskontroll, historik och atomisk sparning |
| [animations/index.json](../../../../lab/animations/index.json) och 16 eventfiler | 64 syntetiska rörelser med numeriska poser/timing |
| [video-registry.mjs](../../../../lab/lib/video-registry.mjs) | Läser befintlig originalinventering för labbpreview |

Det kontrollerade startprojektet `studio.2026-09-20.2` har 4 dealers,
16 noder, 9 triggers, 64 dealerlinjer, 256 varianter och 64 assets.
Samtliga startvarianters videobindningar är `null`. Ett sparat användarprojekt
kan vara äldre eller redigerat; det ska inte ersättas med seed automatiskt.

En **dealerlinje** är här dealer + eventnod + standard/alternativ. Den är
inte den exakta talrepliken `speak.line`. En **variantpost** är inte en
takepool: den pekar i dag på en animation och högst ett generation-ID.

**Förslag till framtida fysisk uppdelning:** ett register per ansvar, till
exempel `dealers.json`, spelens `events.json`, `triggers.json` och dealer-
specifika policyfiler. Detaljförslaget finns i [eventregistret](../../2026-09-20-eventregister-och-mental-modell.md).
En fil per post är också möjligt men inget krav. Ett schema kan validera
många filer. Varianter behöver inte varsin JSON-fil för att få egna grenar i UI.

ID-referenser gör att ett logiskt mappträd kan visa samma trigger eller take
på flera ställen. Att byta etikett eller trädvy behöver inte flytta filer.
Att faktiskt dela projektet i flera filer kräver däremot anpassad läsning,
sparning, revisionskontroll och validering.

Äldre [open-claw/lab/config/catalog.json](../../../../open-claw/lab/config/catalog.json)
hör till den äldre Director-editorn. Den har eget sparande och ska inte
summeras med nya studions projekt. Studion bygger en tillfällig katalog
för valt projekt/dealer och skickar den för råd; detta skriver inte över
Directors sparade katalog.

Läs [studions guide](../../../../lab/README.md),
[policyernas ansvar](../../../../lab/policies/README.md),
[rörelseformatet](../../../../lab/animations/README.md) och
[den första förklaringen av mapparna](../../2026-09-20-labbets-mappar-och-tester.md).
Starta via [Start-Labb.cmd](../../../../Start-Labb.cmd) när du vill använda
editorn. Denna dokumentationsmapp startar inga processer och ändrar inget projekt.
