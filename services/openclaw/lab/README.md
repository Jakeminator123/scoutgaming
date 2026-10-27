# Director och privat OpenClaw Gateway

Aktiv server- och driftkod. `services/openclaw/lab` är källroten för Render och
Docker: Director kör som `croupier-lab-director` (publik) och Gatewayn som
`croupier-lab-openclaw` (privat tjänst). `render.yaml` beskriver bara dessa
två tjänster, inte hela Render-arbetsytan.

Dokumentationen börjar i [docs/AI](../../../docs/AI/README.md);
[OpenClaw-indexet](../../../docs/AI/openclaw/README.md) leder till drift,
dashboard, produkttal och officiella källor.

Spelmotorn når Director med en separat speech-token, och Director når Gatewayn
med Gateway-autentiseringen; modellnyckeln finns bara i Gatewayn. Admins
webbchatt har en egen serveradapter på Vercel. Inga hemligheter skickas till
webbläsaren.

`src/`, `config/`, `schemas/`, `deploy/` och testerna är implementationskällor.
`deploy/runtime-bundle/` är versionsstyrd promptkontext för Gateway-rollerna,
inte en kopia av användardokumentationen.
