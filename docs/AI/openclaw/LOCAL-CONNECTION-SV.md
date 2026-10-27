# Lokal OpenClaw-anslutning (pensionerad)

Pensionerad 27 oktober 2026. Den lokala anslutningshelpern
`services/openclaw/lab/deploy/local-connection.mjs`, dess sessionsvakt
`local-session.mjs` och det isolerade native-/Next-paret på SQLite-tempdatabaser
är borttagna: produkten har en väg (Vercel + Render + Neon + Blob). Prov körs i
staging eller CI. Äldre instruktioner finns i Git-historiken.

Det som fortfarande gäller:

- Spelarens tal går spelmotorn → Director → privat Gateway; se
  [produkttal](PRODUCT-SPEECH-DEPLOYMENT-SV.md). Ingen publik Gateway-URL behövs.
- `LAB_REMOTE_URL` och `LAB_REMOTE_TOKEN` (samma värde som Directors
  `LAB_API_TOKEN`) är Studios väg till Directors labb-API:er. `OPENCLAW_API_KEY`
  är Gatewayns autentisering och `OPENCLAW_MODEL_API_KEY` Gatewayns nyckel mot
  modellen. Var de sätts: [variabelregistret](../../ENVIRONMENT-VARIABLES.md).
- Versionen ägs av `services/openclaw/lab/deploy/Dockerfile.gateway`; se
  [källindexet](OPENCLAW-DOCS.md#kontrollera-den-driftsatta-versionen).
