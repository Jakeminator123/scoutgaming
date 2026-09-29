# Croupiers Director och privata OpenClaw Gateway

Den här mappen innehåller de två befintliga Render-tjänsternas serverkod,
Gateway-konfiguration och driftverktyg. Den aktuella arbetsytan för media och
projekt är [studion i repots lab/](../../lab/docs/README.md).

Arbetsrepo: `Jakeminator123/github-work`, branch `jakemanator123-github-work`.
Båda OpenClaw-tjänsterna kör denna GitHub-källa. Den tidigare separata
labbeditorns installations- och GitLab-instruktioner har tagits bort.

- [Aktuell miljökarta för dator, Render och Vercel](../../_ENVIROMENT-INFO.md)
- [Verifierad anslutning och aktuellt driftkvitto](docs/CLOUD-ACTIVATION-2026-09-29.md)
- [Drift av befintliga Render-tjänster](docs/RENDER-START-SV.md)
- [Roller, talbeslut och behörigheter](docs/PRODUCT-SPEECH-DEPLOYMENT-SV.md)
- [Lokal isolerad anslutning](docs/LOCAL-CONNECTION-SV.md)
- [OpenClaws dashboard](docs/DASHBOARD-SV.md)
- [Officiella källor och övrig aktuell dokumentation](docs/README.md)

Starta den lokala spel-/Lab-miljön med den koordinerade startaren i
Labguiden. Starta inte den äldre editorn parallellt med detta serverpar.

Produktservern på Render anropar Director med sin separat avgränsade
speech-token. Director anropar privat Gateway med Gateway-nyckeln. Endast
Gateway har modellleverantörens API-nyckel. Startsidan på Vercel använder
`CROUPIER_GAME_URL` och har ingen OpenClaw- eller databasanslutning.
