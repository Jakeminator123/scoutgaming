# Blackjack — dealerbank, mått och format

[Till spelmanualen](README.md). Detta dokument sammanför de mottagna planerna utan att göra deras oprövade val till produktregler. Alla original och källhashar finns i [KALLOR.json](KALLOR.json).

## En person, två låsta poser

VILA är viloposen. REDO är posen vid skon. Planens kedja är VILA → to-shoe → REDO → en eller flera korthandlingar → from-shoe → VILA. Idle loopar kring VILA; övergångar, utdelningar, hålkortsvändning och tal spelas en gång. Ett vänteläge kan hålla REDO.png. Eventnamnet idle.ready betyder inte att en tredje pose eller en separat ready-film är obligatorisk.

Lås identitet, kläder, kamera och posehashar. Byte av VILA kräver ny bedömning av REDO och beroende klipp. Samma rörelse ska inte skapas med olika skala i varje fil. Lika ändrutor bevisar inte en sömlös loop: hastighet, ljus och anatomi behöver också granskas.

## Planens 30 grundfilmer

| Grupp | Antal | Start → slut |
| --- | ---: | --- |
| Idle | 1 | VILA → VILA |
| Till/från skon | 2 | VILA → REDO / REDO → VILA |
| Sju spelarplatser, öppet och dolt dealerkort | 9 | REDO → REDO |
| Vända redan utdelat hålkort | 1 | REDO → REDO |
| Exakta talfack | 17 | VILA → VILA |
| Summa | 30 | plus två stillbilder VILA/REDO |

Detta gäller en dealer, ett språk och en standardtagning per fack. Det är en fullständighetsplan, inte ett krav att aktuell motor vägrar starta utan 30 filmer. HTML-planen föreslår dessutom sex tysta reaktioner (36 filmer totalt); Light-katalogen har i stället ett valfritt ready-hold (31 poster totalt). Räkna inte dessa två olika tillval som samma bank.

Talfacken är greeting, placebets, goodluck, insurance, double, sidebet, bust, blackjack, dealerblackjack, dealerbust, win, push, lose, peek, chatter1, chatter2 och farewell. Goodluck/insurance/double har egna speak-event; övriga använder speak.other med exakt situation. Textutkasten är inte godkända manus. En replik kräver matchande text, ljud, video och cue-data; samma situation räcker inte om texten ändras.

Den nya fyrfilsplanens ingång är [01_DEALERPLAN.json](underlag/dealerplan/01_DEALERPLAN.json), som pekar på [utdelning](underlag/dealerplan/02_UTDELNING.json), [tal](underlag/dealerplan/03_TAL.json) och [koordinater](underlag/dealerplan/04_KOORDINATER.json). De är exakt extraherade från START_HAR_Dealerplan.html och fortfarande planning_only. Det finns ingen styrkt bulkimport för detta format. ny-dealer är en platshållare, inte en registrerad dealer.

## Koordinater och boxnumrering

Källplanet är 1080×1920 med kortcentrum som ankare, x åt höger och y nedåt. Kortet är 79×106 px i denna familj. Forge-standardens åtta mål stämmer med båda mottagna planerna:

| Plats i filer/UI | situation | Centrum x,y | Event |
| --- | --- | --- | --- |
| 1 | box0 | 110,1025 | deal.player.left |
| 2 | box1 | 253,1075 | deal.player.left |
| 3 | box2 | 396,1105 | deal.player.centre |
| 4 | box3 | 540,1115 | deal.player.centre |
| 5 | box4 | 684,1105 | deal.player.centre |
| 6 | box5 | 827,1075 | deal.player.right |
| 7 | box6 | 970,1025 | deal.player.right |
| Dealer öppet/dolt | dealer-up / dealer-hole | 540,895 | deal.dealer |

Vändning använder reveal.dealer/dealer-hole. Box 1 är spelarens vänstra sida; spegla inte. Värdena är verifierade kodstandarder, inte uppmätt handkontakt för varje film. Skons 931,48/802,25 i Light är en äldre klickpunkt märkt ej godkänd; HTML-planen lämnar den null. Mät mot verklig REDO. Bakkanten y=740, bordskonturen och handmasken är utkast. DEALERBORD_MATT:s handhöjd gäller dess särskilda låsta VILA, inte alla dealers.

## Två olika desktopprofiler — välj medvetet

| Profil | Formel vid 1920×1080 | Källa och innebörd |
| --- | --- | --- |
| Forge / nya HTML-planen | x′=x+420, y′=y−108, skala 1 | Aktuell stageTransform i dealer-forge-catalog. Porträttfilen beskärs på höjden; ingen ny kamera. |
| Light / höjdanpassad källa | x′=656,25+0,5625x, y′=0,5625y | FORMATGUIDE/SCENKONTRAKT. Hela porträtthöjden ryms. |

