# Environment-info — labbet och OpenClaw

Variabelnamn och placeringar, **inga hemliga värden**. Detta är ett register,
inte en konfigurationsfil som programmet läser. Avser labbet/OpenClaw, inte
produktens databasnycklar eller IDE-agenternas separata GitLab-inbox.

## Samma anslutningsnyckel, två namn

**`LAB_REMOTE_TOKEN` i din lokala `.env` ska ha exakt samma värde som
`LAB_API_TOKEN` på Render-tjänsten `croupier-lab-director`.**

Det tidigare uttrycket `ERSATT_MED_VARDET...` var bara en instruktion att kopiera
det befintliga värdet, inte en ny nyckel. Skriv inte instruktionstexten som värde.
Behåll dina befintliga nycklar. Startfilen skapar, ändrar eller roterar inga.
Inga nya inloggningssteg införs.
Arbetsregel: inför ingen automatisk rotation och byt inga befintliga
nyckelvärden utan Jakobs uttryckliga beställning.

Blueprintens `generateValue` skapar bara ett värde om variabeln inte redan finns;
det är ingen återkommande rotation. Radera/återskapa inte variabeln eller tjänsten
för att starta om labbet. [Renders beskrivning](https://render.com/docs/blueprint-spec#generating-random-secrets).

## Hemligheterna — vem använder vad?

| Variabelnamn | Var det ska finnas | Samband / uppgift |
| --- | --- | --- |
| `LAB_API_TOKEN` | Render → `croupier-lab-director` → Environment | Befintlig nyckel för labbets API. |
| `LAB_REMOTE_TOKEN` | Lokalt → repots `.env` | Kopia av exakt samma `LAB_API_TOKEN` ovan. |
| `OPENCLAWAPI_KEY` | Render → `croupier-lab-openclaw` → Environment | Befintligt Gateway-/dashboard-lösenord. Director får samma värde via Blueprint-referens. |
| `OPENCLAW_GATEWAY_PASSWORD` | Gateway-processen, sätts automatiskt av startkoden | Samma `OPENCLAWAPI_KEY`, under OpenClaws interna variabelnamn. Fyll inte i ännu ett separat lösenord. |
| `OPENCLAW_MODEL_API_KEY` | Render → `croupier-lab-openclaw` → Environment | Din befintliga modellleverantörsnyckel; inte dashboard-lösenordet eller labbnyckeln. |
| `OPENAI_API_KEY` | Kan redan finnas lokalt för andra verktyg | Labbet kopierar/använder inte denna automatiskt. När OpenAI är leverantör ligger den valda OpenAI-nyckeln hos Gatewayen under namnet `OPENCLAW_MODEL_API_KEY`. |
| `ELEVENLABS_API_KEY` | Lokalt → repots `.env` | ElevenLabs-nyckel för det fristående röstprovet `tools/elevenlabs-lab-preview.mjs`. Inte ännu inkopplad i studions scen/chatt. |
| `ELEVENLABS_OC_API` | Valfritt alias i samma lokala `.env` | Provverktyget accepterar samma värde som ovan. Båda behövs inte; om båda finns måste de överensstämma. Namnet konfigurerar inte OpenClaw automatiskt. |

"Samma" gäller kopiorna i respektive koppling ovan. Modellleverantörens nyckel
och ditt valda Gateway-lösenord har andra roller; de slås inte ihop här.
Inga hemliga värden ska finnas i denna fil, Git eller `NEXT_PUBLIC_*`.

## Lokalt: det du behöver för Render-kopplingen

Använd befintliga `Croupier/.env` i repots rot. Lägg inte in dubbla rader.

| Variabelnamn | Innehåll / varifrån |
| --- | --- |
| `LAB_REMOTE_URL` | Directors publika HTTPS-adress, utan `/openclaw/` på slutet. |
| `LAB_REMOTE_TOKEN` | Det befintliga `LAB_API_TOKEN` från Director, oförändrat. |

Det räcker för själva anslutningen. Gateway-/modellnycklar behövs inte lokalt
när OpenClaw körs på Render. Ingen Render-konto-API-nyckel behövs.
Rotens `.env` skickas inte till Render; värden på Render ligger i respektive
tjänsts Environment. Labbet fungerar i regelläge även utan modellanslutning.

Valfria lokala inställningar i `lab/.env.local`:

| Variabelnamn | Uppgift |
| --- | --- |
| `LAB_VIDEO_ARCHIVE` | Annan plats för originalvideorna, om standardarkivet inte används. |
| `LAB_STUDIO_DATA_DIR` | Annan datamapp för sparade projekt, exempelvis isolerade tester. |

Anslutningsvariabler kan också läsas från `lab/.env.local`, men håll dem helst
på ett ställe. Den filen går före rotens `.env`; redan satta processvariabler
går före båda. Starta om den lokala servern efter miljöändringar. Startfilen
återanvänder en redan körande server; den tvingar inte fram en omstart.

## Render-inställningar — normalt redan satta av Blueprinten

| Variabelnamn | Tjänst / uppgift |
| --- | --- |
| `HOST`, `PORT` | Director: lyssningsadress/port. Lokal startfil väljer sin egen localhost-port. |
| `LAB_DATA_DIR` | Director: katalogens beständiga lagring; inte lokala studions `LAB_STUDIO_DATA_DIR`. |
| `OPENCLAW_HOSTPORT` | Director: Gatewayens privata adress, från Render-referens. |
| `OPENCLAW_BASE_URL` | Director: skapas från privat adress av startkoden om inte uttryckligen satt. |
| `OPENCLAW_AGENT` | Director: agenten som föreslår presentationsvarianter. |
| `OPENCLAW_CHAT_AGENT` | Director: separat agent för labbchatten. |
| `OPENCLAW_TIMEOUT_MS` | Director: väntetid för modellråd. Kan också anges lokalt för anslutningen. |
| `OPENCLAW_DASHBOARD_ENABLED` | Director: om den befintliga dashboard-ingången används. |
| `RENDER_EXTERNAL_URL` | Director: publik adress, tillhandahålls av Render. |
| `OPENCLAW_DASHBOARD_ORIGIN` | Gateway: Directors exakta HTTPS-ursprung. Kan även anges uttryckligen på Director. |
| `OPENCLAW_MODEL_BASE_URL`, `OPENCLAW_MODEL_ID`, `OPENCLAW_MODEL_API` | Gateway: modellleverantör, modellnamn och API-format. |
| `OPENCLAW_GATEWAY_PORT` | Gateway: intern lyssningsport. |
| `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH` | Gateway: beständig lagring och konfigurationsfil. |

Gatewayens modellinställningar skapas första gången och sparas sedan beständigt.
Ett senare modellbyte görs i dess dashboard/konfiguration; nya miljöstandarder
skriver inte automatiskt över en redan redigerad konfiguration.

Endast vid en annan, lokal Gateway-/Docker-installation: `OPENCLAW_BASE_URL`
och `OPENCLAWAPI_KEY` lokalt, samt Compose-variablerna i
[`open-claw/lab/.env.example`](open-claw/lab/.env.example).
`OPENCLAW_DASHBOARD_ALLOW_LOOPBACK` hör till sådan lokal dashboard-testning,
inte normal Render-anslutning. `OPENCLAW_GATEWAY_TOKEN` och
`OPENCLAW_CONFIG_READONLY` är gamla vägar som vår Gateway-startkod tar bort;
lägg inte till dem för detta upplägg.

## Starta utan terminalkommandon

Dubbelklicka **[Start-Labb.cmd](Start-Labb.cmd)** i repots rot.
Den använder [Start-Labb.ps1](Start-Labb.ps1), startar eller återanvänder lokala
studion och öppnar standardwebbläsaren. Behåll serverfönstret öppet; Ctrl+C
stoppar servern som körs i det. En redan körande server stoppas inte av startfilen.
Node.js behövs; saknade labbberoenden installeras från låsfilen vid första start.
Ingen systemomfattande PowerShell-inställning ändras.

Startfilen startar inte en ny OpenClaw, pushar inte kod och driftsätter inte
Render. För nya studions modellråd/chatt måste Directors studio-endpoints
finnas i den driftsatta versionen. Verkliga råd/chatt verifierades 2026-09-20
efter Director-deploy av `7f056f7`; första rådet nådde tidsgränsen och föll
tillbaka på standard. Detta är inte en kontinuerlig hälsokontroll.

## Fristående röstprov — ingen Render-ändring behövs

`node tools/elevenlabs-lab-preview.mjs --check` kontrollerar att den valda
standardrösten finns. `--generate` skapar dessutom **ett kort, debiterbart**
svenskt röstprov. Ingen automatisk generering eller återförsök sker.
MP3 och metadata hamnar i Git-ignorerade `lab/data/voice-previews/`.
Verktyget läser rotens `.env` direkt; det ändrar inte dina värden.
Det skickar bara provtexten till ElevenLabs, inte projektet eller spelarchatt.
Ingen röstnyckel har lagts på Render. Först vid en framtida serverbaserad
röstintegration behöver vi välja vilken server som ska göra talanropen.
