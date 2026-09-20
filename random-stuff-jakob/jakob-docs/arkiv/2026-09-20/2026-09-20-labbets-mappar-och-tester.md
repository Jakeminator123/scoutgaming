> Arkiverad arbetsrapport/prompt från 20 september 2026. Uppgifter och instruktioner är daterat underlag; arkivering innebär inte att öppna frågor är lösta. Se [arkivindexet](../README.md), [systemkartan](../../systemkarta/README.md) och [findings](../../../../docs/findings/README.md) för fortsatt läsning.

# Labbet: mappar, tester och videor

## Fyra delar — inte fyra olika system

Allt som hör till den nya lokala studion finns under `lab/`. Du arbetar i
editorn; normalt behöver du inte redigera JSON eller förstå schemakoden.

| Mapp | Vanliga ord | Vad den gör |
| --- | --- | --- |
| `lab/policies/` | Startregler | `project.seed.json`: första projektet med events, triggers, varianter och kopplingar. |
| `lab/schemas/` | Strukturregler | Beskriver tillåtna fält och värden, inte vilka klipp du föredrar. Kod kontrollerar dessutom att referenser och kontrakt stämmer. |
| `lab/data/` | Ditt sparade arbete | `project.json` skapas vid sparning, med tidigare versioner i `history/`. Lokalt och inte i Git. |
| `lab/test/` | Automatiska kontroller | Kontrollerar regler, sparning, modellgränser och videoläsning. Några UI-hjälptester ligger nära koden i `components/`. |

Min rekommendation: behåll dessa fyra tydliga roller. Namnet `policies` är
inte ett krav från Next.js eller OpenClaw; här betyder det presentationsregler.
När ett sparat projekt finns används det, inte startfilen. `schemas` är ett
skyddsnät: en namnändring ska inte råka bli ett nytt motor-event. Runtimekontrollen
görs i `lab/lib/studio-model.mjs`; schemat är inte en extra körande tjänst.

Övriga utvecklarmappar: `app/` = sidor/API, `components/` = gränssnitt,
`lib/` = logik. `.next/` och `node_modules/` skapas av verktygen och ska inte
redigeras. OpenClaws drift ligger separat i `open-claw/`, med befintlig
blueprint i `open-claw/lab/render.yaml`; ingen flytt av driftfiler gjordes här.

**Manifest** betyder ungefär innehållsförteckning för ett paket: version och
vilka filer som hör ihop. Vi behöver inget nytt manifest nu. Projektets JSON
samlar redan innehållet; videoregistret listar video-ID och filfingeravtryck.
Ett versionslåst publiceringspaket kan behöva ett manifest senare.
Exportera JSON om du vill versionshantera reglerna; en vanlig sparning pushar inget.

## Automatiska tester finns redan

Kör från repots rot, efter att labbets beroenden installerats:

```powershell
npm --prefix lab test
npm --prefix open-claw/lab test
```

Omkört 2026-09-20: **69 + 62 godkända**. Modelltransporterna ersätts med
kontrollerade testsvar; inga riktiga modellnycklar eller spelare används.
Testerna provar bland annat otillåtna/sena modellval, fel croupier, ändrat
projekt, standard vid fel, konflikter vid sparning och fel videofil.
GitLab-jobbet `presentation-studio` är definierat för berörda ändringar,
men de nya lokala ändringarna är ännu inte pushade; ingen CI-körning intygas.

## Så verifierar vi riktig OpenClaw

1. Publicera Directors nya studio-endpoints och konfigurera lokal anslutning
   med `LAB_REMOTE_URL` och `LAB_REMOTE_TOKEN` på serversidan. Inga nycklar i UI.
2. Testa utan modell: **Regler** + återkommande spelare med tysk språkpreferens
   ska välja den matchande tyska varianten; neutral kontext ska ge standard.
3. Testa **Shadow**: kontrollera ett verkligt modellsvar i beslutsspåret,
   men uppspelningen ska fortfarande använda standard.
4. Testa **Active**: endast en tillåten variant för rätt event/croupier/projekt
   får användas. Modellen behöver inte välja samma tillåtna variant varje gång.
5. Testa operatörschatten separat och avbrott/fel i isolerad testmiljö.
   Vid bortfall ska eventet fortfarande få standard; skydden får inte kopplas bort.

Detta är en testplan, inte ett genomfört live-test. Dashboard-inloggning och
grön serverstatus bevisar inte att modellen svarar. Verkliga anrop kan kosta.
Adaptervägen använder [OpenClaws HTTP-API](https://docs.openclaw.ai/gateway/openai-http-api),
inte dokumentations-MCP. Riktig spelarchatt och spelarminne är fortfarande
separat, ogjort integrationsarbete. IDE-agenternas inbox hör inte till detta.

## De äldre Windows-felen

Senaste breda produktkörningen gav 99/110 godkända Node-tester. De elva felen:
fem sökvägsfel (`/C:/...` blir fel på Windows), ett saknat `ffmpeg`, fyra saknade
`ffprobe` och ett Bash/WSL-åtkomstfel. Dessutom reagerade en separat Astrid-audit
på Windows-radslut (CRLF); med LF matchade filens hash den sparade referensen.
Det bevisar inte läppsynk. Inga medier eller referensfiler ändrades.

Det är fel i testernas plattformsstöd/förutsättningar, inte belägg för att
OpenClaw är trasigt. Men kontroller som inte kan köras är inte godkända.
Åtgärden är portabla sökvägar, tillgängliga videoverktyg, fungerande Bash eller
portabel ersättning, och explicit radslutshantering — sedan en ny hel körning.
Node beskriver sökvägsfällan och [fileURLToPath](https://nodejs.org/api/url.html#urlfileurltopathurl-options).
Inget av detta reparerades inom denna dokumentationsuppgift.

## Så kom videorna in

Det befintliga registret `docs/animation-events/v3-video-map/snapshot.json`
listar 224 original. Filerna ligger kvar i
`C:/Users/jakem/CroupierAssets/bettalotto-generations`; `LAB_VIDEO_ARCHIVE`
kan ange annan plats. Labbet läser dem, utan kopiering eller uppladdning.

Variant → `videoGenerationId` → registerpost → exakt lokal MP4.
Den lokala servern kontrollerar känd identitet, filplats, storlek och SHA-256
(filens fingeravtryck) före uppspelning. Dealer/event-etiketter är förslag,
inte verifierat innehåll. `want` betyder urvalsintresse, inte godkänd take.
Detta är lokal förhandsvisning, inte anslutning till produktens videospelare.
