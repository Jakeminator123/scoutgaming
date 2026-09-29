# Aktuell drift: Director och OpenClaw Gateway

Driftunderlaget gäller `Jakeminator123/github-work` på
`jakemanator123-github-work`. Tjänsterna finns redan på Render och ska
förvaltas där. De äldre anvisningarna för ett separat labbrepo är borttagna.

Den fullständiga variabellistan och rätt placering finns i
[rotens miljökarta](../../../_ENVIROMENT-INFO.md). Faktisk kontroll av
nyckelmatchning finns i [driftkvittot](CLOUD-ACTIVATION-2026-09-29.md).

## Tjänster och behörighet

- `croupier-lab-director`: publik HTTPS, eget `LAB_API_TOKEN`, separat
  `OPENCLAW_PRODUCT_SPEECH_TOKEN`, privat upstream
  `croupier-lab-openclaw:18789` och disk `/data/catalog`.
- `croupier-lab-openclaw`: privat Gateway med `OPENCLAWAPI_KEY`, annan
  `OPENCLAW_MODEL_API_KEY` och beständig state på `/data/openclaw`.
- `croupier-v2`: produktservern har speech-URL/token och separata
  Director-/Lab-rådpar. Den validerar session, kort, saldo och modellbeslut.
- Vercels Next-startsidor har `CROUPIER_GAME_URL`. Ingen av ovanstående
  OpenClaw-hemligheter behövs där.

Gateway-starten mappar `OPENCLAWAPI_KEY` till OpenClaws interna
`OPENCLAW_GATEWAY_PASSWORD`. Dashboard går via Directors `/openclaw/` och
kräver Gateways inloggning och vid behov enhetsgodkännande. Publik proxy
exponerar inte Gateways `/v1`-API. Se [dashboardguiden](DASHBOARD-SV.md).

Beständig `openclaw.json` kan ha operatörsändrade modeller och roller.
Miljöstandarderna initierar ny state men ersätter inte automatiskt
handredigerad konfiguration. Kontrollera effektiv konfiguration före modellbyte.

Kodändringar levereras med `node tools/push-github-work.mjs`; Render-deploy
är en separat åtgärd. Följ [driftordningen](RENDER-START-SV.md) och kontrollera
[produktens speech-kontrakt](PRODUCT-SPEECH-DEPLOYMENT-SV.md) vid rolländringar.
