# V2 – kort ändringslogg och nästa beslut

Detta är den korta notisen i repots rot. Detaljer och testkrav finns i
[status- och testplanen](docs/STATUS-OCH-TESTPLAN-V2.md).
Skriv datum, ändring och verifiering här när arbetet går vidare; skilj alltid
förslag från implementerad kod och verkligt godkänd drift.

## 29 september 2026 – Emils V3 arkiverad och mindre containerkontext

Emils inaktiva V3-demo (240 filer, 66 160 426 byte) togs ur arbetskopian.
Hela trädet, inklusive 217 MP4 och egna manifest, kopierades byteverifierat
till `C:\Users\jakem\Desktop\croupier\BACKUP-LAB-to-HUB` med SHA-256-index.
Git-commit `9e2048a6` bevarar en andra återställningsväg. Rotens
`.dockerignore` utesluter nu också redigerbara 3D-källor under
`assets/astrid-3d/` och `assets/blackjack-3d/`; publicerade exportfiler
i `web/public/` behålls. Fyra avvisade 3D-studier (240 filer, cirka 941,9 MiB)
kopierades till arkivet men ligger kvar i repot: automatisk granskning
stoppade borttagning av unika original. Se [städrapporten](docs/REPOSITORY-CLEANUP.md).

## 29 september 2026 – gemensamt Lab och filmad kortvändning

Lissabons kod/start är samlad i Lab. Gamla duplicerade standarder och
oförändrade demoexempel rensas med versionshistorik; privata data och egna
ändringar bevaras. Kevins exakta hole/flip-filmer och deras kortspår används
nu på serverns händelser. Hashverifierad förladdning för nästa film är införd.
492 Lab-tester, typecheck, bygge, full pre-commit och dealerprobe godkända;
två hela rundor verifierade i browser. Förladdat klippbyte: 27–42 ms till
första bild lokalt, ej AI-svarslatens. Jakob avslutade manuella prov med
dagens omfattning begränsad till Astrid; ingen ny fyra-dealer-rehearsal. [Detaljer och återgång](docs/KEVIN-LISSABON-REVIEW.md).

## 29 september 2026 – fristående granskningspaket

93 spårade QA-/visningsfiler, 129 504 739 byte (cirka 123,5 MiB), togs bort
från `assets/blackjack-3d/review/` och
`web/public/review/astrid-a9fa1da6/`. De saknade runtime-, test- och
byggberoenden och finns i commit `f31b219e`. Aktiva källmodeller,
dealerfilmer och V2-releasekopior behölls. Se [städrapporten](docs/REPOSITORY-CLEANUP.md).
41 lokala dokumentlänkar, dealerbaslinjen, tre handkontaktprov och
bordstillgångstestet passerade. Ingen ny visuell dealeracceptans gjordes.

## 28 september 2026 – systemkartan till docs och lagringskontroll

Den aktiva systemkartans 16 filer flyttades med bibehållet ämnesträd till
`docs/systemkarta/`; den gamla 956-byte vägvisaren togs bort. Aktiva länkar
uppdaterades. Två representativa Emil-MP4 gav högst 0,06 % besparing med
förlustfri gzip, så videorna kodades inte om eller flyttades. Storlekskartan
och bevarandeskälen finns i [städrapporten](docs/REPOSITORY-CLEANUP.md).
390 relativa länkar i 33 berörda Markdownfiler kontrollerades utan fel;
mediefilerna är orörda.

## 28 september 2026 – referensmappar och Emil-media

Sex historiska Sunny-filer i `reference/` och en daterad observation i
`random-stuff-jakob/` togs bort ur arbetskopian: 7 spårade filer,
2 056 589 byte. Alla finns i `Jakobs-v1`; inga körberoenden hittades.
[Emils nya vägvisare](emil/README.md) skiljer aktiv `dealklipp-v1` från den
inaktiva V3-referensen. SHA-256-jämförelse av 260 MP4-filer hittade inga
identiska videor; V3:s enda exakta dublett är en manifestrefererad startbild
som bevaras för referenspaketets helhet. Privata loggutdrag och media är orörda.
Se [städrapporten](docs/REPOSITORY-CLEANUP.md).
Länkar, manifestets 218 referenser, aktivt mediemanifest och pre-commit passerade.

## 28 september 2026 – avgränsad repostädning

