# 20 september 2026 — OpenClaw och labbet

## Vad vi har gjort

- Jämfört ZIP-underlagen: V2:s fem filer var identiska med motsvarande V1-filer.
  V1 gav dessutom användbara scheman, kontrollkod och tester. Äldre föreslagna
  eventnamn blev inte nya krav på spelmotorn.
- Byggt ett separat labb i [open-claw/lab](../../open-claw/lab/README.md):
  editor, scenarier, stegvis uppspelning och enkla animationer. Sex riktiga
  presentationstyper (`speak`, `deal`, `reveal`, `settle`, `turn`, `idle`) ligger
  bakom 16 begripliga noder, med två varianter per nod och 32 enkla animationer.
- JSON-katalogen binder noder, standardlinjer, varianter, triggers och assets.
  OpenClaw får föreslå en redan tillåten variant; kod validerar rådet och väljer
  standardlinjen vid fel eller timeout. Lägen: av, shadow och active.
- Driftsatt Docker/Render-blueprinten från GitLab-branchen `jakeminator123/work`.
  `croupier-lab-director` är publik labbserver/ingång; `croupier-lab-openclaw`
  är den privata Gatewayen. De är två delar av samma installation.
- Öppnat OpenClaws egen dashboard genom Director. Inställningar och katalog
  har beständiga diskar. Webbläsaren godkändes och den inloggade dashboarden
  verifierades; inget riktigt modell-/chattsvar har ännu verifierats där.

## Så använder jag det

- [OpenClaw-dashboard](https://croupier-lab-director.onrender.com/openclaw/):
  agenter, chatt, tools och inställningar. Bokmärk länken. Från Render: välj
  **croupier-lab-director**, öppna webbadressen och lägg till `/openclaw/`.
- [Labbets editor](https://croupier-lab-director.onrender.com/): events, triggers
  och testanimationer. Lokalt: `npm --prefix open-claw/lab start`, sedan
  `http://localhost:4188`. Den lokala servern kan anropa Render via utgående HTTPS.
- Dashboardens lösenord är `OPENCLAWAPI_KEY`. `OPENCLAW_MODEL_API_KEY` är
  OpenAI-/modellnyckeln och stannar på Gatewayen. `LAB_API_TOKEN` skyddar labb-API:t;
  lokal anslutning använder `LAB_REMOTE_URL` och `LAB_REMOTE_TOKEN`.
  Spara aldrig nyckelvärden i dokumentation eller Git.
- Nya webbläsare kan behöva ett engångsgodkännande. Det är redan gjort för
  webbläsaren vi använde. [Inloggningsguide](../../open-claw/lab/docs/DASHBOARD-SV.md).

## Viktiga gränser och kvar att göra

- RNG, kort, regler, saldo och utbetalningar är orörda. Labbet är inte anslutet
  till den riktiga spelklienten. Produktintegration stäms av med Kevin.
- IDE-agenternas GitLab-inbox är helt separat. Riktig spelarchatt, moderering
  och beständigt spelarminne återstår; labbets chattsignaler är simulerade.
  Adminagenten `croupier-operator` ska inte ta emot spelartext.
- Videoagentens [separata rapport](2026-09-20-v3-videoregister-och-placering.md)
  är underlaget för nästa steg. Godkända videos ska senare ersätta labbanimationer;
  `want` i videoregistret betyder inte automatiskt godkänd take. Inga videor flyttades.
- Lokala tester kontrollerar kontrakt, beslut, sparning och dashboard-proxy;
  de bevisar inte modellnyckel, videokvalitet eller färdig spelintegration.
  Alla 54 tester och katalogkontrollen passerade efter städningen. Lokal
  Gateway/Render-anslutning är ännu inte konfigurerad i den kontrollerade miljön.
  Nästa kontroll är ett riktigt modellsvar och därefter den avgränsade videoadaptern.
- Gateway-lösenordet som råkade delas i chatten bör bytas; det har inte roterats.

## Dokumentation och städning

Officiella OpenClaw-källor och konfiguration hittas via
[tekniskt index](../../open-claw/lab/docs/README.md). `llms.txt` är bara en
länklista som läses vid behov; ingen automatisk dokumentcrawl eller separat
dokumentations-MCP är installerad.

Aktivt arbete ligger kvar i `open-claw/lab/`. Äldre underlag finns enbart i
`open-claw/archive/croupier-proposal-v2/`; en verifierad lokal dubblett raderades.
Arkivets innehåll är bevarat. Den här sidan är Jakobs korta minnesanteckning,
inte en ny parallell teknisk dokumentationsyta.
