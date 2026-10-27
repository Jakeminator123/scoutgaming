# OpenClaw i Scoutgaming

`services/openclaw/lab/` innehåller Director-servern, den privata Gatewayns
konfiguration och deras driftverktyg. Spelarens tal går genom denna kedja.
Namnet `lab` finns kvar i Docker- och driftreferenser och betyder inte att
koden är ett labb.

- [AI-dokumentationen](../../docs/AI/README.md)
- [Director och Gateway: kodens ansvar](lab/README.md)
- [Studio: användarguide](../../apps/studio/docs/README.md)
- [Runtime och media](../../docs/LOCAL-PRESENTATION-RUNTIME.md)

`node apps/studio/start.mjs --no-open` skriver den publicerade produktens
adress. Det lokala `--offline`-serverparet och anslutningshelpern
`lab/deploy/local-connection.mjs` är pensionerade sedan 27 oktober 2026.
