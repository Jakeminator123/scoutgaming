# Spelklientens publika resurser

`index.html` och `app.mjs` bygger blackjackklienten som `services/game/server.mjs`
serverar. Presentationen läser serverns spelstatus; kort, saldo och utbetalningar
ägs av servern. `material-catalog.mjs`, `game-lanes.mjs` och de gemensamma
presentationsmodulerna används även från andra produktdelar.

| Del | Ansvar och status |
| --- | --- |
| [card-presentation/](card-presentation/README.md) | Aktiv kortprojektion, handocklusion och kalibrering från granskad GitLab-kod. `local-card-overlay.mjs` är produktadaptern. |
| `performance-player.mjs`, `local-film-player.mjs`, `speech-*`, `astrid-*` | Filmuppspelning, tal, kamerafunktioner och Astrids presentation. |
| `vendor/three/` | Versionsbundna Three.js-resurser som speluppspelning och kompositorer importerar direkt. De behövs i leveransen. |
| `roulette/` | Spelklienten för roulette. |
| `bo/speech-qa.*` | Kvarvarande behörighetsstyrd tal-QA. `/api/bo/speech-qa` är undantaget när äldre BO-skrivningar stängs i Studio-läget. |

## Bevara verifierad presentation

Kalibrering hör ihop med exakta videohashar, positioner och serverkort.
Ta inte bort `card-presentation/`, `local-card-overlay.mjs` eller vendorresurser
för att deras ursprung eller ett presentationsnamn är äldre. Okända filmhashar
har en fallback och ska inte beskrivas som visuellt godkänd kalibrering.

`/lab-speech-bridge.mjs` serveras från `packages/presentation/runtime/` via
det publika modulregistret. Lissabon-profilklienten är borttagen (22 oktober
2026). Nya backoffice- och lobbygränssnitt utvecklas i `/admin` respektive
`/lobby`; övergångens fungerande äldre länkar finns kvar.

Stora mediafiler kan ligga utanför mappen och lösas via projektets medielayout
eller Blob. En saknad lokal film är därför inte belägg för oanvänd kod.
Se [LOCAL-PRESENTATION-RUNTIME.md](../../../docs/LOCAL-PRESENTATION-RUNTIME.md)
och [kortpresentationens README](card-presentation/README.md).

## Delat bord: beslut och resultat

`shared-room-shortcuts.mjs` låter H/S/D/P välja Hit/Stand/Double/Split när
**en synlig beslutsknapp har tangentbordsfokus** (Tab till beslutspanelen).
Bokstäver utanför beslutspanelen, redigering, dialoger, modifierade tangenter,
IME och tangentupprepning utlöser inga beslut. P betyder aldrig paus.
Tooltip och `aria-keyshortcuts` beskriver tangenterna; stängning tar bort
lyssnare och återställer tidigare attribut. Klick, Enter och Space är oförändrade.

Kortkommandot klickar samma knapp som pekaren. `shared-room-controller.mjs`
prövar fortfarande tur, tidsgräns, paus, anslutning och väntande kommando och
skickar samma serverbundna kommandokropp. Beslut vid `turnAt` får fortfarande
fattas medan den föregående filmens slut spelas.

`shared-room-results.mjs` skjuter upp senaste rundans resultattext och
Nästa runda tills serverns `plan.endAt` passerats **och** den lokala
presentationen avslutats. Kontrollerns befintliga tidskorrigering och
omritning används; inga extra timers, DOM-pollningar eller 700 ms-fördröjningar.
Saldot är alltid serverns riktiga saldo. Ingen utbetalning räknas om eller
fördröjs; en återanslutning efter avslutad plan kräver ingen filmrepris.

Beteendeunderlag: Kevins `kevin/croupier-scoutgg/public/redesign.js` på
`de31659c13ab495e80779c1acbf4efd446b4e565`, kortkommandon och resultat-efter-kort.
Detta är K10 och en avgränsad del av K3 i [portplanen](../../../docs/plans/KEVIN-PORT.md),
inte hela mobil-/resultatombyggnaden. Ingen Kevin-kod, databas eller mediakatalog
monteras. Layout och publicerade dealerfiler ändras inte.

Prov: `test/shared-room-results.mjs` och `test/shared-room-feedback-browser.mjs`
i den befintliga presentationssviten. Webbläsarprovet behöver
`CROUPIER_BROWSER_FIXTURE_MODULE` och provar riktiga vy-/kontrollermoduler
med syntetiska snapshots och mediaport, utan nätverk. Det är inte AV-godkännande
av ett riktigt dealerklipp eller ett nytt moln-/belastningsprov.
