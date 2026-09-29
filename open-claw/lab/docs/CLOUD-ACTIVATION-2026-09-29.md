# Spel → Render → OpenClaw: aktiveringshandoff 2026-09-29

## Faktisk kedja

1. Browsern skickar `POST /chat` till den serverägda spelprocessen i
   `web/server.mjs`. Servern hämtar spelarens session, aktuellt bord och
   spelägd historik. `web/openclaw-chat.mjs` bygger endast den publika,
   begränsade projektionen och validerar senare svaret mot samma revisioner.
2. I molnläget ger `ops/cloud/config.mjs` Web-barnet
   `OPENCLAW_PRODUCT_SPEECH_URL` och `OPENCLAW_PRODUCT_SPEECH_TOKEN`.
   `open-claw/lab/src/product-speech.mjs` kräver en ren HTTPS-origin och skickar
   projektionen till Directors `POST /api/product/speech` med separat bearer.
   Gateway-nyckeln behövs inte i spelprocessen.
3. Director i `open-claw/lab/src/server.mjs` accepterar produkt-token enbart på
   produktens speech- och Probe-endpoints. Den kräver en annan token än
   `LAB_API_TOKEN`, kontrollerar kontrakt, storlek och samtidighet och skickar
   beslutet till privat Gateway `/v1/chat/completions` med `OPENCLAWAPI_KEY`
   och agenten `openclaw/croupier-speech`. Gateway-konfigurationen i
   `deploy/gateway-config.mjs` ger rollen egen state och nekar alla verktyg.
4. Director returnerar exakt `recordedLine`, `generatedText` eller `silence`.
   Spelservern kontrollerar request-id, dealer-id, session-/rundrevision och
   tillåtna linjer. `web/generated-speech-chat.mjs` startar valfri generering
   först efter ny kontroll av sessionen. Genererat ljud/video kräver de
   separata Cartesia-/RunPod-flaggorna och privat lagring. Utan dem levereras
   textbeslutet utan genererat talpaket. Produktens befintliga spelare äger
   idlegrind, talkö och uppspelning; OpenClaw väljer ingen timing eller mediafil.

Presentationsråd är en annan gren: Webs
`CROUPIER_PRESENTATION_DIRECTOR_URL/TOKEN` skickar till Directors
`/api/studio/advice` med `LAB_API_TOKEN`, och Gateway använder
`croupier-director`. Next-labbets `LAB_REMOTE_URL/TOKEN` använder samma
operatörsgräns för råd/chatt. Varken Vercels nuvarande statiska ingång eller
den lokala Next-processen ligger på produktens speech-väg.

## Konfigurationsjämförelse

| Källa | Vad den kräver eller anger |
| --- | --- |
| Molnstart `ops/cloud/config.mjs` | Speech-URL och token måste vara ett komplett par; produktens par krävs för molnstart. Director-råd och Lab-relä är valfria separata par. |
| Director-kod `src/settings.mjs`, `src/server.mjs` | Produkt-token behövs för att annonsera `product-speech-v1` och måste skilja sig från `LAB_API_TOKEN`. Speech-agenten måste vara `openclaw/croupier-speech`. |
| Blueprint `render.yaml` | Nu deklareras separat privat speech-token och explicit speech-agent på Director. Gateway förblir privat, med egen `OPENCLAWAPI_KEY` och leverantörsnyckel. Varken spelprocessen eller Next-labbet får Gateway-nyckeln via Blueprint. |
| Variabelregister | `docs/environment-variables.json` och `ENVIRONMENT-VARIABLES.md` skiljer produktens URL/token från Directors token, labbtoken och Gateway-nyckel. |
| Läsande Render-vy 2026-09-29 | Både Director och Gateway var Live men fortfarande kopplade till GitLab `jakeminator123/work`, commit `8e10017d`. GitHub-branchens Blueprint och kod är därmed inte tjänsternas nuvarande källa. Inga hemlighetsvärden lästes. |
| Daterade driftkvitton | `DEPLOYMENT-RECEIPT-2026-09-28.md` visar att Director/Gateway och `product-probe-v1` fungerade då. `docs/ENVIRONMENT-VARIABLES.md` anger att `croupier-v2` senare var Live. Inget av kvittona verifierar nuvarande hemlighetsvärden eller full spel→tal-kedja. |

Luckan var att Blueprint saknade `OPENCLAW_PRODUCT_SPEECH_TOKEN` fast Director
kräver den för produktendpointen. En ny Blueprint-installation kunde därför
starta med fungerande `/healthz` men utan speech-kapacitet. Den incheckade
konfigurationen är rättad; ingen Blueprint Sync, env-ändring eller deploy ingår
i denna kodleverans.

## Kort aktiveringschecklista

1. Byt först de befintliga OpenClaw-tjänsternas källa till GitHub-repot
   `Jakeminator123/github-work` och branchen `jakemanator123-github-work`
   genom en separat granskad Render-åtgärd. Bevara tjänster, diskar och
   hemligheter; skapa ingen ny Blueprint. Kontrollera därefter att byggrevisionen
   verkligen kommer från GitHub. Ingen GitLab-push eller spegling ingår.
2. Kontrollera i Render **nyckelnamn och tjänstplacering**, utan att kopiera
   ut värden: Director har en separat `OPENCLAW_PRODUCT_SPEECH_TOKEN` och
   `OPENCLAW_SPEECH_AGENT=openclaw/croupier-speech`; spelet har Directors rena
   HTTPS-origin i `OPENCLAW_PRODUCT_SPEECH_URL` och samma produkt-token.
   `LAB_API_TOKEN` och Gatewayns `OPENCLAWAPI_KEY` hålls åtskilda.
