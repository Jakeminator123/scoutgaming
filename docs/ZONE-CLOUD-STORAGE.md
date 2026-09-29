# Molnlagring för Astrids bakgrundszoner

Beslut 2026-09-29: zonvideor ska ligga i Vercel Blob och zonernas koordinater,
uppspelning och klippkopplingar ska ligga i en **egen** Neon Postgres-databas.
Detta gäller bara Astrids bakgrundszoner. Spel, saldo, kort och befintliga
produktdata fortsätter att ägas av Render och dess nuvarande databas.

## Resurser som finns

| Syfte | Resurs | Projektkoppling |
| --- | --- | --- |
| Zonvideor | Vercel Blob `croupier-zone-videos` (`store_zPcBQklQ3j9eWwOb`), publik, `arn1` | `croupier-player-preview-qa`; `BLOB_READ_WRITE_TOKEN` i Production, Preview och Development |
| Zonmetadata | Neon `croupier-astrid-background-zones-db`, Free, `fra1`, utan Neon Auth | `croupier-player-preview-qa`; `CROUPIER_ZONES_*` i Preview och Development |

Den **andra** Neon-resursen, `croupier-preview-neon`, finns också i samma
Vercel-projekt. Den är en separat Preview-databas. Använd **inte** dess
`DATABASE_URL`, `POSTGRES_URL` eller oprefixade `POSTGRES_*` för zonerna.
Zonkod ska enbart använda `CROUPIER_ZONES_DATABASE_URL` och andra
`CROUPIER_ZONES_*`-variabler. Koppla inte zonernas migrationer eller tabeller
till `croupier-preview-neon`.

Resurserna skapades och kopplingarna kontrollerades med Vercel CLI. Deras
hemliga värden ska stanna i Vercels miljövariabler och får inte committas.
Blob är publik för att en zonvideo senare ska kunna spelas direkt som media;
den som har objektets URL kan läsa den. Uppladdningsrätten är serverhemlig.

## Aktuellt sparläge

Labbet på `/zones` sparar fortfarande zonernas JSON i webbläsarens
`localStorage` och själva klippen i IndexedDB. Skapade molnresurser ger
**inte** automatisk synkronisering. Vid kontrollen var Blob-lagret tomt
(`0` filer). Den anpassade manvideon finns lokalt på Jakobs skrivbord som
`C:\Users\jakem\Desktop\croupier\background-man-aligned-206x284.mp4`;
`light-2`-blinkklippet finns fortfarande bara i den aktuella
webbläsarprofilens IndexedDB. Ingen zon har skrivits till Neon.

Ett försök att ladda upp just den lokala manvideon till det **publika**
Blob-lagret stoppades av automatisk godkännandegranskning: användaren hade
beslutat om lagret men ännu inte uttryckligen godkänt att exakt den filen
publiceras där. Ingen fil överfördes.

Nästa kodsteg är ett skyddat Lab-API som tar emot zonkonfiguration och
klipp, validerar pixelmått och klipptyp, laddar upp klipp till Blob och
lagrar en liten JSON-konfiguration med Blob-URL i den dedikerade databasen.
Labbet ligger nu på Render/lokalt, så en Vercel-projektkoppling ger inte
Render dessa nycklar automatiskt. Överföring av serverhemligheter och
speluppspelning behöver göras och provas separat. Publicera inga lokala
klipp i det publika Blob-lagret utan uttryckligt beslut om just filerna.
