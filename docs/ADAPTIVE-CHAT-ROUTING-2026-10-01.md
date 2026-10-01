# Adaptiv Astrid-chatt genom OpenClaw

Arbetskvitto 2026-10-01. Kodcommit `a34875d8` är pushad till den godkända
GitHub-branchen med hela pre-commit godkänd. Aktivering i drift verifieras separat.
[CI för exakt kodcommit](https://github.com/Jakeminator123/github-work/actions/runs/36843542326)
är godkänd i samtliga tre jobb, inklusive hela Lab-sviten på Linux.

## Kodverifiering

Routing/kontrakt: 35/35 PASS, även i oberoende granskning utan blockerande fynd.
Gateway-konfiguration/start och cloud-relay: 54/54 PASS. Hela OpenClaw Lab:
185 PASS, 0 FAIL och ett plattformsskip; sista timeoutvalideringen provades
därefter i de 35 berörda testerna. `audit-dealer-sync --probe` matchar alla
fyra befintliga mediauppsättningar; detta innebär ingen ny läppsynkacceptans.

## Avsett beteende

Detta gäller den riktiga produkten på Render: `lissabon-stream-lane` med
`presentation=local`, den tidigare Lab/Lissabon-strömmen. Inget byte till
den äldre `/v2`-spelaren eller en QA-videoström ingår. Syntetiska modellprov
är en verifieringsmetod, inte en ny destination för spelarens trafik.

Terra är grundmodell. Ett uttryckligt Luna-val för vanlig text kan fortfarande
användas, men ingen dold mini-reserv införs. Första modellen ger normalt ett
slutligt svar. En fråga som kräver resonemang i flera steg kan i stället ge
en strikt intern signal om fördjupning. Servern väljer då den konfigurerade
Sol-modellen. Modellen får inte välja egna modellnamn, verktyg eller externa URL:er.

Högst två anrop från Director till OpenClaw hör till samma fråga. De delar tidsgräns och skydd mot
dubbelanrop. Andra passet får ursprungsfråga, validerad historik/spelkontext
och samma bilder; det får inte första modellens fria resonemang som instruktion.
Saknade fakta eller privata uppgifter ska ge en fråga/ärlig begränsning, inte
en dyrare modell som gissar. Fel och timeout utlöser ingen modelluppgradering.

Chatten visar redan **Astrid tänker…** medan texten produceras. Bara slutligt
svar går till Cartesia och RunPod. En separat genererad ”Let me think”-film
skulle ta GPU-tid och konkurrera med det riktiga svaret; den byggs inte här.
Produktservern kontrollerar fortsatt session och runda före talgenerering och
publicering. Director kan inte läsa om den aktuella handen mellan modellpassen:
om handen ändras utan klientavbrott kan ett andra textanrop redan ha kostat,
även om det inaktuella svaret sedan stoppas före röst/video. HTTP-avbrott hindrar
fortsatt lokalt arbete men bevisar inte att upstream slutar debitera ett påbörjat anrop.

Högst två samtidiga speechbeslut tillåts. GPU-budgeten är separat och sätter
ingen dollargräns för språkmodellerna; pris och typisk latens har inte benchmarkats.
Den första driftversionens begärda gräns 512 tokens per pass var för snäv
för Sol: det syntetiska svåra provet gav tre interna Sol-fortsättningar om
512 tokens och till sist avklippt JSON. Två Director-anrop är därför inte
bevis för högst två provideranrop eller 1024 tokens totalt. Adaptiv drift
återställs till fast Terra medan tokenhantering och format rättas; se livekvittot.

Den efterföljande rättningen begär JSON-object-format på båda adaptiva passen,
512 tokens för första modellen och 2048 för Sol per providerförsök. En
`finish_reason=length` avvisas uttryckligen även om texten ser ut som giltig
JSON; Director gör inget nytt försök. 36/36 relevanta tester PASS, även vid
oberoende granskning. Detta är ännu inte ett nytt godkänt driftprov.
OpenClaw 2026.9.5 har hårdkodade interna gränser för reasoning-only och tomma
svar. `retry.provider.maxRetries` styr en annan gren och stoppar inte dessa.
En hård totalgräns för provideranrop kräver en separat nativeändring eller
kontrollerad providergräns; denna ändring påstår inte att den finns.
Se [den versionsmärkta kopplingen av retrygränser](https://github.com/openclaw/openclaw/blob/v2026.9.5/src/agents/embedded-agent-runner/run-loop.ts#L640-L664).

Detta är separat från OpenClaws modell-failover, som hanterar tekniska fel.
Rollernas vanliga fallbacks är fortsatt tomma. Se
[OpenClaws versionsmärkta failover-beskrivning](https://github.com/openclaw/openclaw/blob/v2026.9.5/docs/concepts/model-failover.md).

## Render-inställningar

| Tjänst | Variabel | Avsett värde |
| --- | --- | --- |
| croupier-lab-openclaw | `OPENCLAW_MODEL_ID` | `gpt-5.6-terra` — redan liveverifierat |
| croupier-lab-director | `OPENCLAW_SPEECH_ROUTING` | `adaptive` först efter verifiering; standard `fixed` |
| croupier-lab-director | `OPENCLAW_SPEECH_DEEP_MODEL` | `gpt-6-sol` |
| croupier-lab-director | `OPENCLAW_SPEECH_TIMEOUT_MS` | `20000` |
| croupier-v2 | `OPENCLAW_SPEECH_TIMEOUT_MS` | `20000` |

Gateway-katalogen innehåller nu Sol med verifierat bildstöd. Två begränsade
syntetiska prov genom den riktiga OpenClaw-speechrollen gav HTTP 200 och korrekt
JSON: text 4266 ms, en bild med röd cirkel 2536 ms. Egen sessionsmetadata
visade `lab-provider/gpt-6-sol`, 85 respektive 91 outputtokens. Detta bevisar
inte typisk latens eller hela produktens adaptiva flöde. Alla fem rollernas
standard är fortsatt Terra med tomma fallbacks. Se [driftbeviset](TERRA-ROUTING-AUDIT-2026-10-01.md).
De tre tjänsterna behöver ingen ny hemlighet för modellväxlingen.

Vid ny installation: driftsätt koden med `fixed`, sätt först produktens
speech-timeout till 20000 och verifiera Web-barnprocessens värde. Aktivera
sedan Director med de tre värdena ovan. Spara miljöändringen med deploy och
kontrollera den körande processens värde: en vanlig omstart kan behålla
förra deploymentens miljöbild. `fixed` på Director följt av deploy stänger av
uppgraderingen igen utan att ändra spelarens data eller huvudmodell.

Lokala Lissabon-startaren vidarebefordrar nu samma uttryckliga
`OPENCLAW_SPEECH_TIMEOUT_MS` till produktens Web-process. Privat
`lab/.env.local` har satts till `20000` och återlästs genom den riktiga
konfigurationsladdaren: produktens talgräns 20000, generell gräns 8000;
Lab får ingen separat talgräns eller routingflaggor. 29/29 startartester PASS.
Inget riktigt lokalt serverpar startades; värdet gäller vid nästa start.
Compose-mallen är ett separat lokalt driftalternativ och ändras inte här.

## Render-åtkomst

Den autentiserade Dashboard/Web Shell fungerar nu. Ingen Render MCP eller
lokal Render CLI-inloggning har hittats. För löpande drift är officiell CLI
en enklare väg än att styra varje knapp:

1. Installera Render CLI från [officiella installationsguiden](https://render.com/docs/cli).
2. Kör `render login` lokalt och godkänn **Authorize CLI** i Render.
3. Välj rätt workspace med `render workspace set`.
4. Agenten kan därefter läsa tjänster, deploymentstatus och loggar i
   strukturerad form. SSH kräver dessutom fungerande SSH-åtkomst.

CLI sparar sin inloggning lokalt. Klistra inte nyckeln i chatten och lägg den
inte i produktens miljövariabler. För en separat obevakad driftmiljö stöds
`RENDER_API_KEY`, enligt [Render API-guiden](https://render.com/docs/api).
Ingen ny CLI-token/API-nyckel eller utökad åtkomst har skapats av denna ändring.
