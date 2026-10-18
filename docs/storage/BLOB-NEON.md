# Dealerklipp, Neon, Blob och gemensam talworker

Kanonisk målstruktur och genomförandeplan, 17 oktober 2026. Detta dokument
ersätter guidens äldre generella lagringsbeskrivning. Importplan och utökat
referensskydd är implementerade på arbetsbranchen; molnworkern förbereds separat.
Det betyder inte att produktionsimport eller rörligt tal i spelet är aktiverat.
Produkttermer ägs av [TERMINOLOGI](../../apps/studio/docs/TERMINOLOGI.md), tekniska
runtimekontrakt av [LOCAL-PRESENTATION-RUNTIME](../LOCAL-PRESENTATION-RUNTIME.md)
och leveransstatus av [handoffen](../JOHN-HANDOFF.md).
Ingen ny parallell tracker skapas.

## Beslut och avgränsning

Jakob vill behålla grundsorteringen, använda Kevins faktiska blackjack-material,
undvika gamla kopior, rätta klassificeringen i Neon och kunna köra den verifierade
lokala läppsynken i molnet. Rekommenderad lösning:

1. Behåll ett gemensamt dealerregister och en gemensam spelare.
2. Återanvänd exakt matchande mediefiler och identiteter; importera det som saknas.
3. Byt valda bindningar genom en kontrollerad revision. Töm inte Neon eller Blob.
4. Radera endast separat verifierade ersatta objekt efter beroende- och jobbkontroll.
5. Paketera talmotorn reproducerbart. Behåll Astrid tills en ersättare fungerar.

Det är tre samordnade leveranser: klippkontrakt/import, register/raderingsskydd
och talworker. Admins navigation och sparstatus behöver inte vänta på
workerbyte eller Astrid-avveckling. All produktionsmigration och fysisk
radering följer först efter en konkret plan över objekt, referenser och återgång.

## Bibliotekets målstruktur v1

Admin visar samma grundfack per registrerad dealer. Filernas mappar och
uppladdningsnamn är inte ett andra register.

| Fack | Innehåll och val |
| --- | --- |
| Vila / idle | En vald grundpose eller grundloop; blick, leende och andning kan vara valbara variationer. Generell stillbild som blackjack-idle kräver komplettering; dagens bildimport är begränsad. |
| Till skon / redo | VILA → REDO. REDO är ett kroppstillstånd, inte en extra spelplats. |
| Utdelning | Spelarplats 1–7, separat dealer öppet/dolt kort. Ingen spelarplats 8. |
| Från skon | REDO → VILA efter en följd av handlingar. |
| Vända dolt kort | Egen handling och kalibrering, inte vanlig utdelning. |
| Reaktioner | Händelsestyrda rörelser, exempelvis blackjack eller vinst, med explicit ljudpolicy. |
| Talade repliker | Färdiga video-/ljudtagningar med exakt text, språk och repliknyckel; flera tagningar får vara möjliga. |
| Dynamiskt tal | Genererat ljud och läppsynk på en exakt vald film/bank. Härledda resultat är egna artefakter, inte nya original. |

Plats 1–7 motsvarar interna `box0`–`box6`; `pos4` är Plats 4 / `box3`.
Dealeruppslag, kort och utbetalningar ägs fortsatt av spelmotorn.

Tre separata egenskaper måste visas och sparas:

- **Funktion:** idle, övergång, utdelning, vändning, reaktion eller tal.
- **Rörelse:** startpose, slutpose, målsituation och exakt kalibrering.
- **Val:** standard, valfri variation, händelse-/tidsstyrning eller OpenClaw.

En nödvändig poseversion får inte behandlas som slumpmässig underhållning.
`role: alternative` på en äldre import bevisar inte hur den användes hos Kevin.
Standardvalet hör till sparade bindningar, inte till ett permanent filnamn.

### Pose och uppspelningsregler

Grundutdelningen kan vara REDO → REDO; `-i` börjar i VILA, `-u` slutar i VILA
och `-iu` gör båda. `-v/-iv` är särskilda filmade avslut till VILA.
Behåll deras exakta filmer och kalibrering. Anta inte att suffixen har samma
betydelse i material från en annan källa.

