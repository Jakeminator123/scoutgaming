# OpenClaws egen dashboard

OpenClaws **Control UI** för agentchatt, verktyg, sessioner och inställningar.
Den är en riktig adminyta, inte Scoutgamings Admin och inte en sandlåda för
spelare. Adress: Directors publika URL plus `/openclaw/`
(<https://croupier-lab-director.onrender.com/openclaw/>). Den privata
`croupier-lab-openclaw` har ingen egen publik dashboardadress.

## Logga in

På `/admin/ai/models` finns **Öppna OpenClaws egen dashboard**. Knappen kräver
aktuell N1-inloggning och skapar en engångslänk med OpenClaws officiella
owner-bootstrap: giltig högst tio minuter, kan bara lösas in av en
webbläsaridentitet. Dela den inte. Tekniskt används Gatewayns privata helper
på port 18790 med den fasta operationen `dashboard --json`; CLI:ns lösenords-
och tokenfält returneras aldrig till sajten.

OpenClaw skapar sedan en egen beständig webbläsarsession. Utloggning från
Scoutgaming avslutar den inte; återkalla en förlorad webbläsaridentitet under
OpenClaws **Devices**.

Reservväg: ange Gateway-hemligheten (`OPENCLAW_API_KEY`, inte modellnyckeln)
i **Gateway secret**. En ny webbläsare behöver ett engångsgodkännande. Visar
UI:t *pairing required*, öppna Render → `croupier-lab-openclaw` → Shell,
kontrollera att begäran är din egen och godkänn just dess ID:

```sh
OPENCLAW_GATEWAY_PASSWORD="$OPENCLAW_API_KEY" node /app/openclaw.mjs devices list
OPENCLAW_GATEWAY_PASSWORD="$OPENCLAW_API_KEY" node /app/openclaw.mjs devices approve <requestId>
```

Director skickar aldrig in sin sparade Gateway-hemlighet åt en webbläsare,
och `OPENCLAW_MODEL_API_KEY` stannar i Gatewayn.

## Deploymentens inställningar

- Director har `OPENCLAW_DASHBOARD_ENABLED=true` och använder Renders
  `RENDER_EXTERNAL_URL`.
- Gatewayn har `OPENCLAW_DASHBOARD_ORIGIN=https://<director-adress>` (bara
  ursprunget: inget `/openclaw`, avslutande snedstreck eller jokertecken). Vid
  egen domän sätts samma värde på båda tjänsterna.
- Nätväg, inloggningsläge och tillåtet ursprung styrs av deploymenten och
  återställs vid omstart; ändra dem i Render och repot, inte i UI:t. Director
  kontrollerar sitt tillåtna ursprung oavsett UI-konfiguration.

## Vad som går att ändra

Inställningar sparas på Gatewayns disk och skrivs inte över vid start.
`croupier-operator` är agenten för dashboardarbete; dess verktyg börjar
avstängda och aktiveras bara uttryckligen. Låt de nekade verktygen hos
`croupier-director`, `croupier-chat`, `croupier-social` och `croupier-speech`
vara kvar, och skicka aldrig spelartext till operatörsagenten. Dashboarden
skapar ingen koppling till slump, spelregler, spelardatabas eller teaminbox.

Chatt, sessioner, verktyg och konfiguration använder native WebSocket.
Tillägg med egna adresser (MCP OAuth-callback, Board, pluginrutter utanför
`/openclaw`) exponeras inte och kräver en separat integrationskontroll.

Källor: Control UI och anslutning/pairing i den taggade versionen, till
exempel [v2026.9.5](https://github.com/openclaw/openclaw/blob/v2026.9.5/docs/web/control-ui.md)
och [connect-and-pair](https://github.com/openclaw/openclaw/blob/v2026.9.5/docs/web/control-ui/connect-and-pair.md).
