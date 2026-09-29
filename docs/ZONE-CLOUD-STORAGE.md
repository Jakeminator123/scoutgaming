# Molnlagring för Astrids bakgrundszoner

Beslut 2026-09-29: zonvideor ska ligga i Vercel Blob och zonernas koordinater,
uppspelning och klippkopplingar ska ligga i en **egen** Neon Postgres-databas.
Detta gäller bara Astrids bakgrundszoner. Spel, saldo, kort och befintliga
produktdata ägs i dag av Render och dess SQLite-databas. Jakob har därefter
beslutat att även produktionsspelet ska migreras till Neon Postgres. Den
migreringen behöver en **separat spelresurs**, schema- och dataverifiering samt
kontrollerat byte; zon- och Preview-databaserna får inte återanvändas.

## Resurser som finns

| Syfte | Resurs | Projektkoppling |
| --- | --- | --- |
| Zonvideor | Vercel Blob `croupier-astrid-zone-media-private` (`store_AqwvebTbBHarOjvG`), privat, `arn1` | `croupier-player-preview-qa`; `BLOB_READ_WRITE_TOKEN` i Production, Preview och Development |
| Zonmetadata | Neon `croupier-astrid-background-zones-db`, Free, `fra1`, utan Neon Auth | `croupier-player-preview-qa`; `CROUPIER_ZONES_*` i Preview och Development |

Den **andra** Neon-resursen, `croupier-preview-neon`, finns också i samma
Vercel-projekt. Den är en separat Preview-databas. Använd **inte** dess
`DATABASE_URL`, `POSTGRES_URL` eller oprefixade `POSTGRES_*` för zonerna.
Zonkod ska enbart använda `CROUPIER_ZONES_DATABASE_URL` och andra
`CROUPIER_ZONES_*`-variabler. Koppla inte zonernas migrationer eller tabeller
till `croupier-preview-neon`.

Resurserna skapades och kopplingarna kontrollerades med Vercel CLI. Deras
hemliga värden ska stanna i Vercels miljövariabler och får inte committas.
Blob-lagret är kopplat endast till det angivna Vercel-projektet just nu.
**Private** innebär att även läsning kräver behörighet; en direktlänk räcker
inte. Projektkopplingen är en konfiguration, inte en oåterkallelig spärr:
lagret kan senare kopplas till andra projekt av en behörig administratör, och
en giltig serverhemlighet kan användas utanför Vercel. Hemligheten får aldrig
skickas till webbläsaren. Det tidigare, tomma och publika
`croupier-zone-videos` (`store_zPcBQklQ3j9eWwOb`) raderades innan något
klipp lades upp.

## Aktuellt driftläge 2026-09-29

Render-anslutningen är aktiverad. Den 29 september cirka 15:42 UTC öppnades
Studio med befintlig administratörssession. Zonvyn visade **Molnet har 0 zoner,
version 0**. **Läs från molnet** gav **Molnzonerna är inlästa** och samma
version i separat molnvy. Det verifierar autentiserad återläsning genom
Render till det dedikerade Neonschemat. Ingen zon sparades eller ändrades.
Full upload → spara → återläs → spela upp och zonernas inkoppling i spelet
återstår. Resursnamnet på Blob är historiskt; samma privata lager används
också för familjeklipp under separat `croupier/videos/`-namnrymd.

### Sammanhängande isolerat rundprov 2026-09-29 16:55 UTC

`node --test lab/test/zone-cloud-store.test.mjs` passerar **14/14** tester.
Det nya rundprovet skapar en syntetisk svart MP4 på 16 × 24 pixlar med riktig
`ffmpeg` och använder produktionskodens `ffprobe`, privata uppladdningsadapter,
hashkontroll, zonvalidering, sparning och skyddade videoläsning. Endast de
externa DB- och Blob-tjänsterna ersätts av isolerade testdubblar; provet går
inte via testets tidigare `probe`-/`putMedia`-genvägar.

