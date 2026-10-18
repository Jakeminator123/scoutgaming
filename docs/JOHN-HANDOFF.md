# Aktuell handoff — Scoutgaming

<a id="dragan-talstatus"></a>

## Lipsync 3: rörelseprov, modellcache och produktionsverifiering — 18 oktober 2026

Det isolerade rörelseprovet fungerar med Dragan, verkligt ljud, exakt
källbundet ansikte och lagren bakgrund → dealer → bord. Jakob godkände
”Ljud och munrörelser ser bra ut” för **enbart** granskningsfilen med SHA-256
`769c5d901775e05ca88773ee3e47174410367ae9c8d0fdb935b4cbcc6080c8f4`
(711 053 byte, H.264/AAC, 1280×720): ”Ulf Lundell är bra.” under självutdelning.
Senare cache- och spelarprov har egna tekniska kvitton, inget ärvt
kvalitetsgodkännande. De verifierar inte serverkort, insats eller saldo.

### Leverans och drift

| Leverans | Verifierad revision / avgränsning |
| --- | --- |
| [PR255](https://github.com/Jakeminator123/scoutgaming/pull/255), exklusiv modellcache | Mergad `967693a42a7524a25018aaa9adbb44a0c844c2e1`. Publicerad privat workerimage och isolerat GPU-prov enligt nedan. |
| [PR256](https://github.com/Jakeminator123/scoutgaming/pull/256), varm serverantagning | Mergad `dd96b5d58f1411e10b5c88ed090771a8c00bd9c1`. Moving-specifik kapacitetskontroll; generiska jobb och recovery behåller drainkravet. |
| [PR257](https://github.com/Jakeminator123/scoutgaming/pull/257), två planerade repliker | Mergad `b6544ec38f129ba61a203e952f00b04e76d74503`. Dåvarande tekniskt journalutrymme 13,2 USD och runtime-dygnsgräns 8,4 USD; senare kapacitet i PR262 nedan. Ingen historiknollställning. |
| [PR258](https://github.com/Jakeminator123/scoutgaming/pull/258), naturligt ljudslut | Mergad `58bdbc95fd3ac86cb5ee9bb656de1e91ca212675`; main-CI 39155063602 success 18:46:24 UTC. Granskat kodunderlag och verklig replay nedan. |
| [PR259](https://github.com/Jakeminator123/scoutgaming/pull/259), förberedelsefel | Mergad `c82dbe4e3138f74187c481421e3c6d13775339a6`. Tillåtna felkoder och fas/korrelations-ID bevaras utan råfel eller hemligheter; UI skiljer förberedelse från GPU-kö. 73 fokuserade tester och 48 commitkontroller passerade. PR-CI 39157061322 success. |
| [PR261](https://github.com/Jakeminator123/scoutgaming/pull/261), kall kapacitetskontroll | Mergad `799e090817636bfe16476c53b18399cc39a87383`. PR-CI 39160233262 success 19:53:49 UTC; oberoende granskning utan blockerare. |
| [PR262](https://github.com/Jakeminator123/scoutgaming/pull/262), separat teknisk budgetkapacitet | Mergad `4cee9bc20254f6eaceb9b34271cae8c98b41a56b` från granskat `6183b42c9c0ba77f4653570006268feaaa142d87`. PR-CI 39165716445 success; tidigare bootstrapfynd stängt av mergegranskningen. |

Denna leverans gör migration 015 obligatorisk för readiness, Studio samt
runtime-media- och speech-ledger-importörerna. Appdriften före slutleveransen
verifierades 18 oktober 21:23:13 UTC på PR262:s main
`4cee9bc20254f6eaceb9b34271cae8c98b41a56b`: Vercel
`dpl_GWMvkVQs8hqbcKH2FgSJDsLMBtP4` READY/production på
`www.scoutgaming.tech` och Render `dep-dbajd83m8hqs73bg33f0` LIVE,
health HTTP 200. T6 och dess återställning körde samma apprevision enligt
nedan. Detta är daterade driftkvitton före slutleveransen; dess egen commit
eller driftsättning påstås inte vara verifierad här. Publicerad workerimage,
appdeploy och verifierade produktionsjobb är skilda kvitton.

Workerrelease
`5908716a81532d29e8b2e9aece3a8639258a7f56dad2ee3b6d98fcc343d0c08c`
publicerades 18:01:16 UTC som
`ghcr.io/jakeminator123/moving-gpu-worker@sha256:eb5a6b4707eaba54839cc562b554ff7a8af37f5897e739a5533f2357f867135a`.
Publiceringskörning 39151186231 passerade. Den ersätter den tidigare
opublicerade mellanreleasen i denna aktuella status.

### Uppmätt GPU, återanvändning och avbrott

Det separata A/B/C/D-provet körde samma installerade serverless-handler,
entrypoint och modellcache på **en NVIDIA GeForce RTX 4090**, 24 564 MiB,
driver 580.126.20, Torch 2.8.0+cu128 och Python 3.12.3. Containerns större
host-RAM-/CPU-värden bevisar inte Podens tilldelning. Befintliga PCM-filer
användes; inga nya TTS-synteser behövdes för jämförelsen.

GPU-kvittot visar toppar på 6,68 GiB allokerat och 10,32 GiB reserverat
CUDA-minne samt 15,24 GiB motor-RSS. RunPods skapandekvitto anger 100 GB
RAM och 9 vCPU. Reserverat CUDA-minne innefattar allokerat; topparna är
observationer, inte verifierade minimikrav.

| Prov | Observerad handler-/jobbtid | Resultat |
| --- | --- | --- |
| A: kall, ”Ulf Lundell är bra.” | 71,245 s | Cachemiss, 54 talrutor, komplett. |
| B: varm, ”Jakob är kung.” | 6,954 s | Samma motor, cacheträff, 50 talrutor, komplett. |
| C: avbrott efter första paketet | 8,125 s | Cacheträff före avbrott; motor och cachepostens aktiva ägarskap avvecklade före avbrottskvittot. Ofullständigt resultat. |
| D: omladdning efter C | 57,940 s | Cachemiss och ny motor, 50 talrutor, komplett. |

Färsk uppvärmning var 52,1–55,6 fps; ordinarie 30-fps-grind användes.
71,245 → 6,954 s är två uppmätta jobb med olika repliker, inte ett
kontrollerat hastighetsförhållande för samma text eller produktionslatens.
Provet använde lokal callbacktransport och prövade inte autentiserad
Render-antagning. Cacheträff förutsätter samma verifierade identitet och
fullständig avslutning: samtliga kompositionsfutures och sista callback måste
vara klara. Fel, avbrott, bank-/modellbyte eller okänd processstatus får inte
lämna återanvändbar motor, PCM eller ansiktsrutor från föregående jobb.

PR258 rättar den verkligt återgivna ordningen där ljudets `ended=true` och
`paused=true` blir synliga före DOM-händelsen `ended`. Båda slutvägarna
använder nu samma slutkontroller; manuell paus, ofullständig kroppssekvens,
saknad slutruta och förlorad ägare avbryter fortfarande. 42 fokuserade
spelare-/rutelagerprov passerade; tre browserprov saknade browserfixture och
hoppades över. Huvudagentens faktiska B-replay med spelarhash
`c1c932af2c97c386bfe9d73d1b68e3b09742ec6a5b72d1fed99a23b722dfc5af`
gav `completed=true`, 50 mottagna ansiktsrutor och sista kroppsruta 65.
**63 unika kroppsrutor observerades av 66 planerade**; det bevisar inte att
alla 66 visades. Kvitto-SHA
`40138ffa770e713dcde0e0c64f804bab8e3c8579f746fabfb3a101882f85419f`
(64 067 byte). Det äldre godkända rörelseprovets separata logg innehöll alla
66 unika kroppsrutor; den observationen överförs inte till detta B-prov.

### Exakta källor och bevarande

De 50 befintliga Dragan-källklippen som återanvänds från Kevins material
behåller sina registrerade originalbytes; vi använder den gemensamma
spelaren och lagersammansättningen. Detta verifierar inte Kevins privata
miljö. Källmängdens SHA-256 är
`e49f1e9e9e141d1725c7ea1ec104fddff5d9055db33c4181f2c7a2e9a797ef0d`.
Fullbankens 2 479 poolrutor är 594 432 000 byte, SHA
`5dcf0f323f707ad6fa58f740a560a1aa62a73b1a6ebeaa916b6b026f6a47f14c`;
bankkvittot är 1 045 byte, SHA
`74c3c460e6589898dc2341fd44f06934eb91542374697f3d93f863fe9ef9b477`.
Källfilm `d9c7fefb-141c-4809-aecf-3904392f22f5` har 66 rutor vid 24 fps,
SHA `061e82f2d4be69d3a73a2e6842692eb2d23c7b7e11fcd9d246fbb0c85e9f72c0`.
Vila är ruta 0 i `2f3955b0-b450-4cc2-a9f5-ac80f10abd2f`, SHA
`2b8d6ea7829bde6212f6145038569747a389c5e20166b3ea08fc26efda81c9e3`.
Ulf-PCM har SHA `767ad6ff0e0c65786f25d5ae0d60595671f0351858a35f47039d838a98a8aa32`
(73 560 byte); Jakob-PCM har SHA
`903c2ceb331fbc6ae0162ded81a53818a2cf8e55450902666866f4842c1712c9`
(64 644 byte). Båda är 24 kHz mono. Manifesten binder även exakta lager,
text, ljud, källrutor, bank och release.

Fem privata Blob-manifest är fullåterlästa. Produktionspaketen T3, T4 och T6
redovisas separat nedan. De två första paketen har återlästa manifest under
`croupier/media/dealers/dragan/staging/lipsync-review/`:

| Manifestets suffix | Slutfört kvitto |
| --- | --- |
| `d63657f1-cc18-5707-9551-86d380f39404/ed5b5c1cd9799bf46e83ec513cb09282637bda9d2acedf40f952ea8bbd1b6b10.json` | 16:55:28 UTC; manifest 68 291 byte. 53 nya objekt och manifest, totalt 222 641 075 byte, fullåterlästa med rätt SHA. Fem äldre objekt är referenser, inte ny fullhashning. |
| `2ef8e43a-b151-4244-af8f-2a9975b94684/2ef8e43ab1516244ef8f2a9975b94684fa98c156da317f9c85a8296d2cad91cf.json` | 18:23:41 UTC; manifest 10 688 byte, 23 verifierade objekt. A/B/D:s kompletta ansiktspaket och ljud, C:s uttryckligen partiella resultat, sanerade kvitton samt lyckad och avbruten replay. |

Filnamnens 64 hextecken är manifestens exakta SHA-256. De separata
planhasharna är `26ec9bc513455a67c4ca35049c83dc2c17712693e97aef2021e5d79c2b0bf23b`
respektive `30b57cf58486119902b7311d8dd2c31d6b78fc9cf080ad176a7d0279608eba4a`.
Omkodade jämförelser i första paketet är derivat, inte originalkällbytes.
Nya inspelningar utan SHA-bundet capture-/transkodningskvitto bevaras som
ogranskade samlokaliserade filer; deras namn bevisar ingen härledning.
Det äldre visuella godkännandet överförs inte till nya filer.

Emils `lappsynk-export-fe1b55e.zip` är bevarad oförändrad: 145 846 625 byte,
SHA `949443c1084ab3f515792fe66c5e2d381e985f9bdc743e792e5fbca36a9240a3`.
Det är referensmaterial, inte aktiv fullbank, Git-innehåll eller Admin-klipp.
19 textfiler gav inga träffar i sekretesskontrollen; binära tensorers innehåll
är inte fullständigt sekretessgranskat. Inga Neon-rader eller `/admin/clips`-
poster skapades av bevarandet. Råa requestfiler, cookies och loggar hålls
privata lokalt. Moving-resultat sparas ännu inte automatiskt i svarsbiblioteket.

### Journal, produktionsprov och kvarvarande ansvar

Varm antagning kräver färskt, serverägt bevis för exakt release och högst en
egen frisk, ledig worker, inga köade/aktiva jobb, samt samma SQL-lease före
POST. `workersMin=0`, `workersMax=1`, `idleTimeout≤60` och exklusiv endpoint
gäller; GET och POST är inte atomiska. RunPods `ready` är separat cache-
kapacitet, inte ett modellbevis. Tomgången ryms tillsammans med jobbets
540 s TTL inom reservationens 720 s. 87 kapacitets-/sessions-/journalprov
och isolerad PostgreSQL (4 retained, 26 SQL, 59 integration) passerade;
den miljöberoende fristående wrappern hoppades över, SQL-funktionen kördes
uttryckligen i fixturen. Budgetändringen hade 30 fokuserade gröna prov och
samma isolerade SQL-kedja, inklusive historikbevarande och tredje-avvisning.

Rootens amendment `4f1893d5-a6d1-459d-9269-703c7f8629a3` återlästes
18:32:11 UTC: varaktigt totalt utrymme **13,2 USD**, oförändrad historik
**nio reservationer/10,8 USD**, dagens reserverat **6 USD** och sparad
dygnspolicy **20 USD**. Inga öppna moving-sessioner eller levande leases
fanns då. Dåvarande runtime begränsade till 8,4 USD/dygn och 1,2 USD per ny reservation.
Kodtaket höjer inte ensamt den sparade journalen. Detta är teknisk
journalföring av två uttryckligen planerade repliker, inte ett nytt mänskligt
kostnadstak. Jakob har återkallat det tidigare mänskliga provtaket.

Samma avstämning fann **56 äldre generiska `submission_uncertain`-poster**,
utan moving-bindning, aktuell aktivitet eller levande lease. De är olöst
historisk observationsskuld; inga poster har rensats, återbetalats eller
förklarats lösta. De ska hållas skilda från det aktuella moving-provets
sessioner och från faktisk providerdebitering.

Första trial04-försöket på PR258 avbröts före någon varaktig moving-reservation:
första chatten gav `chat_failed` efter 11 669 ms och inget ljud/WS-resultat.
Det bevisar inte ett GPU-köfel; den gamla UI-etiketten visades redan under
förberedelsen. Exakt ursprungsfel saknades i svaret som fångades. Ett senare
skrivskyddat röst-GET från lokal Windows fick HTTP 200 för rätt Dragge-ID,
vilket inte verifierar Render-tjänstens nätväg. PR259 tillför därför
avgränsade felkoder och fasloggning före nästa försök. Försöket
`67c6de23-a002-424e-a909-078c92a67b87` stängdes 18:56:32 UTC utan cleanup-fel:
profilen åter i preparation, talflaggan 0, endpoint/template borta,
0 aktiva workers och fortsatt nio avslutade reservationer/10,8 USD.

Nästa försök `4ade638b-842b-44f9-9293-5de8fdd4ef25` körde PR259 och
fångade exakt `generated_speech_moving_capacity_unverified` i det strömmade
chattsvaret, efter 9 867 ms. Inga ljud-/ansiktspaket eller reservationer
skapades. Cleanup var stängd utan fel 19:32:04.843 UTC, med återställd
preparation-profil, flagga 0, borttagen endpoint/mall och LIVE-återställning
`dep-dbaht1jrjlhs73ak14ig` på `c82dbe4e3138f74187c481421e3c6d13775339a6`.

En separat kapacitetsdiagnos `eabbaf86-e1dc-4fbc-848f-86931bd5cba5` gjorde
två GET-observationer 19:37:56/19:38:17 UTC, utan GPU-jobb eller ändring av
Render/Studio. Båda reproducerade validatorns avvisning av health
`initializing=1`, trots exakt en aktuell EXITED-post, noll aktiva pods,
`running=0` och tom jobbkö. Det isolerar ett konkret kallstartsfall; det är
inte en allmän regel att initialisering är kostnadsfri. Testresurserna togs
bort och cleanup verifierades stängd. De två kapacitetskvittona ligger under
samma privata provbas. Detta ersätter inte en direkt providerobservation
från det tidigare misslyckade produktionsanropet.

PR261 tillåter det reproducerade fallet som kall antagning. Varm
initialisering, gamla eller okända workerposter, fler initialiserande slots,
ohälsa, throttling och kö/arbete avvisas fortfarande. Det innebär inte
färdigladdad modell. 69 fokuserade tester passerade utan skips; huvudagentens
isolerade PostgreSQL-körning gav 4 retained-, 26 SQL- och 59
integrationskontroller med den utökade kapacitetsfixturen uttryckligen körd.
Testwrappern gav 15 pass och ett miljöberoende skip för det separata,
redan uttryckligen körda SQL-provet. Klockdomänen mellan Node och databas,
generell drain, image och kostnadsgränser ändrades inte.

### Teknisk kapacitet och beviljad budget

PR262 skiljer kapacitet från beviljade belopp: 40 USD tekniskt totalt,
20 USD runtime-dygn och fortsatt 1,2 USD per reservation. Det fasta
Dragan-budget-ID:t får separat 13,2 USD som initialt belopp endast när
journalen är tom. Ett befintligt ID behåller sitt varaktiga tak även om
runtime eller startvärdet höjs; ytterligare utrymme kräver en finansierad,
revisionskontrollerad amendment. Ingen gammal reservation nollställs.

Migration **015 applicerades och återlästes i produktion 21:24:12.086 UTC**,
efter verifierad PR262 på både www och croupier-v2. Endast tre CHECK-gränser
ändrades 15 → 40 USD. De två berörda moving-tabellernas rader, budget- och
reservationshistorik samt tidigare ledgerposter var oförändrade; andra
speltabeller låstes inte och påstås inte ha varit oförändrade. Det dåvarande
beviljade totalutrymmet förblev **13,2 USD**: migrationen beviljar ingen budget.
Kvitto: `production-trial-04/migration015-plans/b7ccaf22-1ca1-4ce0-ada6-8862d2a6472a/applied-receipt.json`,
SHA-256 `ac5471208ec7559451d3101d6788932210697e3043870cda9219069861328b6a`.
Efter 015 får äldre kod som avvisar dess ledger inte driftsättas.

Slutpatchens åtta kod-/testfiler gör 015 obligatorisk för readiness, Studio
samt både runtime-media- och speech-ledger-importören. **94 fokuserade prov
passerade utan skips**. Isolerad PostgreSQL verifierade 4 retained-, 26 SQL-
och 59 integrationskontroller; wrappern gav 16 pass och ett miljöberoende
skip, medan SQL-funktionen kördes uttryckligen. Kvitto:
`final-documentation/require015-verification.json`; SQL-logg-SHA
`90d81f1d858cf7a84e9b1df62497e85043f4fa157cc7e51ee812fa2e4af85e03`.
Kontrollerna gäller ändringen i denna leverans. Det daterade appdriftkvittot
ovan föregår leveransen.

PR262:s tidigare bryggprov: 48 fokuserade bootstrap-/sessions-/journaltester och 48 commitkontroller
passerade. Den verkliga PostgreSQL-fixturen körde den aktuella konfigurationen
på både 014 och 015: elva reservationer inom 13,2 USD följdes av avslag,
även vid ändrat startvärde, utan nya journalrader. Den separata körningen
`motion-readiness/budget-policy-bootstrap-sql.log` har SHA-256
`1ae37e34b648506a6832e7f72fa82666b06562eaf3875b6867fb35c647617542`;
26 SQL- och 59 integrationskontroller passerade. Den tidigare uppgraderings-
körningen verifierade oförändrade datarader och CHECK-gränser; dess kvitto
`budget-policy-sql.log` bevaras. En redundant fristående SQL-wrapper hoppades
över medan samma SQL-funktion kördes uttryckligen. Studio-testets 14 prov
passerade med bryggans avsedda optional-lista.

### Två enskilda produktionssvar — T3 och T4

Båda proven spelade ”Ulf Lundell är bra.” i den befintliga produktionsspelaren
med samma förseglade cacheimage och källbank. De är **vilotal**, inte utdelning
eller insats. Ett mottaget ansiktspaket eller release-callback bevisar inte att
varje bild visades. Tabellen skiljer mottagna medier från inspelningens täckning.

| Prov och körning | Medier och inspelning | Kallt jobb och begränsning |
| --- | --- | --- |
| T3 `32c15e27-a1e9-472f-a290-9ee11bc04084`, PR261 `799e090817636bfe16476c53b18399cc39a87383` | Komplett PCM/H.264, 51/51 mottagna ansiktsrutor, 38 release-callbacks; 66 874 byte PCM och 86 287 byte H.264 i fem paket. `mediaCompleted=true`, `captureComplete=false`, inga JPEG. | Provider COMPLETED/complete, cachemiss; kö 91,094 s, execution 86,651 s, klick→slut 192,456 s. Inspelningshjälparen felklassade avslutad HTTP-läsning efter komplett deskriptor. Ingen andra replik skickades. |
| T4 `3001c02f-ee64-4b7a-9681-aad822af40a3`, PR262 `4cee9bc20254f6eaceb9b34271cae8c98b41a56b` | `mediaCompleted=true` och `captureComplete=true`; 57/57 mottagna ansiktsrutor, 44 release-callbacks; 78 020 byte PCM, 89 485 byte H.264 i fem paket samt 62 passiva JPEG-prov. | NVIDIA A40, provider COMPLETED/complete, cachemiss; kö 129,065 s, execution 98,747 s, klick→slut 242,115 s (väggklocka). Rootens verktygsövergång förbrukade andra permitens tidsfönster. Ingen andra replik skickades. |

T3:s oförändrade råexport behåller `capture.runFailed=true`; den senare
strikta medieverifieringen ändrar inte detta historiska inspelningsfel.
T4 verifierade samma HTTP-övergång mot exakt deskriptor, kompletta medier
och naturligt browser-slut: en verifierad avbruten HTTP-läsning, inga
väntande sådana avbrott eller rapporterade capture-fel. Dess PCM-SHA är
`2fa6867322302f8f7f851245ed819ac185a82ffd777a9c09b4c465ca1925b10a`;
uppspelningskvittots SHA är
`1d22cbbf0136d206a80afc44f5a0e38d3d5e1851b2c29a72f761157064c8aeee`.
JPEG-bilderna är glesa visuella observationer, inte en komplett bildsekvens;
PCM är mottaget providerljud, inte inspelat systemljud. Inget nytt visuellt
godkännande eller varmt produktionsåteranvändningsbevis följer av dessa prov.

T4:s worker mätte bankhämtning 17,216 s, motorförberedelse 53,143 s,
uppvärmning 40,9 fps och faktisk rendering 37,3 fps för 57 rutor.
`renderMs=1529` skiljer sig från `renderWallMs=8399,834` och kvittensväntan
7 893,319 ms; dessa överlappande mått ska inte summeras som separata faser.
Det är ett kallt A40-prov, ingen p95- eller minnes-/latensgaranti.

| Avveckling | Verifierat slutläge |
| --- | --- |
| T3, 20:12:46 UTC | Preparation-profil, flagga 0, endpoint/mall borta, inga aktiva workers/leases. Render `dep-dbaig3rrjlhs73am1igg` LIVE på samma apprevision. 10 avslutade reservationer/12 USD; då 7,2 USD för dagen och 13,2 USD beviljat totalt. |
| T4, 21:35:10.932 UTC | `closed=true`, inga cleanup-fel; preparation-profil, fyra egna Render-nycklar återställda med flagga 0, endpoint `nw2pept58q2o94` och mall `aoo6wzla54` borta, 0 aktiva workers och inga öppna sessioner/leases. Render `dep-dbajmjm1egvs73avkig0` LIVE på PR262. Historik 11 avslutade reservationer/13,2 USD; separat amendment hade före provet beviljat 14,4 USD. Providerkostnader var ännu inte slutavstämda och reserver behölls. |

T3:s tredje privata Blob-manifest (`historical-single-reply`) är fullåterläst:
sex mediefiler, sanerat kvitto och manifest, totalt åtta objekt. Manifestet är
5 231 byte, SHA-256
`d62843eb604bf00f78e638522098e8d07dc00d09d173bd7569c0a7443c70c257`;
plan-SHA `b77bcb9e796de7fb457afbf52c27ddb5ec4c3e0845fd1d794aa2834f80733896`.

T4:s fjärde privata Blob-paket slutfördes **21:43:55.023 UTC**: 69 objekt
fullåterlästa med rätt storlek och SHA, utan overwrite eller Neon-/Admin-skrivning.
Manifestet är 2 848 byte, SHA-256
`42972d70315c48feb1a6f1a4c7f7ee5b63878ed77f1a6740f6e389d468855148`,
under `42972d70-315c-48fe-a1a6-f1a4c7f7ee5b/` i Blob-prefixen nedan.
Lokalt slutförandekvitto ligger i
`artifact-preservation/t4-single-reply/plans/3001c02f-ee64-4b7a-9681-aad822af40a3/`,
SHA-256 `001c0dc636111c9af1342691f854b90b6d3b9488f99b6929fefa91f14fca2a72`.
Varken T3 eller T4 registrerar nya Admin-klipp eller ett komplett tvåsvarsresultat.
Råexporter, cookies och hemligheter ingår inte i Blob-paketen. Originalkvitton finns under respektive
`production-trial-04/runs/<körning>/`; bevarandet ligger under
`artifact-preservation/` och den privata Blob-prefixen
`croupier/media/dealers/dragan/staging/lipsync-review/`.

**Avbrutet inspelningsprov T5:** `9e888383-6b6c-4271-9d44-ca4ceb803e1e`.
Ett betrott chatklick skickade begäran `d478249e-c778-438b-853c-f18e4219c24e`.
Inspelningshjälparens cursor hade inte lästs under cirka fyra minuters
Admin-/deployväntan; `capture_events_truncated` upptäcktes efter klicket.
Inget komplett medieresultat eller andra svar räknas. Detta är ett fel i
provstyrningen, inte belägg för ett nytt fel i läppsynken.

Cleanup var verifierad stängd **21:48:22.159 UTC**: profil preparation,
fyra Render-nycklar återställda och flagga 0, endpoint `js61kp4eoxzjzi`
och mall `ybymqj9q2j` borta, inga aktiva workers eller öppna reservationer.
Återställningen `dep-dbajs7eq1p3s73bv5tc0` var LIVE på PR262.
Journalen behåller 12 avslutade reservationer/14,4 USD; det separat
beviljade totalutrymmet var 15,6 USD. Inga historikposter nollställdes.

Den privata inspelningsfixen kräver nu en färsk förkontroll före klick och
dränerar samma cursor utan återställning. 42 offlineprov passerade och
oberoende granskning fann inga blockerande fel. Ny fångst initieras först
efter profilaktivering; ofullständig fångst stoppar före ett nytt chattanrop.
Detta offlinekvitto är inte ett nytt produktionsresultat.
### Verifierat tvåsvarsprov T6 och slutläge

T6 `728d0e03-1f46-4ab5-936b-01a99e1dbe1e` slutförde två efterföljande
repliker på `www.scoutgaming.tech`, Dragan-testbordet och PR262:s apprevision.
Det var **vilotal utan DEAL, insats eller saldoändring**. Båda svaren har
`mediaCompleted=true`, `captureComplete=true` och naturligt browser-slut,
bundna till exakt text, ljud, källbank, källmängd och den publicerade releasen.
Detta ersätter inte rörelsefilmens separata visuella godkännande.

| Replik | Samma NVIDIA A40-worker | Mottagna rutor / release-callbacks | Providerkö / execution | Klick→slut, monotont |
| --- | --- | --- | --- | --- |
| ”Ulf Lundell är bra.” | Kall modell, cachemiss | 57/57 / 44 | 64,805 s / 85,954 s | 164,088 s |
| ”Jakob är kung.” | Varm modell, cacheträff | 51/51 / 38 | 0,147 s / 25,773 s | 37,176 s |

Båda körde worker `nc0qem1vw69ad2`. Motorförberedelsen mättes till
52,761 respektive 2,180 s; färsk uppvärmning till 42,0/41,3 fps och faktisk
rendering till 38,2/34,8 fps. Replikerna har olika text och ljud: detta är
ett återanvändningsbevis, ingen jämförande hastighetsgaranti eller p95-mätning.
Alla ansiktsrutor mottogs; release-callbacks och glesa skärmbilder bevisar
inte att varje ruta visades eller att den nya filen visuellt godkänts.

Det samlade kvittot är `production-trial-04/runs/728d0e03-1f46-4ab5-936b-01a99e1dbe1e/two-reply-result.json`,
SHA-256 `302451f9a5f17d17a6d1239861f858c0956c1394b2287def252bf483987ba07a`.
Ulf-PCM är 78 020 byte, SHA
`629a22012d1e6bdbda50623aa66a4898d60e9e7bc5510ad6c53c136e88f8bb24`;
Jakob-PCM är 66 874 byte, SHA
`2a7957ee4655e5e991840b6fb50b7fd5fd9acf9bb69e8ed20bffd79badc23067`.
Ljudet är mottagen PCM, inte inspelat systemljud.

Cleanup var stängd **21:59:46.560 UTC**, sju steg godkända och inga fel:
profil preparation, fyra egna Render-nycklar återställda med talflagga 0,
endpoint `rz295h5xl2vuhv` och mall `z39jmv6pfy` borta, inga aktiva workers,
öppna reservationer eller levande leases. Återställningsdeploy
`dep-dbak20ijnfac73816bsg` var LIVE på samma `4cee9bc2`-revision.
Cleanup-kvittots SHA är
`097ff09ccbc1efcdc30c829531dcc94b7a9fb83483fed0c8a8535d7ea4696104`.
Journalen behåller **14 avslutade reservationer/16,8 USD**, dagens reserverat
12 USD och separat beviljat totalt utrymme 16,8 USD. Ingen historik nollställdes.

T6:s femte privata Blob-manifest slutfördes **22:04:20.559 UTC**: 94 unika
objekt, 28 001 366 byte, fullåterlästa mot storlek och SHA. Paketet innehåller
två PCM-filer, tio H.264-paket, två sanerade kvitton, 79 unika JPEG-bilder
med 82 tidsreferenser i samma bildserie samt manifestet. 92 objekt laddades
upp och två befintliga objekt fullåterlästes; inga bytes skrevs över.
Manifestet är 3 275 byte, SHA
`ca28ce8ca81ec4c3f655ab7638be47ca8fc044c57192555edec86220f2929ba2`,
under `ca28ce8c-a81e-44c3-a655-ab7638be47ca/` i den privata Blob-prefixen ovan.
Slutkvittot i `artifact-preservation/production-trial04/plans/728d0e03-1f46-4ab5-936b-01a99e1dbe1e/`
har SHA `db7a78528b2a5fcd465de6a73e0a038cb04998786719e51e9f829d8b977d3073`.
Inga Neon-/Admin-klipp skapades. Paketet är ogranskat visuellt; skärmbilderna
är glesa observationer, inte en komplett synkroniserad granskningsvideo.

### Kostnadsavstämning och fortsatt varm drift

Avläsningen **18 oktober 22:00:19.322 UTC** gav **0,8236155684862752 USD** i
rapporterad RunPod-kostnad för lästa 20 endpoints och kontots pods, tidsfönster
16 oktober 00:00 till 18 oktober 22:00:18.918 UTC. Det är inte T6:s slutkostnad:
T3–T6:s endpointlistor var tomma och `finalCostConfirmed=false`.
**35,003335 USD** i providerreserver behölls; inget frigavs automatiskt.
ElevenLabs/TTS och nätverksvolymer ingår inte i denna fakturaavstämning.
Kvitto `production-trial-04/provider-budget-1792360819748.json`, SHA
`15361bfcd5e75934572e92ac24cfc2ab06dfb6ec290b5b2ee40f4902fad0b915`,
länkar till det lästa fakturaunderlaget. Reservationer är inte fakturor;
tomma eller fördröjda billing-rader bevisar ingen slutlig nollkostnad.

**24 timmars varm drift är inte aktiverad eller verifierad.** Nuvarande
antagning kräver `workersMin=0`, `workersMax=1` och högst 60 s tomgång;
`workersMin=1` avvisas. Provets guard var 720 s. Modellcachen har ingen egen
TTL eller jobbgräns, men finns bara medan processen lever och avvecklas vid
identitetsbyte, fel eller avbrott. Nästa steg för längre varm drift bör vara
ett separat, uttryckligt avgränsat varmtest med kostnadsmätning och bevarade
antagnings-, avbrotts- och städskydd. T6:s cacheträff lovar inte dygnsdrift.
Riktig mikrofon-/bild-E2E från PR251 och automatisk beständig lagring av
moving-resultat är separata återstående produktspår.

### Arbetskopior och underlag

Privat provbas är
`C:/Users/jakem/.codex/visualizations/2026/10/18/01a14e80-4e7f-7ff0-a83b-0ec7a9984900`.
`motion-readiness/warm-worker-publication.json`, warm-cache-provets
`gpu-result/cycle-receipt.json`, `player-replay/B-warm-jakob/replay-receipt.json`,
`artifact-preservation/` och `production-trial-04/` innehåller kvittona.
Det äldre godkännandet ligger i `motion-readiness/visual-acceptance.json`.

Primärcheckouten `C:/Users/jakem/Projects/croupier` var 21:41:47 UTC på
annan arbetsbranch, `codex/scout-visual-product-model`, revision
`7a6fc8a70b7c3b810829c2736ad98bd26fcf9bb1`, med samma sex ändrade eller
oregistrerade poster nedan. Lipsync arbetar separat i
`lipsync3-server-diagnostics/croupier` och `lipsync3-bank-http/croupier`
under `.codex/worktrees`. W1:s Studio-beroenden länkar till W2; ingen av
arbetskopiorna får raderas medan denna junction används. Huvudagentens
avslutande lokala inventering identifierade inga egna provprocesser knutna till provbasen,
W1 eller W2 och inga lyssnare på 8765/8766; Admins talcheckbox var av.
Arbetskopiorna och deras beroenden lämnas kvar. Ändrade
`.codex/config.toml`, `.cursorignore` och oregistrerade
`.agents/skills/source-command-ping/`, `.cursor/settings.json`, `a.zip`,
`web/` tillhör inte Lipsync-leveransen och är orörda. Grönt i editorn kan
betyda nytillagt/oregistrerat i Git, inte osparat. `a.zip` är agentmaterial,
inte Emils export. Ägarskap och integrations-/klonarbetet måste samordnas
med HUVUDAGENT5/merge-agenten; ingen mass-staging eller städning är gjord.
Neon är produktregistret och Blob mediekällan, inte dessa privata arbetsfiler.
Tidigare avvecklade Impactwin `game-engine`/`preview-v2` ska inte återställas;
produktionens `croupier-v2`/main består. Vercel Preview delar fortfarande
produktionsbackend och får inte antas vara isolerat.

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
