# Drift: Director och OpenClaw Gateway

Director och den privata Gatewayn kör på Render från
`Jakeminator123/scoutgaming`, branch `main`, med autodeploy av. De är redan
skapade; återskapa dem inte för en env-ändring. Blueprinten
[render.yaml](../../../services/openclaw/lab/render.yaml) beskriver
kontraktet, tjänsternas Environment-vyer de faktiska värdena. Alla nyckelnamn
och var de sätts står i [variabelregistret](../../ENVIRONMENT-VARIABLES.md);
identiteter i [START-HERE](../../../START-HERE.md#identiteter).

## Tjänster och nycklar

- `croupier-lab-director` (publik HTTPS): eget `LAB_API_TOKEN`, separat
  `OPENCLAW_PRODUCT_SPEECH_TOKEN`, privat upstream
  `croupier-lab-openclaw:18789` och disk `/data/catalog`.
- `croupier-lab-openclaw` (privat tjänst): `OPENCLAW_API_KEY` för
  Gateway-autentisering, `OPENCLAW_MODEL_API_KEY` mot modellleverantören och
  beständig state på `/data/openclaw`.
- `croupier-v3` (spelmotorn): har `OPENCLAW_PRODUCT_SPEECH_URL`, speech-token
  och `OPENCLAW_SPEECH_AGENT`, aldrig Gatewayns nyckel. Den validerar session,
  kort, saldo och modellens svar.
- Vercel behöver ingen av OpenClaw-hemligheterna.

Kedjan: spelmotorn skickar en avgränsad projektion via Director till
Gatewayn. Svaret är `recordedLine`, `generatedText` eller `silence` och ekar
request, dealer, session och runda; se [produkttal](PRODUCT-SPEECH-DEPLOYMENT-SV.md).
Gateway-starten mappar `OPENCLAW_API_KEY` till OpenClaws interna
`OPENCLAW_GATEWAY_PASSWORD`. Dashboarden går via Directors `/openclaw/`; den
publika proxyn exponerar aldrig Gatewayns `/v1`. Se [dashboarden](DASHBOARD-SV.md).

Beständig `openclaw.json` kan ha operatörsändrade modeller och roller.
Miljöns standardvärden initierar ny state men skriver inte över handredigerad
konfiguration, så ändrad `OPENCLAW_MODEL_ID` bevisar inget modellbyte. Läs den
effektiva konfigurationen före ett byte. Nycklar och diskdata följer inte med
en Git-push eller en Vercel-deploy.

## Ändra och deploya

1. Öppna rätt tjänst i Render → **Environment** och jämför bara dess
   nyckelnamn mot variabelregistret. Importera aldrig en hel lokal `.env`.
2. Spara ändringen och deploya tjänsten; en omstart räcker inte för sparade
   men odriftsatta env-ändringar. Render MCP:s env-skrivning slår ihop nycklar
   och startar en deploy själv.
3. Vid kod- eller rolländring: deploya Gatewayn först och kontrollera
   konfigurationen (`node /app/openclaw.mjs config validate --json`), sedan
   Director när ändringen kräver det. Kodändringar i `packages/director` eller
   `services/openclaw/lab` når drift först då.
4. Kontrollera Directors hälsa och autentiserade status utan modellkostnad:
   produkt-token nekas på Lab-status, och ett tomt produktanrop med rätt
   produkt-token ger HTTP 400 före modellkörning. Ett riktigt talprov kräver
   syntetisk profil, kostnadsram och uppspelningskvitto.

Gatewayn kör som uid 1000 under `tini`. OpenClaw håller sin owner-lease upp
till fem minuter efter senaste förnyelse; radera eller kringgå aldrig leasen.
Om en deploy fastnar på leasen: utred loggarna innan nästa deploy och rör inte
state eller lås. Övergången från den äldre root-imagen gjordes 18 oktober 2026
och beskrivs i [historiken](../../history/AI/RENDER-START-2026-10.md).