Vår befintliga `planFilmedDealSequence` väljer redan korrekt posekedja via
en hashbunden Kevin-profil. Fristående `transition.shoe`-klipp finns i biblioteket
men är inte inkopplade i den ordinarie spelarsekvensen. En ny implementering måste
välja en sammanhängande kedja; spela inte både ett fristående inträde och samma
inträde inbakat i `-i`. Använd samma regel vid återgång.

Idle kan väljas med intervall, slumpvariation, cooldown och frekvenstak.
OpenClaw får föreslå ett tillåtet klipp för aktuell dealer utifrån chatten;
spelaren bestämmer en säker startpunkt. Kortutdelning och pågående tal har
företräde. Dagens idlevariant har ett användningsläge åt gången.
Inspelat tal måste behålla sitt ljud; det ska inte stumspelas som en idlevariation.
Händelser, upprepningsskydd och språkval ska uttryckas som policy, inte hårdkodas
per dealer i en ny spelare.

## Namn och import: enkelt för användaren, exakt i registret

Vald registrerad dealer och bekräftad placering är auktoritet. Ett filnamn får
föreslå men aldrig själv skapa dealer, publicera media eller avgöra rätt spelplats.
`dragge` får mappas till `dragan` enbart genom importens uttryckliga källalias.

Rekommenderade läsbara namn för nytt material:

- `dragan__idle__breath__t01.mp4`
- `dragan__deal__pos4__redo-vila__t01.mp4`
- `dragan__speech__blackjack__sv__t01.mp4`

Detta är målkonventionen, inte ett redan infört krav i filnamnsparsern.
Kevin-filer behöver inte döpas om eller kodas om för att importeras.
Originalnamn, full källsökväg och commit bevaras som proveniens.

Återanvänd befintlig importassistent: välj dealer, dra in filer, granska fack,
spara. Vid okänt, felstavat eller motsägelsefullt namn visar samma granskning
”Välj placering” med konkret orsak. Fråga bara om de tvetydiga raderna.
Förslag via AI använder begränsad metadata och kan inte skriva eller godkänna
självt. Bild-/ljudanalys är en separat eventuell utökning, inte bevisad funktion.
Dagens assistent har redan regelbaserade förslag, manuella fack och valbar AI.

Varje importerad tillgång behöver validerad identitet, format/storlek/hash,
dealer, spel, funktion, händelse/situation och källproveniens. Poseklipp behöver
start/slutpose och kalibreringsrevision. Tal behöver dessutom språk, exakt text,
replik/tagning och sammanhängande ljud-/videohashar. Fält som saknas i dagens
schema införs i en versionerad migration; inga ad hoc-fält skrivs i produktions-JSON.

## Neon och Blob: behåll lagringsgränsen

**Neon är produktregistret; privat Blob lagrar mediebyte.**
Aktuella `media_records`, projektbindningar, `runtime_media_catalogs`,
`speech_reply_records` och frysta publiceringspaket har olika uppgifter.
Repo-JSON och äldre Blob-JSON är authoring-/importkällor, inte runtime-reserver.

Behåll den etablerade fysiska strukturen:

```text
croupier/media/dealers/<dealer-id>/
  source/<ursprung>/<objekt-id>/<sha256>.<format>
  review/uploads/<media-id>/<sha256>.<format>
  runtime/<bank-eller-format>/<objekt-id>/<sha256>.<format>
  staging/<arbetssteg>/<objekt-id>/<sha256>.<format>
croupier/media/backgrounds/<lager-id>/<sha256>.<format>
croupier/media/tables/<lager-id>/<sha256>.<format>
```

`source` bevarar original; `runtime` håller härledda spel-/talbanker.
`review/uploads` är en lagringsväg, inte en granskningsstatus.
Val eller publicering kräver ingen filflytt och ska inte skapa ytterligare kopior.
Nya undermappar/format används först när befintlig sökvägsvalidering stödjer dem.

