# Astrid: lägg in klipp, varianter och små bakgrundszoner

Status 2026-09-29. Den här guiden gäller den aktuella checkouten
`C:\Users\jakem\Projects\croupier`. En film som syns i Labbet är en kandidat;
den är inte därmed godkänd i produktens spelare. Pågående, ocommittade MP4,
manifest och policyer i `emil/dealklipp-v1` tillhör pågående mediaarbete och
ska bevaras tills ägare och avsikt har kvitterats via `agent-talk`.

## 1. Färdiga Astridfilmer och varianter

### Chatt och privat röstpanel

Astrids chattfält och konversation ska alltid synas i spelet, även på mobil.
De ska inte stängas av en timer eller följa den privata röstpanelens synlighet.
Panelen med egen rösttranskription och kamerainformation är dold från början;
ett långt tryck på röstknappen öppnar den. Vanlig textchatt kräver inte att
mikrofon eller kamera aktiveras.

### Direkt i Astrid Studio

Vercel-ingången `/labb-lissabon` öppnar det befintliga, skyddade Labbet på
Render `/studio`, från samma GitHub-repo. Inloggningen ägs av Render/BO.
Efter att den nya Lab-versionen driftsatts:

1. Välj **Ladda upp & bibliotek**, en MP4/WebM (högst 128 MB) och ett namn.
2. Välj exakt kortplats, replik eller Idle. Förhandsvisa den valda filen.
3. Välj **Ladda upp och spara klipp**. Vänta tills sparandet har kvitterats
   och klippet återlästs. Den andra spelaren visar den sparade serverfilen.
4. Välj **Välj hur klippet ska användas**. Kort får frekvens, repliker får
   urvalstillåtelse/villkor och Idle får sin egen policy. Spara inställningarna.

Filen lagras på Lab-serverns beständiga Render-disk (`/var/data/studio/videos`)
och blir en manuell kandidat i samma exakta familj som uppspelningsmodulen
läser. Standardfilen ersätts inte. Gamla vanliga bankuppladdningar flyttas
inte automatiskt till gemensam uppspelning. Detta är inte Blob-synk; den
separata Blob-/zonkopplingen nedan återstår. Visuell granskning enligt
checklistan nedan krävs innan ett nytt klipp godkänns.

Det lokala biblioteket kontrollerades till 51 tillgängliga klipp, varav
22 varianter. Pågående ocommittade mediefiler måste importeras separat som
kandidater till Render; Git-publicering av enbart denna kod skickar inte dem.

### Mappimport och granskning

1. Välj först exakt familj: `deal/deal_pos1`–`deal_pos7` eller `deal_posdealer`
   för en kortplats, `repliker/<exakt-replik-id>` för tal, och `idle` för
   vänteläge. En film för ett visst ord eller kort får inte återanvändas som
   ungefärlig film för ett annat. Lägg ny kandidat i **den familjens**
   `variant/`-mapp. Basfilmer ligger direkt i familjemappen; idlebaser ligger
   direkt i `idle/`, korta idlevariationer i `idle/variant/`.
2. Använd en egen stagingmapp för omkodning och kalibrering. Behåll original
   och andra agenters filer. `build-index.mjs` vägrar skriva över kalibrerad
   film med andra bytes; ta inte bort metadata för att kringgå spärren.
3. I lokala Labbet: **Läs in nya filer**. Det skannar mapparna och uppdaterar
   manifestet utan att flytta MP4-filerna. Kontrollera att rätt fil-ID,
   familj och hash visas. Ny variant börjar som manuell kandidat.
4. I Astrids Deal-/replik-/idleeditor: välj när kandidaten får användas och
   spara projekt/policy. Deal har högst fyra aktiva frekvensvarianter per
   familj, sammanlagd andel högst 100 %; resten går till standard.
   Replikfamiljer visar högst fyra alternativ. Idle stöder högst 30
   variationer och har egna intervall/cooldown. `0 %` eller manuellt läge
   låter dig granska klippet utan automatisk användning.
5. Kontrollera varje avsedd take som ett paket: exakt repliktext, rätt inspelat
   ljud, rätt video, frame index, kalibrering och en skriven acceptansnotering.
   En ändrad ljud- eller videohash upphäver tidigare visuell acceptans.
   Lyssna och se hela repliken, kortkontakt, övergångar och slutbild.
   Spela två gånger i följd via spelets verkliga
   `?dealer=astrid&rehearsal=1`-spelare. Gör motsvarande kontroll för övriga
   tre dealers när en gemensam spel-/medieändring levereras.
6. För varje media-/playerändring: kör
   `node pipeline/audit-dealer-sync.mjs --probe` och testerna i
   `.githooks/pre-commit`. Uppdatera asset-baseline först efter mänsklig
   granskning och dokumenterat per-rad-resultat. Ett hash- eller testpass
   bevisar inte läppsynk. För uppspelningskvitto krävs både beslut och
   spelarens verkliga fil-ID/filnamn/familj.

Teknisk spel- och policybeskrivning finns i
[Labguiden](../lab/docs/README.md) och
[handoffen](JOHN-HANDOFF.md).

### Fristående import via Videobanken

Öppna lokalt Lab `/videos`. Där går det att lägga in MP4/WebM på högst
128 MiB, ge namn, dealer, exakt event/replik eller kortsituation och rollen
standard/alternativ. Filen lagras i Labbs Git-ignorerade bank, inte i
`emil/dealklipp-v1`. Valet **Koppla till projektutkastet direkt** är frivilligt;
**Spara projekt** gör den kopplingen beständig. Nya alternativ är manuella tills
regler, slump eller OpenClaw uttryckligen tillåts. En bankuppladdning är inte
en automatisk produktpublicering. Se [Videobanken](../lab/VIDEO-LIBRARY.md).