Efter checkpointen `e03b5d0` togs 28 oanvända spårade filer bort (151 085 byte):
V3/V4-planerna, två inaktiva Cursor-regler, tre engångsdokument och Astrids
historiska motorinventering. Aktiva ingångar och länkar pekar nu på V5,
GitHub-migrationen eller bevarad `Jakobs-v1`-version. Se
[städrapporten](docs/REPOSITORY-CLEANUP.md) för filgrupper, beroendekontroll,
verifiering och återställning. Worker, media och privata data ändrades inte.
Länkkontroll, `git diff --check` och hela pre-commit-kedjan passerade.

## 28 september 2026 – GPU-policy och kontroll av städning

### Checkpoint före större ändringar

Jakob begärde att hela aktuella kod-/dokumentläget sparas och pushas innan
större omarbetning. Städ- och workerchatten pausade sina skrivningar under
checkpointen. Även deras nuvarande moln-/streamingarbete ingår i snapshoten;
privata/ignorerade data, credentials och separata worktrees ingår inte.
40 riktade moln-/streamingtester passerade vid checkpointkontrollen, inklusive
HTTP-fixturen som tidigare blockerade dokumentcommitten nedan.

Kvar att besluta/rätta före imagepublicering: nya manuella workflowen och
GPU-testdokumentet anger `ghcr.io/jakemanator123/astrid-gpu-worker`, medan
repoägaren är `Jakeminator123`. Mål/ägarskap ska bekräftas och göras konsekvent
innan workflowen körs. Ingen image har publicerats av checkpointen och ingen
GPU eller molninstans har startats. Detta är en återgångspunkt för pågående
arbete, inte visuellt GPU-godkännande eller färdig driftsättning.

**Dokumenterat förslag, inte aktiverat eller driftsatt.** Inga RunPod-
inställningar, kostnader, spelarlogins eller privata data ändras av denna notis.

### Beslutad inriktning för första testmiljön

- Vanlig inloggning ska inte starta eller hålla en GPU varm. Förinspelade
  dealerklipp och vanligt spel behöver inte ny GPU-generering.
- En autentiserad spelare som uttryckligen aktiverar Astrids AI-läge i
  spelrummet kan få en tidsbegränsad serverregistrerad GPU-reservation.
  Aktivering kräver att operatören har slagit på funktionen och godkänt budget.
- Föreslagen aktivitetsgräns: **5 minuter** sedan senaste godkända spelar-
  handling i det aktiva AI-rummet eller talförfrågan. Närvaro/heartbeat,
  musrörelser, videouppspelning och en inloggningscookie räcker inte.
- Kontrollera närvaro var **30:e sekund**. Vid förlorad anslutning släpps
  reservationen efter **60 sekunder**; denna marginal förlänger inte
  femminutersgränsen. En ny flik får inte skapa en extra worker för samma session.
- När sista aktiva reservationen försvinner: avvisa nya betalda uppdrag,
  avsluta/avbryt kvarvarande uppdrag enligt begränsad deadline och stäng
  worker-sessionen. En spelares utträde får inte stoppa andra aktiva spelares
  berättigade jobb. Kapacitet och rättvis kö måste hanteras av servern.
- Starta piloten med **högst en worker** och inga permanent aktiva workers
  (`active workers = 0`). Det är inte ett löfte om omedelbar service till
  flera spelare: befintlig worker hanterar en replik i taget.
- Föreslagen RunPod-idle-timeout efter avslutat sessionsjobb: **30 sekunder**.
  Det är inte samma sak som rummets inaktivitet. Ett pågående sessionsjobb
  måste faktiskt avslutas; annars börjar inte nedskalningens väntetid.
- Föreslagen sessionsjobbgräns: högst **15 minuter**, med autentiserad
  förnyelse mellan repliker endast vid fortsatt aktivitet och återstående
  budget. Verifiera samspelet med befintlig worker-TTL och RunPod-timeout.
- Kostnadsspärr och total testdeadline gäller även om alla spelare fortsätter
  vara aktiva. Ha serverägd avstängning/watchdog och kontrollera efter stopp
  att inga jobb eller varma testworkers är kvar. Max workers är inte ett USD-tak.