Likadan SHA-256 visar likadana byte, inte automatiskt likadan ägare, språk,
kalibrering eller publiceringsidentitet. Bevara en befintlig fungerande identitet
när både innehåll och avsedd användning matchar. Slå inte ihop olika ägares poster.
Förändrad film eller ljudhash ger ny tillgång och ogiltigförklarar tidigare
audiovisuell acceptans för den tagningen.

## Fryst Kevin-underlag för importplanen

Läsande GitHub-granskning 17 oktober:

- `kevin`: `31f50618d071667476c9b7f4a85dfed951e23d53`.
- `kevin-staging`: `57f3ce8b6fb69f8fb246b31020e1e422d1629e2e`.
- Källa: `kevin/croupier-scoutgg/`, intern dealer `dragge`.
- Befintliga Dragan-medieblobbar matchar mellan brancherna; staging tillför
  portugisiska. En branch är inte bevis för driftsatt SHA eller aktiv miljöflagga.

Importplanens utgångspunkt är `kevin`-revisionen och dess sv/en.
Portugisiska behandlas som ett separat tillägg från den frysta stagingrevisionen.
Blanda inte rörliga branch-heads under en körning.

Granskad referensmängd: 56 poseklippssökvägar inklusive förladdning/reservvägar,
`vila.png`, tre idleklipp och 81 replikfiler/textnycklar per tillgängligt språk.
Identifierade server-/klientvägar når 56 replik-ID:n inklusive fallback/preload;
GPU-förhämtning refererar dessutom `goodluck_2/3` för sv/en.
**81 katalogfiler får därför inte bli 81 automatiskt aktiva repliker.**
Externa avatarbanker ingår inte automatiskt i Git-inventeringen.

Generera ett granskningsmanifest från kodreferenser, språkregister och Git-träd:
källcommit, källsökväg, Git-blob-ID, storlek, kategori och användningsorsak.
Skilj `playback`, `preload`, `fallback`, extern worker och orefererat.
Ladda sedan ned endast urvalet och beräkna SHA-256; Git-blob-ID är inte filens
SHA-256. Matcha mot Neon innan uppladdning. Vår spelare behöver inte importera
Kevins fallbackvarianter om samma funktion redan är täckt, men sådana undantag
ska stå explicit i manifestet.

Källor vid frysta revisioner: `public/dealers.js`, `server/shared-table.mjs`,
`server/server.mjs`, `server/media-registry.mjs`, `public/shared-table.js`,
`public/dealer-remarks.js`, `server/rorlig-lipsync.mjs` och
`server/dragge-voice.mjs`. Kataloggranskning är inte visuell acceptans.

## Kontrollerad Dragan-migration

Planen ska kunna köras om utan att skapa nya kopior. Varje rad beslutas som
**återanvänd**, **importera**, **korrigera bindning**, **behåll skyddad** eller
**raderingskandidat**. Körordning:

1. Frys källmanifest, målmiljö/scope, projekt-/mediarevisioner och alla beroenden.
   Spara ett privat återgångsunderlag med gamla bindningar och exakta objekt.
2. Förhandsgranska differensen inklusive befintliga original, talreferenser,
   bankmanifest, språk, aktiva jobb, alias och publiceringspaket.
3. Återanvänd identiska godtagna tillgångar. Ladda upp saknade byte oföränderligt,
   läs tillbaka och verifiera hash/storlek innan registrering.
4. Registrera och klassificera genom befintliga tjänstekontrakt med revisionsskydd.
   Byt utkastets bindningar atomiskt; import skapar ingen publicering automatiskt.
5. Verifiera plats 1–7, dealer/hole/flip, posekedjor, språk/ljud och talbankens
   exakta bildrutor. Publicera ett nytt granskat paket; ändra inte gamla paket.
6. Läs om beroenden och jobb efter bytet. Presentera en exakt raderingslista med
   media-ID, hash, sökväg, orsak och skyddade undantag. Fysisk radering sker sist.

Återgång före fysisk radering återställer bindningar med revisionskontroll och
behåller föregående fungerande publicering. Blob och SQL är inte en gemensam
transaktion: avbrutna uppladdningar och pending deletion måste kunna återupptas.
Återgång efter fysisk radering kräver verifierat bevarade originalbyte; ett
Git-commit är ingen backup av molnmedia.