[dealerFrameRect](../../../web/public/dealer-framing.mjs) använder visningshöjd × sparad scale samt x/y-offset. Med standard scale=1 blir porträtthöjden höjdanpassad. HTML-planens föreslagna framing scale=16/9, x=0, y=13/45 ger vid 1920×1080 samma beskärning som Forge. Därför kan båda beteendena uttryckas, men ett faktiskt rum måste läsas från sin publicerade profil. Ingen global ändring av zoom eller kalibrering görs här.

Light klassar den äldre cropen som LEGACY, medan HTML-planen väljer den och dagens Forge fortfarande implementerar den. KLIPPKLASSNING beskriver också cropen trots Light-guidens motsatta profil. Detta är en dokumenterad konflikt, inte ett avgjort nytt gemensamt beslut.

Light föreslår bred master 3414×1920 med mobilcrop x=1167, y=0, 1080×1920. Höjdskalning till 1080 ger bredd 1920,375, inte exakt 1920. Behåll registrerad crop/padding; skapa inte separat omgenererade sidor som ändrar perspektiv. 1088×1920-råoriginal får inte tyst beskäras och 1024×1536 är inte 9:16.

## Format och lager

Den bevarade [formatlåsningen](FORMATLASNING.md) gäller ett historiskt paket: H.264/MP4, 1080×1920, 24 CFR, SAR 1:1, ingen rotation/ljud och grön bakgrund. Webbvarianter 720×1280 CRF20, 1080×1920 CRF18 och 540×960 CRF23 behåller geometri och bildruteantal. CRF är en startinställning, inte kvalitetssäkring.

Light rekommenderar PNG RGBA/sRGB med riktig transparens för bord, lossless WebP som webbvariant och ingen trimning av transparent canvas. Bakgrunder är separata, opaka bilder eller ljudlösa videor; dealer/keying får inte frilägga ett grönt bord. Videoexportens profil är H.264/yuv420p, 24 CFR, SDR/BT.709, limited range och faststart. Okänd källfärg blir inte verifierad av nya taggar.

HTML-planen föreslår i stället WebM/VP9 med riktig alfa, Opus 48 kHz mono för tal och inget ljud i övriga klipp. KLIPPKLASSNING anger däremot ljudlösa WebM-filer även när klipptypen är tal. Dessa ljudprofiler behöver förenas innan export väljs; varken inbäddat ljud eller separat ljud får dubbleras i spelaren. Nuvarande [MIME-validering](../../../lab/lib/media-file-types.mjs) accepterar WebM; det bevisar inte alfa/ljud genom varje GPU-/CPU-väg eller webbläsare. CPU-keying multiplicerar inkommande alfa. Klassificeringsmetadata använder fortfarande green-screen, inte ett nytt alpha-enum. [Videoschemat](../../../lab/schemas/video.schema.json) använder playback: once; loopval för registrerad grundloop ligger separat i idle-policyn.

Ordning för splitlager: bakgrund → samma avkodade dealerbild/kropp → bord → kort → samma dealerbild/händer → framkant → UI. Maskerna måste vara korrekt registrerade. En horisontell split är en provmask och ingen allmän handsegmentering. Mask för synlighet (vitt visar) och Light-mask för bildredigering (vitt accepterar ny kandidat) har olika roller; blanda inte deras betydelse.

## Klassning och godkännande

[Klassningsunderlaget](underlag/light/KLIPPKLASSNING_FOR_AGENT.md) föreslår probe, ändrutor och mellanrutor, posejämförelse och kontroll av kameradrift, fel arm, extra objekt, falska kort och identitetsbyte. Dess SSIM/diff-, avstånds- och confidence-gränser är heuristiker, inte kalibrerade produktgrindar. Auto-flytta eller publicera inga klipp från ett klassningsförslag.

Genomför en pilot först: låst VILA → idle → riktig spelare, därefter REDO och övergångar, en mittutdelning, resten av korthandlingarna och sist godkända tal. Light stöder inte tal/läppsynk trots talposterna i katalogen. Ingen beställning eller providerinstallation följer av dokumentationen.

En femsekunders generering får inte automatiskt pressas till äldre 26–28-rutorsreferenser. Mät landningsruta och indexbas i den verkliga filmen. Äldre FORMATLASNING lämnar indexkonventionen öppen; HTML-planens releaseFrameIndexBase=0 är ett planval och får inte skriva om gamla märkningar.

START_HAR:s KLARA-uppgifter är källans mätkvitto: 22 produktionsfilmer/4 poser i två paket; Dragge 11 standardfilmer, Paow 10 plus alternativtagning; idle/tal saknas, Paow saknar hålkort och båda separat reveal. ZIP-filerna och filmerna har inte mätts om i denna dokumentgranskning. Detta säger inget om dagens registrerade/publicerade bank. Full visuell kontakt-, alpha-, skarv-, mobil-/desktop- och läppsynkacceptans återstår.
