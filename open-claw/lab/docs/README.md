# Dokumentation – bara vid behov

`llms.txt` är en länklista, inte en tjänst som kör eller indexerar något.
I det här projektet läser en IDE-agent den **bara när en aktuell OpenClaw-fråga
behöver en källa som inte redan finns här**. Sedan läser agenten relevanta sidor.

Ingen automatisk crawl, bakgrundssynk eller vektordatabas är installerad.
Extern dokumentation hämtas inte vid spel-events, dashboard-inloggning eller
varje chattmeddelande. Ett litet versionsmärkt, lokalt
[kunskapspaket](../deploy/runtime-bundle/README.md) läggs däremot avsiktligt i
rollernas AGENTS-kontext efter redeploy: kort kontrakt för Director, även
begreppsmodell/källindex för chat och operator. Det är ingen full docs-kopia,
ingen hämtning av länkarnas innehåll och ingen ny verktygsbehörighet.
Återanvänd redan kontrollerade källor inom uppgiften; kontrollera på nytt när
versionen eller sakfrågan kräver det.

- [Officiella källor och lokala konfigurationsfiler](OPENCLAW-DOCS.md)
- [Starta på Render](RENDER-START-SV.md)
- [Logga in i OpenClaws egen dashboard](DASHBOARD-SV.md)
- [Teknisk drift och nycklar](DEPLOYMENT.md)
- [Separat social labbchatt för Astrid](SOCIAL-CHAT.md)
- [Runtimekunskap: roller, versionshash, bevarade agentfiler](../deploy/runtime-bundle/README.md)
