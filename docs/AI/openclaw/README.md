# Dokumentation – bara vid behov

> Guide flyttad 2026-10-13. Relativa kodsökvägar som `src/`, `deploy/` och
> `config/` i exemplen utgår från `open-claw/lab/`. Daterade prov nedan
> är historiska; [aktuell dokumentingång](../README.md) skiljer drift från förslag.

`llms.txt` är en länklista, inte en tjänst som kör eller indexerar något.
I det här projektet läser en IDE-agent den **bara när en aktuell OpenClaw-fråga
behöver en källa som inte redan finns här**. Sedan läser agenten relevanta sidor.

Ingen automatisk crawl, bakgrundssynk eller vektordatabas är installerad.
Extern dokumentation hämtas inte vid spel-events, dashboard-inloggning eller
varje chattmeddelande. Ett litet versionsmärkt, lokalt
[kunskapspaket](../../../open-claw/lab/deploy/runtime-bundle/README.md) läggs däremot avsiktligt i
rollernas AGENTS-kontext efter redeploy: kort kontrakt för Director, även
begreppsmodell/källindex för chat och operator. Det är ingen full docs-kopia,
ingen hämtning av länkarnas innehåll och ingen ny verktygsbehörighet.
Återanvänd redan kontrollerade källor inom uppgiften; kontrollera på nytt när
versionen eller sakfrågan kräver det.

- [AI-agenternas flöde och ändringslogg](../scoutgaming-agentflode.md)
- [Aktuell drift och migration](../../CLOUD-MIGRATION.md)
- [Nyckelnamn och ansvar per tjänst](../../ENVIRONMENT-VARIABLES.md)
- [Officiella källor och lokala konfigurationsfiler](OPENCLAW-DOCS.md)
- [Verifierad lokal anslutning, isolerad start och kvarvarande produktblockerare](LOCAL-CONNECTION-SV.md)
- [Separat produkt-speech-roll, säkerhetsgräns och exakt driftplan](PRODUCT-SPEECH-DEPLOYMENT-SV.md)
- [Astrids kamera och mikrofon: implementation, testbevis och kvarvarande driftprov](../../LOCAL-PRESENTATION-RUNTIME.md)
- [Designunderlag: valbar kamera och mikrofon för Astrid](ASTRID-CAMERA-VOICE-PLAN.md)
- [Starta på Render](RENDER-START-SV.md)
- [Logga in i OpenClaws egen dashboard](DASHBOARD-SV.md)
- [Teknisk drift, nycklar och kedjan efter det pensionerade 29-septemberkvittot](DEPLOYMENT.md)
- [Separat social labbchatt för Astrid](SOCIAL-CHAT.md)
- [Namn, sparat labbminne, budgetbegränsad webbsökning och skämtläge](COMPANION.md)
- [Runtimekunskap: roller, versionshash, bevarade agentfiler](../../../open-claw/lab/deploy/runtime-bundle/README.md)