Provet verifierar privat och oföränderlig uppladdning, full byteåterläsning
före klippraden, revision **1 → 2**, avvisad gammal revision med **409** och
oförändrad senast sparad geometri. En separat tom cache simulerar nästa
serverprocess: klippet hämtas igen från Blob-testtjänsten och ger två
korrekta **206 Range**-svar samt **200 HEAD** med rätt storlek och tom kropp.
Zonsvaret innehåller varken Blob-sökväg, direktlänk eller serverhemlighet.
En efterföljande misslyckad DB-insert städar endast sitt nya Blob-objekt;
det tidigare sparade klippet och zonerna finns kvar. Temporära klipp och
cachemappar städas av testet. Ingen produkt-/Lab-server startas.

Vercels riktade resursmetadata bekräftade zonresursen
`store_f0uLTbYiQKqQjLCY`, Neon-projektet `wandering-hill-60561912`, rätt
Vercelprojektkoppling och separata `CROUPIER_ZONES_*`-nycklar. Ett försök att
nå den befintliga QA-grenen via Vercels Neon-SSO stannade på krav att verifiera
kontots e-post innan identiteterna kan kopplas. Ingen QA-värd kunde därmed
bekräftas och inga Neon-skrivningar utfördes.

Ett försök att begära dekrypterad Vercel-miljö enbart för feldiagnostik
avvisades av den automatiska godkännandegranskningen som onödig exponering
av hemligheter. Fortsatt credentialhämtning och planerat live-Blob-skrivprov
stoppades. Inget nytt molnobjekt skapades. Detta rundprov är därför ett
**sammanhängande kodkvitto med isolerade tjänster**, inte en genomförd
liveuppladdning. Produktionszonernas lista och användardatabasen lämnades
orörda. Tidigare verifierad autentiserad produktionsläsning av 0 zoner/version
0 gäller fortfarande; full liveuppladdning/sparning kräver ett separat prov
efter återautentisering mot den bekräftade syntetiska QA-grenen.

## Implementerat flöde

Labbet har nu ett riktigt, skyddat molnflöde för zoner. **Spara till molnet**
laddar upp lokala MP4-/WebM-klipp genom `/api/zones/clips`, kontrollerar den
verkliga pixelstorleken med `ffprobe`, sparar privat Blob-media och skriver
zonkonfigurationen till det separata Neon-schemat `croupier_zones`.
**Läs från molnet** hämtar sparad konfiguration och öppnar en separat molnvy.
**Till webbläsarkopian** återgår till tidigare lokal geometri och klipp.
Ingen automatisk migration eller ersättning av browserlagringen sker.
Osparade molnändringar och ursprungsrevision sparas som ett separat lokalt
molnutkast och återställs med **Återställ molnutkast**, även utan molnanslutning.
Geometri, export och lokalt bevarade utkastklipp kan användas frånkopplat;
en ny molnsparning kräver anslutning. Varje lyckad
klippuppladdnings ID sparas direkt, så ett senare uppladdningsfel eller
versionsfel inte tvingar om samma klipp till nya Blob-objekt vid nästa försök.
Ändringar i molnvyn kräver en uttrycklig sparning. Sparningen ersätter de
tidigare molnkoordinaterna och stoppar med HTTP 409 vid versionskonflikt.

Servern behöver `CROUPIER_MEDIA_STORAGE=blob`, `BLOB_READ_WRITE_TOKEN` och
**endast** `CROUPIER_ZONES_DATABASE_URL` för zonernas databas. Om de saknas
fortsätter browserläget och molnsparning visar ett tydligt fel. Det finns ingen
fallback till generiska `DATABASE_URL`/`POSTGRES_URL` eller speldata.
Schemat finns i [`lab/lib/zone-cloud-schema.sql`](../lab/lib/zone-cloud-schema.sql)
och installeras uttryckligen i den separata zondatabasen; appstart eller
uppladdning utför inga automatiska schemaändringar. Använd direktanslutning
för schemaaktivering och poolad anslutning för applikationens HTTP-driver.

