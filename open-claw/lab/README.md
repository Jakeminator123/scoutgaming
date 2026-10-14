# Croupiers Director och privata OpenClaw Gateway

Denna mapp är aktiv server- och driftkod i `Jakeminator123/scoutgaming`.
Sökvägen används av Render och Docker och behålls. Studio för mediearbete
ligger i repots separata [lab/](../../lab/docs/README.md).

All mänsklig AI-/OpenClaw-dokumentation börjar i
[docs/AI/README.md](../../docs/AI/README.md).
[OpenClaw-indexet](../../docs/AI/openclaw/README.md) leder till drift,
dashboard, lokal anslutning, socialt prov och officiella källor.

`render.yaml` beskriver två tjänster: publik Director och privat Gateway.
Det är inte en förteckning över hela Render-arbetsytan. Aktuell daterad
tjänste- och instanskontroll finns i AI-indexet.

Produktservern använder en separat speech-token till Director, som i sin tur
använder Gateway-autentisering. I denna kedja ligger modellnyckeln hos Gateway.
Webbchattens direkta serveradapter är ett separat flöde; se
[AI-översikten](../../docs/AI/scoutgaming-agentflode.md). Hemligheter skickas
inte till webbläsaren.

`src/`, `config/`, `schemas/`, `deploy/` och testerna är implementationskällor.
`deploy/runtime-bundle/` är versionsstyrd promptkontext, inte en kopia av
användardokumentationen. De få filerna i `docs/` är kompatibla hänvisningar
till den samlade dokumentationen.
