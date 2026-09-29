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

## Implementerat 2026-09-29, Render-aktivering och liveprov återstår

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
Render-miljöns aktivering och autentiserat upload → spara → återläs → spela
upp i den faktiska Lab-sessionen återstår. Schemakvittot ersätter inte det
fullständiga driftprovet.

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
Render dessa nycklar automatiskt. Överföring av serverhemligheter och
speluppspelning behöver göras och provas separat. En privat video måste
hämtas av en behörighetskontrollerad serverväg; den direkta Blob-länken kan
inte användas som ett vanligt `<video src>`. Den vägen behöver också
hantera HTTP Range för videouppspelning.
