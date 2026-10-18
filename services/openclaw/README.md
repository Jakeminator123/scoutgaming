# OpenClaw i Scoutgaming

`services/openclaw/lab/` innehåller den aktiva Director-servern, den privata Gatewayens
konfiguration och deras driftverktyg. Produktens speech-adapter använder denna
kedja. Den interna nivån `lab` behålls i Docker-/driftreferenser.

- [Samlad AI-dokumentation](../../docs/AI/README.md)
- [Director och Gateway: kodens ansvar](lab/README.md)
- [Studio: användarguide](../../apps/studio/docs/README.md)
- [Runtime och media](../../docs/LOCAL-PRESENTATION-RUNTIME.md)

`node apps/studio/start.mjs --no-open` skriver den publicerade produktens adress.
Endast `--offline --no-open` startar ett isolerat serverpar utan externa
OpenClaw-/talanrop; se [startalternativen](../../apps/studio/docs/README.md).
