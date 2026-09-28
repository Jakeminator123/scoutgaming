# Astrid Probe — implementation och driftgräns

2026-09-28. Fokus är Astrid enligt Jakobs senaste avgränsning.
Användarguiden finns i `lab/docs/guide.json`; detta är den tekniska referensen.

## Funktion

- `/lissabon` har Probe och en länk till OpenClaw. `/probe` i stora labbet
  använder samma editor och sparade `probePolicy` i projektets JSON.
- Av är standard även för äldre projekt som saknar fältet. Textprov använder
  en av 20 syntetiska kontexter utan TTS/GPU. Talprov öppnar den konfigurerade
  lokala spelfliken och kräver ett separat knapptryck.
- Startvärden: 90 s inaktivitet, 300 s paus, 30 % per tillfälle, 3 försök/timme,
  högst ett obesvarat initiativ tills spelaren är aktiv igen. Misslyckade
  försök förbrukar tillfället och begränsningarna; timerticks köper inga omtag.
- Fakta: högst 20, normalt 30 dagar från källan; högst fem kandidater skickas
  till modellen. Samma anekdot spärras i 7 dagar, namnfrågan en gång/session.
- Modellval gäller Astrids vanliga chatt, Probe och minnesutdrag. Standard är
  `gateway-default`; andra roller byter inte modell. Kandidater är
  `gpt-5.4-mini`, `gpt-6-luna`, `gpt-5.6-terra`.
- HTTP 409 erbjuder en sammanslagning mot den ursprungliga versionen.
  Oberoende fält bevaras; samma fält/array kräver ett uttryckligt konfliktval.

## Gränser och lagring

`web/player-chat-memory.mjs` behåller samma autentiserade spelaridentitet
och dealeravgränsning: 30 user/assistant-meddelanden totalt, högst 8 000
tecken och 1 000 tecken per meddelande. Probe fabricerar inget user-inlägg.
En assistentpost med `origin=probe`, `delivery=played` skrivs först efter
det faktiska spelarens slutkvitto, atomiskt med Probe-ledgern.

Sex additiva SQLite-tabeller skapas i samma spelar-DB:
`player_probe_profiles`, `player_probe_sessions`, `player_probe_attempts`,
`player_probe_sources`, `player_probe_facts`, `player_probe_rounds`.
Scope härleds från chattminnets HMAC-identitet och dealer, aldrig klientens ID.
Reservation, aktivitetsepok, minnesgeneration och policyrevision skyddar
mot dubbla flikar, omstart, sena svar och samtidig Glöm. Källor och rundor
gallras efter 30 dagar; försök efter 31 dagar; närvaro efter ett dygn.

Personliga fakta extraheras efter åtta nya spelarmeddelanden, högst en gång
per minut, utanför chattsvarets kritiska väg. Bara exakta citat ur user-källor
lagras; en modellskriven sammanfattning blir inte ett nytt faktum. Noll
fakta är giltigt. En identifierad korrigering pensionerar konservativt alla
personliga fakta och äldre källor. Detta kan glömma mer än just det rättade
ämnet; det prioriterar att inte återanvända en felaktig uppgift.

Exakta dubbelvinster kräver två separata, intilliggande, insamlade
serverrundor med samma kort, en vinnande hand per runda och ingen split.
Ett hål i den monetära rundsekvensen bryter beviskedjan. Summor bevisar inte
kort. Dolda kort skickas aldrig. Vanlig chatt får dessutom `playResults.lastRound`
med senaste insamlade rundans insats, retur och netto, separat från totalsummor
och pågående runda. Resultatet finns kvar när nästa runda startar.

Glöm stoppar väntande arbete, raderar källmaterial och byter minnesgeneration
så en sen extraktion inte återställer raderade fakta. Full Glöm raderar även
handunderlag och text i gamla försök; opaka spärrar behålls mot återförsök.
Att läsa eller spela ett faktum förlänger inte dess TTL.

## Runtime och uppspelning

Spelfliken skickar närvaro/skrivsignal var femte sekund. Servern kräver både
färsk närvaro och eget lugnt spelläge. Ny chatt, spelhandling, utloggning,
profilbyte, Glöm eller ändrad policy gör väntande arbete ogiltigt. Kontroller
körs före modell, före Cartesia, före RunPod och efter render samt före
visning och efter nedladdning/dekodning, precis före talstart. Efterfrågad
chatt inväntar den avbrutna probens resursstädning innan talvägen återanvänds.

