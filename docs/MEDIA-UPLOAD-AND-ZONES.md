# Astrid: lägg in klipp, varianter och små bakgrundszoner

Uppdaterad 2026-10-01. Den här guiden gäller den aktuella checkouten
`C:\Users\jakem\Projects\croupier`. En film som syns i Labbet är en kandidat;
den är inte därmed godkänd i produktens spelare. Bevara originalmedia och
samordna nya fil-, manifest- och policyändringar via `agent-talk`.

## 1. Färdiga Astridfilmer och varianter

### Chatt och privat röstpanel

Astrids chattfält och konversation ska alltid synas i spelet, även på mobil.
De ska inte stängas av en timer eller följa den privata röstpanelens synlighet.
Panelen med egen rösttranskription och kamerainformation är dold från början;
ett långt tryck på röstknappen öppnar den. Vanlig textchatt kräver inte att
mikrofon eller kamera aktiveras.

### Direkt i Astrid Studio

Vercel-ingången `/labb` öppnar det befintliga, skyddade Labbet på
Render `/studio`, från samma GitHub-repo. Inloggningen ägs av Render/BO.
Det publicerade flödet är:

1. Välj **Ladda upp & bibliotek**, en MP4/WebM (högst 128 MB) och ett namn.
2. Välj exakt kortplats, replik eller Idle. Förhandsvisa den valda filen.
3. Välj **Ladda upp och spara klipp**. Vänta tills sparandet har kvitterats
   och klippet återlästs. Den andra spelaren visar den sparade serverfilen.
4. Välj **Välj hur klippet ska användas**. Kort får frekvens, repliker får
   urvalstillåtelse/villkor och Idle får sin egen policy. Spara inställningarna.

I den aktiverade molnkonfigurationen lagras nya familjeklipp i privat Vercel
Blob under `croupier/videos/`. Servern läser tillbaka hela filen och
kontrollerar hash innan den publicerar klippets metadata. Familjeindex,
projekt och policy ligger fortfarande på Render-disken. Befintliga
diskklipp fungerar parallellt. Utan aktiverad Blob-konfiguration använder
det lokala Labbet sin diskbank.

Uppladdningen blir en manuell kandidat i exakt den valda familjen;
standardfilen ersätts inte. Gamla fristående bankuppladdningar flyttas inte
automatiskt till gemensam uppspelning. Visuell granskning enligt checklistan
nedan krävs innan ett nytt klipp godkänns.

De 22 överlämnade varianterna är redan importerade och verifierade: **12 i
privat Blob och 10 befintliga diskposter**, med exakt familj/hash. Importera
inte dem igen enbart för att tio inte ligger i Blob. Det lokala manifestet
omfattar 51 klipp. Se [mediekvittot](MEDIA-BEST-TAKES-2026-09-29.md) och
[importkvittot](qa/cloud-media-import-2026-09-29.json) för exakta identiteter.
En Git-push, en Blob-upload och godkänd användningspolicy är skilda steg.

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

Välj **Spara till molnet** för att ladda upp zonklippen och spara koordinater
i den separata zondatabasen. **Läs från molnet** öppnar en separat molnvy;
**Till webbläsarkopian** behåller ditt lokala original. Sparning kräver
konfigurerad molnlagring och stoppar vid versionskonflikt, så en gammal flik
inte skriver över en nyare sparning. Lokala och osparade molnutkast är skilda.

Detta är fortfarande en **Labförhandsvisning**. Spelets runtime-spelare läser
ännu inte zonerna. Den tidigare uppladdade manfilmen i Blob är inte samma
sak som ett sparat, aktiverat zonbibliotek. Fullt isolerat liveprov av
uppladdning, sparning, återläsning och uppspelning återstår; se
[zonlagringen och provstatusen](ZONE-CLOUD-STORAGE.md).

## 3. Ska vi använda Vercel Blob?

Privat Blob används redan för nya familje- och zonklipp. Zonernas
koordinater och klippkopplingar sparas i egen Neon, inte i ett Blob-manifest.
Det befintliga privata lagret heter `croupier-astrid-zone-media-private` med
`BLOB_READ_WRITE_TOKEN` kopplad till
`croupier-player-preview-qa`. Skapa inte en ny token
eller kopiera denna till Director, Gateway, rotens `.env` eller browsern bara
för att få lokal uppladdning att fungera. Den nya Git-kopplade startsidan
`croupier-frontend` är ett annat Vercel-projekt och saknar denna koppling.

De skyddade serverrutterna finns redan: familjeuppladdning använder samma
videoregister som produktspelaren; zonuppladdning kontrollerar klippformat,
storlek och pixelmått innan privat lagring och metadata i zon-Neon.
Läsning går genom autentiserade GET/HEAD/Range-rutter, utan att token eller
privat Blob-adress skickas till browsern. Familjer använder `croupier/videos/`,
zoner `croupier/zones/`. Nästa kvarvarande verifiering är zonernas isolerade
liveprov och därefter separat inkoppling i spelruntime. Exakt tal behöver
fortfarande frame index, kalibrering och audiovisuell acceptans.

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