Den tidigare inventeringen visade 56 Dragan-poster, 54 innehållshashar och två
dublettgrupper (idle och deal_pos4). Det ger inte rätt att radera alla 56.
Banken i den lokala checkpointen refererar till exakta befintliga ID:n/hashar;
om dessa ändras måste banken byggas och verifieras på nytt.

## Raderingskontrakt för Admin

Dagens skydd ska bevaras: arkivering före permanent radering, revisions-/hash-
kontroll, objektlås, spärr för retained-bank, publicerade paket, andra ägare,
aktuella referenser och aktiva uppladdningstillstånd. Befintlig sekvens är
`pending → radera Blob → deleted` med förnyad behörighetskontroll.

**Implementerat referensskydd:** `inspectMediaDeletion` läser dokument, paket och
alias samt exakta ID-/sökvägsreferenser i Forge-profiler, icke-terminala Forge-jobb
(inklusive `submit_unknown`), sparade talsvar och talpaketens metadata. Avslutade
Forge-input är historik, medan läsbara talpaket fortfarande äger sina outputfiler.
Saknade tabeller, överskridna sidgränser eller okända svar stoppar radering.
Raderingstjänsten kontrollerar dessutom det faktiska Neon-runtimeindexet via
`readIndex`; det skyddet ska återanvändas, inte beskrivas som saknat.
”Inte vald i utkastet” är inget raderingsbevis. `findMediaReferences` anger
själv ofullständig täckning.

Färsk läsande granskning 17 oktober hittade tio operatörspaket. Swedish-games
v1–6 bevarar Dragan och v3–6 fryser 36 filmer; v7 är tom. Inga Forge-jobb eller
Forge-profiler hittades. Två talleases var utgångna och 60 GPU-sessioner terminala.
56 begäranden med `submission_uncertain` saknar paketmetadata och kan därför
inte tillskrivas aktiva Dragan-jobb eller avfärdas genom ett antagande.
De fyra ID:na i de två Dragan-dublettgrupperna hittades inte i granskade paket,
aktuella dokument eller dokumenthistorik. Det är kandidatinformation;
full jobb-/lagringskontroll krävs fortfarande före radering.

Forge fångar nu media-ID, SHA-256, sökväg och revision för faktiskt använda
referenser. `insertJob` och återöppning av jobb kontrollerar dem atomiskt mot
pending/deleted/arkiverad media under samma Studio-scopelås. Före submission
och commit kontrolleras referenserna igen. Ett gammalt jobb får registrera ett
osäkert leverantörsutfall efter arkivering; det får inte återaktivera raderad media.
Befintliga projekt-/publicerings-/register-/klassificeringsspärrar ska återanvändas.
Riktade regressionsprov hör hemma i `lab/test/dealer-lifecycle.test.mjs`,
`lab/test/dealer-forge.test.mjs` och `test/speech-reply-repository.mjs`.
`deduplicate-media.mjs` hanterar äldre layout/index och får inte användas som
om det redan täckte hela Neon-grafen.

Taljournalen saknar fortfarande exakta indatareferenser för äldre strömmande
jobb. Därför stoppar inspektionen radering konservativt när miljön har en
icke avvecklad GPU-session, giltig tallease eller oavslutad fullfilsbegäran.
Gamla förbrukade strömnycklar blockerar inte ensamma. Inspektionen tar talets
befintliga miljölås efter Studio-/objektlåsen och behåller det tills transaktionen
slutar. Detta skyddar den observerade sessionsbilden; det är inte ett påstående
om gemensam atomisk mediaadmission för alla talvägar. Den nya rörliga vägen
har separat atomisk admission i optional migration 013; den måste vara införd
innan den vägen aktiveras. Äldre sessions osäkerheter kvarstår.

Gemensamt målkontrakt före utökad direkt radering:

- En jobb-/sessionsreferens binder exakt scope, dealer, media-ID/hash,
  bankrevision och ägande jobb. Nya jobb och publiceringar måste kontrollera
  samma deletion-status under samma transaktions-/låsningsgräns.
- En pending-markering får inte införas om en aktiv eller osäkert inskickad
  referens finns. När pending väl finns nekas nya referenser och sena commits.
