# Astrid – dealerklipp, version 1 (2026-09-24)

Klipp för Croupier-spelet: kortutdelning och idle (MiniMax H3) samt repliker med läppsynk (MuseTalk + Cartesia).
Det här är **version 1**: fler klipp och nya versioner kommer.

## Teknik (gäller alla klipp)

| | |
|---|---|
| Format | MP4, H.264 (crf 12), yuv420p, BT.709, 24 fps, **1080×1920** (9:16), utan ljud |
| Startbild | `astrid_startbild_spel_1080x1920.png` – **varje klipp börjar exakt i den här bilden** (ruta 0 är identisk, byte för byte) |
| Slutbild | idle: samma startbild. Utdelning: startbilden + ett vitt kort på platsen |
| Sömlöshet | eftersom alla klipp börjar och slutar i startbilden kan de spelas i valfri ordning utan övertoning: idle → deal → idle → deal … |

Visa startbilden som stillbild när inget klipp spelas, och använd den som bas för läppsynk. Den är H3:s egen återgivning av
Kevins ankarbild (inte ankarbilden själv) – det är därför klippen matchar den utan hopp.

## deal/ – kortutdelning (8 klipp)

Dealern drar ett kort ur skon, glider det till platsen, vänder det och lägger det med **vit framsida** upp. UI:t ritar
valören ovanpå det vita kortet. Handen tillbaka i startpositionen. 2,7–3,5 s.

| Fil | Plats | Kortets centrum (px, 1080×1920) |
|---|---|---|
| `deal_pos1.mp4` | spelare 1 (längst till vänster) | 110, 1025 |
| `deal_pos2.mp4` | spelare 2 | 253, 1075 |
| `deal_pos3.mp4` | spelare 3 | 396, 1105 |
| `deal_pos4.mp4` | spelare 4 (mitten) | 540, 1115 |
| `deal_pos5.mp4` | spelare 5 | 684, 1105 |
| `deal_pos6.mp4` | spelare 6 | 827, 1075 |
| `deal_pos7.mp4` | spelare 7 (längst till höger) | 970, 1025 |
| `deal_posdealer.mp4` | dealerns eget kort (mitt i "Dealer stands on all 17s") | 540, 895 |

Kortet är 63×85 px, rakt, med rundade hörn. Samma koordinater i `kortpositioner.json`. Kortet ligger stilla från och med
sista rutan; UI:t kan rita valören när klippet är slut (eller från den ruta då kortet lagts – ca 0,5 s före slutet).

## idle/ – dealern väntar (6 klipp, 3 s)

| Fil | Innehåll |
|---|---|
| `idle_still_f73_s302.mp4` | sitter stilla, bara andning |
| `idle_blink_f73_s303.mp4` | stilla, en blinkning |
| `idle_breath_f73_s303.mp4` | ett lite djupare andetag, en blinkning |
| `idle_glance_f73_s301.mp4` | blicken glider åt sidan och tillbaka |
| `idle_cheek_f73_s301.mp4` | handen till kinden och tillbaka |
| `idle_insulted_f73_s301.mp4` | reaktion: kort förnärmad blick, tillbaka till neutral |

Förslag: spela `still`/`blink` mest, `glance`/`breath` ibland, `cheek`/`insulted` sällan. Alla kan loopas eller följa på varandra.

## repliker/ – Astrid pratar (17 klipp, med ljud)

Alla 17 repliker i Astrids `bank.json` som läppsynkade klipp på samma startbild, rösten Victoria (Cartesia).
Filnamn = replik-id (`blackjack.mp4`, `dealerbust.mp4`, …). Börjar och slutar i startbilden precis som klippen ovan,
så de kan spelas mellan idle och deal utan övertoning. Detaljer, texter och vilken spelhändelse som spelar vilket
klipp: `repliker/README.md`.

## Kontakt

Emil (konsult).