GPU-vila ska **inte logga ut spelaren från kontot**, radera sparande eller
avbryta spelets ekonomiska transaktion. Visa ”AI-rösten vilar – aktivera igen”.
Vid kallstart visas ”Astrid förbereds”; inga falska ready-signaler eller
automatiska andra betalda försök. Säkerhetsutloggning och eventuell automatisk
utgång ur ett blackjackrum är separata produktbeslut, inte GPU-kostnadskontroll.

RunPods aktiva workers och idle-time debiteras även utan inferens. Ovanstående
tider är våra startvärden för test, inte uppmätta optimala inställningar.
[Officiella endpointinställningar](https://docs.runpod.io/serverless/endpoints/endpoint-configurations).

### Det vi kan göra utan ett betalt GPU-prov

1. Testa reservationerna med falsk klocka: flera flikar/spelare, bortkoppling,
   inaktivitet, serveromstart, pågående replik, ny aktivitet och budgetstopp.
2. Färdigställa den andra agentens skyddade WebSocket-/molnkonfiguration.
   Fördela miljövariabler per tjänst; skriv exempel med tomma värden.
3. Förbereda mätpunkter för AI-text, första TTS-ljud, GPU, kodning och första
   uppspelning samt tydliga UI-lägen. Publicera ingen sekretessbelagd text i logg.
4. Förbereda versionsbunden imagepublicering och testprotokoll. Vercel och
   extern/betald driftsättning får vänta på mål, budget och åtkomstbeslut.

### Kontroll av det som raderats

Avstämt mot `22976fc` före denna dokumentändring:

- Inga nya borttagna spårade filer i vare sig arbetskopia eller Git-index.
  De synliga ändringarna gäller pågående moln-/streamingkod och lämnas orörda.
- De senaste dokumenterade raderingarna är våra tidigare städcommits
  `74409cb` och `b3e830a`, inte en ny radering identifierad från Jakob.
- Ingen återställning behövs utifrån denna kontroll. Git kan däremot inte
  visa om en tidigare ospårad eller ignorerad fil har tagits bort manuellt.
  Detta är inte en fullständig hälsokontroll av alla lokala filer eller drift.
- Mediemanifestets läsande kontroll passerade: 43 objekt i 26 familjer.
- Försöket att committa denna dokumentation stoppades av ordinarie pre-commit:
  streaminggruppen hade 20 godkända och 1 misslyckat test. Det riktade
  HTTP-provet startade inte sin fixture: `generated_speech_stream_not_configured`
  från den samtidigt ändrade `web/server.mjs`. Ingen kontroll kringgicks.
  Detta är ett separat fel i pågående streamingintegration, inte belägg för
  raderingsskada. Dokumentationen är sparad lokalt men ännu inte levererad
  som commit vid denna notis.

`random-stuff-jakob/astrid_motorklipp.txt` finns kvar, är Git-spårad och
oförändrad mot HEAD (cirka 16 KiB). Det är en historisk JSON-inventering med
19 motorklipp och 6 staged-takes, inte aktuell konfiguration eller GPU-kod.
Ingen runtime-referens till filnamnet hittades; systemkartans
`ASTRID-LIVE-2026-09-21.md` refererar till den som historiskt underlag.
**Rekommendation: den kan tas bort i nästa avgränsade städning**, om den
referensen samtidigt pekas till `Jakobs-v1`. Filen lämnas kvar i denna kontroll.

Fler möjliga städkandidater: importerad gammal GitLab-CI och duplicerade
deploymentinstruktioner i worker-katalogen när GitHub-publiceringen ersatt dem;
tomma/genererade testbyggen när ingen agent använder dem. Radera inte
`services/astrid-gpu-worker/gateway`, dess testverktyg, avatarer/modeller,
aktiva manifests, `.env` eller data-mappar. GPU-worktreen behöver jämföras
mot huvudbranchen och därefter arkiveras med återställningsmöjlighet.

### Tidigare levererat

- GitHub-only branch, v1-ankare, CI och pushskydd.
- Godkänd radering av gamla inboxen, testcache och historiska dokument.
- Importerad och bearbetad Emil-worker, syntetiska streamingtester och
  CPU-imagebygge. Verklig GPU-latens och visuell läppsynk återstår.
- Skyddad molnstart/inloggning förberedd; faktisk molndrift återstår.
- Samlad lägesbild/testplan i `22976fc`.
