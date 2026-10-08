# Utdelningsplatser från de färdiga klippen

Lokal demo: http://127.0.0.1:8620/

Sju numrerade spelplatser och dealerns kortmål läggs nu ovanpå videon. Klick eller Enter/Space skickar samma befintliga spelhändelse som knapparna under **Spelhändelser**. Markeringen tänds när klippet faktiskt börjar spelas, inte när det läggs i kön.

## Underlag och placering

Den aktiva banken innehåller 6 idle-klipp, 17 replikhändelser med 3 varianter vardera och 8 utdelningsklipp. Alla åtta utdelningar granskades i kontaktkartorna här. Replikerna inventerades i manifestet; denna kontroll är ingen ny granskning av samtliga 51 talklipp.

`public/media/manifest.json` är källan för både klipp-ID, kortstorlek (63 × 85) och landningspunkter. Punkterna överensstämmer med `public/media/deal/kortpositioner.json`. Numreringen är 1–7 från vänster till höger; mitten är plats 4.

| Plats | x | y |
| --- | ---: | ---: |
| 1 | 110 | 1025 |
| 2 | 253 | 1075 |
| 3 | 396 | 1105 |
| 4 | 540 | 1115 |
| 5 | 684 | 1105 |
| 6 | 827 | 1075 |
| 7 | 970 | 1025 |
| Dealer | 540 | 895 |

`public/table-boxes.js` ritar en SVG i videons koordinatsystem, 1080 × 1920. Kortmålet har 12 px marginal på sidorna och 10 px upptill/nedtill. Insatsringen ligger 108 px nedanför kortets centrum. Alla mått skalar gemensamt med videon.

Video/stillbild använder `object-fit: contain; object-position: center top` och SVG använder `xMidYMin meet`. Detta bevarar hela bildytan även på smala telefoner; tidigare `cover` skar bort ytterplatser. Ingen källa har beskurits, flyttats eller kodats om.

## Verifierat

- Alla åtta kontaktkartor granskade. `landing-measurements.json` mäter det vita kortets sammanhängande område i slutbilden: spelarplatserna ligger inom 1 px från manifestets centrum; dealer inom 2 px. Det är placeringskontroll, inte godkännande av handanatomi.
- Alla åtta utdelningar köade via bordets klickytor i den körande webbdemon. Renderad utdelning och aktiv markering observerade, inklusive mitten och ytterplatser; högerplatsens vita kort ligger helt inom sin ram.
- Datorvy 1280 × 900 och mobilvy 390 × 844 granskade. Alla sju klickytor ryms; mobilens spelarytor är cirka 47 × 73 CSS-pixlar. Den vanliga in-app-vyn återställd efter kontrollen.
- Enter på mittenplatsen använder samma händelseväg. Inga browserfel eller varningar observerade.
- `node --check public/app.js`, `node --check public/table-boxes.js` och `git diff --check` godkända.

Detta lägger till bordets spelplatser i Emils klippdemo. Det lägger inte till insatser, saldo, kortvärden eller beständiga spelhänder. De vita korten är fortfarande en del av respektive originalklipp. Videofiler, AI-konfiguration och serverlogik är oförändrade. Ingen generering har körts.

## Uppföljning: klick registrerades men spelaren stod still

Efter första granskningen rapporterade användaren att inget hände. Live-inspektion visade det synliga `idle/blink.mp4` pausat på 2,706 s av 3,042 s (`paused=true`, `ended=false`, `readyState=4`). Klick till plats 2 och 5 fanns i loggen, men kön väntade för alltid på `ended`.

`playback-recovery.js` återupptar nu pausad video. En kö bakom pausad idle kan starta direkt; pågående prat eller utdelning återupptas utan att hoppas över. Laddning och dolda flikar undantas. Återhämtningen körs vid köning, användargest, återkomst till fliken och i spelarens befintliga vakt. Sena play-promises får inte ändra ett nytt klipp. Bordet visar också om utdelningen väntar eller spelas.

Sju riktade regressionstester passerar med `node --test test/playback-recovery.test.mjs`. I den uppdaterade sidan registrerades klick till plats 2 och 5; plats 5 observerades faktiskt spela med rätt aktiva ruta, rätt MP4, `paused=false`, `readyState=4`. Den ursprungliga pausorsaken i webbläsaren är inte fastställd; fixen hanterar det observerade låsta tillståndet.

## Playable engine integration and latest speech bank

Updated 2026-09-25 after merging Emil's `1e271e1` (51 corrected speech endings).

Observed in the actual in-app browser on an isolated local demo wallet:

- A $5 main wager at seat 4 debited $1,000 to $995. Two cards arrived using `deal_pos4`; dealer upcard and concealed hole card used `deal_posdealer`.
- Hit on 7♥ + 8♦ dealt Q♥, showed 25/bust, revealed dealer 9♠ + 8♥ and settled with $0 returned. The demo balance stayed $995 and New round became available. Browser error log was empty.
- The next opening selected all seven seats, debited $35 and sequenced all 16 initial draws. Card positions stayed aligned with the recorded landings. Further doubles/hit advanced to the next player hand, with the extra stakes reflected in the wallet. User interaction overlapped that second test; it is not claimed as an exclusively automated seven-seat settlement check.
- Responsive inspection at 597 × 778 exposed HUD misalignment in the letterboxed video. Fixed the HUD frame to the same contained 9:16 rectangle and visually rechecked it.
- Card target outlines removed. Seven fine gold felt rings, person markers, green stake chips and active-hand highlighting remain.

Automated: original 197 engine/shoe checks and persistence cases; 4 new integration tests (seven-seat ordering, split/hit/double/reveal, immediate blackjack, transactional demo wallets); 7 playback-recovery tests. All pass. No production wallet or game files changed. No newly generated media. New source/architecture notes: `GAME-ENGINE.md`.

Limits: only sampled speech variants were visibly exercised. The prerecorded in-flight card and SVG resting cards do not yet have per-finger occlusion; do not call this a perfect full-round composite.
