# OpenClaw i Scoutgaming

Kodsökvägar som `src/`, `deploy/` och `config/` utgår från
`services/openclaw/lab/`. Översikt över alla AI-flöden: [docs/AI](../README.md).

## Läsregel

Bara `docs.openclaw.ai` och `github.com/openclaw/openclaw` är auktoritativa;
[källindexet](OPENCLAW-DOCS.md) pekar ut sidorna och de lokala
konfigurationsfilerna. `llms.txt` är en länklista som en IDE-agent läser
**bara när en aktuell fråga behöver en källa som inte redan finns här**, och
sedan hämtar agenten just de sidorna. Ingen crawl, bakgrundssynk,
vektordatabas eller dokumentations-MCP är installerad, och extern
dokumentation hämtas aldrig vid spelhändelser, inloggning eller chatt.

Gateway-rollerna får i stället ett litet versionsmärkt
[runtimepaket](../../../services/openclaw/lab/deploy/runtime-bundle/README.md)
i sin AGENTS-kontext vid containerstart: kontrakt för Director och
begreppsmodell och källindex för chat och operator. Det är ingen kopia av
dokumentationen och ger inga nya verktyg.

## Guider

- [Källindex och versionslås](OPENCLAW-DOCS.md)
- [Produkttal: `croupier-speech`, transport och dealerpersona](PRODUCT-SPEECH-DEPLOYMENT-SV.md)
- [Drift: tjänster, nycklar och Render](DEPLOYMENT.md)
- [OpenClaws egen dashboard](DASHBOARD-SV.md)
- [Astrids sociala labbchatt](SOCIAL-CHAT.md) och [companion: namn, minne, webbsökning](COMPANION.md)
- [Pensionerad lokal anslutning](LOCAL-CONNECTION-SV.md)

## Kodens ansvar

[packages/director](../../../packages/director/) äger beslutsmotor, tal- och
provkontrakt, social policy, companion och rena inställningar; Studio och
spelmotorn importerar biblioteket direkt. Tjänstens `src/` äger HTTP,
Gateway-RPC, signering, katalog-I/O och miljöläsning.
`apps/studio/lib/director-settings.mjs` och `services/game/director-settings.mjs`
väljer fil och datarot med den gemensamma läsaren
`packages/director/node/settings-reader.mjs`. Companion-lagret
(`companion.json`) ligger i bibliotekets `node/`-adapter; anroparen väljer
katalog.