- Skydda queued/submitting/running/cancelling och osäkra leverantörsutfall.
  En utgången lokal lease är inte ensam bevis för att GPU-jobbet slutat.
  Frigör först efter bekräftat slut/avbrott och hanterade sena callbacks.
- Beroendeinspektionen ska rapportera om täckningen är komplett; ofullständig
  katalog, fler sidor eller okända referenser stoppar permanent radering.
- Behåll original och frysta paket. En enklare knapp får ändra användarflödet,
  men får inte kringgå serverns beroende-, behörighets- och revisionskontroller.

Exakta statusnamn och minsta schemaändring fastställs mot respektive existerande
jobbmodell före implementation. Detta är ett kontraktsförslag, inte en redan
införd gemensam lease-tabell.

### Körbar importplan v1

`tools/dealer-import-plan.mjs` använder befintlig registrerad dealer, slotkatalog,
filnamnsgranskning och metadataregler. Källmanifestet är fryst till Kevin
`31f50618d071667476c9b7f4a85dfed951e23d53` och innehåller 247 källrader från sv/en,
posevägar, idle, bilder och källmetadata. Nåbara klipp, förhämtning/reserv,
bytealias och orefererade filer redovisas var för sig.

```powershell
node tools/dealer-import-plan.mjs --plan --project <privat-project.json> --dealer dragan --source-alias dragge --inventory <privat-inventory.json> --source-root <befintlig-Kevin-checkout>
```

`--source-root` är valfri och läser enbart befintliga original. Varje funnen fil
måste matcha fryst Git-blob och storlek; därefter beräknas separat SHA-256.
Ett Git-objekt-ID är aldrig ett bevis för mediets registrerade SHA-256.
UUID-namngivna lokala original kan i stället läsas med `--source-map`, en privat
JSON med `schemaVersion: 1`, absolut `root` och `files` som mappar fryst källväg
till lokal fil inom roten. Samma bytekontroll gäller; verktyget flyttar inget.
Planen kan återanvända en entydig befintlig identitet med bevarad klassning.
Poseåteranvändning kräver hashbunden kalibrering; inspelat tal kräver exakt
text/ljud/video/index. Fel dealer, flera träffar eller skyddad media kräver granskning.

Planradernas `placement` innehåller pose, val, ljudpolicy, språk och repliknyckel.
Fälten är ännu inte nya produktionsfält i videoschemat. Alla rader har
`applyAllowed: false`; verktyget har varken `--apply`, uppladdning eller radering.
Saknade talfack och verifierade ljud-/index-/kalibreringsuppgifter behöver lösas
innan en import kan genomföras genom ordinarie revisionsskyddade skrivare.
Admin-agentens befintliga importcallback och API behöver ingen ändring för denna etapp.

Praktiskt prov mot projekt-/mediaexport 17 oktober 01:49 UTC: 38 återanvändningar,
8 kopplingar att granska/rätta, 129 granskningsrader, 67 exkluderade och
5 rena referenser; ingen direkt import. Första körningen verifierade 46 av 247
källvägar med redan lokala original (41 unika filer). Efter ett avgränsat
innehållsstickprov är 52 av 247 källvägar byteverifierade; planens klassningar
är oförändrade. Detta är ingen innehållsacceptans av de återstående filmerna.

Stickprovet omfattade tolv klipp med lokal Whisper-tiny-transkribering och fyra
bildrutor per klipp. Nio original (5,93 MB) hämtades och verifierades mot frysta
Git-blobbar och SHA-256. Svenska/engelska kommer från Kevin-revisionen ovan;
portugisiska från den separat frysta stagingrevisionen och ingår inte i basimporten.
`chatter`, `placebets` och `greet_jakob` verkar motsvara småprat, spelinstruktioner
och personlig hälsning. Det är preliminära klassningar: modellen gör tydliga
ord-/namnfel, särskilt i korta svenska och portugisiska repliker. En avvikande
transkribering bevisar därför inte fel i inspelningen. Ingen semantisk eller
audiovisuell acceptans utfärdades. Registrerade `sv/win_1` har andra byte än
Kevin-filen; ursprung och talinnehåll måste klarläggas före omkoppling.

