# Spelklientens publika resurser

`index.html` och `app.mjs` bygger blackjackklienten som `services/game/server.mjs`
serverar. Presentationen läser serverns spelstatus; kort, saldo och utbetalningar
ägs av servern. `material-catalog.mjs`, `game-lanes.mjs` och de gemensamma
presentationsmodulerna används även från andra produktdelar.

| Del | Ansvar och status |
| --- | --- |
| [card-presentation/](card-presentation/README.md) | Aktiv kortprojektion, handocklusion och kalibrering från granskad GitLab-kod. `local-card-overlay.mjs` är produktadaptern. |
| [game-interface.mjs](game-interface.mjs) | Sittplatser, action-/givknappar och chattplacering för `app.mjs`. Läser serverrundan; samordnar första synliga frame, resize och stängning. |
| [dealer-chat-controls.mjs](dealer-chat-controls.mjs) | Chattens öppning/oläststatus och montering av röstkontroller efter kamerakontrollens servervaliderade readiness. Provspel exponerar inte chatt/röst. |
| [player-entry-controls.mjs](player-entry-controls.mjs), [dealer-picker.mjs](dealer-picker.mjs), [dealer-rehearsal.mjs](dealer-rehearsal.mjs) | Previewnotis, sessionsbunden retur, tillåtna dealers och repetition genom samma taluppspelning. Repetition väntar på serverstart och stängning stoppar vidare batchuppspelning. |
| [blackjack-bet-controls.mjs](blackjack-bet-controls.mjs), [blackjack-table-client.mjs](blackjack-table-client.mjs) | Insatsutkast, befintliga Classic-gränser och serverkommandon. Ett tvetydigt startsvar behåller samma request-id och låser klienten tills serverläget återhämtats. |
| [filmed-action-controls.mjs](filmed-action-controls.mjs), [moving-speech-sequence.mjs](moving-speech-sequence.mjs) | Filmens actionägare och kortvisning enligt serverns draw-id, rundversion och exakta källframes. |
| [player-chat-controller.mjs](player-chat-controller.mjs), [blackjack-feedback.mjs](blackjack-feedback.mjs) | Köad utdelningschatt, begärans livscykel och tal/ljud/markering utifrån serverns avräkning. |
| [roulette/round-controller.mjs](roulette/round-controller.mjs), [roulette/wheel.mjs](roulette/wheel.mjs) | Sparat insatskommando och bekräftat kvitto; bildfel får inte skicka en ny insats. Hjulet får serverns utfall och den europeiska fickordningen från scenen. |
| `performance-player.mjs`, `local-film-player.mjs`, `speech-*`, `astrid-*` | Filmuppspelning, tal, kamerafunktioner och Astrids presentation. |
| `vendor/three/` | Versionsbundna Three.js-resurser som speluppspelning och kompositorer importerar direkt. De behövs i leveransen. |
| `roulette/` | Spelklienten för roulette. |

[Placeringsproven](../../../test/presentation/layout/action-placement.mjs),
[sittplatsproven](../../../test/presentation/layout/game-overlay-layout.mjs) och
[chattproven](../../../test/speech/capture/dealer-chat-visibility.mjs) importerar samma moduler
som klienten. De mäter mobilernas hinder, återupptagna ytterhänder, start/stängning
och röstberedskap med DOM-fixturer. Det är kodprov, inte ny visuell driftacceptans.
Modulerna levereras från den publika mappen; webbens importföljande byggsteg
inkluderar dem utan nya alias i det delade publika modulregistret.

Dealer-, preview-, film-, feedback-, utdelningschatt- och rouletteproven importerar
också dessa produktkontroller direkt. `app.mjs` kopplar dem till levande getters
och callbacks för dokumentets runda, session, saldo och mediakontroller. Där ligger
fortfarande DOM-montering, bordets övergripande spelkoreografi, kassaflöde och
native-brygga. `chat-requests.mjs` äger HTTP/strömning, pose-gaten äger talets
dealer-/sessions-/rundgräns och `local-presentation.mjs` äger vald film och avbrott.
Det är verkliga konsumentgränser; flyttarna skapar ingen alternativ spelmotor.
Roulettens separata dokument serverar kontrollern genom dess exakta resursroute.
Atlas följer modulimporterna; befintliga handgranskade spelkärneankare är oförändrade.

Två angränsande integrationsharness har fortfarande andra verkliga beroenden:
`operator-appearance-integration` avgränsar serverns HTTP-start och dokumentets
appearance-/startkoreografi via AST; insatskontrollerna importeras direkt.
`roulette-room-http` importerar hela rouletteklienten med serverns publika
regelalias, men kör scenmodulen med ersatta media-/rendererportar för att pröva
publicerad bolags-, dealer- och lagerisolering. Dessa prov är inte förbrukade;
en senare extraktion behöver behålla deras scope-, start- och återhämtningsfall.

Filmens kantshader används av `performance-player.mjs`; ljuskanterna följer
fasta vägg- och filtfärger samt bordets bakre kant. En saknad eller misslyckad
film startar ingen 2D-renderare. Filmkvittot anger då `renderer: 'none'`;
serverns kort visas separat av kortpresentationen och DOM-kontrollerna behålls.

Den fristående BO-tal-QA-ytan är avvecklad. `/api/bo/*` har inget skrivundantag;
gamla QA-adresser skapar inga sessioner eller betalda talförsök. Engångsimporten
av diskjournaler är också avvecklad. Historiska SQL-migreringar samt tidigare
försök och importkvitton i Neon bevaras.

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
