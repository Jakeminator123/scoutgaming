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
