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

## Aktuellt sparläge

Labbet på `/zones` sparar fortfarande zonernas JSON i webbläsarens
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

Nästa kodsteg är ett skyddat Lab-API som tar emot zonkonfiguration och
klipp, validerar pixelmått och klipptyp, laddar upp klipp till Blob och
lagrar en liten JSON-konfiguration med Blob-sökväg i den dedikerade databasen.
Labbet ligger nu på Render/lokalt, så en Vercel-projektkoppling ger inte
Render dessa nycklar automatiskt. Överföring av serverhemligheter och
speluppspelning behöver göras och provas separat. En privat video måste
hämtas av en behörighetskontrollerad serverväg; den direkta Blob-länken kan
inte användas som ett vanligt `<video src>`. Den vägen behöver också
hantera HTTP Range för videouppspelning.
