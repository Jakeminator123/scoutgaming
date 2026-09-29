# Astrid Probe — implementation och driftgräns

2026-09-28. Fokus är Astrid enligt Jakobs senaste avgränsning.
Användarguiden finns i `lab/docs/guide.json`; detta är den tekniska referensen.

## Funktion

- `/lissabon` har Probe och en länk till OpenClaw. `/probe` i stora labbet
  använder samma editor och sparade `probePolicy` i projektets JSON.
- Av är standard även för äldre projekt som saknar fältet. Textprov använder
  en av 23 syntetiska kontexter utan TTS/GPU. Talprov öppnar den konfigurerade
  lokala spelfliken och kräver ett separat knapptryck.
- Startvärden: 90 s inaktivitet, 300 s paus, 30 % per tillfälle, 3 försök/timme,
  högst ett obesvarat initiativ tills spelaren är aktiv igen. Misslyckade
  försök förbrukar tillfället och begränsningarna; timerticks köper inga omtag.
- Fakta: högst 20, normalt 30 dagar från källan; högst fem kandidater skickas
  till modellen. Samma anekdot spärras i 7 dagar, namnfrågan en gång/session.
- Modellval gäller Astrids vanliga chatt, Probe och minnesutdrag. Standard är
  `gpt-6-luna` enligt Jakobs val den 28 september; andra roller byter inte modell. Alternativ är
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

### Vanlig chatt och sparade fakta — driftsatt och provad med Luna

Vanlig Astrid-chatt kompletteras med `status.conversationMemory`: högst
20 fakta/8 KB, valda på servern för autentiserad spelare och Astrid. Kanalen
är separat från de verkliga user/assistant-inläggen. Personliga minnen har
exakt spelarutsaga och tid; avslutade händer har uttryckligt serverunderlag.
Aktuella rättelser väger före gamla uppgifter. Relevanta känsliga ämnen får
besvaras naturligt när spelaren själv tar upp dem; detta tvingar inte fram
ett spontant Probe om ämnet.

Minnesläsning fungerar även i Probe Av/Textprov, så länge minne är på.
TTL och minnespolicy gäller fortfarande. Glöm, generationsbyte, utgångna
fakta och ändrad minnespolicy invaliderar väntande svar före röst/video och
publicering. Normala minnesutdrag börjar fortfarande efter åtta meddelanden
och utesluter känsliga persondetaljer och påstådda spelresultat; de manuellt
seedade fiktiva skilsmässominnena ändrar inte den extraktionsregeln.

Director kör minnesfixen `e6ea969` sedan 09:54:52 Stockholm den 28 september.
Tre syntetiska liveprov kontrollerade återkallande, aktuell rättelse och
frånvaro av belägg. Två vanliga chatter i den återställda QA-profilen använde
skilsmässo- och hundminnet genom hela röst-/videovägen. 4200/4201 och
4210/4211 har startats med ny backend och bevarade respektive data.

Driftsätt först uppdaterad Director, som validerar det nya valfria fältet;
starta därefter om lokal produktserver med bevarade data. En äldre Director
avvisar det nya kontraktet. Se senaste handoff för faktisk driftstatus.

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

## Drift och uppmätta prov

Gateway kör `70ef43f`; Director kör `e6ea969` med vanlig chatts minneskanal.
Probe och de tre modellkandidaterna är fortsatt tillgängliga.
Åtta autentiserings-/schemaprov och en full 60-fallsjämförelse passerade.
Luna gav relevanta initiativ och var snabbare än Terra i detta lilla prov.
Jakob valde därefter Luna som Astrids standard. Provbeskrivningen ovan är
historisk. Aktuella env och kvarvarande verifiering finns i
[live-kvittot](../../open-claw/lab/docs/CLOUD-ACTIVATION-2026-09-29.md).

Rätt ingång är Lissabon på 4201 och **Anslut** till
`?dealer=astrid&presentation=local` på 4200. Porträttklippen används även på
dator. Repetitionsläget utan `presentation=local` är den äldre vägen.
Astrids aktiva QA körs på localhost:4210/4211 med samma sparade projekt som
vanliga Lissabon: `lissabon/data/project.json`. Labbet på
http://localhost:4211/lissabon öppnar sin 4210-spelare med **Anslut**.
Launcherns `playerDataDir` håller testprofilens databas separat, medan
`browserHostname: 'localhost'` behåller dess sessionscookies och länkar på
rätt värdnamn. API-kontroll verifierade samma revision, idlepolicy och
klippfamiljer på 4200 och 4210. Modellvalet är GPT-6 Luna, Probe Automatiskt.
Spara och ladda om spelet efter ändrad idlepolicy, när handen är avslutad.
Deal/Repliker/Probe använder senaste sparade inställningar vid nästa beslut.

Talprovets senaste resultat ligger kvar även när närvarostatus uppdateras.
En vanlig idlevariation avbryter inte ett pågående förberedelsearbete.
Spelhandling, annan chatt/tal, profilbyte och övriga färskhetskrav stoppar
fortfarande arbetet. Färdigt tal inväntar ett faktiskt presenterat neutralt
bildläge genom samma posegrind som vanlig chatt.

Kör `node tools/probe-model-eval.mjs --output <privat-testfil.json>` för en
ny syntetisk jämförelse. Verktyget registrerar enskilda modellfel utan att
försöka samma generation igen; autentiserings-/anslutningsfel stoppar serien.

## Rollback

Sätt Probe till Av och modell till Gatewayns nuvarande talmodell för att
stoppa initiativ utan kodrollback. Full kodrollback till versionen före
Probe kräver att endast projektets valfria `probePolicy` tas bort från en
säkerhetskopierad projektfil, eftersom äldre validator inte känner fältet.
De additiva DB-tabellerna kan lämnas kvar; radera inte spelar-DB:n eller
Gatewayns disk. Äldre chattkod kortar historiken enligt sin tidigare gräns.
Modellkandidaterna kan ligga kvar utan att användas när override är av.
