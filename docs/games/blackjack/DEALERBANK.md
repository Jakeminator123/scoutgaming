# Blackjack: dealerbank, mått och format

[Till blackjackguiden](README.md). Ett rum använder alltid sitt publicerade paket.

## Två poser

VILA är viloposen och REDO posen vid skon. Kedjan är VILA → till skon → REDO → en eller flera korthandlingar → från skon → VILA. Vila loopar kring VILA; övergångar, utdelningar, hålkortsvändning och repliker spelas en gång. Eventet `idle.ready` kräver ingen tredje pose eller separat ready-film.

Identitet, kläder, kamera och posehashar är låsta per dealer. Byte av VILA kräver ny bedömning av REDO och alla beroende klipp. Lika ändrutor bevisar inte en sömlös loop: hastighet, ljus och anatomi granskas också.

## Grundbanken: 30 klipp

| Grupp | Antal | Start → slut |
| --- | ---: | --- |
| Vila | 1 | VILA → VILA |
| Till och från skon | 2 | VILA → REDO / REDO → VILA |
| Sju spelarplatser samt dealerns öppna och dolda kort | 9 | REDO → REDO |
| Vända hålkortet | 1 | REDO → REDO |
| Talfack | 17 | VILA → VILA |

Det gäller en dealer, ett språk och en standardtagning per fack, plus stillbilderna VILA och REDO. Det är en fullständighetsplan; motorn kräver inte alla 30 för att starta.

Talfacken: greeting, placebets, goodluck, insurance, double, sidebet, bust, blackjack, dealerblackjack, dealerbust, win, push, lose, peek, chatter1, chatter2 och farewell. Goodluck, insurance och double har egna speak-event; övriga använder `speak.other` med exakt situation. En replik kräver matchande text, ljud, video och cue-data; ändrad text är en ny replik.

## Koordinater och boxnumrering

Källplanet är 1080×1920 med kortcentrum som ankare, x åt höger och y nedåt. Kortet är 79×106 px i PAOW-familjen. Forge-standardens mål:

| Plats i UI | Situation | Centrum x,y | Event |
| --- | --- | --- | --- |
| 1 | box0 | 110,1025 | deal.player.left |
| 2 | box1 | 253,1075 | deal.player.left |
| 3 | box2 | 396,1105 | deal.player.centre |
| 4 | box3 | 540,1115 | deal.player.centre |
| 5 | box4 | 684,1105 | deal.player.centre |
| 6 | box5 | 827,1075 | deal.player.right |
| 7 | box6 | 970,1025 | deal.player.right |
| Dealer öppet/dolt | dealer-up / dealer-hole | 540,895 | deal.dealer |

Vändning använder `reveal.dealer`/`dealer-hole`. Box 1 är spelarens vänstra sida; spegla inte. Värdena är kodens standard, inte uppmätt handkontakt i varje film; mät skons hämtpunkt och landningsrutan mot den verkliga REDO.

## Två desktopprofiler

| Profil | Formel vid 1920×1080 | Innebörd |
| --- | --- | --- |
| Forge | x′=x+420, y′=y−108, skala 1 | Porträttfilen beskärs på höjden (den oanvända funktionen `stageTransform` är raderad). |
| Höjdanpassad (Light) | x′=656,25+0,5625x, y′=0,5625y | Hela porträtthöjden ryms. |

[dealerFrameRect](../../../packages/presentation/contracts/dealer-framing.mjs) använder visningshöjd × sparad `scale` samt x/y-offset; standard `scale=1` ger höjdanpassning, och `scale=16/9, x=0, y=13/45` ger Forge-beskärningen. Båda kan alltså uttryckas, men ett rum läses alltid från sin publicerade profil. Ingen automatisk crop, förflyttning eller förstoring får lösa konflikten i tysthet.

## Format och lager

- Dealerklipp: H.264/MP4 i 9:16 (1080×1920), konstant 24 fps, kvadratiska pixlar och ingen rotation. Friläggning (grön nyckling eller alfa) anges per media i registret. Repliker bär bild och ljud i samma MP4 (`recordedSpeech` v2, se [runtime-referensen](../../LOCAL-PRESENTATION-RUNTIME.md)); övriga klipp är tysta.
- WebM/VP9 med riktig alfa accepteras av [MIME-valideringen](../../../packages/shared/media-file-types.mjs), men det bevisar inte alfa eller ljud i varje webbläsare. Kontrollera faktiskt innehåll.
- Bord: PNG RGBA eller förlustfri WebP med riktig transparens, otrimmad canvas. Bakgrunder är separata, opaka bilder eller ljudlösa videor.
- Lagerordning med split: bakgrund → dealerkropp → bord → kort → dealerhänder (samma avkodade bild) → framkant → UI. En horisontell split är en provmask, ingen handsegmentering.
- [Videoschemat](../../../packages/presentation/contracts/schemas/video.schema.json) använder `playback: once`; loop för en registrerad grundloop ligger i vilopolicyn.

## Klassning och godkännande

Ett klassningsförslag (pose, ändrutor, kameradrift, fel arm, falska kort) är en heuristik, inte en produktgrind; inga klipp flyttas eller publiceras automatiskt. Mät landningsruta och indexbas i den verkliga filmen. Kontakt, alfa, skarv, mobil/desktop och läppsynk bedöms visuellt av Jakob.
