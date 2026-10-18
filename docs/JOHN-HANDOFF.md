# Aktuell handoff — Scoutgaming

<a id="dragan-talstatus"></a>

## Lipsync 3: miljöidentitet och avstängt utdelningstal — 18 oktober 2026

Skrivskyddad kontroll 15:11–15:19 svensk tid: Render croupier-v2 använder
croupier-production/main, värd ep-fragrant-meadow-b1qzb0qv, databaserna
croupier_game för spelet och neondb för zonregistret. Main innehåller aktiva
Dragan test och Nordic bet, med Dragan-rumspaket 4. Preview-v2 är en äldre
kopia med Scoutgaming Demo, Swedish Games och bland annat paow-kevin.
Innehållsnamnet bevisar inte Kevin-ägarskap. Båda kopiorna har datavärdet
environment_id=production; värd och Neon-gren avgör faktisk anslutning.
Ingen databas eller anslutning ändrades. Äldre croupier-preview-neon ligger
i personliga Vercel-organisationen och dess main är arkiverad.

Vercels www.scoutgaming.tech och croupier-lab-ui.vercel.app pekade på samma
READY-produktion, main 5778cf8f (PR244), klar 15:10:51 svensk tid.
Kevins kevin-staging var en misslyckad Preview i samma projekt: MISSING_SERVICES
för branchens äldre vercel.json. PR224:s äldre Blob-byggfel rättades redan i
PR225 och senaste produktionsbygget passerade. Preview och Production har
fortfarande samma Render-backend; Preview är inte isolerat. Vercels skyddade
databasadresser kunde inte återläsas. Ingen global bygginställning ändrades.

RunPods API rapporterade 0,5051714402 USD för 15–18 oktober, varav
0,4990273255 den 17:e och 0,0061441148 den 18:e. Båda använda API-profilerna
hör till samma konto, saldo 27,4508002293 USD. Senaste debiteringsperiod var
10:00 UTC; provet 12:35–12:40 saknar fortfarande kostnadsrader. Dess faktiska
slutkostnad är okänd; reserverna är inte debitering. Inga nya jobb startades.

En öppen flik kan behålla planerat utdelningstal efter att tjänsten stängts av.
Servern skiljer nu avstängd tjänst från ogiltig kontext och avvisar starten före
spelmutationen. Klienten återkallar talvalet, behåller text och insatsutkast och
låter spelaren uttryckligen starta igen utan tal. Ingen automatisk start skickas.
Efter ett tvetydigt nätverksfel behålls låsningen och auktoritativ återhämtning;
det går då inte att lova att föregående start aldrig genomfördes.

Isolerat HTTP-prov verifierade oförändrat bord, saldo och transaktionsantal vid
avvisningen samt en enda debitering vid separat vanlig start. Tio klient-/
utdelningstester och befintliga runtimeprov passerade; oberoende granskning
hittade inga kvarvarande blockerare efter nätverksfallet rättats. Detta löser
återhämtning från avstängt tal, inte det tidigare ofullständiga ljudprovet.
Talflaggan är fortsatt 0. Driftsättning av denna återhämtningsändring ska
verifieras separat mot faktisk Render-version.

## Lipsync 3: produktionsprovet avbröts; återställningen klar — 18 oktober 2026

PR242 (bankens HTTP-hämtning) och PR245 (en ytterligare journalreservation)
är mergade. Provet körde main `746905d59bd6a5bc66ae3d52e0defd858a1b1e10`
på croupier-v2 och den nya privata workerimagen nedan. Fryst rumspaket4
för Dragan test jämfördes med paket3: samma presentationsdata, 36 publicerade
videor och samtliga 50 bankkällor med exakta ID/hashar. Paketbytet kräver
ingen ny bank. Rösten var Dragge, `7f95xPL4S3ySZ4OS1pw8`, på Dragan-profilen.

