# Roulette

Samlad ingång för implementerat spel och mottaget medieunderlag. Kodbas: main `426fa11417695025e2a0ee194825110f48f6b4af`, läst 13 oktober 2026. Underlagets bedömda fullständighet är **75 %**. [Källregler](../README.md), [teknisk referens](TEKNIK.md) och [källregister](KALLOR.json).

## Implementerat på main

För klippbegrepp och format, börja i [gemensamma referensen](../KLIPP-OCH-FORMAT.md). [37 utfallsfilmer](UTFALLSFILMER.md) beskriver det nya produktionsmålet, kopplingen till sparade serverkvitton och acceptanskraven. Filmstödet är ännu inte implementerat på granskad main. Webbplatsens AI-funktion ingår inte i dokumentationsuppdraget.

Europeisk roulette med enkel nolla, 37 fack och oberoende serverdrag via crypto.randomInt(0,37). [Generatorn](../../../web/games/roulette/index.mjs) accepterar operatörs-, rums- och rund-ID, inte seed eller önskat nummer. Nollan ingår inte i röd/svart, jämn/udda eller låg/hög. [Satsningskatalogen](../../../web/games/roulette/rules.mjs) har straight, split, street/trio, corner, six-line, dozen, column och outside. Nettovinster: 35:1, 17:1, 11:1, 8:1, 5:1, 2:1 respektive 1:1. Ingen La Partage eller En Prison. Gränser: 1–2 000 per fält och 10 000 per runda.

POST /api/roulette/table hanterar state och spin. Servern kontrollerar session, spelare/valuta och publicerat rum. Spin tar requestId, aktuell version, bets och context. [room.mjs](../../../web/games/roulette/room.mjs) validerar/avräknar; [storage.mjs](../../../web/games/roulette/storage.mjs) skriver saldo, transaktioner och kvitto atomärt i SQLite eller PostgreSQL. Exakt återförsök använder samma sparade kommando, aldrig ett nytt slumpanrop för att ersätta ett borttappat svar. De senaste 20 kvittona bevaras per spelar-/operatörs-/rumsscope; gamla versioner avvisas.

Spelingång: /play/roulette?operator=<slug>&table=<room-id>&dealer=<dealer-id>. Native demo/inloggning delas med blackjack, men roulette har egna regler och ingen sko. Detta är personliga rundor, inte ett gemensamt tidsstyrt multiplayerhjul. Partner-launch-konton är spärrade tills roulette stöds i deras plånbokskontrakt.

Den separata /roulette-test är en publik noindex-testyta utan spelkonton, insatser eller databassaldo. Blanda inte dess stateless provsnurr med rummets beständiga kommandon.

## Scen och kodägande

| Ansvar | Källa |
| --- | --- |
| Rumstillgång och publiceringskontroll | [access.mjs](../../../web/games/roulette/access.mjs) |
| Sida och resurser | [http.mjs](../../../web/games/roulette/http.mjs) |
| HTML, CSS och interaktion | [web/public/roulette](../../../web/public/roulette/) |
| Dealer/bord/bakgrund från fryst paket | [scene.mjs](../../../web/public/roulette/scene.mjs) |
| Gemensam publicerad scen | [published-scene.mjs](../../../web/public/published-scene.mjs) |
| Bolag, game och rum | [presentation-room-contract.mjs](../../../web/presentation-room-contract.mjs) |

Scenen läser /api/operators/<slug>/rooms/<room-id>/preview med revision och dealer. Ett rum har en speltyp; återanvända bakgrunder gör inte blackjackens rörelsebank till en roulettebank. Publicerad tyst idle används. Serverns kvitto bestämmer resultat och saldo; bildens eller en AI-films sista nummer gör det aldrig.

## Mottagen bordsspecifikation

[roulette_specifikation.json](underlag/roulette_specifikation.json) hittades i Desktop/videoskapare/roulette/, inte i den angivna bord/-mappen. Originalbytes bevaras med hash. Det är en prototypspecifikation med uppgifter från dess författare, ingen ny egen bild-/videomätning.

Den anger en RGBA-PNG på 1672×941, 2 229 281 byte, bildhash dcf2fe0eb5332bce7d599f3e41bc210b14a3bc9605444acc41634a2c2e28976b. Ingen verifierad ICC/färgrymd; delar av bordet har alpha 253/255. Kamera, fysisk bordsskala och kontakt mot VILA/REDO är inte uppmätta. Källan anger upprepade/otydliga hjulnummer, overifierad europeisk nummerföljd, overifierat satsningsmönster och productionApproved=false.

Beställningen begärde 15 sekunder, 1080p och stilla kamera. Beställd timing är 0–0,6 stilla, 0,6–4 acceleration, 4–7 fart, 7–14,4 inbromsning och 14,4–15 stilla. I denna äldre fil är actualOutput fortfarande okänt och SUBMITTED_PENDING bara en historisk status. Den ska inte användas för att starta om ett betalt jobb.

Svart videobakgrund är inte alfa. Global borttagning av svart skulle även skada svarta nummerfält och räcken. En statisk mask kan skydda bordets omgivning men bevisar inte korrekt sifferföljd inne i rotorn. Förslaget om separat stel rotor och kontrollerad vinkel är en produktionsidé, inte implementerat utfallsstöd.

## Senare arbete i PR47 — ännu utkast

[PR47](https://github.com/Jakeminator123/scoutgaming/pull/47), läst på e90fa70ece0c35340746c5684cea3094985af8d4, har senare källmetadata i [media-specification.json](https://github.com/Jakeminator123/scoutgaming/blob/e90fa70ece0c35340746c5684cea3094985af8d4/web/games/roulette/media-specification.json). Det är inte med i granskad main.

Ägarens kvitto där beskriver MP4/H.264/yuv420p, 1916×1080, 361 rutor, 24 fps, 15,041667 sekunder, 10 317 238 byte, inget ljud/alfa; hash 7702cec6f0ec5ec2e1767608781588e8f6b182a0fbc652a952706f8288314195. Rutor 0/180/360 uppges granskade. Full rörelse, skarv, maskregistrering och utfallsmappning är inte godkända. Detta är senare dokumenterat ägarbevis, inte en egen ny mätning i denna uppgift.

Utkastet lägger satsningar på fotografiskt bord med mobilförstoring och tillgänglig dialog. Det föreslår statisk PNG-alpha-mask och dealer till spelarens högra sida. Ankare för ögon/händer är uttryckligen okalibrerade. Utkastets blackjack-template med null-geometri ersätter inte blackjackens befintliga Forge-kontrakt.

## Vad saknas före godkänd medieintegration?

Verifierad hjul-/satsningsgrafik mot kodens europeiska sekvens och färger; kalibrerad kamera/bord/dealer; registrerad mask och fullrörelsegranskning; vald koppling mellan dekorativ film och serverhändelser; godkända roulette-specifika poser/rörelser/tal om sådana ska införas. Dessutom krävs riktig mobil/desktop, tangentbord, reducerad rörelse, fokusåtergång och sammansatt publicerad scen.

Regel-, HTTP-, SQLite- och isolerade PostgreSQL-prov beskrivs i [TEKNIK.md](TEKNIK.md). Inget produktionssaldo ändras för acceptanstester. Dokumenten ger inget mandat till datamigration, ny publicering, byte av PAOW/Johanna eller betald filmgenerering.
