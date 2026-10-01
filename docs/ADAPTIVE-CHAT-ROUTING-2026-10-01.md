# Adaptiv Astrid-chatt genom OpenClaw

Arbetskvitto 2026-10-01. Lokal kod och direkt modellkapabilitet är verifierade.
Detta dokument är inte i sig bevis för att adaptive är aktiverat i drift.

## Avsett beteende

Terra är grundmodell. Ett uttryckligt Luna-val för vanlig text kan fortfarande
användas, men ingen dold mini-reserv införs. Första modellen ger normalt ett
slutligt svar. En fråga som kräver resonemang i flera steg kan i stället ge
en strikt intern signal om fördjupning. Servern väljer då den konfigurerade
Sol-modellen. Modellen får inte välja egna modellnamn, verktyg eller externa URL:er.

Högst två modellanrop hör till samma fråga. De delar tidsgräns och skydd mot
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

Varje pass har högst 512 outputtokens, alltså högst 1024 sammanlagt. Högst två
samtidiga speechbeslut tillåts. GPU-budgeten är separat och sätter ingen
dollargräns för språkmodellerna; pris och typisk latens har inte benchmarkats.

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

Driftsätt kod före de nya variablerna. Spara miljöändringen med deploy och
kontrollera den körande processens värde: en vanlig omstart kan behålla
förra deploymentens miljöbild. `fixed` på Director stänger av uppgraderingen
igen utan att ändra spelarens data eller huvudmodell.

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