3. Om Blueprinten ska synkas, granska ändringen i Render före Manual Sync.
   Direktorn och privata Gatewayen deployas uttryckligen i den ordning som
   [speech-planen](PRODUCT-SPEECH-DEPLOYMENT-SV.md) beskriver. Repots ändring
   uppdaterar inte befintliga miljövariabler eller beständig Gateway-state.
4. Verifiera först utan modellkostnad: Directors `/healthz`, labbautentiserad
   `/api/status` med `product-speech-v1`, och att speech-token nekas på status
   medan labbtoken nekas på produktendpointen. Ett 200 på health bevisar inte
   fungerande Gateway eller tal.
5. Kör därefter ett enda godkänt, isolerat spelprov med syntetisk spelare och
   explicit kostnadsram: kontrollera giltigt beslut, korrekt revision,
   idlegrind och eventuell ljud-/videouppspelning. Full visuell lip-sync och
   data över omstart kräver egna acceptansprov innan bred aktivering.

Lokalt passerade variabelregistret, 25 Director-/speech-kontraktstest och
sju registertest. Mediemanifestets kontroll verifierade 45 filer i 28 familjer
utan ändring av mediefilerna. Inga hemliga värden, live-env, betalda AI-anrop
eller spelardatabaser ändrades här.
Kvarvarande driftprov är därför inte markerade som godkända av denna leverans.

## Render-källbyte 2026-09-29

Den befintliga GitLab-Blueprinten `croupier-openclaw-lab`
(`exs-danhg6egekts7390c360`) kopplades loss i Render-webbvyn före
källbytet. Render bekräftade att frånkopplingen stoppar framtida synk utan
att ta bort tjänsterna, och Blueprinten försvann från listan. Ingen ny
Blueprint skapades.

| Befintlig tjänst | Källa och revision | Deploy och resultat |
| --- | --- | --- |
| Privat Gateway `srv-danhiv3tqb8s73burkq0` | `Jakeminator123/github-work`, `jakemanator123-github-work`, `15bd15419fc05d88635fedcde3e73f952386c6c5` | `dep-dathq9navr4c73djjkgg`: **Live** efter manuell deploy. Byggloggen visar GitHub-clone och exakt revision. Privat adress `croupier-lab-openclaw:18789`/`:18790` och befintlig disk `/data/openclaw`, 1 GB, kvarstår. |
| Director `srv-danhlpjtqb8s73bv530g` | Samma GitHub-repo, branch och revision | `dep-dathsp2d0e5s73c61dlg`: **Live** efter manuell deploy. Byggloggen visar GitHub-clone och exakt revision. Befintlig origin `https://croupier-lab-director.onrender.com` och disk `/data/catalog`, 1 GB, kvarstår. |

Director saknade livevariabeln `OPENCLAW_SPEECH_AGENT`. Den lades till med
värdet `openclaw/croupier-speech` och sparades före Director-deployen.
Render-spelet `croupier-v2` har `OPENCLAW_PRODUCT_SPEECH_URL` satt till
Directors exakta rena HTTPS-origin. Både spelet och Director har variabeln
`OPENCLAW_PRODUCT_SPEECH_TOKEN`; deras maskerade värden har inte lästs ut
eller jämförts. Jakob behöver själv bekräfta att de är lika och att
Directors produkt-token skiljer sig från `LAB_API_TOKEN`. Ingen hemlighet
ändrades, och inga modell-, GPU- eller spelprov kördes vid källbytet.
En enda läsande GET mot Directors `/healthz` gav HTTP 200 med
`{"ok":true,"service":"croupier-openclaw-lab"}`. Det verifierar processens
hälsa, inte tokenlikhet, Gateway-svar eller faktisk talfunktion.

## Läsande driftprov 2026-09-29 02:47 UTC

Render visade fortsatt Director och privat Gateway som **Live** från GitHub
`15bd1541`; spelet `croupier-v2` var **Live** på `fcc2a08c`. Spelets miljö har
`OPENCLAW_PRODUCT_SPEECH_URL` och
`OPENCLAW_PRODUCT_SPEECH_TOKEN`; Director har produkt-token, separat
`LAB_API_TOKEN`, `OPENCLAW_SPEECH_AGENT` och privat Gateway-nyckel. Inga
maskerade värden öppnades eller kopierades.

Från Directors container gav intern `GET /api/status` med dess befintliga
labbtoken HTTP 200, `provider: configured` och kapaciteterna
`product-speech-v1` och `product-probe-v1`. Labbtoken till produktens
`POST /api/product/speech` gav HTTP 401; produkt-token till
`GET /api/status` gav också HTTP 401. Från **spelets** container gav
`POST {}` med dess befintliga produkt-token till Directors speech-endpoint
HTTP 400 `invalid_product_speech_envelope`. Detta bekräftar att spelets
token accepteras av Director och att kontraktvalideringen stoppar anropet
före modellkörning. Det tidigare öppna frågetecknet om tokenlikhet är
därmed löst utan att hemligheten exponerades.

Director nådde privat Gateway `GET /v1/models` med HTTP 200 och modellen
`openclaw/croupier-speech` fanns i listan. Lokalt passerade 25
Director-/speech-kontraktstest och 47 produktchattkontraktstest för båda
Lissabonlägena. `local-connection.mjs --check` bekräftade
lokal reläkonfiguration men kunde inte nå Render från den begränsade lokala
miljön; de interna proven i Render-containrarna ovan är driftbeviset.

Ingen livevariabel, databas, mediafil eller tjänst ändrades. Ett giltigt
produktbeslut genom Gateway, syntetisk spelrunda, TTS/GPU, uppspelning och
visuell läppsynk är fortfarande oprövade och kräver separat kostnadsram.
