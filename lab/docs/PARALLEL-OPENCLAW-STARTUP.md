# Parallell uppgift: verifierad lokal OpenClaw-anslutning

Arbeta i `C:/Users/jakem/Projects/croupier` på aktuell work-branch. En annan
agent äger Eventstudions UI, mediefamiljer, manifestval och native-uppspelning.
Din avgränsade uppgift är lokal anslutning och driftdokumentation för OpenClaw.

Läs AGENTS.md, `open-claw/lab/docs/README.md`, `OPENCLAW-DOCS.md` och relevanta
driftguider där. Det finns ett lokalt källindex och ett litet runtimepaket,
inte en installerad dokumentations-MCP eller fulltextindexerad docs-databas.
Använd relevanta officiella OpenClaw-källor vid behov och jämför med versionen
i `open-claw/lab/deploy/Dockerfile.gateway` och faktiskt körd version.

Gör följande:

1. Kontrollera läsande vilka anslutningar som faktiskt finns för lokal
   produktserver → OpenClaw Gateway och labb → Director. Redovisa konfigurerat,
   nåbart och funktionellt prov som skilda resultat. Läs inte ut nyckelvärden i
   terminal, logg, dokument eller Git. Skilj gatewaynyckel från modellnyckel.
2. Ordna en uttrycklig lokal startväg för ett isolerat prov med den befintliga
   OpenClaw-anslutningen. Använd separata portar, loopback och en separat
   databas/datakatalog; återanvänd inte riktiga spelaruppgifter. Bevara den
   befintliga offline-jämförelsens nätspärr och tomma providerinställningar.
   Lägg hellre den nya startvägen i en separat helper med tester. Hemligheter
   får läsas från befintlig privat konfiguration men aldrig kopieras till
   kommandoradsargument, webbläsare, exempeldata eller versionshanterade filer.
3. Behåll OpenClaws befintliga OpenAI-konfiguration. Byt inte provider till
   Gemini, kör inte ny onboarding och ändra inte gatewayroller eller externa
   behörigheter. Kontrollera att produktens strukturerade talbeslut kan nå rätt
   roll med det nuvarande kontraktet; rapportera konkret eventuell konflikt.
4. Dokumentera vilka processer som behöver startas om och vilka som redan har
   rätt kod/konfiguration. Stoppa inte de gemensamma processerna på 4192/4194
   medan den andra agenten arbetar. Ingen extern redeploy eller gatewayomstart
   ingår i denna uppgift. Ge ett exakt förslag om sådan åtgärd behövs.
5. Verifiera den nya helpern, inklusive att den inte använder verklig DB eller
   exponerar nycklar. Ett litet manuellt modellprov får bara ske genom den
   avsedda gatewayen med syntetiska kortdata och ett syntetiskt visningsnamn.
   Beskriv vad som faktiskt observerades, inte bara vad kontrakttester täcker.

Äg endast en ny anslutningshelper med tillhörande tester och en avgränsad guide
under `open-claw/lab/docs/`. Ändra inte `lab/components/`, `lab/lib/`, manifest,
MP4-filer, `web/server.mjs`, `web/public/` eller gemensamma handoff-filer.
Bevara alla befintliga dirty-filer. Leverera en kort integrationsnotering med
filförteckning, testresultat, startkommando och eventuella driftblockerare.
Samordna via befintlig repo-rutin före commit/push; pusha aldrig main.