Tekniska testnamn som `dragan-speech-probe.mp4` är inte produktkategorier.
OpenClaw kan välja en replik vid inaktivitet; den utlösaren är separat från
klippets funktion, språk, pose och eventuell alternativ tagning. Den gemensamma
guiden i `web/public/dealer-clip-guide.mjs` beskriver dessa skillnader för Admin.
Guiden visar slotmallar och granskningskrav; den intygar inte ett enskilt klipps
faktiska start-/slutpose eller visuella kvalitet.

### Färska dublettkandidater, 17 oktober

Read-only Blob-listning av `croupier/media/dealers/dragan/` gav 56 objekt,
79 963 657 byte. De fyra objekten i tabellen hämtades från origin och hashades
utan att sparas lokalt; båda parens byte och SHA-256 matchade. Övriga 52 objekt
har inte hashats om i denna etapp.

| Innehåll | Föreslagen befintlig identitet att behålla | Nyare dublettkandidat | Identiska byte per objekt |
| --- | --- | --- | ---: |
| Äldre idle | `97100320-238f-4b3a-8168-6226887038be` | `c2b4235e-4c22-4cc6-a3b0-dfc6b9bbaf10` | 4 284 756 |
| deal_pos4 | `0a72227e-d48a-4422-b575-6bcaebbc6478` | `9958ddcc-987c-40a9-bbea-d2b85a418a71` | 1 035 146 |

Detta är två kandidater, inte ett godkänt raderingsjobb. Ingen av de fyra
posterna var arkiverad. Aktualitet, komplett beroendeinspektion, jobbreferenser,
uppladdningsgräns och fysisk sökväg/hash måste kontrolleras om vid mutation.
Lokal talbank och original skyddas även om inga publiceringsreferenser hittas.

## Gemensam talworker: återanvänd tjänsterna, byt motorn kontrollerat

Integrationen efter PR191 binder nu varje rörlig talsession till samtliga exakta
bankoriginal, profilrevision, publicerat paket och ett eget RunPod-jobb. Optional
migration 013 sparar dessa referenser och en beständig totalbudget; vanlig
medieradering tar hänsyn till dem. Funktionen är avstängd tills schema, privat
workerimage, bank och separat testmiljö har verifierats. Aktuell leveransstatus
och återstående driftprov finns i [handoff](../JOHN-HANDOFF.md).

Jakob har valt ett separat Dragan-testrum utan att återöppna pausade operatörer.
Första liveprovet använder bankens explicita vilobild mellan kortsekvenser.
Samtidig utdelning och dynamiskt tal är ett senare steg, inte verifierat av
denna integration. Originalfilerna behåller sina identiteter: tydligare
visningsnamn och kategorier kräver inte radering och återuppladdning. Verifierade
dubbletter kan prövas för arkivering först efter färsk beroendekontroll.

Målet är en delad workerimplementation med validerad bank/profil per dealer.
En endpoint kan betjäna flera dealers genom separata jobb/sessioner; det betyder
inte att en GPU klarar obegränsat samtidig belastning eller att bankerna kan blandas.
OpenClaw-roller är inte GPU-avatarer.

OpenClaw är fortsatt standardägare av den dynamiska texten. Flödet är
OpenClaw-beslut → registrerad röst/TTS → exakt PCM → vald och verifierad
bildrutebank → läppsynk i dealerlagret. Workern väljer varken repliker, spelkort
eller filmer. Förinspelade repliker spelar sin egen verifierade video och sitt
inbäddade ljud och behöver inte genereras igen. Ett filnamn eller en uppladdning
aktiverar inte detta flöde automatiskt.

Lokal checkpoint: [setup och återkörning](../AI/lipsync-lokalt-2026-10-17.txt),
tagg `lipsync-local-dragan-2026-10-17`. Sparad replik, modeller, bank och WSL-miljö
är fortfarande privata arbetsdata. Provet är offline; 11,8 fps lokalt är inte
realtidsacceptans. Tidigare varm A6000-mätning är inte ett kallstarts-/spelprov.

Första workerleveransen:

