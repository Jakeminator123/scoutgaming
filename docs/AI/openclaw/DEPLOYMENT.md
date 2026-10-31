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
state eller lås.

## Modeller och resonemang

Rollens modell och resonemang i den beständiga `openclaw.json` är driftens
källa. `OPENCLAW_MODEL_ID` är bara ett startvärde för en ny fil; dess värde
bevisar inte vilka modeller befintliga roller använder. Admin läser och
byter rollmodeller med revisionskontroll.

| Roll | Avsedd modell | Native resonemang |
| --- | --- | --- |
| `croupier-operator` | `gpt-6.1-sol` | `thinkingDefault: high` |
| `croupier-chat` | `gpt-6.1-sol` | `thinkingDefault: medium` |
| `croupier-director`, `croupier-social` | `gpt-6-luna` | `thinkingDefault: low` |
| `croupier-speech` | Luna, högst en Sol 6.1-fördjupning | `models[ref].params.thinking`: `low` respektive `high` |

Gateway 2026.9.5 tar inte emot `reasoning_effort` i sitt kompatibla HTTP-API.
De native inställningarna ovan fungerar utan ett versionsbyte. OpenAI-
leverantören måste använda `openai-responses` för Sol 6.1 med verktyg;
modellkatalogen deklarerar resonemang och stödda nivåer. `reasoningDefault`
styr synlighet och ska inte förväxlas med `thinkingDefault`.

Startkoden fyller bara saknade native inställningar och sparar en privat
`pre-model-migration`-backup före ändring. Befintliga modellval, egna nivåer,
andra leverantörer, verktyg och agenttillstånd bevaras. Ett nytt önskat
modellval görs separat i Admin. Speech får välja en annan modell än chatten;
dess hårda verktygsförbud och isolerade state gäller fortfarande.

Sol 6.1 får bildstöd med den befintliga `CROUPIER_SPEECH_VISION`-grinden.
Det aktiverar ingen kamera. Slack-bilder kräver dessutom Slacks medieåtkomst.
OpenAI stöder inte `adaptive` som Sol 6.1-effort; högre nivå väljs uttryckligt
eller via Directors begränsade eskalering.

För JSON mode skickar Director en fast applikationsägd JSON-instruktion även
bland indata. Gateway 2026.9.5 flyttar annars systemtexten till Responses
`instructions`, som inte uppfyller API:ts kontroll av ordet JSON i indata.
Detta reproducerades mot den pinnade Gatewayen: instruktion enbart i system-
meddelandet gav HTTP 400; instruktion i indata gav HTTP 200. `fixed` kan
användas som återställningsläge under en sådan transporträttning.

Källor: [OpenClaw 2026.9.5 thinking](https://github.com/openclaw/openclaw/blob/v2026.9.5/docs/tools/thinking.md),
[HTTP-schema](https://github.com/openclaw/openclaw/blob/v2026.9.5/src/gateway/openai-http.ts),
[OpenAI Sol 6.1](https://developers.openai.com/api/docs/models/gpt-6.1-sol),
[Luna](https://developers.openai.com/api/docs/models/gpt-6-luna).
