# Nästa parallella uppgift: rätt OpenClaw-roll för produktchatten

Arbeta i C:/Users/jakem/Projects/croupier på aktuell work-branch. Eventstudions
manifeststyrda UI och uppspelning ägs av en annan agent; rör inte lab/components,
lab/lib, mediemappar eller den pågående lokala jämförelsen på 4192/4194.

Läs AGENTS.md, open-claw/lab/docs/README.md, OPENCLAW-DOCS.md,
LOCAL-CONNECTION-SV.md samt produktens web/openclaw-chat.mjs och befintliga
talpakets-/posegrindstester. Kontrollera ändringar mot den låsta OpenClaw-versionen
och dess schema. Det finns ett källindex och runtimepaket, inte en docs-MCP.

Förbered en avgränsad, testad kod-/konfigurationsändring för följande blockerare:

1. Produktchatten behöver en separat verktygslös croupier-speech-roll som följer
   exakt det befintliga JSON-kontraktet recordedLine/generatedText/silence med
   request-, dealer-, session- och rundrevisioner. Operatörsrollen croupier-chat
   får inte återanvändas eller ändra innebörd.
2. Behåll befintlig OpenAI-provider, modell och nyckelhantering. Ingen Gemini,
   onboarding, ny extern behörighet eller exponering av Gatewayens /v1 genom
   den publika dashboardproxyn.
3. Beskriv och testa avsedd privata transport. Om laptop → privat Gateway inte
   är möjlig, föreslå en smal autentiserad Director-adapter för enbart det
   validerade produktkontraktet. Redovisa säkerhetsgränsen innan extern driftsättning.
4. Bevara serverägda speldata, skyddat hålkort/framtida shoe, säkert displayName,
   opak identitet och samma spelares flera boxar. Tal och chattrad ska fortfarande
   hållas tills spelaren kvitterar verklig standard-idle; skapa inte en andra talkö.
5. Testa fel roll, fel revision, saknad koppling, timeout, dubbelsvar, promptinjektion
   i visningsnamn/chatt och att deal inte kan blockeras av väntande tal.

Leverera lokal kod, tester och en exakt driftplan. Ändra inte privata nycklar,
Render-konfiguration eller körande Gateway och gör ingen redeploy i denna uppgift.
Separata portar och tempdatabaser för QA. Använd inte verkliga spelare. Samordna
före commit/push enligt repots rutin; pusha aldrig main. Bevara andras dirty-filer.
