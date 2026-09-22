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
- **Produktens chatt:** en äldre egen väg i webbklienten; labbchatten har
  inte ersatt den.

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
Se [kontextschemat](../../../../open-claw/lab/schemas/observed-chat.schema.json).

Director måste kvittera version 2 och antalet mottagna meddelanden. Det
aktuella provet mot äldre remote saknade kvittot: labbet behåller då standard
med `remote_context_not_supported_baseline`. Director-redeploy och ett nytt
kompatibilitetsprov behövs innan chattstödet får kallas aktivt där. Detta
är separat från produktens framtida gemensamma talägarskap.

## Ljudets roll

ElevenLabs kan skapa ett explicit begärt talprov. Samma text/röst/modell/
inställningar återanvänder lokal MP3-cache. Genereringen kan kosta krediter.
Synlig 2D-reaktion och hörbart ljud är inte verifierad läppsynk med en
inspelad dealerfilm.

Ljudets beredskap, uppspelningstid, slut och avbrott kan vara styrsignaler
för presentationen. Ingen mikrofon-/taligenkänningsingång hittades i de
granskade klient- och labbvägarna. Att låta en enda ny talägare ersätta den
gamla är en önskad integrationsriktning, ännu inte en utförd avstängning.

## Vad vet vi om drift?

Den daterade [handoffen](../../../../docs/JOHN-HANDOFF.md) redovisar ett
socialchattprov på Director/Gateway `6797b6a`, upstream `2026.9.5`, med
riktiga fasta/fria svar och ElevenLabs-tal. Det är historisk evidens,
ingen ny kontroll av dagens deploy. Råd och social chatt har separata
tidsbudgetar: 8 respektive 30 sekunder enligt granskad konfiguration/kod.

[Render-blueprinten](../../../../open-claw/lab/render.yaml) beskriver
Director och privat Gateway; Next-studion är lokal.
[Gateway-Dockerfilen](../../../../open-claw/lab/deploy/Dockerfile.gateway)
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

[Runtimepaketet](../../../../open-claw/lab/deploy/runtime-bundle/README.md)
installerar korta rolltexter och källsammanfattningar i redan konfigurerade
arbetsytor. Det är inte en crawl, vektordatabas, automatisk läsning av hela
repot eller indexering av video. Länkar ger inte modellen nytt fil-/nätverktyg.

Börja tekniska OpenClaw-frågor i
[det lokala dokumentationsindexet](../../../../open-claw/lab/docs/README.md).
Läs bara relevanta källor när frågan kräver det.

Fördjupning: [social labbchatt](../../../../lab/SOCIAL-CHAT.md),
[socialt runtimekontrakt](../../../../open-claw/lab/docs/SOCIAL-CHAT.md),
[drift](../../../../open-claw/lab/docs/DEPLOYMENT.md),
[dashboard](../../../../open-claw/lab/docs/DASHBOARD-SV.md) och
[dokumenterade variabelroller](../../../../_ENVIROMENT-INFO.md).