Ett enda chattprov skickades cirka12:35UTC: ”Ulf Lundell är bra.”.
Det var viloposition, utan spelinsats eller utdelning. Worker-ready och
bankkontroll passerades före TTS enligt runtimeordningen. Jakob hörde
”Ulf Lund…” från produktionsprovet; ingen lokal film spelades samtidigt.
Webbläsaren visade därefter ”Svaret kunde inte slutföras.”,12:40:38UTC.
Fullständig ljud-/bildleverans, faktisk bildhastighet och visuell läppsynk
är INTE verifierade. Exakt avbrottsorsak saknas: befintlig klient skrev över
uppspelningskvittot med generiskt fel och serverns stream-catch dolde orsaken.
`bank_length_mismatch` har inte observerats på nytt. Saknade bildrutor,
ändrad pose eller anslutningsfel får inte kallas bekräftad orsak.

RunPod-jobb `a8e69c9e-9d7e-43ee-824b-79f8dba8803f-e1`: CANCELLED,
kö221553ms, execution97628ms. Session `6c5195983a12654f22c45467c982485c`
avslutades/frisläpptes12:40:38.537UTC. Egen endpoint `1d4pnh0hvs8s2d` och
template `sppmr9xejw` är borttagna; stoppguarden avslutad och inga egna
workers kvar. Talflaggan är0, endpointinställningen borttagen och Dragans
profil åter i preparation. Inga andra miljövariabler ändrades vid återställning.
Renderåterställning `dep-dbabtbijnfac73f4nomg` blev live12:43:24UTC efter
Jakobs uttryckliga godkännande. OpenClaw-tjänsterna och den äldre separata
Astrid-endpointen ändrades inte.

Budget `dragan-test-20261017`: sju reservationer, totalt8,4USD, alla avslutade.
Historiken är bevarad och utrymmet för detta extra prov är förbrukat.
Det globala providertaket40USD är oförändrat; ny antagning kräver separat
budgetavstämning. Senaste kända faktiska kostnad före provet0,5051714402USD;
behållna tidigare providerreserver16,403334USD och provreserv2,3333333333USD.
Providerkostnaden för senaste provet är ännu inte slutavstämd; rapporterat0USD
vid stoppkontrollen är inte bevis på ett kostnadsfritt prov. Journalreservationer
och providerreserver ska inte summeras som separata fakturerade kostnader.

Den aktuella klientändringen behåller enbart tillåtna felkoder, start-/bildstatus
och begränsade rutantal i det flyktiga DOM-kvittot även efter yttre felhantering.
Serverns befintliga generiska stream-fel skiljs från felaktiga protokollmeddelanden.
Ingen taltext, token eller godtycklig exception kopieras till kvittot. 68 fokuserade
tester passerade; två valfria riktiga webbläsar-codecprov kördes inte. Ändringen
diagnostiserar nästa avbrott men löser inte en ännu okänd produktionsorsak.
Kvittot ersätts fortfarande vid nästa fråga eller sidladdning och måste fångas
direkt efter ett kommande prov. Serverns interna stream-fel är fortsatt generiskt.

Diagnostiken är levererad i PR244; aktuella drift- och miljökvitton finns överst.
Nästa steg är att fånga den exakta orsaken och avstämma kostnad före nästa
betalda prov. Kontrollera därefter hela meningen och först sedan
tal under auktoritativ utdelning. Lipsync-spåret äger även uppföljningen av
256MiB servergräns mot32MiB klientgräns; viloklippet i detta prov var1,95MB,
så den skillnaden förklarar inte just detta avbrott. Alla kvarvarande problem
ska hållas isär från historiska `astrid-*`/`lissabon-*` filnamn.

Privata provkvitton/skärmbilder ligger i basen nedan under `production-trial-01/`:
`stop-verification.json`, `status-1792327247142.json`, `browser-result.txt`,
`speech-result.png` och `registry-refresh.json`. Ingen full produktionsinspelning
finns; fulla lokala filmer, ljud och körjournaler anges nedan.

## Lipsync 3: lokal bankhämtning verifierad — 18 oktober 2026