1. Versionera granskad motorkälla eller en verifierad oföränderlig källartefakt.
   Lås basimage, Python-/CUDA-/paketversioner, MuseTalk-commit och modellhashar
   mot det fungerande provet. Det äldre Astrid-receptet har andra Torch-versioner
   och delvis olåsta beroenden; därför förbereds ett separat versionslåst recept.
2. Bygg separat image och verifiera samma sparade ljud/film, full frameordning,
   originalytor, timing och audiovisuellt resultat. GPU-byte får inte byta modell.
3. Anslut till befintlig autentiserad talsession, journal, budgetreservation,
   engångsbiljett, cancel och idle-avveckling. Implementera bankattestering,
   dispatcher, omplanering och spelarens ljudklocka för den rörliga motorn.
4. Ersätt hårdkodade avatar-/imagebegränsningar med en explicit tillåten release-
   och bankkonfiguration. Mät kall/varm första bild/ljud, avbrott och verklig kostnad.
5. Aktivera Dragan kontrollerat. Utvärdera Astrid på samma väg innan äldre
   kompatibilitetsnamn, endpoint, bilder eller byggjobb kan avvecklas.

Den tidigare tillfälliga Dragan-podden avvecklades efter provet. Astrids endpoint
är separat och ska inte raderas på grund av sitt namn. Arbetskatalog,
container-image, GitHub-workflow och RunPod-endpoint är olika saker.
Aktuell molnstatus måste läsas om inför nästa förändring; denna plan skapar ingen
pod eller återkommande drift. Nästa betalda prov använder bara återstående del
av uttryckligen godkänd testbudget efter avstämning av tidigare förbrukning.

Förberedelsen ligger i `services/moving-gpu-worker/`: versionslåst motor,
MuseTalk, Pythonpaket och modellhashar, separat Dockerrecept samt bank-/sessions-
validering. `web/moving-speech-transport.mjs` accepterar nu en separat egen image
med SHA-256-digest. Den kräver workerintyg för release, dealer, avatar,
profilrevision, källbank, arkiv, bankkvitto, session, försök, nonce och faktiskt
accepterat RunPod-jobb innan `bind` och första PCM skickas. Äldre transportväg
behåller sina begränsningar; ingen route eller endpoint aktiveras automatiskt.
Bankens avatar heter `dragan`; den ska inte döpas om till `dragge` utan nytt
verifierat bankunderlag. Imagen och bankintyget verifieras separat.