Alla zon-API använder samma Lab-behörighets- och origin-kontroll som övriga
skyddade Lab-routes. Videoläsning sker genom `/api/zones/clips/:id` med
GET/HEAD/Range och privat cachekontroll. Inga Blob-direktlänkar eller
hemligheter lämnas till klienten. Uppladdning begränsas till 64 MiB per klipp,
MP4/WebM och exakt zonstorlek inom Astrids 1080 × 1920-bildyta. Fel vid den nya
klippradens DB-skrivning rullar tillbaka just det nya Blob-objektet. Tidigare
molnklipp raderas inte när zoner ändras eller tas bort.

Verifierat i lokala isolerade tester: autentiserings-/originskydd, korrekt
DB-val, schema, två Range-läsningar och HEAD genom den gemensamma privata
Blob-adaptern, sparning/återläsning med versionskonflikt, saknade klipp,
fel mått, rollback, Render-proxyns origin och bevarad browserkopia. Faktisk `ffmpeg`/`ffprobe`
skapade och kontrollerade små MP4-/WebM-fixtures. 13 tester och TypeScript
passerade. DB- och Blob-tjänsterna var testdubblar: dessa resultat är **inte**
ett kvitto på driftaktivering eller autentiserad liveuppladdning. Inga
befintliga klipp, live-resurser, env eller speluppspelning ändrades i detta steg.
Zonerna är fortfarande en Lab-förhandsvisning; inkoppling i spelet är separat.

### Verifierad schemaaktivering i dedikerad Neon

Samordnaren verifierade därefter den 29 september det dedikerade zonprojektet
`wandering-hill-60561912`. Schemat provades först på QA-grenen
`br-soft-base-b1z5814s`: sparning och uppdatering gav revision **1 → 2**,
och en uppdatering med en gammal revision ändrade **0 rader**. Detta
bekräftar databasens versionsskydd med riktiga SQL-anrop. QA-endpointen
är suspenderad efter kontrollen.

Efter QA installerades schemat på huvudgrenen `br-flat-fog-b161a6r8`.
Tabellerna `croupier_zones.clips` och `croupier_zones.documents` verifierades
som **tomma** efter installationen. Inga användarzoner importerades och ingen
spel- eller Preview-databas användes för dessa schemaändringar.
Render-miljön är därefter aktiverad och återläsning verifierad enligt
driftläget ovan. Autentiserat upload → spara → återläs → spela upp i den
faktiska Lab-sessionen återstår. Schemakvittot ersätter inte detta driftprov.

## Föregående sparläge och redan befintliga filer

Före molnimplementationen sparade Labbet på `/zones` zonernas JSON i webbläsarens
`localStorage` och själva klippen i IndexedDB. Skapade molnresurser ger
**inte** automatisk synkronisering. Efter Jakobs uttryckliga godkännande
laddades den anpassade manvideon från
`C:\Users\jakem\Desktop\croupier\background-man-aligned-206x284.mp4`
till `astrid/background-zones/background-man-aligned-206x284.mp4` i det
privata Blob-lagret. CLI visade ett objekt på 65,76 KB, och en oinloggad
HEAD-begäran mot dess direktlänk fick HTTP 403. Filen finns också lokalt;
`light-2`-blinkklippet finns fortfarande bara i den aktuella
webbläsarprofilens IndexedDB. Ingen zon har skrivits till Neon.

Ett tidigare försök att ladda upp manvideon till det **publika** lagret
stoppades av automatisk godkännandegranskning. Den senare uppladdningen skedde
först efter Jakobs uttryckliga godkännande och efter att ett privat lager
skapats. Inga filer publicerades öppet.

Det identifierade kodsteget var ett skyddat Lab-API som tar emot zonkonfiguration och
klipp, validerar pixelmått och klipptyp, laddar upp klipp till Blob och
lagrar en liten JSON-konfiguration med Blob-sökväg i den dedikerade databasen.
Labbet ligger nu på Render/lokalt, så en Vercel-projektkoppling ger inte
Render dessa nycklar automatiskt. Serverhemligheterna har aktiverats separat;
speluppspelning av zoner behöver fortfarande provas separat. En privat video måste
hämtas av en behörighetskontrollerad serverväg; den direkta Blob-länken kan
inte användas som ett vanligt `<video src>`. Den implementerade medievägen
hanterar HTTP Range; zonflödets fullständiga liveacceptans återstår.
