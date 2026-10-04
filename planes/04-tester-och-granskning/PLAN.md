# 04 — Testkoppling, ändringsvarningar och oberoende granskning

## Syfte och mål

Låta den visuella kartan visa vilket bevis som finns för varje kontrakt och
var en ändring behöver följas upp. Återanvänd befintliga tester och CI.
Kartan ska inte bli en andra testmotor eller ett allmänt kontrollsystem.

## Min bedömning

En extra granskning är motiverad eftersom tre missade användarflöden nu är
identifierade. Den bör fokusera på rättningarna, shutdown/dataägande,
autentisering, mediereferenser och kritiska gränser efter migrationen.
Att läsa om alla agentloggar eller köra alla historiska betalda prov ger
inte automatiskt bättre bevis.

En ny databaskolumn kan vara en korrekt, avsiktlig ändring. Varningen ska
betyda ”kontrakt/karta/test behöver uppdateras”, inte ”kolumner får aldrig ändras”.

## Steg 1 — Koppla befintliga bevis

Varje kartobjekt får stabilt ID, källa, ansvarig tjänst, kontrakt, testfil/
testnamn, testtyp, verifierad SHA/datum och resultat. Länka till relevant
CI-körning eller en maskerad sammanfattning. Privata kvitton ska inte
publiceras eller laddas in i en publik HTML-sida.

Exempel på befintliga ankare:

- Process/gateway: [runtime-test](../../ops/cloud/test/runtime.test.mjs)
  och [WebSocket-test](../../ops/cloud/test/websocket.test.mjs).
- GPU-session/journal: [journalruntime](../../test/speech-journal-runtime.mjs),
  [Postgres-journal](../../test/postgres-speech-journal.mjs).
- Studio-schema: [migrationstest](../../test/studio-migrations.mjs).
- Auktoritet: [Studio/Render-test](../../test/studio-game-authority.mjs).
- Media: [Blob-routing](../../lab/test/blob-source-routing.test.mjs)
  och den befintliga dealer-/medieacceptansen.
- Dashboard: [proxytest](../../open-claw/lab/test/dashboard-proxy.test.mjs).
- Nyckelnamn: [namnkontroll](../../tools/check-environment-variables.mjs).

**Statusfärger:** grönt = aktuellt prov godkänt för angiven version;
rött = verifierat kontraktsfel/testfel; gult = ändrat sedan senaste relevanta
prov eller saknad uppdatering; grått = inte verifierat/inte tillämpligt.
Historiska gröna prov är inte aktuella bara för att kartan öppnas på nytt.

## Steg 2 — Avgränsad ändringsdetektion

- Jämför versionerade routes, schemas/migrationer, envnamn och eventkontrakt
  med kartans inventering. Ändringar ska länka till berörd del, inte måla hela appen röd.
- Länka händelser från spelmotor till policy och spelarens konsumtion genom
  verkliga eventnamn/payloadfält. Markera inte varje legitim spelsignal som avvikelse.
- Visa rapport från samma befintliga CI-körning. Kontrollerad ändring plus
  uppdaterad migration, tester och karta ska kunna bli grön.
- Gissa inte live-schema från versionsfiler. En eventuell live-jämförelse
  ska vara explicit läsande och skilja driftavvikelse från otestad kod.

## Steg 3 — Endast motiverade leveransgrindar

Tillåt blockering för exempelvis misslyckat relevant test, saknad migration,
bruten registrerad mediereferens eller odokumenterat required-envnamn när
kontrollen är stabil och åtgärden begriplig. Börja med varning för
redaktionell kartdrift. Inga nya generella stopp baserade på exakt pris,
postantal eller extra kvittobindningar.

Repo levereras till `main` via befintlig push-helper. Kontrollera faktisk
branch protection/CI innan någon säger att en kontroll blockerar serverns
merge eller push; en lokal hook ensam är inte detsamma som GitHub-skydd.

## Oberoende granskare

Granskaren får slut-SHA, konkret diff, tre reproduktioner, nya riktade
testresultat, återanvända bevis och kända luckor. Granskning är läsande.
Fynd klassas som bevisat fel, osäkerhet som behöver prov eller förbättring/backlog.
Ingen automatisk återkommande granskningsloop startas.

**Färdigt när:** en ändring av en vald route, kolumn eller signal visar
rätt berört kontrakt och dess verkliga teststatus, utan hemligheter eller
nya provideranrop. Relevanta fel går att följa från karta till kod och CI.
