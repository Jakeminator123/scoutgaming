# OpenClaws egen dashboard

Detta är OpenClaws **Control UI** för agentchatt, tools, sessions och inställningar,
inte labbets katalogeditor och inte IDE-agenternas GitLab-inbox.

Dashboarden driftsattes och inloggningsvyn verifierades **2026-09-20**:
[Öppna OpenClaw](https://croupier-lab-director.onrender.com/openclaw/).
Båda Render-tjänsterna kör dashboard-koden från `7ec4e17`. UI:t når Gatewayen
och ber om lösenord. Inloggad chatt/modellanrop och första browser-pairing
återstår att prova med operatören; inget lösenord har lästs ur `secret.txt`.

## Render: en adress, OpenClaws egen inloggning

1. Publicera och driftsätt dashboard-ändringen på **båda** labbtjänsterna.
   Behåll Gateway som Private Service; skapa ingen ny tjänst.
2. Kopiera Director-tjänstens publika HTTPS-adress. På den privata
   `croupier-lab-openclaw`, lägg i Environment till
   `OPENCLAW_DASHBOARD_ORIGIN=https://<din-director-adress>.onrender.com`.
   Ange bara ursprunget: inget `/openclaw`, snedstreck på slutet eller jokertecken.
3. Blueprinten sätter `OPENCLAW_DASHBOARD_ENABLED=true` på Director. Den använder
   då Renders egen `RENDER_EXTERNAL_URL`. Vid egen domän sätter du samma explicita
   `OPENCLAW_DASHBOARD_ORIGIN` på **båda** tjänsterna. Spara och driftsätt ändringarna.
4. Öppna `https://<din-director-adress>.onrender.com/openclaw/`.
   I **Gateway secret** anger du värdet i `OPENCLAWAPI_KEY` — inte OpenAI-nyckeln.
   Inget extra konto, separat inloggningssystem eller MFA har lagts framför UI:t.

Gatewayens eget lösenordsskydd gäller ända fram till OpenClaw. Director skickar
**inte** in sin sparade Gateway-hemlighet åt en webbläsare. Modellnyckeln
`OPENCLAW_MODEL_API_KEY` stannar hos Gateway och ska aldrig klistras in i UI:t.
Använd en lång, unik Gateway-hemlighet; den ger administratörsåtkomst.

En ny webbläsare behöver normalt ett **engångsgodkännande**. När UI:t visar
pairing required, öppna Render → privata OpenClaw-tjänsten → Shell:

```sh
OPENCLAW_GATEWAY_PASSWORD="$OPENCLAWAPI_KEY" node /app/openclaw.mjs devices list
OPENCLAW_GATEWAY_PASSWORD="$OPENCLAWAPI_KEY" node /app/openclaw.mjs devices approve <requestId>
```

Kontrollera att begäran gäller din egen webbläsare innan du godkänner just dess
ID. Koppla sedan upp UI:t igen. Ny profil eller rensad webbläsardata kan kräva
ett nytt godkännande. Detta är OpenClaws inbyggda skydd, inte en extra loginprodukt.

## Vad går att ändra?

Inställningar sparas på Gatewayens disk och skrivs inte över vid varje start.
`croupier-operator` är den separata agenten för arbete i admin-dashboarden.
Tools börjar avstängda även där; du kan uttryckligen konfigurera dem i UI:t.
`croupier-director` och `croupier-chat` är labbets två begränsade runtime-agenter:
låt deras nekade tools vara kvar. Spelartext ska aldrig skickas till adminagenten.

Nätväg, inloggningsläge och tillåtet ursprung styrs fortfarande av deploymenten.
Ändra dessa via Render/repo, inte UI:t.
Denna policy återställs vid omstart; den är inte ett löpande skrivlås i OpenClaw.
Director fortsätter kontrollera sitt tillåtna ursprung även om en admin ändrar UI-config.
Vid första uppgraderingen säkerhetskopieras
och migreras bara den exakt igenkända gamla labbkonfigurationen. En egen ändrad
konfiguration behålls; se tekniska guiden för gränser och validering.

UI:t är en riktig adminyta, inte en sandlåda för spelare. Aktivera bara verktyg
och anslutningar du avser ge agenten. Ingen koppling till RNG, spelregler,
spelar-databas eller IDE-inbox skapas av dashboarden.

Grundfunktionerna chatt, sessions, tools och config använder native WebSocket.
Avancerade tillägg kan behöva egna adresser: MCP OAuth-callback, Board och egna
pluginrutter utanför `/openclaw` exponeras inte automatiskt av den här ingången.
Att lägga till ett sådant tillägg kräver en separat integrationskontroll.

Källor: [Control UI i vår låsta version](https://github.com/openclaw/openclaw/blob/v2026.9.5/docs/web/control-ui.md),
[anslutning och pairing](https://github.com/openclaw/openclaw/blob/v2026.9.5/docs/web/control-ui/connect-and-pair.md).
