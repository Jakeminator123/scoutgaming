# Dokumentation – bara vid behov

`llms.txt` är en länklista, inte en tjänst som kör eller indexerar något.
I det här projektet läser en IDE-agent den **bara när en aktuell OpenClaw-fråga
behöver en källa som inte redan finns här**. Sedan läser agenten relevanta sidor.

Ingen automatisk crawl, bakgrundssynk eller vektordatabas är installerad.
Dokumentationen hämtas inte vid spel-events, dashboard-inloggning eller varje
chattmeddelande och läggs inte automatiskt i OpenClaws modellprompter.
Återanvänd redan kontrollerade källor inom uppgiften; kontrollera på nytt när
versionen eller sakfrågan kräver det.

- [Officiella källor och lokala konfigurationsfiler](OPENCLAW-DOCS.md)
- [Starta på Render](RENDER-START-SV.md)
- [Teknisk drift och nycklar](DEPLOYMENT.md)