Den egna motorn kräver en explicit bildruteplan för 220 ms inledande och 530 ms
avslutande tystnad: en sekund PCM ger 42 rutor vid 24 fps. Antalet räknas i
hela ljudsamplingar: `floor((pcmBytes / 2 + 18000) / 1000)`. Det undviker
flyttalsfel vid exakta bildrutegränser. Vila använder alltid sin källruta 0,
även när planen upprepar den. För kort plan får
inte lösas genom att motorn håller kvar en godtycklig sista ruta.
Socket-/protokolltester bevisar inte visuell läppsynk eller livekapacitet.
Egen kallstart har högst 150 sekunder till första `pong`, inom transportens
totala 180 sekunder; normal I/O och behörighetskontroller behåller 15 sekunder.
Separat PR-workflow `moving-gpu-build.yml` bygger serverless-target på CPU
och kontrollerar paketerade importer utan nät/GPU. Den publicerar ingen image
och skapar inga molnresurser.
Verifierat 17 oktober på kodhead `19103fcf6301b4f8e2ae2ef78690943919cdc97f`:
[serverless-containerbygget](https://github.com/Jakeminator123/scoutgaming/actions/runs/38994132683)
passerade med sju verifierade modellhashar och 31 tester både under bygget och
i den färdiga containern utan nät, som icke-root. Releasekvitto:
`d6a799c104281b6e180c8285ba464b6420f6b4a4e3d20369ecab0a2d40988eb8`.
[Full produkt-CI](https://github.com/Jakeminator123/scoutgaming/actions/runs/38994132656)
passerade också, inklusive isolerad PostgreSQL och schemaberedskap. Imagen är
byggd men inte publicerad; en lokal image-ID är inte ett publicerat OCI-digest.
GPU-prov, journal-/dispatcheranslutning och faktisk spelarintegration återstår.
Docker finns inte installerat i den kontrollerade Windows-/WSL-miljön; bygget
kördes i GitHub Actions. Läsande RunPod-kontroll 17 oktober 01:42 UTC visade inga
pods och endast den befintliga endpointen `croupier-astrid-gpu-test`.

## Filansvar, ersättning och parallellt arbete

| Del | Återanvänd/utöka | Ersätter eller kan senare tas bort | Verifiering |
| --- | --- | --- | --- |
| Import och klassning | `lab/lib/dealer-import-*`, `video-intake.mjs`, `lab/schemas/video.schema.json`, befintlig importassistent | Dubbla namnregler och poseinformation enbart i fritext; inte alla gamla medieposter | Felstavat/motstridigt namn, språk, fel dealer/box, upprepade importer |
| Pose och spel | `packages/presentation/runtime/filmed-deal-sequence.mjs`, `web/filmed-deal-selection.mjs`, hashbunden Kevin-profil | En hårdkodad profil kan ersättas först av validerad likvärdig registerdata | Posekedja, exakt kortposition, saknat klipp, fryst paket |
| Register/radering | `web/storage/studio-repository.mjs`, `lab/lib/studio-media-deletion.mjs`, Forge-/taljobbtjänster | Ofullständig beroendeinspektion; inga tabeller töms | Race mellan nytt jobb/publicering och radering, tvärscope, retries, sena callbacks |
| Talworker | `services/moving-gpu-worker`, `web/moving-speech-*`, befintlig gateway, `generated-speech-stream.mjs`, journal | Byggrecept/handler stegvis; äldre fullfilsmotor/avatarberedning först utan konsumenter | Fel bank/dealer, nekad budget, avbrott, tidsgränser, ljudsynk |
| Dokumentation | Denna guide, runtime, handoff, AI-ingång | Äldre generella beskrivningar som säger att repo-/Blob-JSON är produktregister | Länkar och tydlig gräns mellan plan, implementation och daterat kvitto |

Radera inte tester för aktiva kontrakt bara för att deras filnamn innehåller
Astrid eller Kevin. Ersätt assertions för avsiktligt avvecklad implementation
och ta bort ett gammalt test först när aktivt beteende täcks på sin nya plats.
Medieoriginal, kalibrering och privat checkpoint är inga genererbara byggrester.

Arbetsordning utan ny tracker:

- **Kontrakt/import:** konkret manifest, metadata-/schemadiff och återkörbar plan.
- **Referensskydd:** parallell inventering; implementering mot samma fältnamn,
  lås och jobblivscykel. Måste vara färdig före utökad fysisk radering.
- **Worker:** reproducerbart bygge kan göras parallellt med importplanen.
  Produktaktivering väntar på slutliga bank-/profilidentiteter.
- **Admin:** huvudagenten äger UI, sparstatus och integration. Biblioteksvisningen
  ansluter till det gemensamma kontraktet; navigation behöver inte vänta på worker.
- **Integration:** granska små PR:er med avgränsad filägare. Källmaterial från
  Kevin importeras på exakt revision; hans branch mergas inte som en genväg.

## Historiskt underlag och kvarvarande osäkerhet

[Filinventeringen 16 oktober](BLOB-NEON-INVENTERING-2026-10-16.md) är ett daterat
belägg, inte dagens raderingslista. Den observerade 1710 Blob-objekt och 79
produktionsklipp. Den beskrev även 12 äldre PAOW-svar med saknade mediafiler
och avgränsade referensluckor; dessa hör inte till Dragan-uppdraget.
Dess metod och dåvarande registermodell finns länkade till den frysta
guideversionen. Ingen historisk observationssiffra räknas om utan en ny inventering.

Den genomförda kontrakts- och förberedelseetappen innebär
ingen fullständig visuell klassning av alla Kevin-filmer, ingen verifiering av
hans driftsatta tjänst och ingen ny fullständig Blob-hashläsning (endast de fyra
dublettobjekten ovan hashades nu). Sådana belägg
ska samlas för det faktiska urvalet när importplanen körs.
