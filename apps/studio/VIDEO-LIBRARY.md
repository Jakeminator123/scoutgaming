# Videobank: standardtagningar och alternativ

Aktuell användaringång: [Guide i labbet](http://127.0.0.1:4188/guide).
Detta är teknisk referens. Se avsnittet **Aktuell ingång och kategoriavgränsning**
nedan för de skärpta reglerna och kategorisering av befintliga original.

## Användning

### Nuvarande grundkälla: Emils mapp

Från 25 september 2026 läser Videobanken som standard de 31 MP4-filerna direkt
ur `emil/dealklipp-v1/` via mappens `lab-video-manifest.json`. Filerna kopieras
inte till `lab/data/`, och videoinnehållet semantiskt indexeras inte. Manifestet
ger stabilt ID, relativ sökväg, storlek och SHA-256; hela hashen kontrolleras
först när ett klipp spelas.

Alla poster är Astrid-kandidater men avsiktligt omappade. De syns därför i
**Inkorg · kategorisera** tills rätt event, typ, roll och konkret situation har
valts manuellt. Detta gör inte klippen runtime-godkända och ändrar inte
produktspelaren. `LAB_VIDEO_ARCHIVE` kan peka på en annan rot endast om den har
samma manifeststyrda mappstruktur.

### Lokala original som standardförval

`/api/original-media` och spelaren för originalmedia är pensionerade
(12 oktober 2026). Registrerad video stannar på den gemensamma scenen.
Ett hanterat klipp utan spelbar fil visar den befintliga statustexten,
inte en separat originalmedia-reserv.
Standard utan `videoGenerationId` använder exakt matchande original för
vald dealer, replik eller stödd destination. En explicit koppling går före;
alternativ lånar aldrig standardens film. **Bara 2D** finns kvar.
Ingen projektfil skrivs om och inga råfiler flyttas. Detta ändrar alltså hur
en tom standardkoppling förhandsvisas, inte det sparade projektformatet.

Registrerad MP4 spelas genom produktens befintliga spelarmoduler.
Den indexerade H.264-banken (`runtime/indexed`) är borta ur Git och är inte
ett spelformat. Packad staged-video från den banken följde med bort.
Staged-förval gäller endast de registrerade destinationerna; senare kort,
split, reveal och övergångar får inte antas vara täckta.

Katalogen omfattar 84 lokalt tillgängliga poster, varav 22 för Astrid vid
kontrollen. Det är inventering, inte identitetskontroll, visuell acceptans
eller bevis för vilka bytes Bettalotto använder. Lokala uppspelningskvitton
är separata från originalspelets ännu saknade klipptelemetri.

Öppna **Videobanken** i det lokala labbet (`/videos`). Lägg in MP4 eller
WebM, högst 128 MiB per fil. Ange namn, dealer, event, avsedd roll
(standard/alternativ) och vid behov en konkret situation. Videotypen följer
eventet: idle, action, tal eller reaktion. Tal kräver ett exakt replik-ID;
en `speak.other`-film blir därför inte en gemensam talvideo för alla repliker.

Filen sparas direkt i den lokala banken. **Koppla till projektutkastet direkt**
är valfritt: standard ersätter linjens videoreferens i utkastet; alternativ
skapar en ny variant och behåller befintliga varianter. Kopplingen blir
beständig med **Spara projekt**. En linje rymmer fortfarande en standard och
högst fyra alternativ; banken kan innehålla fler kandidater för senare val.

Videobanken kan filtreras på källa, dealer, event, typ och avsedd roll.
Kategorisering beskriver vad operatören uppger att filmen föreställer, inte
visuellt godkänd täckning eller automatisk kvalitetsrankning. Standardrollen
i banken är en avsikt; den faktiska standarden är projektets koppling.

**Standardlinjer & kontroll av kopplingar** visar de 16 noderna för vald
dealer, kopplad standard, avgränsad situation och antal alternativ med video.
Den visar även unika rörelsedata/filhashar och trasiga eller semantiskt
felaktiga referenser i utkastet. Klicka på ett event för att öppna editorn.
Tillgänglig standardvideo innebär inte att alla situationer i en bred nod
är täckta: exempelvis finns flera repliker under `speak.other` och flera
bordsplatser under `deal.player.centre`.

## När får ett alternativ väljas?

Urval hör till **varianten i projektet**, inte till den råa filen. Nya
alternativ börjar med alla automatiska val avstängda, alltså manuell preview.
Vid direktkoppling kan detta väljas i uppladdningsformuläret; senare finns
samma val i Eventstudions varianteditor.

| Val | Betydelse |
| --- | --- |
| Regler | Får väljas efter prioritet när event och eventuella triggers matchar. |
| OpenClaw | Får föreslås av modellen; kontrolleras fortfarande mot katalog och triggers. |
| Slumpvariation | Deltar endast i labbets särskilda slumpval, av som utgångsläge. |
| Alla av | Endast manuell förhandsvisning. |

Triggers är frivilliga extra villkor. Inga triggers betyder inga extra
villkor, inte att en variant är avstängd. Alla valda triggers måste matcha.
Det riktiga eventet krävs alltid. **OpenClaw** är studions startläge.
**Bara standard** är ett jämförelseläge som spelar standard oavsett vilka
alternativa urval som är aktiverade.
Slumpläget väljer med lika sannolikhet bland standard och uttryckligen
slumpaktiverade alternativ som uppfyller sina triggers. Detta använder en
separat lokal presentationsslump och påverkar inga kort, pengar eller utfall.

Äldre projekt utan `selection` behåller sitt tidigare beteende
(`rules: true`, `model: true`, `random: false`). Inget sparat projekt skrivs
om automatiskt. Standardvarianten kan inte begränsas eller raderas.

## Lagring och gränser

- Egna filer: privat Blob i molnläget; offline-fixturen använder sin
  tillfälliga datamapp. Inget skrivs i checkouten.
- Varje fil behålls byte för byte och får UUID, SHA-256 och kategorisering.
  Originalnamnet används som förslag till visningsnamn, aldrig som filsökväg.
- Uppladdning strömmar till en tillfällig fil med en hård storleksgräns.
  Formatkontrollen gäller MP4/WebM-signaturen, inte full codec-/bildgranskning.
  Ospelbar video visar befintlig märkt 2D-reserv. Ingen transkodning utförs.
- Registret skrivs atomiskt under ett lås. Avbrutna/felaktiga uppladdningar
  lämnar inga nya registerposter. Samma intakta fil och samma metadata
  återanvänder tidigare post vid ett nytt försök.
- GET/HEAD och byteintervall använder samma verifierade filhandtag och
  SHA-256-kontroll som originalbanken. Endast localhost/samma ursprung tillåts.
- Emils manifeststyrda mapp visas tillsammans med uppladdningarna. Det äldre
  fältnamnet `videoGenerationId` används även för dessa video-ID:n och uppladdade
  video-ID:n för att bevara projektformatets befintliga kopplingar.
- En kategoriserad uppladdning får inte bindas till fel dealer/event.
  Vid eventtest ger fel exakt replik eller kortsituation 2D-reserv med spår.
  Manuell preview spelar det explicit valda klippet för inspektion.

Detta är lokal intake och labbpolicy. Produktens spelare, dealerfiler,
kalibreringar, produktregister och OpenClaws driftsättning har inte ändrats.
Takepooler, cooldown/viktning, full täckningskontroll, omkategorisering av
befintliga bankposter och produktintegration är separata fortsättningar.
Vill man korrigera en uppladdnings kategorisering i denna version kan samma
fil läggas in med korrigerade metadata och kopplingen bytas uttryckligen.

## Kontrollerat 20 september 2026

Före egna QA-data: 16 eventnoder, 64 dealerlinjer, 256 variantposter.
64 eventrörelser har 64 olika uppsättningar pose-spår, även när etiketter och
ID:n räknas bort. Därutöver finns en separat social rörelse, `social.ledsen`.
Rörelserna delas mellan de fyra dealeruppsättningarna. Alla 256 seedreferenser
fanns och tillhörde rätt event; även durationerna matchade. Samtliga 16
exempel matchade rätt katalogingång för alla fyra dealers.

Originalregistret innehöll 224 poster med 224 unika registrerade SHA-256;
alla 224 filer hittades lokalt med rätt storlek. Inga sparade videokopplingar
fanns i standarddatamappen; `lab/data/project.json` saknades. Detta beskriver
det kontrollerade lokala projektet, inte osparade webbläsarutkast eller BO/live.
Hash-/rörelseskillnad bevisar inte perceptuell skillnad eller hög kvalitet.

Verifiering: 184 labbtester, TypeScript och Next-produktionsbygge passerade.
Nya tester omfattar uppladdning/återläsning/byteintervall, avbrott, för stora
strömmar, fel format/ursprung/metadata, korrupt register, valbehörigheter,
slump med triggerkrav, exakt tal/situation och alla seedmappningar.

Isolerad webbläsar-QA på port 4192 med egen datamapp: riktig 1 353 762-byte
MP4 uppladdad genom formuläret, standardkoppling sparad, 1/16 synligt i
översikten, video spelad till 3,041667 sekunder och spelad igen. Ett nytt
alternativ började manuellt, kunde slumpaktiveras och valdes i slumpmode;
standardmode behöll standard. Sparade kopplingar överlevde omladdning.
Inga konsolfel observerades. Filmen användes som funktionstest, inte som ny
visuell acceptans av destination, rörelse eller läppsynk.

Alla kommandon i `.githooks/pre-commit` kördes. De tre integritetsauditerna
och övriga tillgängliga regressioner passerade. Sex tester kunde inte passera
på denna maskin: fem kräver saknade `ffmpeg`/`ffprobe`, ett kräver `jq`.
`audit-dealer-sync.mjs --probe` stoppades också av saknat `ffprobe`.
Den kontrollen är senare borttagen tillsammans med den indexerade banken.
Jira-anslutning saknades; inga CAC-statusar ändrades. Full dealer-QA och
hashbunden visuell acceptans är inte utförda av detta labbarbete.
# Aktuell ingång och kategoriavgränsning

Använd [Guide i labbet](http://127.0.0.1:4188/guide). Detta dokument är teknisk referens.
Videobanken visar som standard bara registrerade filmer för vald dealer/eventgrupp.
Inkorg samlar oklassificerade original och äldre ofullständiga klassificeringar.
Kategorisering av ett befintligt original sparas i `videos/classifications.json`
under labbets data-mapp, knuten till exakt ID och SHA-256. Originalfilen flyttas
eller ändras inte. Samtidiga redigeringar skyddas med lås och föregående metadata.
API: `POST /api/videos/classify` (endast lokalt/samma origin).

Alla kortgrupper och talgrupper kräver exakt situation/replik. Äldre tomma
korthandlingar kan läsas men behöver kategoriseras före ny koppling/test/sparning.
Okategoriserade original är granskningsbara men inte valbara som variantfilmer.
`playback` får bara vara `once`; utelämnat betyder `once`. Loop är inte aktiverat.
Kontrakt: `policies/studio-contract.json`; format: `schemas/video.schema.json`.
Urvalstillåtelser och triggers hör till varianten, inte en duplicerad filpolicy.