Komplettering 18 oktober: ”Ulf Lundell är bra.” har också spelats in genom
den oförändrade produktkompositorn med testrummets sparade lager Lounge · varm
(`87bca397-cf29-4371-bf95-0fb0653472c7`) och Blackjack · Oak
(`f00be01d-fe7c-4a43-85b9-952e378f7331`). Båda Blob-filerna hämtades
skrivskyddat och verifierades mot Neon-posternas storlek/SHA. Projektets
revision var `studio-e1bf984e-2f75-42f7-b7c8-07859ef9f968`.

Webbläsarinspelningar med ljud finns i den privata basens
`local-review-03/layers/composition-desktop.mp4` och `composition-mobile.mp4`:
80 %, 100 % och 120 % av sparad dealerstorlek, cirka 8,5 sekunder per film.
Exporterna är 24 fps, 1280×720 respektive 720×1280, avkodade utan fel.
`context.json`, `module-hashes.json`, `browser-receipt.json`,
`mobile-browser-journal.txt` och `composition-verification.json` anger
lager, kodhashar, händelsetider och exporthashar. Granskning på
`http://127.0.0.1:8766/layers/`; port 8765 är avslutad.

Detta använder den redan renderade talfilmen och en simulerad viewportadapter,
inte en ny live-session. Källrutans mun målas först; gemensam inramning,
nyckling och scenplacering kommer efteråt. Ingen ny visuell acceptans av
läppsynkens kvalitet eller verifiering av serverkort/pengar följer av detta.
30 fokuserade tester för komposition och frame-layer passerade; det valfria
externa webbläsar-codecprovet i testsuiten kördes inte. Inga nya TTS-anrop gjordes.

Aktuell miljö- och debiteringskontroll finns överst. Ett nytt driftprov kräver
färsk kumulativ budget/journal,
en avgränsad endpoint med stoppguard och kontroll av bankhämtning, minst 30 fps,
ljud/rutbindning samt fel/avbrott innan tal öppnas i det särskilda testrummet.

Ett nytt lokalt HTTPS-prov reproducerade `bank_length_mismatch` i workern
med ett korrekt chunked-svar redan vid bankkvittot. De tidigare testerna
avvisade bara det felaktiga fallet med både Transfer-Encoding och
Content-Length. Molnprovets exakta svarshuvuden saknas fortfarande;
detta bevisar en lokal protokollbrist, inte dess exakta orsak i produktion.

Workern avkodar nu chunked före kontroll av jobbets exakta storlek och
SHA-256. Samma TLS/origin, inga redirects eller komprimerade svar, tidsgränser,
avbrott och atomisk cache gäller. Blandade längdhuvuden, trasiga/avbrutna
chunkar, för stor kropp, fel hash och framing i trailers avvisas. Chunkrader
och trailers har egna storleksgränser. Inga dependencies eller modeller ändras.

Lokal verifiering i befintlig WSL/Python3.12.3: 54/54 workerprov passerade,
inklusive riktig MuseTalk-/vendor-kod på CPU med fyra beräkningstrådar,
utan skips eller GPU-start. De tio hämtningstesterna täcker även giltiga
chunkar, metadata, felaktig inramning samt timeout/avbrott vid rad, kropp
och trailers. Ordinarie releasekontroll ingår i workersviten.

Den fulla befintliga Dragan-banken överfördes också via tillfällig lokal
HTTPS/chunked: kvitto1045byte och arkiv594432000byte. Hämtning14,720s,
efterföljande ordinarie bankverifiering2,686s: 50klipp och2479poolrutor
med oförändrade ägar-/käll-/filhashar godkända. Originalen lästes enbart;
testservern och den temporära kopian/extraktionen är avvecklade.
Privat kvitto: `C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/local-bank-http-receipt.json`.

