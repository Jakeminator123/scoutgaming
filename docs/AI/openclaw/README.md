# Dokumentation – bara vid behov

> Guide flyttad 2026-10-13. Relativa kodsökvägar som `src/`, `deploy/` och
> `config/` i exemplen utgår från `services/openclaw/lab/`. Daterade prov nedan
> är historiska; [aktuell dokumentingång](../README.md) skiljer drift från förslag.

Det gemensamma biblioteket [packages/director](../../../packages/director/) äger
beslutsmotor, tal-/provkontrakt, social policy, Companion och rena inställningar.
Studio och spelservern importerar biblioteket direkt. Tjänstens `src/` äger
fortfarande HTTP, Gateway-RPC, signering, katalog-I/O och sin miljöfilläsare.
`apps/studio/lib/director-settings.mjs` och `services/game/director-settings.mjs` äger respektive
apps filval och datarot, med en gemensam Node-läsare i
`packages/director/node/settings-reader.mjs`. Filordning, alias och den
befintliga Director-dataroten är oförändrade. Companion-lagret (`companion.json`)
ligger också i bibliotekets `node/`-adapter;
anroparen väljer datakatalogen. Flytten skapar ingen ny lagringsyta.

`llms.txt` är en länklista, inte en tjänst som kör eller indexerar något.
I det här projektet läser en IDE-agent den **bara när en aktuell OpenClaw-fråga
behöver en källa som inte redan finns här**. Sedan läser agenten relevanta sidor.

Ingen automatisk crawl, bakgrundssynk eller vektordatabas är installerad.
Extern dokumentation hämtas inte vid spel-events, dashboard-inloggning eller
varje chattmeddelande. Ett litet versionsmärkt, lokalt
[kunskapspaket](../../../services/openclaw/lab/deploy/runtime-bundle/README.md) läggs däremot avsiktligt i
rollernas AGENTS-kontext efter redeploy: kort kontrakt för Director, även
begreppsmodell/källindex för chat och operator. Det är ingen full docs-kopia,
ingen hämtning av länkarnas innehåll och ingen ny verktygsbehörighet.
Återanvänd redan kontrollerade källor inom uppgiften; kontrollera på nytt när
versionen eller sakfrågan kräver det.

- [AI-agenternas flöde och ändringslogg](../scoutgaming-agentflode.md)
- [Aktuell drift och migration](../../CLOUD-MIGRATION.md)
- [Nyckelnamn och ansvar per tjänst](../../ENVIRONMENT-VARIABLES.md)
- [Officiella källor och lokala konfigurationsfiler](OPENCLAW-DOCS.md)
- [Pensionerad lokal anslutningshelper (avvecklingsnotis)](LOCAL-CONNECTION-SV.md)
- [Separat produkt-speech-roll, säkerhetsgräns och exakt driftplan](PRODUCT-SPEECH-DEPLOYMENT-SV.md)
- [Astrids kamera och mikrofon: implementation, testbevis och kvarvarande driftprov](../../LOCAL-PRESENTATION-RUNTIME.md)
- [Designunderlag: valbar kamera och mikrofon för Astrid](ASTRID-CAMERA-VOICE-PLAN.md)
- [Starta på Render](RENDER-START-SV.md)
- [Logga in i OpenClaws egen dashboard](DASHBOARD-SV.md)
- [Teknisk drift, nycklar och kedjan efter det pensionerade 29-septemberkvittot](DEPLOYMENT.md)
- [Separat social labbchatt för Astrid](SOCIAL-CHAT.md)
- [Namn, sparat labbminne, budgetbegränsad webbsökning och skämtläge](COMPANION.md)
- [Runtimekunskap: roller, versionshash, bevarade agentfiler](../../../services/openclaw/lab/deploy/runtime-bundle/README.md)

## Dealerpersona i spelchatten

Spelets textsvar (`POST /chat` → Director `/api/product/speech`) får persona och
svarsspråk från registret
[dealer-chat-persona.mjs](../../../packages/presentation/contracts/dealer-chat-persona.mjs):
dealer-id → `displayName`, `language` (`sv`/`en`), kort `persona` och
`replyStyle` (högst 2 meningar/220 tecken, styrs via prompten). `product-speech.mjs`
lägger persona, språkregel ("Svara alltid på svenska") och gemensam gräns (inga
spelråd, oddslöften eller uppmaningar att spela) *efter* adapterns ordinarie
spel-, integritets- och JSON-regler. Paow och Dragan svarar på svenska; Astrid
behåller sin oförändrade engelska standardregel. Oregistrerade dealers får den
generiska prompten. Svarsbiblioteket sparar dealerns registrerade språk (annars `en`).
Ny dealer: lägg en post i registret och ett fall i
`services/openclaw/lab/test/dealer-chat-persona.test.mjs`. Prompten byggs i
Director, så ändringen når spelet först när Director-tjänsten är omdeployad.
