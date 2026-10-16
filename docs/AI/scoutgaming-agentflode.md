# Så samarbetar chattar, agenter och modeller i Scoutgaming

Aktuell status och återstående arbete finns överst i
[CLOUD-MIGRATION](../CLOUD-MIGRATION.md) och
[JOHN-HANDOFF](../JOHN-HANDOFF.md). Följ [AGENTS.md](../../AGENTS.md) för
mandat, ägarskap, verifiering och merge-/driftgränser. Daterade kvitton nedan
beskriver sina dåvarande versioner och öppnar inte avslutade migrationssteg.

Underagenter används bara på uttrycklig begäran enligt projektreglerna.
De ärver vald modell om Jakob inte begär ett annat modellval eller en annan
tankenivå. Uppgifterna ska vara korta och kompletta, med en ägare per fil,
inklusive tester. Huvudagenten äger Git, integration, gemensamma register
och leverans; byt inte branch medan sidoagenter skriver. Samordna tunga
byggen och testpaket så att högst ett körs lokalt åt gången, och återanvänd
giltiga resultat för oförändrad kod och samma testmiljö. Bevara beteendekontrakt och
data när verifierat ersatta sidor och tester avvecklas. Rapportera relevanta
fel och osäkerheter utan en ny generell godkännandegrind.

## Daterat samordningskvitto — 15 oktober 2026