PR242 är mergad som `efdad149d741dbe7b50a7725b39b58ead35e1b05` efter grön
dealer-regression, worker-, container- och GitGuardian-kontroll.
Förseglad workerrelease: `c8ba8f3c81315d172e292fa5316fca66d289f219ab7c3672b97201a3a5ed653f`.
GitHub Actions `39120838837` har byggt och publicerat den privata imagen
`ghcr.io/jakeminator123/moving-gpu-worker@sha256:178c3459460980e979f679837d6a0c52cc34202fb64fb3da86fcc6403bffc127`.
Publiceringskvittot bekräftar samma commit/release, CPU-bygge och isolerade
importer/tester. Imagen användes senare i det avvecklade produktionsprovet ovan.
Ingen ny endpoint, moln-GPU, talaktivering eller budgetändring ingick i själva
det lokala bank-/publiceringssteget.

Nytt lokalt offlineprov med aktuell motor/frame-contract på RTX3060 gav
”Jakob är kung.” över 66 exakta källrutor. 50 talrutor tog 4,560s (11,0fps),
första bilddelen 1353ms, uppvärmningsmätning 12,7fps. Produktionskravet
30fps är oförändrat och uppnåddes inte. En färdigrenderad film är därmed
verifierad; realtidsdrift och visuell läppsynksacceptans är inte verifierade.
Tre containersökvägar anpassades endast i en privat kopia av `rorlig.py`.
Modell- och bankhashar verifierades före laddning. Härledningen har 66 klipp-
rutor plus den verkliga vilobilden: källklippets ruta0 är fullbankens poolruta421,
inte poolruta0. Den äldre extraktionsmappen saknade `pool.mp4`; fullarkivet
var intakt och användes utan ändring. Avbrutna prov är sparade i körjournalerna.

Privata filmer, original/jämförelse/närbild, granskningsvy och tidsstämplade
kvitton finns under
`C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/local-review-03/`.
Se den uppdaterade lokalguiden i `docs/AI/lipsync-lokalt-2026-10-17.txt`.

Jakob begärde därefter ”Ulf Lundell är bra.” under självutdelning. Ett nytt
ElevenLabs-anrop med verifierad Dragge-röst gav PCM24k mono1,393208s. Neon
lästes skrivskyddat 11:03:04UTC: samma röst/modell/inställningar, profilen i
`preparation`, klipp `d9c7fefb-141c-4809-aecf-3904392f22f5` = Kevin posdealer-iv,
`deal.dealer`/`dealer-up`, originalhash
`061e82f2d4be69d3a73a2e6842692eb2d23c7b7e11fcd9d246fbb0c85e9f72c0`.
Källvideons hash och dess66 avkodade rutor matchade bankens poolrutor2126–2191.
51 talrutor, plan8–58, tog5,804s (8,8fps), första bilddelen1542ms.
Ny video-SHA `2b9a07591fa2f39657d8d7b320e52dd242f62702480b50725747f062aa0ffa10`.
Separat privat prov finns i `ulf-lundell-dealer/render/` under samma bas;
granskningskopian ligger i `local-review-03/ulf-lundell/`.
Båda provens MP4-filer avkodades utan fel. Webbläsaren spelade hela2,75s;
bildrutestegning verifierades efter att den egna lokala granskningsservern
fick HTTP Range-stöd. Inget av proven är visuellt godkänt eller realtidsklart.

RunPod lästes åter 10:55:39UTC: rapporterat 0,502929440146545USD inklusive
kontots podkostnader konservativt. Senaste jobbets endpoint redovisar ännu0USD;
providerlagg är möjlig. Tidigare reserver plus senaste provets reserv behålls:
16,403334USD. Alla13 tidigare moving-endpoints är raderade med noll workers;
senaste template är raderad, Astrids endpoint kvar på min0/max1. Neon-journalen
och ElevenLabs-faktureringen ingick inte i denna kostnadsavläsning. Nytt molnprov
kräver därför fortfarande färsk journal-/profil-/bank-/budgetkontroll under
befintligt totalt40USD-tak och en egen avvecklingsguard; gamla startbesked gäller inte.

## Dragan: avslutat diagnosprov, bank_length_mismatch — 18 oktober 2026 10:10 UTC

Detta var slutläget efter molnprovet, före den lokala HTTP-rättningen ovan.
Ingen GPU eller fortsättningsbevakning lämnades igång. Jakob önskade en bra
överlämningspunkt. Den dåvarande leveransen ändrade bara handoffen.

