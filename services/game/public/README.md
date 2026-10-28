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
