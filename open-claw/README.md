# OpenClaw i Scoutgaming

`open-claw/lab/` innehåller den aktiva Director-servern, den privata Gatewayens
konfiguration och deras driftverktyg. Produktens speech-adapter använder denna
kedja. Sökvägen `lab` är en befintlig Docker-/driftreferens.

- [Samlad AI-dokumentation](../docs/AI/README.md)
- [Director och Gateway: kodens ansvar](lab/README.md)
- [Studio: användarguide](../lab/docs/README.md)
- [Runtime och media](../docs/LOCAL-PRESENTATION-RUNTIME.md)

Lokal Studio och spel startas med `node lab/start.mjs --no-open`;
respektera spärren för ett enda lokalt serverpar.