**Verifierat:** PR240 är mergad och appen körde
`209d62f436786f9dae69c7ee6f1b256253ab6805`. Diagnostikimagen från PR238
är publicerad och använd i provet: image
`sha256:3ede7d24fd7885f2a8ffcd1ad4798d2d1caa8799f926c610b576d196cc92db6c`,
release `3bec5b4be9954d929fcc60d281b89981a7be3d7a9027008466c240b90c1e44ad`.
OpenClaw svarade exakt "Hej Jakob, nu testar vi ljudet.". Budget/admission,
nyckelåtkomst och workerstart passerades. Ingen spelinsats gjordes.

**Bekräftat fel:** RunPod-jobbet
`878f6561-7d54-4203-a091-cf4935386642-e1` väntade 214835 ms och exekverade
1328 ms. Providern rapporterade COMPLETED men output var
`status:failed, code:bank_length_mismatch`. Render loggade kvitto-GET200
10:06:14.906Z; inget efterföljande arkiv-GET. Browsern tog emot noll ljud-/
bildbytes och ingen worker-WebSocket. Detta är inte ett lyckat talprov.
`services/moving-gpu-worker/bank_download.py` använder samma felkod för
otillåten transfer/content encoding, fel Content-Length och för stor kropp.
Exakta svarshuvuden fångades inte. Chunked är en hypotes, inte fastställd orsak.
Det nya utfallet stärker underagenternas statiska kvitto-/framinganalys;
deras procenttal är bedömningar, inte ytterligare runtimeprov.

**Avvecklat:** guarden stängde 10:06:20.952Z. Oberoende återläsning
10:10:08.646Z verifierade endpoint `4aissnsig9exnz` och template `vcd0ebcbmw`
404, tom workerlista samt terminal/frisläppt session
`a409d4882815adb907e93c6b26846091`. Journalens COMPLETED återger providern,
inte lyckad workeroutput. Renderflaggan0 blev LIVE 10:07:37.980Z via
`dep-dba9k9uq1p3s73armh90` på samma209d. Dragan-profilen är sparad avstängd.
Förbrukad endpointvariabel är borttagen med Save only och återläst;
den körande avstängda deploymenten har fortfarande sitt gamla env-snapshot.
Astrids endpointinställningar min0/max1 och originalmedia är oförändrade.

**Budget:** Jakobs uttryckliga totaltak är40USD. Append-only amendment
`4a6363d5-5e26-4da5-874b-20e4b977dd48` är genomförd: samma budget-ID
`dragan-test-20261017`, journaltak6→7,2USD. Sex reservationer om sammanlagt
7,2USD och två amendments är bevarade; inga öppna sessioner på testendpointen.
Detta är reservationer, inte leverantörsfaktura. Även provets försiktiga
providerreserv2,333334USD ska behållas tills färsk kostnad avstämts.
40USD-godkännandet är klart. Runtime och journal har nu båda7,2USD som
fullt reserverat tak. Ett senare prov kräver avstämd kostnad, motsvarande
ändring av runtimegränsen och append-only journaländring inom40USD;
återställ inte historiken och skapa inte ett nytt budget-ID för att kringgå den.

**Nästa agent:** börja med kvittoöverföringen, inte nya nycklar eller samma
GPU-omtag. Läs bara säkra status-/framing-/storleksfält; exponera inte
capability-URL:er, credentials eller råa undantag. Reproducera relevant
HTTP-beteende offline och rätta det med bibehållen TLS/origin, storleksgräns,
SHA-256, tidsgräns och avveckling. Först därefter granskning, förseglad release,
containerprov och pinnad image före ett nytt kontrollerat talprov.
Faktiskt hörbar röst och visuellt synkron mun återstår att verifiera.

