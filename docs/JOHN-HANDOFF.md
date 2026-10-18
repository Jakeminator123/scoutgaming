# Aktuell handoff — Scoutgaming

## UX/UI: första Admin-klippkartan — 19 oktober 2026

Dokumentationsförslaget [PR260](https://github.com/Jakeminator123/scoutgaming/pull/260)
är mergat. [TERMINOLOGI](../apps/studio/docs/TERMINOLOGI.md) är fortsatt den
enda produktmodellen. UI-leveransen ligger på `codex/admin-clip-map`, från
main `14d47c24`; Lipsyncs senare handoff är bevarad.

`/admin/clips` visar kategori → situation → standardklipp och varianter.
Sju spelarplatser hålls isär från dealerns öppna, dolda och vända kort.
En plats visar inte längre grannplatsernas sparade standarder som varianter.
Vila skiljer basloop från beteendeklipp; inspelat tal visar originalljud,
exakt text och språk. Klipp, scenförhandsvisning och befintlig scenredigering
har gemensam navigation. Osparat tal har en synlig väg tillbaka till formuläret.
Befintliga exakta klipp-ID:n, skrivare och revisions-/publiceringsgränser används.

Verifierat: 48 fokuserade tester, frontendens typkontroller och byggning;
isolerat webbprov av platsval, klippkoppling, sparbekräftelse, återläsning,
bas/beteende, inspelat tal och bevarat talutkast vid panelbyte. Scenpanelen
öppnas; inga verkliga spel-, media-, publicerings- eller OpenClaw-prov ingår.
Den befintliga byggningen varnar fortfarande om CSS `composes` i äldre teman.
Full CI hittade navigationstestets gamla knappnamn. Testet använder nu
Scen & lager och behåller kontrollen av utkast, kontext, Back/Forward och omladdning.
Oanvända UI-konstanter, kategorifilter och ersatt knapp-CSS har tagits bort.

Fria kort-/markerankare, PNG-idle, generell chattregeleditor och exakt var
åttonde utdelning per box finns fortsatt bara i förslag/demo och kräver egna
spar-/runtimekontrakt. HUVUDAGENT5 äger namn/importmappning; Lipsync 3 äger
medie-/taluppspelning. Denna PR ändrar inte dessa kontrakt eller någon databas.
Teknisk referens: [BLOB-NEON](storage/BLOB-NEON.md).

Demoer finns privat i `C:/Users/jakem/Desktop/STUDIO JÄMFÖRELSE/demoer/`;
arbetslogg och kvarstående körordning i `PROVISORISKT/UX-KLIPPKARTA.md`.
GitGuardian på aktuell main: två öppna incidenter (38318914, 38318915),
partiell platstäckning och historisk skanning `too_large`; inte åtgärdade här.

<a id="dragan-talstatus"></a>

## Lipsync 3 — verifierad slutstatus 18 oktober 2026, UTC

Dragan talar med källbundet ansikte under självutdelning i det isolerade
rörelseprovet. Jakob godkände **enbart filmen med hash nedan**. T6 verifierade
senare två vilorepliker i produktion, kall modell följd av varm återanvändning.
T6 prövade ingen DEAL, insats eller saldoändring och fick inget nytt visuellt
godkännande. Provresurserna är avvecklade och talflaggan är åter av.

[Runtimeguiden](LOCAL-PRESENTATION-RUNTIME.md) beskriver tekniken;
[TERMINOLOGI](../apps/studio/docs/TERMINOLOGI.md) är enda produktmodellen.
[Historiskt detaljkvitto före förkortning](https://github.com/Jakeminator123/scoutgaming/blob/0ff9467d3230c30219126ee9b2c87b2724220529/docs/JOHN-HANDOFF.md#dragan-talstatus) och
[privat backup](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/final-documentation/lipsync3-detaljkvitto-0ff9467d-2026-10-18.md) bevarar hela föregående avsnitt:
äldre prov, amendmenthistorik och exakta kvitton. De är historiskt underlag, inga extra aktiva guider.

### Leverans och exakta bindningar

Modellcache och varm antagning är levererade i PR255–257. T6 körde PR262:s
`4cee9bc20254f6eaceb9b34271cae8c98b41a56b`; www och Render verifierades på
revisionen 21:23:13 UTC och återställningen efter provet använde samma kod.
Migration **015 applicerades 21:24:12 UTC**: tre CHECK-gränser 15→40 USD,
oförändrad budget-/reservationshistorik och inget nytt beviljat belopp.
**Denna leverans gör 015 obligatorisk** för readiness, Studio och båda
importörerna. 94 fokuserade prov samt verklig isolerad PostgreSQL passerade;
detaljkvittot skiljer dessa kontroller från den daterade appdriften.

| Underlag | Exakt identitet |
| --- | --- |
| Enda visuellt godkända filmen, ”Ulf Lundell är bra.” under självutdelning | SHA-256 `769c5d901775e05ca88773ee3e47174410367ae9c8d0fdb935b4cbcc6080c8f4`, 711 053 byte, H.264/AAC, 1280×720 |
| 50 oförändrade Dragan-källor | source-set-SHA `e49f1e9e9e141d1725c7ea1ec104fddff5d9055db33c4181f2c7a2e9a797ef0d` |
| Rörelsekälla, 66 rutor vid 24 fps | `d9c7fefb-141c-4809-aecf-3904392f22f5`, SHA `061e82f2d4be69d3a73a2e6842692eb2d23c7b7e11fcd9d246fbb0c85e9f72c0` |
| Vilokälla, ruta 0 | `2f3955b0-b450-4cc2-a9f5-ac80f10abd2f`, SHA `2b8d6ea7829bde6212f6145038569747a389c5e20166b3ea08fc26efda81c9e3` |
| Fullbank, 2 479 poolrutor / 594 432 000 byte | SHA `5dcf0f323f707ad6fa58f740a560a1aa62a73b1a6ebeaa916b6b026f6a47f14c` |
| Workerrelease | `5908716a81532d29e8b2e9aece3a8639258a7f56dad2ee3b6d98fcc343d0c08c` |
| Publicerad image | `ghcr.io/jakeminator123/moving-gpu-worker@sha256:eb5a6b4707eaba54839cc562b554ff7a8af37f5897e739a5533f2357f867135a` |

En ändrad ljud-/videohash är en annan tagning; godkännandet ärvs inte.
Lagren är bakgrund → dealer → bord, med serverägda kort och spel-UI ovanpå.

### Senaste produktionsprov och avveckling

T6 `728d0e03-1f46-4ab5-936b-01a99e1dbe1e` gav två naturligt avslutade
svar på Dragan-testbordet. Båda har `mediaCompleted=true` och
`captureComplete=true`, med exakt text-, PCM-, bank-, käll- och releasebindning.

| Replik | Samma A40-worker `nc0qem1vw69ad2` | Mottagna rutor / release-callbacks | Providerkö / execution | Klick→slut, monotont |
| --- | --- | --- | --- | --- |
| ”Ulf Lundell är bra.” | Cachemiss | 57/57 / 44 | 64,805 s / 85,954 s | 164,088 s |
| ”Jakob är kung.” | Cacheträff | 51/51 / 38 | 0,147 s / 25,773 s | 37,176 s |

Motorförberedelsen tog 52,761 respektive 2,180 s. Olika repliker och enstaka
prov ger ingen p95-/hastighetsgaranti. Mottagna rutor, callbacks och glesa
JPEG-bilder bevisar inte att varje ruta visades eller ny visuell acceptans.
Mottagen PCM är inte inspelat systemljud. Det isolerade RTX4090-provet
verifierade även avbrott och ny motor efter avbrott; kvitton finns i paket 2.

Cleanup stängdes **21:59:46.560 UTC**, sju godkända steg utan fel: profil
preparation, fyra egna Render-nycklar återställda med flagga 0, endpoint/mall
borta och inga aktiva workers, öppna reservationer eller levande leases.
Render `dep-dbak20ijnfac73816bsg` var LIVE på PR262. Journalen behåller
**14 avslutade reservationer/16,8 USD**, varav 12 USD för dagen; separat
beviljat totalutrymme är 16,8 USD. Ingen historik nollställdes.
[T6:s resultat](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/production-trial-04/runs/728d0e03-1f46-4ab5-936b-01a99e1dbe1e/two-reply-result.json)
och [cleanup](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/production-trial-04/runs/728d0e03-1f46-4ab5-936b-01a99e1dbe1e/cleanup-receipt.json)
är de lokala kvittona; deras fullständiga hashar finns i detaljkvittot.

### Bevarande och lagring

Fem privata Blob-manifest är fullåterlästa. Länkarna öppnar deras verifierade
lokala kopior; objekten ligger under `croupier/media/dealers/dragan/staging/lipsync-review/`.

| Manifest | Bevarat underlag |
| --- | --- |
| [1. Källor och rörelseprov](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/artifact-preservation/preservation-manifest.json) | Referens-ZIP, käll-/bankreferenser, ljud och granskningsmedia; derivat skiljs från original. |
| [2. Varm cache och avbrott](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/artifact-preservation/warm-cache/plans/warm-cache-1526eeb3-a526-48a7-8e43-d3665ca09d59/manifest.json) | Kompletta A/B/D-resultat, uttryckligen partiellt C-resultat och sanerade kvitton. |
| [3. Historiskt T3-svar](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/artifact-preservation/historical-single-reply/plans/32c15e27-a1e9-472f-a290-9ee11bc04084/manifest.json) | Kompletta medier men ofullständig capture; inget tvåsvarsbevis. |
| [4. T4-svar](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/artifact-preservation/t4-single-reply/plans/3001c02f-ee64-4b7a-9681-aad822af40a3/manifest.json) | Ett komplett fångat svar och 62 passiva JPEG-prov. |
| [5. T6:s två svar](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/artifact-preservation/production-trial04/plans/728d0e03-1f46-4ab5-936b-01a99e1dbe1e/manifest.json) | 94 unika objekt / 28 001 366 byte: två PCM, tio H.264, två sanerade kvitton, 79 unika JPEG med 82 tidsreferenser och manifest. Fullåterläst 22:04:20.559 UTC. |

Emils `lappsynk-export-fe1b55e.zip` är bevarad oförändrad, 145 846 625 byte,
SHA `949443c1084ab3f515792fe66c5e2d381e985f9bdc743e792e5fbca36a9240a3`.
Bevarandet importerade inga API-, SQL- eller env-mallar. Kevins 50
registrerade källklipp behåller originalbytes; det verifierar inte hans privata miljö.
Inga källor flyttas automatiskt. För registrerat spelmaterial är Neon registret
och Blob mediekällan. Bevarandet skapade inga Neon-/Admin-klipp; ZIP, bank
eller råa ansiktspaket hör inte hemma i `/admin/clips` som spelbara klipp.
Inspelade repliker följer `recorded-speech`/`preserve-recorded-audio` med
originalnamn och exakt ljud-/videobindning. Moving-resultat sparas ännu inte
automatiskt i svarsbiblioteket. Manifesten är ingen ny visuell acceptans.

### Kostnad, varm drift och kvarvarande ansvar

Avläsningen **22:00:19.322 UTC** visade **0,8236155684862752 USD** rapporterad
RunPod-kostnad för lästa 20 endpoints och kontots pods under 16 oktober
00:00–18 oktober 22:00:18.918 UTC. T3–T6:s slutdebitering är obekräftad;
tomma billing-listor betyder inte nollkostnad. **35,003335 USD** i
providerreserver behölls, inget frigavs automatiskt. TTS/ElevenLabs och
nätverksvolymer ingår inte. [Kostnadskvittot](C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900/production-trial-04/provider-budget-1792360819748.json)
länkar till fakturaunderlaget. Reservationer är inte fakturor. Jakobs tidigare
mänskliga provtak är återkallat; tekniska journal-/kostnadskontroller består.

**24 timmars varm drift är inte aktiverad eller verifierad.** Nuvarande
antagning kräver min 0/max 1 worker och högst 60 s tomgång; min 1 avvisas.
T6 hade en 720 s provguard. Cachen saknar egen TTL/jobbegränsning men försvinner
med processen eller vid identitetsbyte, fel och avbrott. Ett längre varmtest
behöver eget avgränsat drift-/kostnadsfönster med antagnings-, avbrotts- och städskydd.

Kvar: kortare svarstid, tal under produktionsutdelning, automatisk beständig lagring av moving-resultat, riktig mikrofon-/bild-E2E
och slutlig kostnadsavstämning. 56 äldre generiska `submission_uncertain` är
separat olöst observationsskuld; de har inte rensats eller frikänts.

### Arbetskopior och ägarskap

Primärcheckouten var 21:41:47 UTC på `codex/scout-visual-product-model`,
`7a6fc8a70b7c3b810829c2736ad98bd26fcf9bb1`. Dess sex dirty/oregistrerade poster
`.codex/config.toml`, `.cursorignore`, `.agents/skills/source-command-ping/`,
`.cursor/settings.json`, `a.zip` och `web/` är andra ägares och orörda.
`a.zip` är agentmaterial, inte Emils export. Ingen mass-staging eller städning.
Lipsyncs två arbetskopior är `C:/Users/jakem/.codex/worktrees/lipsync3-server-diagnostics/croupier`
och `C:/Users/jakem/.codex/worktrees/lipsync3-bank-http/croupier`. Studio-beroenden
länkar mellan dem; lämna dem kvar tills junctionens konsumenter är avvecklade.
Huvudagentens slutkontroll identifierade inga egna provprocesser i dessa träd
eller provbasen, inga lyssnare på 8765/8766, och Admins talcheckbox var av.
Impactwins avvecklade `game-engine`/`preview-v2` ska inte återställas;
produktionens `croupier-v2`/main består. Vercel Preview delar produktionsbackend
och får inte antas vara isolerat. Övrigt ägarskap samordnas med HUVUDAGENT5.

## Historiskt Lipsync 2-kvitto

Följande daterade diagnos är bevarat underlag; aktuell status och aktuellt
kostnadsmandat står ovan och ersätter dess tidigare start-/stoppvillkor.
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

[PR243](https://github.com/Jakeminator123/scoutgaming/pull/243) och
[PR246](https://github.com/Jakeminator123/scoutgaming/pull/246) är mergade
efter full grön PR-CI. Strukturplanen förblir avslutad. Agent-talk visar
riktade samtal för berörda agenter, behåller kvittens/köarkiv och kräver
egen done. Delade filer är inte privata och andras claims frigörs inte automatiskt.

Lokal kontroll och CI delar dokumenturval; flyttad klientkod har rätt
migrationsurval. Moving-workerns befintliga CPU/image-workflow ingår i
obligatorisk CI när relevant. Inget generellt tvåuppspelningskrav finns kvar.

Efterfixen flyttar chattens visning, avbrott och beslutade uppspelning till
en importerbar klientmodul. Beteendeprov ersätter regex/VM-utskärning och
källtextassertioner; liveägarskap, dealer/session/revision, exakt media,
textfallback och avbrott behålls. Testnamnet är `test/chat-decision-player.mjs`.
Den extraherade modulen ingår också i serverns och browserns QA-källhashregister;
avvikande bytes eller saknad pin stoppar innan kö eller strömning öppnas.
Studios guide skiljer direkt Next-env från anslutningshjälparens avsiktliga
bakåtkompatibilitet. Inga privata env-/data-/mediefiler flyttas.

**Lokalt verifierat:** 71 passerade beteende-/regressionsprov; två valfria
Playwright-prov överhoppades eftersom browsermodulen saknas i arbetskopian.
Två nya QA-regressionsprov reproducerade hashregisterluckan före rättning;
efteråt passerade 158/158 prov i QA-/chattpaketet, helt utan betalda anrop.
515 JavaScript-/TypeScript-kandidater har inga föräldralösa tester, och
miljövariabelregistret stämmer. Obligatorisk CI följs på efterfixens PR.
Detta är inget nytt produktions- eller läppsynkprov. Lipsync 3:s handoff ovan består.

**Avslutat:** efterfixen levererades i [PR252](https://github.com/Jakeminator123/scoutgaming/pull/252),
merge `2e9b53388636effa42bea27f451845280375b9ef`. MERGE3 verifierade grön
PR-CI och [main-CI 39145319537](https://github.com/Jakeminator123/scoutgaming/actions/runs/39145319537).
Det efterföljande renklonprovet redovisas nedan. Lipsync 3:s arbete och
primärcheckoutens inställningar, råmedia och data lämnades orörda.

## HUVUDAGENT5: renklon och organisationsavslut — 18 oktober 2026

Direktklon av GitHubs main i `C:/Users/jakem/Projects/scoutgaming-clean-20261018`,
fryst på **`2e9b53388636effa42bea27f451845280375b9ef`** efter PR252.
Klonen har egen fysisk `.git`, en revisions historik och inga Git-alternates.
Arbetskatalogen var ren både före provet och efter alla körningar, innan detta
dokumentkvitto lades till. Inga moduler, byggfiler, miljöfiler eller privata
data kopierades från äldre arbetskopior. Lipsync 3 lämnade aktuell
bevarandelista; dess worktrees, moduljunction, råmedia/banker och processer
bevarades. MERGE3 bekräftade att inga blockerande H4-fynd kvarstod.

| Egen körning i klonen | Resultat |
| --- | --- |
| Installation och bygge | Låsta npm-installationer för Studio, designklient, spelmotor, Speech och transport-Gateway; webb med pnpm 10.33.2 och frozen lockfile. Node 24.21.0 respektive Speech 22.23.1 enligt paketen. Studio/design och webb byggdes från början, inklusive Next-typkontroll; designens separata typkontroll och Speechs syntaxbygge passerade. |
| Fokuserade Windows-prov | 52 struktur-/chattprov, 3 Director-paket/startprov, 2 jämförelsefixtureprov, 33 anslutningsprov, 11 sessionsprov och webbbyggets 117 tester passerade. Ett Linux-specifikt sessionsprov hoppades över på Windows. |
| Verklig lokal start | Nybyggt Studio och spelserver via `--offline --skip-build --no-open`: lokal hälsa och Studio-sida 200, opublicerat spel avvisat med 503, syntetiskt projekt i temporär datarot. Stopp tog bort dataroten och frisläppte sessionen. Vanlig publicerad Studio-start räknades inte som prov. |
| SQL, omstart och HTTPS | Befintliga `tools/studio-isolated-qa.mjs` kördes som icke-root i WSL mot samma klon/SHA och ett nytt PostgreSQL 16-kluster: 4 retained-kontraktsprov, 26 SQL-kontroller och 59 integrationskontroller. 196 källhashar var oförändrade; klustret stoppades och togs bort. Den importerade testmodulens fristående SQL-test var överhoppat; verktyget körde den verkliga SQL-kedjan uttryckligen. |
| Isolering | Ny allowlist-miljö redan vid installation/bygge, tomma användar-/npm-profiler och egen paketcache. Inga ärvda apphemligheter, NODE_PATH eller NODE_OPTIONS. 122 interna länkar och 101 byggspår med 19 329 referenser gav noll mål utanför klonen; inga privata envfiler. Båda befintliga guards blockerade läsning av i förväg skapade syntetiska envfiler samt extern fetch/TCP. |

SQL-pakethämtningen gav först `Hash Sum mismatch` från Ubuntu via HTTP,
före databasstart. Samma prov passerade med en uppgiftsspecifik `APT_CONFIG`
för Ubuntus HTTPS-källor, med bibehållen signatur-/hashkontroll. Inga
systempaket, systemkällor eller externa databaser ändrades.
Leveransverktygets push verifierades på GitHub men upstreamsteget behövde
klonens main-begränsade fetchspec utökad med den egna featurebranchen.
`git remote set-branches --add origin <featurebranch>` följt av fetch och
ordinarie leveranskommando räckte; ingen gammal arbetskopia behövdes.

**Kvarvarande särskilda förutsättningar:** inga gamla lokala projektfiler
behövdes för de prövade flödena. Director-adaptrarnas äldre relativa
`open-claw/lab` är en bevarad konfigurations-/datarot; välj uttrycklig
temporär datarot och `envFiles: []` för isolerad körning. Privat native-AI-QA
kräver fyra filer i `lab/data/platform-private` och sitt exakt pinnade
OpenAI-SDK 7.12.1-träd. Minsta åtgärd för just det verktyget är att separat
bevara/verifiera dess egna underlag, inte återföra dem som ordinarie
byggberoenden. Browserprov kräver separat Playwright/Chrome. SQL-provet
kräver Linux/WSL, OpenSSL och verifierade PostgreSQL-binärer. Se
[återställningsguidens avgränsning](ENVIRONMENT-RESTORATION.md#renklonprov-och-separata-qa-förutsättningar).

**Inte provat:** full lokal regression, browser-/visuell produktacceptans,
GPU-/taljobb, produktionsskrivningar eller molnändringar. Processmiljö,
Node-guards och sökvägs-/byggspårskontroller är ingen OS-sandbox eller
bevis för alla historiska privata verktyg. Produktdrift kräver fortsatt
uttrycklig Neon/Blob/auth/provider-konfiguration enligt miljöguiden. För native
Admin omfattar det `CROUPIER_GAME_DATABASE_URL`,
`CROUPIER_STUDIO_ENVIRONMENT_ID`, `CROUPIER_STUDIO_WORKSPACE_ID`,
`CROUPIER_STUDIO_NATIVE_ADMIN=1`, `CROUPIER_STUDIO_NEON_POLICY=1`,
`CROUPIER_PUBLIC_ORIGIN` och
`CROUPIER_LAB_UI_ORIGIN`; Blob-läget använder `CROUPIER_MEDIA_STORAGE`
och `BLOB_READ_WRITE_TOKEN`. Inget av dessa skarpa värden behövdes för byggena
eller den syntetiska fixturen.

Privata körloggar, plan och maskinläsbara kvitton finns under
`C:/Users/jakem/.codex/visualizations/2026/10/18/01a14fb1-2374-7ce1-8105-d61ce1796718/`
(`clone-baseline.json`, `results.jsonl`, `offline-smoke-result.json`,
`isolation-audit-result.json`, `sql-result.json` och `sql-run.log`).
Detta stänger det avgränsade organisations-/efterstädningsprovet. Admin-UX,
Lipsync 3:s pågående integration och övrigt produktarbete har egna kvitton.

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

**HUVUDAGENT4, 18 oktober:** produktionens `croupier_game` på Neon-main
är källan för aktuella bolag, rum och dealers. Den tidigare läsningen visade
Dragan test och Nordic bet. Preview-grenen `preview-v2` raderades senare
enligt det daterade kvittot i [miljöguiden](ENVIRONMENT-VARIABLES.md#aktuellt-miljöval-för-admin--verifierat-18-oktober-2026).
Det andra Blob-lagret hör till Impactwin. Preview är ännu ingen verifierad
skrivtestmiljö; ingen ny molnavläsning eller full Admin-UX-acceptans påstås här.
Lipsync 3 äger tal-/workerarbetet och dess aktuella verifieringsstatus ovan.
Moving-kontrollen är levererad i PR246; renklonprovet är avslutat enligt HUVUDAGENT5-avsnittet.

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