Den befintliga talkön och posegrinden används. Det egna köade jobbet får
passera sin startkontroll; andra köade repliker eller spelhandlingar stoppar
det. Victoria/Cartesia sonic-3.5 och befintligt exakt RunPod-paket används.
Ett kvitto, en hash eller godkänt test är inget visuellt läppsynkgodkännande.

Policy läses inför varje beslut och färskhetskontroll. En sparad ändring
behöver ingen runtimeomstart. En redan pågående kostsam operation kan
avbrytas vid nästa kontroll/närvarouppdatering; ett sent resultat kasseras.

## OpenClaw och PROBE_API

`PROBE_API` är **ingen ny miljövariabel eller nyckel**.

| Väg | Befintlig behörighet |
| --- | --- |
| Browser → Web `/api/probe/*` | Inloggad spelare/demogäst, samma origin |
| Browser → Next `/api/probe` | Lokalt labb, bara syntetiska textfall |
| Web → Director `/api/product/probe` | `OPENCLAW_PRODUCT_SPEECH_TOKEN` |
| Next → Director `/api/studio/probe` | `LAB_REMOTE_TOKEN` |
| Director → privat Gateway | Befintlig Gateway-hemlighet, isolerad `croupier-speech` |

Inga MCP-verktyg, webhooks eller nya operatörsrättigheter krävs.
Officiella integration-/MCP-länkar finns i
`open-claw/lab/docs/OPENCLAW-DOCS.md` och visas i OpenClaw-vyn.

Gateway 2026.9.5 har modelloverride via `x-openclaw-model`. Agentmålet
förblir `openclaw/croupier-speech`, verktyg nekade. Kandidater läggs till
i befintlig officiell OpenAI-provider vid startup; befintliga primärmodeller,
fallbacks och manuella modellmetadata bevaras. HTTP-schemat stöder inte
`reasoning_effort`, därför visas ärligt `gateway-default`, inte ett skenbart
val mellan none/low. Ingen jämförd modell har utsetts till vinnare.

## Driftkvarstående

Kontroll den 28 september: Director `/api/status` svarade 200 med befintliga
capabilities men **utan `product-probe-v1`**. Första syntetiska modellprovet
fick HTTP 401 på den ännu saknade produktvägen. Jämförelsen avbröts där;
inga 20-fallsresultat, latenspercentiler eller kostnadsslutsatser finns.
Detta ska inte tolkas som att användaren behöver skapa en ny token.

Efter granskad commit/push: driftsätt samma commit på befintliga Director
och Gateway. Använd Manual Deploy, ingen Blueprint Sync, ny tjänst eller
ändrad GPU-budget. Kontrollera att `product-probe-v1` finns, att de gamla
token-gränserna består och att Gateway faktiskt laddat kandidaterna.
Starta sedan om det lokala bygget kontrollerat när ägaren är klar med det.
Pågående gemensamma 4200/4201 har inte startats om av detta arbete.

Kör `node tools/probe-model-eval.mjs --output <privat-testfil.json>` med
befintlig nätåtkomst. Det provar samma 20 syntetiska fall per modell, utan
TTS/GPU, och särredovisar första anropet, varma p50/p95 och oväntat tal.
Anropet rapporterar begärt modell-ID; det bevisar inte den laddade modellen.
Tokenförbrukning/kostnad saknas i relay-svaret. Naturlighet och faktatrohet
behöver fortfarande granskas. Prova därefter två genererade talpaket i
Astrids faktiska spelare och dokumentera avbrott samt synk separat.

## Rollback

Sätt Probe till Av och modell till Gatewayns nuvarande talmodell för att
stoppa initiativ utan kodrollback. Full kodrollback till versionen före
Probe kräver att endast projektets valfria `probePolicy` tas bort från en
säkerhetskopierad projektfil, eftersom äldre validator inte känner fältet.
De additiva DB-tabellerna kan lämnas kvar; radera inte spelar-DB:n eller
Gatewayns disk. Äldre chattkod kortar historiken enligt sin tidigare gräns.
Modellkandidaterna kan ligga kvar utan att användas när override är av.