Jakob påpekade dessutom olika videoversioner och idle efter handdragning,
samt en möjlig SHA-/bildrutebindning i Kevins staging. Jämför exakt branch,
video/hash, avatarpaket och frame-index före playbackacceptans; byt inte
media på namn eller ungefärlig längd. Metoden på staging är inte verifierad
i denna omgång. Studio visade referensvalet "Kevin V2 · andning", vilket
ensamt inte bevisar att bankpaket och visad film matchar. Det nu bekräftade
hämtfelet inträffar före användning av videopaketet.

Privat operativ källa (ingen ny publik tracker):
`C:/Users/jakem/.codex/visualizations/2026/10/17/01a14afa-f423-7011-bbdf-30a7f44609d1/budget-resume-checkpoint.json`.
Den länkar terminaloutput, browserresultat, budgetamendment och oberoende
stoppkvitto. Privata helperfiler ska läsas innan återanvändning; den avslutade
guarden eller förbrukade endpointen får inte startas igen. Aktuell worktree:
`C:/Users/jakem/.codex/worktrees/dragan-admission-diagnosis/croupier`, branch
`codex/dragan-bank-failure-handoff`. Merge-agenten och HUVUDAGENT3 har fått
stoppkvitto och deployhållet för övrigt arbete är släppt.

Uppdaterad 18 oktober 2026. Den beslutade strukturflytten är levererad och
verifierad, inklusive rättningen av lokal klippmappning. Inga fler rotflyttar
återstår i strukturplanen. Tal/läppsynk och övriga öppna produktfunktioner är
separata arbeten; hela casinoprodukten är inte slutverifierad.

## HUVUDAGENT4: avgränsad rutinstädning — 18 oktober 2026

Överlämning från HUVUDAGENT3 mottagen; strukturplanen förblir avslutad.
Agent-talk filtrerar riktade pingar och kvittenser från andras statusvyer;
claims och start/slut är gemensamma. Status utan id ger bara översikt,
medan status --all uttryckligen visar hela aktiva kön. Detta är inte sekretess.
Kvittens, köarkivering och egen done behålls; gamla claims frigörs aldrig automatiskt.

Lokal kontroll och CI använder ett gemensamt dokumenturval så granskade
guider inte får olika kontrollnivå av misstag. Okänd kod, runtime-Markdown,
konfiguration, filtypsbyten och main/manual behåller sina kontroller.
Studio-guidens generella tvåspelningskrav och gamla flyttstatus är rättade.
Sidindelningstestet förbereder arkivposter direkt i stället för 41 CLI-starter;
överflöde, samtidighet, fel och återhämtning provas fortfarande via verklig CLI.
Handoffrutinen ersätter inaktuell status inom eget scope och länkar befintliga kvitton.

**Lokalt verifierat:** 38/38 riktade prov i agent-talk, CI-urval, precommit
och leveranspolicy; 515 JavaScript-/TypeScript-kandidater, 0 föräldralösa tester.
Det separata Python-inventariet är inte en verifiering av Python-täckningen.
CI-/driftstatus följer den nya PR:n; inget produktionsprov gjordes i detta pass.
GitGuardian på bas-main 6e781b9d: två öppna incidenter, partiell platsmetadata,
historisk skanning too_large; inga incidenter ändrade.

Övrig testskuld står kvar i CLOUD-MIGRATION. Lipsync 3 äger worker/tal och
sin separata PR242; dess kod, handoff och verifieringspåståenden ändras inte här.
Primärcheckoutens privata/ospårade filer och andra arbetskopior är bevarade.

## Strukturens slutkvitto