Vid detta kvitto hade Jakob gett mandat att slutföra en
sammanhängande Admin/partner/lobby-struktur, granska och merga egna PR:er
och städa ersatt legacy efter konsumentkontroll. C1–C9 i
[migreringstrackern](../CLOUD-MIGRATION.md#admin-checkpoints-c1c9) är enda
uppföljningen. Avgränsade underagenter lämnar ett kvitto per uppgift;
huvudagenten äger integration, fullkontroll och ägarverifiering före merge.

PR152 är levererad på main `3da92370`: obligatorisk PR-CI och main-CI gröna,
Vercel production READY och Render live på samma SHA; engine health/version bekräftade `3da92370` den 15 oktober 00:10 UTC.
Samordnarens eget läsande prov med befintlig staffsession verifierar Admin →
Partner → Lobby, rum/bolagsstandard genom meny/reload/historik, negativa
rumslänkar och återställt Avbryt-fokus. Roller ändras inte, inga
produktionsskrivningar eller spelrundor gjordes. Vid detta kvitto återstod ny
produktionslogin, full skrivacceptans, faktisk 200-procentszoom och godkännande
för PR91:s export av privat spelarkod. Kvitton i [handoffen](../JOHN-HANDOFF.md) skiljer
lokal fullhook (3 852 pass/9 skip/0 fel), CI och produktionsprov;
överlappande underagentprov summeras inte.

C6:s tidigare API-steg ersattes då av faktisk N2-arbetsyta i samma isolerade
browserkedja. Underagentens Chrome-kvitto (2/2, inga skip) och oberoende
kodgranskning hålls isär; lokal fullhook och CI redovisas separat. En läsande
produktionskontroll fann dubblerad kontonavigation och en journalhänvisning
utan länk. De små UI-rättningarna behåller gamla adresser och servergränser.
Inga nya testidentiteter eller produktionsdata behövdes.

## Arbetssätt och verifiering

Strukturpass 16 oktober 2026: sex befintliga README samlar rätt ingångar,
runtimeägarskap och testernas hemvist. Förbrukad lokal registeruppgradering
är borttagen; isolerade fixtures bevarar befintliga data. CI-följden ligger
separat i PR188. Handoff och respektive PR skiljer lokal kontroll, CI och
leverans; detta pass omfattar ingen visuell användaracceptans.

Dokumentationsrättning 16 oktober, efter den externa granskningen:
systemkartans läsanvisning är nu en kort systemöversikt och terminologin en
ordlista. Äldre kartdata ger inga bevarandekrav på sidor eller tester.
Astrids referensroll skyddar hennes verifierade funktioner och data, inte
parallella lokala register. Rotens README beskriver samma fokuskontroller
lokalt/full regression i CI som AGENTS. Äldre statusrubriker i handoff och
tracker är märkta som historik. Aktuell merge/driftstatus följs där överst.

Dokumentationsändring 16 oktober 2026: det nya runtimekontraktet samlar
katalog och svarsbibliotekets metadata i scoped Neon, med mediebytes i Blob.
Lokala katalogfiler används endast som uttryckliga authoring-/importkällor.
Vanlig `lab/start.mjs` öppnar publicerad produkt (`--no-open` skriver URL);
bara `--offline` startar isolerade temporära testdata. Äldre anslutna lokallägen
avvisas. Guiderna för [runtime](../LOCAL-PRESENTATION-RUNTIME.md),
[miljövariabler](../ENVIRONMENT-VARIABLES.md) och
[användarsteg](../../lab/docs/README.md) är uppdaterade i sina befintliga filer.
Huvudagentens kvitto 16 oktober 18:38 UTC bekräftar migration 012 och återläst
katalog-/svarsimport. Runtimebytet från bridgeversion `3165ab6` är därefter
mergat i PR186 (`2ea080bc`) efter grön SQL-/HTTPS-CI och driftsatt på både
Vercel och Render. Versions-/hälsokontroll och publika mediehashar är
verifierade 19:32 UTC. Kvarvarande användaracceptans och produktarbete
följs enbart i befintlig tracker och handoff.
Detta dokumentationskvitto räknas inte som en ny molnverifiering.

Från 16 oktober 2026 kör lokal commit kontroller av ändrade filer och
tillgängliga närliggande tester, med högst fyra testprocesser. `node
tools/precommit-checks.mjs --plan` visar urvalet. Hela regressionen körs i CI
eller uttryckligen med `sh .githooks/pre-commit --full`; ett fokustest är inte
full acceptans. Studio-tester upptäcks automatiskt och körs en gång i CI.
Migrationsberedskap mot produktionsregistret krävs för server/schema/beroenden
och alltid på main; tydliga klient- och teständringar i PR:er slipper den läsningen.
Systemkartans CI-rapport är informativ och blockerar inte ändrad struktur.
Agent-talk bevaras för samma checkout, men kontrolleras vid start, nya filanspråk
och leverans i stället för var 30:e sekund. Samma branchnamn i olika arbetskopior
delar inte tavla. Uttryckligen beslutad avveckling får ta bort sidor och deras
förbrukade tester; kvarvarande behörigheter, data och beteenden ska verifieras.

`node tools/check-admin-navigation.mjs` kör befintliga riktade tester med
fyra arbetare (`--plan` visar urvalet). Det är ett snabbt utvecklingsprov;
CI behåller hela produktkontrollen inför leverans.

Frontendens `npm run typecheck` ingår nu i fullhook/CI och Next-bygget
tillåter inte längre typfel. Kör Node från rätt paketmapp enligt
[runtime-tabellen](../ENVIRONMENT-RESTORATION.md#byggdelar-och-node-versioner).
Vid städning skiljs aktiv delad kod från onåbar klientdemo genom konsumenter;
legacy-namn eller ett gammalt test är inte ensamt ett bevarandekrav.

Partner-städningen behåller beteendetester för verklig meny, rollgränser,
utkast och publiceringskvitton. Test av en borttagen demomenys exakta antal
och ordning ersätts med dessa kontrakt. Kontrollera kvarvarande referenser
när gamla generatorer och vyer tas bort; raderingsgrinden kan hjälpa den kontrollen.

Det tidigare spelarstoppet är hävt för isolerade internetprov. PR #91 har
Astrid-kvitto för förlust, vinst, push, split, mobil och sammanhängande
spelningar; detta är funktion, inte ny läppsynksacceptans. Dragan v4 väntar
på uttryckligt tillstånd att också kopiera den privata spelarkoden till
den tillfälliga sandlådan efter automatisk säkerhetsgransknings avslag.
Se [aktuell handoff](../JOHN-HANDOFF.md). Äldre daterade kvitton nedan är historik.

Uppföljning 13 oktober: PR #103 med publik Scoutguide och befintlig D-ID-agent
är mergad (`b2dda8ab`), med grön main-CI och Vercel production READY.
Riktiga Luna-svar är verifierade i cookiefri produktionsvy, inklusive att
publik hjälp avböjer interna saldon och radering. N1 behåller sina tre lägen.
PR #109 ersatte #105 och mergades som `7f02da34` efter budget-PR #108.
Budgeten är verifierad live på Render och Neon: 20 USD per UTC-dygn för GPU,
inte en gemensam kvot för GPT, D-ID eller talsyntes. PR #109 och main-CI är
gröna; samma kod kör på Vercel och Render. D-ID:s API och vilovideovärd är
tillåtna i de publika lobby-/roulette-dokumenten och uppvärmningen startar
ljudlöst. Bygge och fullkontroll: 3 436 godkända, 11 skips; slutliga riktade
kontroller: 20 D-ID/sidtester och 22 konfigurationstester.

Produktionsprovet gav ett riktigt Luna-svar och D-ID skapade en WebRTC-ström,
men avataracceptansen är ännu inte godkänd. Provet hittade ett separat fel:
SDK 3 använder `agent.idle_video`, inte `agent.presenter.idle_video`.
Rättningen i PR #111 (`21f7fc8c`, `codex/public-did-idle`) har ett
regressionstest som först var rött och sedan grönt, godkänt bygge och
fullkontroll: 3 436 godkända, 11 skips, inga fel. Alla PR-kontroller blev gröna
och PR #111 mergades som `ed584be7`. Även sista main-CI är grön.
Vercels produktion är READY och
chattfilen på `www.scoutgaming.tech` matchar den rättade lokala bundlens
SHA-256. Tio HTTP-ingångar kontrollerades igen efter publiceringen.
Uppföljning 14 oktober: webbläsaren återanslöts och produktionen provades
efter omladdning utan skriptöverlagring. Två svar i samma D-ID-anslutning
gav HTTP 200 och talvideon spelades med `paused: false`, `muted: false`,
volym 1 och readyState 4. Vid vila återgick videon till ljudlös uppspelning.
Det är tekniskt bevis för uppspelning med ljud aktiverat; ingen akustisk
inspelning eller separat läppsynksbedömning gjordes. Den tillfälliga
cookiefri testvyn och tidigare skriptöverlagring fanns bara i vår testflik.
Privata kvitton finns i ignorerade `arkiv/public-did-20261013/`.

HTTP-provet omfattade tio ingångar: `/`, `/about`, `/lobby`, `/partner`,
`/partner/login`, `/play`, `/play/blackjack`, `/play/roulette`, `/admin` och
`/control`. Samtliga slutvyer innehåller chattkoden. De provade speladresserna
utan vald spelkontext går till `/play`; admin/control går till `/studio/login`. Adminrobotens metadata
ger `access: none` och utloggad POST nekas med 401. N1:s tre lägen är också
visuellt verifierade. Inloggade N2/N3-sidprov och hörbar avataracceptans är
separata kontroller; HTTP-provet är inte bevis för dessa. Testkontot `LLM`
loggades in 14 oktober men visar N1:s Adminrobot. Partnerinloggningen nekar
kontot och hänvisar till intern inloggning. Detta är inte en spärr mot N1:s
partneråtkomst: nytt produktionsprov 14 oktober verifierade att en enda
LLM-inloggning öppnar `/play`, därefter `/partner` med alla fyra registrerade
bolag och `/admin` via Kontrollpanelen. Kontoidentiteten ligger kvar som
intern administratör. N1 ska använda `/partner` direkt eller länken till
intern inloggning, inte försöka skapa en N2-session via partnerformuläret.
N1 kan därmed komma in på samtliga tre produktytor med samma konto.
Positiv inloggad N2/N3-acceptans
behöver därför befintliga konton med dessa roller. Jakob har informerats.
De av Jakob angivna testuppgifterna sparades i ignorerad `.env.local` under
`CROUPIER_QA_LOGIN_USERNAME` och `CROUPIER_QA_LOGIN_PASSWORD` samt i Vercels
production, preview och development. Inga `NEXT_PUBLIC_`-variabler används.
Ingen roll eller kontobehörighet ändrades under provet.

Produktens aktuella ingångar, bolagssluggar och kompatibilitetslänkar har en
kanonisk lista i [användarguiden](../../lab/docs/README.md), verifierad
14 oktober 2026. `/control/openclaw` leder till `/admin/ai/models`, medan
`?tab=chat` leder till `/admin/dealer-agent`. Dessa länkar ska inte blandas
ihop med Adminrobotens `/admin/ai/chat` eller den publika D-ID-bubblan.
Det är den verifierade kontorollen som väljer chatt: besökare/N2/N3 får
publik Scoutguide, N1 får Adminrobotens lägen även när samma konto öppnar
partner- eller spelarytan. En URL-slugg eller sidbyte ger inga nya privilegier.
De faktiska blackjack- och rouletteborden, inklusive Studio-preview, visar
sedan mobilrättningen 15 oktober ingen flytande Adminrobot/Scoutguide:
den skymde spelkontrollerna. Sidornas uttryckliga markör stoppar widgeten
före DOM-injektion och API-anrop. Assistenten finns kvar i Admin, Partner,
Lobby och spelets ingångssida. Dealerns separata spelarchatt ändras inte.

Uppdaterad 13 oktober 2026 efter PR #94, #96 och #98. Alla tre är mergade:
dealerimport, lokal arkivering och Adminrobotens utökade N1-verktyg.
Mergeagentens senaste driftskvitto avser `982d541f`: grön samlad CI, Vercel
production READY, Render live samt matchande version och HTTP200 på health.
Det är ett rapporterat driftskvitto; full acceptans av N1:s nya användarflöden
har inte genomförts i denna chatt. Gatewaymodellernas daterade avläsning
nedan är separat från denna kodleverans.
En agent är en roll med instruktioner och behörigheter. En modell är den motor
rollen anropar. Fem roller betyder alltså inte fem samtidigt arbetande modeller.

```text
ANVÄNDARE / WEBBLÄSARE
|
+-- Besökare, NIVÅ 2 och NIVÅ 3
|     Separat Scoutguide (PR #103 live; avataracceptans återstår)
|       -> Vercel /studio/api/public-assistant
|       -> gpt-6-luna (low), enbart fast publik sajtinformation
|       -> svarstext -> D-ID DirectPlayback / speak -> avatar och svensk röst
|          Ingen databasåtkomst, inga interna verktyg eller ändringsåtgärder.
|
+-- Inloggad NIVÅ 1: Scoutguiden / snabbhjälp
|     Vercel /studio/api/assistant
|       -> gpt-6-luna (low)
|       -> svar om sajten
|          Endast publik kunskap. Ingen intern databas eller åtgärd.
|
+-- Inloggad NIVÅ 1: Adminroboten
|     Vercel /studio/api/assistant
|       +-> Läsare: dealers, material, sammansättningar, media, bolag och rum
|       |     -> befintliga Studio-/spel-API:er -> Neon PostgreSQL
|       |     -> sparade mediaregister: metadata, inte videoanalys
|       +-> Modell: gpt-6.1-sol (high)
|       |     -> svar eller ETT åtgärdsförslag
|       +-> Granskning + "Är du säker...?"
|             -> aktuell N1-session + bekräftat underlag
|             -> befintlig skrivfunktion -> sparad ändring
|       +-> Länk till rätt adminvy / import för vald dealer
|             -> skapa dealer -> välj filmer -> granska och spara import
|
+-- Inloggad NIVÅ 1: Adminrobotens OpenClaw-läge
|     Samma Vercelchatt, gpt-6.1-sol (high)
|       -> Director på Render -> privat OpenClaw Gateway
|          +-> läs anslutning, roller och modellkatalog
|          +-> bekräftat modellbyte för en vald roll
|          Ingen roll läggs automatiskt till i varje webbsamtal.
|
+-- Klippassistenten (separat import)
|     Vercel / Studio
|       +-> gpt-6.1-sol (high): föreslår klippfack
|       +-> gpt-5.6-luna (medium): äldre importchatt
|       -> användaren granskar -> befintlig klippbank / Blob / Neon
|
+-- Äldre Studio-/Control-funktioner
|     Vercel -> Director på Render -> privat OpenClaw Gateway
|       +-> croupier-chat: förklarar katalog och konfiguration
|       +-> croupier-social: Astrids separata sociala labbchatt
|       +-> croupier-director: föreslår kompatibel presentationsvariant
|            (endast när OpenClaw-/shadow-läge används)
|
+-- SPELAREN talar med dealern
|     Spelserver på Render: croupier-v2
|       -> Director /api/product/speech
|       -> Gateway / croupier-speech
|          -> svarstext, exakt inspelad replik eller tystnad
|       -> spelserverns talkö och faktiska idle-läge
|          +-> inspelat tal: godkänt ljud + video spelas
|          +-> genererat tal:
|                accepterad GPU-session
|                  -> Cartesia: text till ljud
|                  -> RunPod / MuseTalk: ljud till läppsynkad video
|                  -> spelserverns relä -> spelarens ljud och bild
|       Kort, shoe, saldo, regler och utfall ägs av spelservern.
|
+-- OpenClaws EGEN DASHBOARD (en annan webbapp)
      Director /openclaw/ -> Gatewayns Control UI
        -> croupier-operator: administrativ agentroll
        -> agentinställningar, sessioner och konfiguration
      N1-knappen skapar en kortlivad engångslänk till Owner-inloggning.
      Verifierad 13 oktober utan extra lösenord eller terminalkommando.
      Gatewayns egen session är separat från sajtens N1-session.
```

## Modellval i Gatewayn

Vid huvudchattens avläsning den 13 oktober var Gatewayn ansluten, version
2026.9.5. **croupier-operator använder lab-provider/gpt-6.1-sol** efter ett
bekräftat modellbyte och återläsning. Övriga fyra roller använder fortsatt
**lab-provider/gpt-5.6-terra**, med sina tidigare fallbacklistor bevarade.
Gatewayns lästa modellkatalog innehöll **5.4 Mini, 5.6 Terra, Luna 6,
Sol 6 och Sol 6.1**. Uppgifterna återlästes efter Gatewayns omstart i PR #89.
Att ett modellnamn finns i katalogen betyder tillgängligt val, inte aktiv process.
Repots agentkonfiguration har heartbeat=0m, nekade verktyg och avstängd
cron/browser. Det finns alltså ingen avsedd ständig bakgrundsloop per roll.
Det visar konfiguration, inte att alla fem används eller att varje samtal använder
grundmodellen. Ingen roll raderas på antagandet att den är inaktiv.

| Roll | Vem anropar den? | Uppgift |
| --- | --- | --- |
| croupier-director | Presentationsrådgivning i OpenClaw-/shadow-läge | Väljer bland tillåtna, kompatibla klippvarianter |
| croupier-chat | Äldre operatörschatt via Director | Förklarar konfiguration; skriver inte |
| croupier-operator | OpenClaws egen dashboard | Separat administrativ konversation |
| croupier-social | Social labbchatt | Textsvar och policybunden social trigger |
| croupier-speech | Spelserverns separata speech-API | Spelarens svarstext eller inspelade replik |

**Speech kan välja modell per anrop.** Kodens tillåtna produktval är
gpt-5.4-mini, gpt-6-luna och gpt-5.6-terra. Valfri adaptiv Astrid-routing kan
göra ett andra resonemangsanrop; standardvalet där är gpt-6-sol.
Det är en möjlig kodväg, inte ett verifierat påstående om aktuell driftsinställning.

## Vad som redan är verifierat

- Sol 6.1 och Luna 6 svarade i syntetiska anrop till den konfigurerade leverantören.
- Sol 6.1 klarade också det nya svarsformatet med läsning, förslag och navigation
  i ett verkligt modellprov med syntetiska uppgifter, utan dataskrivning.
- Adminrobotens utökning: 35 riktade tester och fullhook med 3342 godkända,
  11 överhoppade, 0 fel. Studio byggd. Separat dokumentationskontroll 37/37.
- Isolerat UI-prov: dold widget för N3, N1:s tre lägen, importlänk,
  konsekvensdialog och N1→utloggad→N1 med tömt samtal. Ingen åtgärd verkställd.
- Gatewayns anslutning och operatorns Sol 6.1 återlästes i drift; övriga roller
  och fallbacks bevarades. N1-engångslänken till dashboarden är provad i drift.
- Frekvens/senaste anrop för respektive Gatewayroll är ännu inte verifierat.
- Den äldre N1-webbchatten svarade i drift med Sol 6.1 och läste register.
  Efter PR #98 återstår full liveacceptans av de nya N1-flödena. Slutligt
  versions-/hälsokvitto är inte samma sak som godkänd dealerimport eller radering.
- TalkingHead ingår inte: det är en separat 3D-avatar-/läppsynkintegration.

Källor i kod: lab/lib/assistant-model.mjs, assistant-context.mjs,
assistant-actions.mjs, assistant-reads.mjs, dealer-import-model.mjs;
tools/retention-archive.mjs och tools/retention-policy.json;
open-claw/lab/src/settings.mjs,
openclaw.mjs, product-speech.mjs, speech-routing.mjs, social.mjs;
web/generated-speech-stream.mjs och services/astrid-gpu-worker/README.md.

## Webbchattens behörigheter och dataflöde

Alla tre lägen kräver en aktuell nivå 1-session. Det gäller även snabbhjälpen
och när samma chatt finns på andra sidytor. Widgeten döljs före
behörighetskontroll och töms vid utloggning eller kontobyte. N2, N3 och
besökare får ingen intern kontext eller åtkomst till dessa chattverktyg.
Spelarens separata samtal med en dealer följer produktens speech-API ovan.

| Läge eller steg | Befogenhet |
| --- | --- |
| N1 snabbhjälp, Luna 6 low | Korta svar om sajten; inga interna läsningar eller ändringar. |
| N1 administration, Sol 6.1 high | Söka och bläddra i sparade dealers, material, sammansättningar, mediaregister, bolag och rum. |
| N1 efter konsekvensdialog och separat bekräftelse | Skapa dealer; ändra resurs- och klippnamn; arkivera/återställa dealers, material, bolag, rum och berättigade klipp; pausa/öppna rum. Permanent radering av redan arkiverad dealer eller klipp kräver befintlig beroendekontroll. |
| N1 OpenClaw-läge, Sol 6.1 high | Läsa anslutning, roller och modellkatalog samt föreslå bekräftat modellbyte för en vald Gatewayroll. |

Webbchatten körs på sajten via Vercel och anropar modellleverantören genom
sin serveradapter. Den befintliga `OPENAI_API_KEY` kan användas där.
OpenClaw-läget ansluter dessutom till Director på Render och den privata
Gatewayn. Dashboardens croupier-operator är en separat konversation; den
styr inte automatiskt varje svar som webbchatten visar.

Modellen kan begära högst tre avgränsade registerläsningar per svar.
Resultaten är paginerade och anger fortsatt offset eller ofullständigt urval.
Blobåtkomst här avser sparad filmetadata och tillåtna medieåtgärder.
Lagringssökvägar, signerade URL:er, nycklar och spelaruppgifter exponeras inte.
Ingen fri SQL eller shell ingår. Navigation betyder en länk till en godkänd
adminvy; roboten styr inte en fri webbläsare.

Ett förslag ändrar inget. Vid verkställning läses session, resurs och revision
om, och exakt mål bekräftas i dialogen. Permanent radering förklarar vad som
försvinner och inte kan återställas. Aktiva referenser, frysta/publicerade filer
och historik kan blockera åtgärden. Bolagsåterställning öppnar inte rum igen.
Modellbyte kan ändra den valda rollens fallbacklista enligt dialogen.

## Skapa dealer och ladda upp flera filmer

PR #94 lägger till **Skapa dealer** i `/admin/clips?tool=import`.
Registrera exempelvis **Dragge**, spara och välj den som mottagare för klippen.
Dealern får tomma klippfack och läggs inte automatiskt till ett rum.
En chattlänk kan välja en redan registrerad dealer med dess exakta ID.

Importassistenten tillåter högst 30 **osparade** filer per omgång och
128 MiB per fil. Sparade rader upptar inte nästa omgångs köplatser.
Filval, uppladdning, klippmappning och slutlig granskning sker i importvyn;
chattrutan tar ännu inte emot videobilagor. Dealerskapande blockeras om
importvyn har osparad klippmappning eller en aktiv importkö.
Dragge har inte skapats i produktion som del av våra tester.

## Automatisk lokal arkivering och återställning

PR #96 inför rotation efter lyckad lokal projektsparning respektive avslutad
observationssession. Policyn finns i `tools/retention-policy.json`:

| Källa | Gräns som startar arkivering | Behåll alltid |
| --- | --- | --- |
| `lab/data/history` | Över 100 projektsnapshots eller 64 MiB | Minst de två senaste |
| `lab/data/observations` | Över 20 avslutade sessioner eller 128 MiB | Minst de två senaste |

Äldre poster flyttas tills gränserna är uppfyllda, med minst två senaste kvar.
Aktiva inspelningar lämnas kvar. Arkiveringsfel rapporteras utan att göra en
lyckad projektsparning misslyckad. Detta gäller de lokala skrivarna, inte varje
molnsparning. Neon, Blob, videofiler och publicerings-/spelarhistorik omfattas
inte av automatiken. Webbchattens historik finns endast i minnet.

Den kanoniska privata mappen är `arkiv/`, ignorerad av Git och vanliga
sökningar. Varje rotationsomgång sparas under
`arkiv/YYYY-MM-DD/retention-UUID/<ursprunglig-sökväg>` med manifest och SHA256.
Arkivering flyttar data på samma disk och frigör inte totalt diskutrymme.

Kör från repots rot i en aktuell arbetskopia där PR #96 ingår:

```powershell
# Förhandsvisa utan att flytta något
node tools/retention-archive.mjs
# Verkställ lokal arkivering enligt policyn
node tools/retention-archive.mjs --apply
# Förhandsvisa återställning av en faktisk arkivomgång
node tools/retention-archive.mjs --restore arkiv/YYYY-MM-DD/retention-UUID
# Återställ genom kopiering; befintliga mål skrivs aldrig över
node tools/retention-archive.mjs --restore arkiv/YYYY-MM-DD/retention-UUID --apply
```

Byt platshållarna mot manifestets verkliga katalog. Återställningen bevarar
arkivkopian, och även en avbruten arkiveringsomgång kan återställas.
Våra tester använde syntetiska filer; ingen verksamhetsdata arkiverades som prov.


## Dokumentets ansvar

Detta är den kanoniska översikten över AI-agenternas flöden. Uppdatera denna
fil när ingång, modell, roll, behörighet, datakälla eller avatarväg ändras och
lägg en kort daterad rad i ändringsloggen. Leveransstatus och acceptans ägs
fortfarande av [CLOUD-MIGRATION](../CLOUD-MIGRATION.md) och
[handoffen](../JOHN-HANDOFF.md); detta är ingen separat migrationslista.
[Miljövariabler](../ENVIRONMENT-VARIABLES.md),
[OpenClaws guider](openclaw/README.md) och
[kunskapspaketet](../../open-claw/lab/deploy/runtime-bundle/README.md)
behåller sina tekniska kontrakt.

En flytt eller redigering av den här filen ger inte agenten nya kunskaper eller
behörigheter automatiskt. Den direkta webbchatten får sitt sammanhang genom
serveradaptern. Gatewayrollerna får sitt lilla versionsmärkta kunskapspaket
vid containerstart; godtyckliga Markdown-filer läses inte automatiskt.

## Chattens uttryck

Jakobs riktning, 13 oktober: diskret ingång och få fasta texter. En öppnad
chatt kan vara stor och visuellt stark. Visa namn, konversation och inmatning;
lägg modellnamn, lägesförklaringar och tekniska detaljer bakom ett val som
Detaljer. Korta svar är normalfallet; utveckla när användaren ber om det eller
när uppgiften kräver det. Visa fel där de uppstår. Visa mål och konsekvenser
för destruktiva åtgärder i bekräftelsen, i stället för återkommande varningstext
runt vanlig chatt. Behåll tillgängliga etiketter och fungerande kontroller.

Undersökning: ingen granskad instruktion kräver övertydlighet eller långa
svar. Adminrobotens modellprompt i PR #82 säger redan "Reply in concise
Swedish". Den sociala Gatewayrollen säger "Speak briefly in Swedish".
PR #98 flyttar modell och täckningsinformation till Detaljer och behåller
en kort introduktion. Konsekvenser visas i den separata granskningsdialogen.

## D-ID i den publika Scoutguiden

Den befintliga agenten `v2_agt_UuD7CYFA` återanvänds, med befintlig svensk
röst och domänbegränsad publik Client Key. Ingen ny agent skapas.
D-ID är ett separat presentationslager ovanpå webbchattens svar. En
API-nyckel ensam skapar ingen avataranslutning. Anslut med Agent ID och Client Key
begränsad till avsedda domäner. DID_API_KEY förvaras på servern.
Webbchatten kan skicka sin färdiga svarstext till SDK:ts speak-funktion och
visa videoströmmen i en videoruta. Modell, N1-behörighet och skrivfunktioner
stannar i sajtens befintliga serverflöde.

Rekommenderat första prov: valbar knapp för röst/avatar, svenska repliker,
mobil och desktop, avbrutet svar, stängd panel och kontobyte. Koppla ner
anslutningen när avatarläget stängs; behåll textchatten om videotjänsten
misslyckas. Följ användning och kostnad innan rösten aktiveras brett.
Agenten är verifierad som redo; verktygslistan och kunskapsbasens dokumentlista
är tomma. Den befintliga nyckeln accepterar produktionsdomänen men inte lokal
QA. Riktigt Luna-svar och växling mellan publik chatt och N1 är lokalt provade.
Publika textsvar är även verifierade i produktion efter PR #103. Publicerad
avataruppspelning återstår; anslutningsfelet och rättningen beskrivs överst.
SDK laddas först när chatten öppnas. Stängd panel, sidbyte, dold flik och två
minuters inaktivitet stänger anslutningen. Textchatten fungerar vid avatarfel.
Endpointen har begränsningar per serverprocess, inte en global användningskvot.
Se [D-ID:s SDK](https://docs.d-id.com/reference/agents-sdk-overview).

För detta upplägg används `agentManager.speak({ type: "text", input: svaret })`.
Det är backendens färdiga svar som skickas för tal/läppsynk. D-ID:s eget
`chat()`-anrop gör i stället modellgenerering och används inte i denna väg.
Modellval, systeminstruktioner, samtalsminne och sidkontext ägs av vår backend,
med Gateway eller direkt modelladapter enligt flödet ovan. Kunskapsfält hos
D-ID lämnas tomma där de är valfria; profilens namn, avatar och röst räcker
som presentationsinställningar. Formulärfält som tjänsten kräver ändrar inte
denna ansvarsfördelning. API-nyckeln ska inte läggas i klientkoden.

## Ändringslogg

| Datum | Ändring och skäl |
| --- | --- |
| 2026-10-16 | Integrationsgranskningen rättade klientundantaget så beroende-/schema-/konfigurationsfiler fortfarande kräver migrationskontroll. Admins testplan kontrollerar nu faktisk globexpansion och har ett negativt prov för bortfallen Studio-täckning. Sidochattens förenkling ingår i den befintliga PR185-leveransen; aktuell slutstatus finns i JOHN-HANDOFF. |
| 2026-10-16 | Lokala commits använder fokuskontroller; hela regressionen ligger i CI/explicit fullkörning. 135 dubblerade Studio-testval ersatta med automatisk upptäckt; samma 454 testfiler täcks. Systemkartans leveransspärrar borttagna, rapport/evidens kvar. Klient- och test-PR:er slipper live migrationsläsning; server/schema och main behåller den. Agent-talk styrs av arbetsmoment i samma checkout. 54 fokustester och 30 kart-/samordningstester passerade; inga nya föräldralösa tester. Detta är lokal verifiering, inte körd GitHub-CI eller driftsättning. |
| 2026-10-16 | Chef-verktyg, skill och tester använder nu `agent-talk/chef.json`. Den borttagna `.croupier-inbox` läses, migreras eller återskapas inte. Status är fortsatt skrivfri; 12 riktade prov passerar. Ingen chef aktiverades. |
| 2026-10-16 | Delegationsregeln anpassad till aktuella AGENTS: uttrycklig delegation, ärvd modell, kort komplett scope och huvudagentens Git-/integrationsansvar. Verifierat ersatta sidor/tester får avvecklas med bevarade kontrakt och regressionstäckning. PR152/C6-kvittot daterat som historik; dagens status länkas till befintlig tracker/handoff. Ingen systemkartbaslinje, produktkod eller drift ändrad. |
| 2026-10-16 | Importgränsen rättad från tio till 30 osparade filer enligt `DEALER_IMPORT_LIMITS.maxFiles` och befintligt regressionstest. COMPANION-guidens gamla arbetsbranch ersatt med featurebranch → grön PR → main enligt repositorypolicyn. Ingen runtime- eller behörighetsändring. |
| 2026-10-15 | PR149–152 levererade på main `3da92370`. Samordnarens läsande produktionsprov verifierar rumshistorik, portaler, negativa länkar och Avbryt-fokus; lokal fullhook, CI och drift hålls isär. Kvarvarande login-/skriv-/zoom-/spelargränser står öppna i befintlig tracker/handoff. |
| 2026-10-14 | Aktiva ingångar och bolagssluggar samlade i användarguiden efter produktionsprov av 22 adresser och fem query-/guidevarianter. Äldre Control-länkar skiljs från adminverktygens mål och efterföljande inloggning; N1 behåller sin roll på partner-/spelarytan. API- och spelstartkontrakt bevarade. |
| 2026-10-14 | Jakobs riktning om N1-åtkomst överallt verifierad med LLM i produktion: samma inloggning öppnar spelaryta, partnerlista med fyra bolag och admin. Partnerformuläret är en separat N2-ingång; dess avvisning av N1 ska inte beskrivas som saknad åtkomst till partnerportalen. |
| 2026-10-14 | Återansluten webbläsare: två D-ID-svar och talvideo med ljud aktiverat verifierade på produktion utan kodöverlagring. Angivna testuppgifter sparade lokalt och i Vercels tre miljöer. LLM visar N1 och nekas partnerlogin; positiva N2/N3-prov behöver andra konton. |
| 2026-10-13 | PR #105 ersatt av #109 och levererad efter verifierad GPU-dygnsbudget 20 USD. Produktionsprov hittade SDK 3-fel i vilovideoläsningen; rättat och mergat i #111 med grön CI. Tio HTTP-ingångar, riktigt textsvar och nekad anonym adminåtkomst dokumenterade separat från kvarvarande hörbar avatar-/N2/N3-acceptans. |
| 2026-10-13 | Engångsuppföljning efter PR #103: verifierad publicering, publika Luna-svar och separat N1 dokumenterade. PR #105 rättar anslutningsordning, autoplay och sidpolicy. Kvarvarande avatar-/rollacceptans anges uttryckligen; webbläsaranslutningen bröts vid kontobytet. |
| 2026-10-13 | Publik D-ID-Scoutguide implementerad separat från N1 enligt Jakobs nya mandat. Befintlig agent, Luna 6 low, inga interna verktyg. Kod/test skiljs från ännu återstående publicerad avataracceptans. |
| 2026-10-13 | Slutligt flöde från PR94/96/98 infört: alla tre webbchattlägen endast N1, registerläsningar, granskade skrivningar, dealerimport och återställbar lokal arkivering. Tidigare uppgifter om publik chatt, saknad Sol 6.1 och manuell dashboardinloggning ersatta. Mergeagentens driftkvitto skiljs från kvarvarande full N1-acceptans; D-ID-avsnittet bevarat. |
| 2026-10-13 | Elva OpenClaw-guider flyttade från open-claw/lab/docs till docs/AI/openclaw. Fyra gamla filer innehåller enbart hänvisningar för runtimepaketets/kartans befintliga referenser. Aktiva länkar flyttade; runtimekod, promptpaket och tjänster oförändrade. |
| 2026-10-13 | Gemensam ingång docs/AI/README.md med daterad Render-inventering och skillnad mellan drift, Astrid-prov och Slack-förslag. Falskt påstående om saknad produktintegration borttaget ur OpenClaws rotguide. Dashboardguiden tar med N1-ingången från main 579c47e3, där PR #83 redan ingår. |
| 2026-10-13 | Systemkartans verkliga CI-användning och 64 varningar på main 579c47e3 dokumenterade i docs/system-map/README.md. Inga baslinjer nollställda. 84 tidigare länkar klassificerade; utvidgad granskning hittade och rättade tre gamla Markdown-ankare. |
| 2026-10-13 | D-ID-vägen preciserad: egen agentbackend äger svar, modeller och minne; avatar-SDK använder speak med färdigt svar. Ingen D-ID-implementation eller betald körning gjord. |
| 2026-10-13 | Flödesschemat från huvudchattens tillfälliga visualiseringsunderlag placerat i docs/AI/scoutgaming-agentflode.md. Ursprungliga sakuppgifter bevarade, med tydlig gräns mellan pågående kod och driftbevis. Arbetsoriginalet behålls medan huvudchatten arbetar. |
| 2026-10-13 | Länkar till den kanoniska översikten tillagda i rotguiden och OpenClaws dokumentindex. AGENTS och CLAUDE medger denna AI-översikt som undantag från regeln om fem huvudfiler. |
| 2026-10-13 | Trasig länk till socialt prov i användarguiden ersatt med docs/AI/openclaw/SOCIAL-CHAT.md. Inaktuell uppgift om ingen runtime-injektion i Cursor-regeln ersatt med den befintliga kunskapspaketsvägen. |
| 2026-10-13 | Jakobs riktlinje om diskret chatt och korta texter dokumenterad, samt nästa steg för en valbar D-ID-avatar. Inga produktbehörigheter eller agentroller ändrade. |

Guiderna är nu samlade under docs/AI/openclaw; deras gamla innehållskopior
är borttagna. Fyra korta kompatibilitetshänvisningar återstår. Ingen
Gatewayroll har avvecklats: låg användning är ännu inte verifierad och
rollen croupier-operator används separat i dashboarden.
