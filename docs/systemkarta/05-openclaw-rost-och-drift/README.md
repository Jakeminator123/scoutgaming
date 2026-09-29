# OpenClaw, röst och drift

[Till systemkartan](../README.md) · [Nästa: arbetssätt och verifiering](../06-arbetssatt-och-verifiering/README.md)

**OpenClaw kan ge råd inom ett avgränsat kontrakt.** Kod väljer tillåtna
kandidater och kontrollerar svaret. Modellen äger inte kort, regler, utfall
eller wallet. För variantval ger saknat eller ogiltigt råd standard.

```text
Lokal studio → lokal server → Render Director → privat OpenClaw Gateway
                                       ↓
                              kontrollerat modellråd
                                       ↓
                    lokal video/2D-preview eller socialt svar
```

## Fyra olika samtal

- **Eventråd:** ett variant-ID ur tillåtna alternativ för ett exempel eller
  en mottagen presentationsinstruktion. Eventeditor och sekvensspelare delar
  det lokala mellanledet `/api/presentation/decision`, med deduplicering av
  beslutsförsök och separat uppspelningskvitto.
- **Operatörschatt:** frågor om labbprojektet; separat från spelarchatt.
- **Social Astrid-chatt:** riktig textinput, egen sparad policy och
  validerad text/reaktion i `idle.ready`. Valfritt exakt ElevenLabs-tal.
- **Produktens strukturerade talbeslut:** `/chat` projicerar allowlistade
  publika spelfakta och accepterar endast `recordedLine`, `generatedText`
  eller `silence`. Den nya rollen `openclaw/croupier-speech` är skild från
  operatörschatten. Den separata rollen och adaptern har daterade driftkvitton,
  men aktuell molnspel→tal-kedja är inte verifierad. Se
  [aktiveringshandoffen](../../../open-claw/lab/docs/CLOUD-ACTIVATION-2026-09-29.md).

Eventtestets `chat.signal`, språk, återkomst och historikräknare är manuella
testvärden. De är inte ett bestående spelarminne eller automatiskt lästa
från den sociala chatten. Den sociala labbchatten har begränsad samtalshistorik
och lokal cooldown, men ingen generell kö till produktspelaren.

Livejämförelsen använder däremot observerade publika handresultat och kan
bifoga `context.observedChat` från originalfliken. Kontrakt v2 tillåter högst
8 user/assistant-meddelanden, 600 tecken vardera och 3 200 totalt, med tid och
proveniens före instruktionen. En lucka bryter kontextfönstret. Texten är
data för variantval, inte order till modellen eller ett autentiserat minne.
Saldo-, identitets- och authfält kopieras inte till denna projektion.
Se [kontextschemat](../../../open-claw/lab/schemas/observed-chat.schema.json).

Director måste kvittera version 2 och antalet mottagna meddelanden. Det
aktuella provet mot äldre remote saknade kvittot: labbet behåller då standard
med `remote_context_not_supported_baseline`. Director-redeploy och ett nytt
kompatibilitetsprov behövs innan chattstödet får kallas aktivt där. Detta
är separat från produktens framtida gemensamma talägarskap.

Historiskt var commit `1219d98` utgångspunkten: fungerande lokal
operatörsrelay men saknad privat produkt-Gateway-URL och fel standardroll för
produktkontraktet. Commit `113dfd8` löser rollkonflikten i kod med en separat,
verktygslös speech-roll och en smal Director-adapter. Den saknade privata
transporten, ny separat token, Gateway-/Director-redeploy och isolerad runtime-QA
var nästa steg då. OpenAI-provider/modell behölls; Gemini ersatte den inte.
En läsande kontroll 2026-09-29 visade att de befintliga Director-/Gateway-
tjänsterna ännu hämtar från GitLab `jakeminator123/work` på `8e10017d`.
GitHub-arbetsbranchens nya Blueprint kan därför inte aktivera dem utan ett
separat Render-källbyte och en uttrycklig driftsättning.

## Ljudets roll

ElevenLabs kan skapa ett explicit begärt talprov. Samma text/röst/modell/
inställningar återanvänder lokal MP3-cache. Genereringen kan kosta krediter.
Synlig 2D-reaktion och hörbart ljud är inte verifierad läppsynk med en
inspelad dealerfilm.

Ljudets beredskap, uppspelningstid, slut och avbrott kan vara styrsignaler
för presentationen. Ingen mikrofon-/taligenkänningsingång hittades i de
granskade klient- och labbvägarna. Produktkoden håller ett svar utanför kön
tills den riktiga spelaren kvitterat aktuell `standard-idle`; först då får
chattrad, caption, ljud och visuell presentation släppas till den befintliga
enda talkön. Den posegrinden är kod- och regressionstestad, men inte verifierad
mot en ny driftsatt speech-roll. En fil som börjar/slutar i startbilden eller
en fristående preview bevisar inte att grinden passerade i produkten.

## Vad vet vi om drift?

Den daterade [handoffen](../../JOHN-HANDOFF.md) redovisar ett
socialchattprov på Director/Gateway `6797b6a`, upstream `2026.9.5`, med
riktiga fasta/fria svar och ElevenLabs-tal. Det är historisk evidens,
ingen ny kontroll av dagens deploy. Råd och social chatt har separata
tidsbudgetar: 8 respektive 30 sekunder enligt granskad konfiguration/kod.

[Render-blueprinten](../../../open-claw/lab/render.yaml) beskriver
Director och privat Gateway; Next-studion är lokal.
[Gateway-Dockerfilen](../../../open-claw/lab/deploy/Dockerfile.gateway)
är versions-/digestlåst. Ingen driftändring görs av systemkartan.

För hela livejämförelsen krävs tre separata versioner: senaste lokala
Next-labbet, en Director som stöder kontext v2 samt Bettalottos native-server
och klient med presentationssvar och opt-in-observer. Render-blueprintens
byggkontext är endast `open-claw/lab/`; en Director-deploy publicerar alltså
varken `lab/` eller `web/`. Just kontext v2 kräver inte en ny Gateway-version.
Lokala helhetsprovet är godkänt, men Bettalottos aktuella native-version är
inte verifierad: begränsade offentliga JS-anrop den 22 september gav 401.
Det visar åtkomstkrav, inte att den nya koden finns eller saknas live.
Driftsättning och en behörig provsession återstår separat; inga riktiga
spelares saldon eller sessioner ska användas som testdata.

## Avgränsad kunskap, ingen full indexering

[Runtimepaketet](../../../open-claw/lab/deploy/runtime-bundle/README.md)
installerar korta rolltexter och källsammanfattningar i redan konfigurerade
arbetsytor. Det är inte en crawl, vektordatabas, automatisk läsning av hela
repot eller indexering av video. Länkar ger inte modellen nytt fil-/nätverktyg.

Börja tekniska OpenClaw-frågor i
[det lokala dokumentationsindexet](../../../open-claw/lab/docs/README.md).
Läs bara relevanta källor när frågan kräver det.

Fördjupning: [social labbchatt](../../../lab/SOCIAL-CHAT.md),
[socialt runtimekontrakt](../../../open-claw/lab/docs/SOCIAL-CHAT.md),
[drift](../../../open-claw/lab/docs/DEPLOYMENT.md),
[dashboard](../../../open-claw/lab/docs/DASHBOARD-SV.md) och
[miljö-/API-förklararen med variabelnamn och läsordning](MILJO-OCH-API.md).
Den exakta kvarvarande driftsordningen finns i
[produktens speech-plan](../../../open-claw/lab/docs/PRODUCT-SPEECH-DEPLOYMENT-SV.md).