## 2. Små filmer som maskar bakgrundsytor

Öppna Astrid Studio → **Bakgrundszoner** (`/zones`) i det lokala Labbet.
Referensen är Astrids startbild på 1080 × 1920 pixlar.

1. Rita en rektangel över den lilla bakgrundsyta som ska få egen rörelse.
   Ange exakt X, Y, bredd och höjd och välj **Spara pixelruta**. Rektangeln
   är masken. **Ladda ned zonens startbild** ger en beskuren PNG som underlag
   när du skapar ett eget klipp.
2. Välj **Skapa blinkklipp** för ett lokalt tvåsekunders WebM-ljusprov, eller
   **Lägg in eget zonklipp** för MP4/WebM på högst 64 MiB. Det egna klippet
   måste ha **exakt samma pixelbredd och -höjd** som zonen. Om zonen senare
   ändras ligger det gamla klippet kvar för nedladdning men visas inte som
   passande förrän ett nytt klipp med rätt mått skapats.
3. Välj **Ljus (svart blir osynligt)** för lampglöd eller
   **Vanlig video / alfakanal** för vanliga motiv. Välj uppspelning
   **Hela tiden**, **Automatisk · högst 2/minut** eller **Av**. Automatisk
   startar första gången inom 10 sekunder, väntar sedan minst 30 sekunder
   plus 0–10 sekunder, och låter varje klipp spela klart.
4. Växla mellan relevanta deal-, replik- och idlefilmer i provytan. Kontrollera
   att bakgrunden inte flyttar sig, att ljuset inte täcker vägg eller händer,
   och att en rörlig dealer inte felaktigt hamnar bakom zonfilmen. Ett objekt
   bakom en person kan behöva en separat förgrundsmask. Prova även klippskarv
   och två uppspelningar. Bara gemensam 1080 × 1920-upplösning bevisar inte
   registrering mot varje take.
5. **Exportera koordinater** och **Ladda ned** varje zonklipp som ska bevaras.
   Koordinater ligger i webbläsarens `localStorage`, klipp i `IndexedDB`
   för just den webbläsarprofilen. En JSON-export innehåller inte själva
   videobytes. Byt inte profil/rensa webbplatsdata utan dessa exporter.

Detta är fortfarande en **Labförhandsvisning**. Spelets runtime-spelare läser
inte zonerna från webbläsarlagret. Nuvarande privata QA-Blob innehåller en
separat, godkänd testuppladdning av en man-MP4; det är inte ett publicerat
zonbibliotek eller ett visuellt godkännande för alla Astridfilmer. Se
[zonernas molnplan](ZONE-CLOUD-STORAGE.md).

## 3. Ska vi använda Vercel Blob?

Ja, för **godkända små zonfilmer och exporterat zonmanifest** är en privat
Blob rimlig när vi bygger synk och runtime. Det finns redan en privat
QA-store `croupier-astrid-zone-media-private` med
`BLOB_READ_WRITE_TOKEN` kopplad till
`croupier-player-preview-qa`. Skapa inte en ny token
eller kopiera denna till Director, Gateway, rotens `.env` eller browsern bara
för att få lokal uppladdning att fungera. Den nya Git-kopplade startsidan
`croupier-frontend` är ett annat Vercel-projekt och saknar denna koppling.

Nästa faktiska integrationssteg är en behörighetskontrollerad serverroute som
tar emot en zonfilm, verifierar MIME, storlek, mått, ägare och zon-ID, skriver
till **privat** Blob och lagrar bara metadata/revision i zon-Neon. En separat
spelroute måste kontrollera läsbehörighet och vidarebefordra HTTP Range/206
så att MP4 kan sökas/spelas utan att `BLOB_READ_WRITE_TOKEN` syns i klienten.
Först därefter kan Lab export/import ersättas med riktig synk och spelruntime
kopplas in. För stora originaltakes behövs en egen publiceringspipeline med
frame index, kalibrering och QA; att lägga rå-MP4 i Blob löser inte den delen.

Privat Blob kräver token även för läsning enligt
[Vercels dokumentation](https://vercel.com/docs/vercel-blob/private-storage).
Serveruppladdningar och filöverföring kan debiteras, så kostnadstak och
testmängd ska fastställas innan ett brett mediebibliotek förs över.

## 4. Tal, bild, minne, inloggning och saldo

Spelet äger idag konto/session, chattminne, saldo och runda i två SQLite-filer
på Render. OpenClaw får en avgränsad projektion av aktuell spelkontext via
spelservern och Director; det får inte direkt databasåtkomst eller rätt att
ändra saldo/utbetalning. Det finns redan en separat speech-roll, men ett
fullständigt publikt prov från talbegäran till giltigt beslut och hörbar,
synlig uppspelning är ännu inte kvitterat. Kamera/bild är opt-in och kräver
egen översättningsnyckel och bildintegritetsprov. Genererat Cartesia-/RunPod-
tal är också ett separat opt-in-prov, inte godkänd läppsynk.

Beslutet att flytta produktens konton, saldo och rundor till **egen game-Neon**
är dokumenterat men ännu inte genomfört. QA:s zon-Neon och Preview-Neon får
inte användas för skarpa spelare. En komplett adapter, backup av båda
SQLite-filerna, isolerad migration och återgångsprov måste bli klara först.
Efter en sådan flytt kan samma serverägda projektion fortsätta ge OpenClaw
relevanta, tillåtna fakta; OpenClaw behöver fortfarande ingen Postgres-URL.
Se [Neon-planen](NEON-GAME-MIGRATION.md) och
[OpenClaws produktkontrakt](../open-claw/lab/docs/PRODUCT-SPEECH-DEPLOYMENT-SV.md).