Accepterad strukturrevision är **`2ba5bf03437b8f7da8a60d06335831abaf50f162`**,
[PR237](https://github.com/Jakeminator123/scoutgaming/pull/237), ovanpå
[PR236](https://github.com/Jakeminator123/scoutgaming/pull/236). Slutlig
mappkarta och ansvar finns i [README](../README.md#source-and-folder-map).
Neon är produktregister och Blob mediekälla. Källkodens nya rötter ändrar
inte sparade medieidentiteter, publika URL:er eller privata datarötter.

| Kontroll | Verifierat resultat |
| --- | --- |
| CI | [PR-CI 39112069295](https://github.com/Jakeminator123/scoutgaming/actions/runs/39112069295) och [main-CI 39112728886](https://github.com/Jakeminator123/scoutgaming/actions/runs/39112728886) SUCCESS på slutliga revisioner. |
| Lokal klippmappning | Nytt prov av verklig isolerad HTTP-server reproducerade felet före rättning. Efteråt återfinns 17 talposter, 2 native-talposter och 2 filmade tagningar; token saknas ger 401 och autentiserat cloudRuntime ger 404. Ingår i CI. |
| Databas | Isolerad PostgreSQL/omstart/HTTPS i CI; produktionsledger ready med pending=[] kl. 08:53:56 UTC. Required schema 014 är installerat. |
| Frontend | Vercel `dpl_JBah2ng3jCQtKDpk25P4f7MVpqrW` READY på accepterad SHA; 17/17 produktionskontroller. |
| Spelserver | Render `dep-dba8id8ae00c739g70fg` LIVE 08:56:42 UTC på accepterad SHA. Version, health/lobby 200, privata gränser 401, Admin-retur 307 och oautentiserad klippmappning 401 med Bearer/no-store verifierades 08:57:42–43 UTC. |
| Gateway/Director | Gateway på `d55ce412714e9e0c85103358f381098ce3d35077`, normal deploy `dep-dba28hnavr4c73fsf3fg` LIVE 01:45:00 UTC. SIGTERM/ny start utan EPERM eller kvarvarande lease; signerad config.get 200 och connected/applied 01:45:22 UTC. Director på `9f7f415d9896ca05b8c240f210ea64a1c30f2b04`, deploy `dep-dba30r2jnfac73e5err0` LIVE 02:36:29 UTC; health/autentiserat API och signerad Gateway config.get 200/connected/applied verifierade 02:37:34 UTC. PR237/238 ändrar inte Directors byggda kod. Modellval, disk och autoDeploy oförändrade. |

Driftkvittot ovan kommer från mergagentens kontroller, inte en ny körning i
dokumentationspasset. Det autentiserade cloudRuntime-provet gjordes i CI,
inte direkt mot produktion. Gateway/Director behövde ingen ny leverans för
PR237. Grönt CI och dessa driftprov är inte visuell läppsynkacceptans.

Klippfelet berodde på att servern gav clipMapping den nya fysiska roten
medan katalogen behåller `web/public`-alias. PR237 ansluter alla berörda
läsningar till den befintliga filresolvern `publicAssetPath`. Det tidigare
GO:t för PR236 var därför för brett; regressionen är nu rättad och täckt.

## Senaste app- och workerleverans

[PR238](https://github.com/Jakeminator123/scoutgaming/pull/238) levererade säkra
workerfelkoder och den privata diagnostikimagen som användes i provet ovan.
CPU-containerprovet passerade 52/52 tester, inklusive renderaren;
[imagepublicering 39114263475](https://github.com/Jakeminator123/scoutgaming/actions/runs/39114263475)
är SUCCESS. Detta verifierar bygget och publiceringen, inte hörbar röst eller
synlig läppsynk. Den tidigare apprevisionen 4c782b3b var driftsverifierad.

[PR240](https://github.com/Jakeminator123/scoutgaming/pull/240) är mergad som
`209d62f436786f9dae69c7ee6f1b256253ab6805` och skiljer providerredovisningens
godkända totaltak 40 USD från journalens oförändrade schemagräns 15 USD.
Runtime 7,20 USD kan inte ensamt höja den sparade journalgränsen. Samma
budget-ID och historiska reservationer bevaras; aktuell förbrukning och
kraven före nästa prov finns i inledningens stoppkvitto.

[PR-CI 39115861445](https://github.com/Jakeminator123/scoutgaming/actions/runs/39115861445)
och [main-CI 39116605256](https://github.com/Jakeminator123/scoutgaming/actions/runs/39116605256)
är SUCCESS. Main körde verklig isolerad PostgreSQL, omstart och HTTPS på
13,946 sekunder, inklusive blockering utan amendment och exakt en ny
reservation med bevarad historik. Produktionsledger 001–008 och 011–014
var ready med pending=[] och optionalPending=[] 09:53:32 UTC.

Mergagentens egen produktionskontroll 09:56:49 UTC verifierade exakt
209d62f4 på spelservern och Vercel `dpl_8PC4t8tYzTN6WvLZCfrsR7C5fJNu`:
health, startsida och lobby 200, privata Studio-API:er 401 och Admin-retur
307 till inloggning. Studio kontrollerades separat 17/17. Render
`dep-dba9eajm8hqs73b5hj3g` blev LIVE 09:56:12 UTC. Provets senare
avstängningsdeploy på samma kodrevision dokumenteras i stoppkvittot ovan.
Director och Gateway ändrades inte av PR238/240.

Det aktuella diagnos-, budget- och stoppkvittot i inledningen är lipsync2:s
verifiering, bevarad från [PR241](https://github.com/Jakeminator123/scoutgaming/pull/241).
Struktur- och appkvittot är mergagentens tidigare egna kontroller.
Denna samlade dokumentationsleverans kör inga nya GPU- eller spelprov och
ändrar varken HTTP-hämtning, budgetjournal, miljövariabler eller media.

## Avslutsstädning och skyddat lokalt arbete

Förbrukade flyttinstruktioner, aktivitetskort och motsägande väntelägen ska
inte finnas kvar som aktiva uppdrag. Denna handoff ersätter den löpande
flyttloggen; äldre exakta kvitton finns i [Git-historiken](https://github.com/Jakeminator123/scoutgaming/blob/4c782b3be4f49dc5743f27e3af3dfcb52e407939/docs/JOHN-HANDOFF.md).
Ingen ny strukturplan eller parallell migrationslista behövs.

Gamla kodrötter är tömda i accepterad main. En äldre lokal checkout kan
fortfarande visa dem. Synka först efter kontroll av branch, egna ändringar,
ägarskap och eventuella aktiva processer. Radera verifierat förbrukade rester;
bevara osäkra original i det kanoniska gitignorerade `arkiv/<datum>/`.
`lab/data`, `web/data`, OpenClaw-data, env, råmedia, kalibrering och privata
QA-kvitton får inte raderas som en följd av källkodsflytten. Avvecklade egna
worktrees kan arkiveras efter kontroll av opushat och ignorerat arbete;
andra agenters worktrees och claims är inte del av rutinmässig städning.

## Övrigt kvarvarande produktarbete

<a id="2-öppna-kontroller-och-kända-fel"></a>

[CLOUD-MIGRATION](CLOUD-MIGRATION.md#separat-produktarbete-och-öppna-driftansvar)
är den enda listan över öppna produktfunktioner och äldre observationer.
Där finns operatörsledger/rapporter, konto/invite/reset, Admin-/lobbyluckor,
OpenClaw-funktionsprov, medieradering, backup och pausad QA. De innebär
inte att den levererade strukturflytten ska öppnas igen.

Välj prov efter ändrat beteende. Ingen generell manuell spelacceptans eller
ett fast antal spel krävs för vanlig leverans. Auth, rum/bolagsgränser,
revisioner, sparande och serverägda pengar/spelregler behåller täckning.
Hash, waveform och testpass bevisar aldrig synlig läppsynk; exakta
ljud-/videoidentiteter och befintliga godkännanden ska bevaras.

GitGuardian-läsningen inför detta avslut visade 2 öppna och 19 ignorerade
incidenter. Platsmetadata är delvis ofullständig och helhistorikskanningen
har status too_large. Grön produkt-CI betyder inte full säkerhetstäckning;
inga incidenter har ändrats av strukturavslutet.

Begrepp: [TERMINOLOGI](../apps/studio/docs/TERMINOLOGI.md).
Teknisk verklighet: [LOCAL-PRESENTATION-RUNTIME](LOCAL-PRESENTATION-RUNTIME.md).
Konfiguration: [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md).
Återställning: [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md).
