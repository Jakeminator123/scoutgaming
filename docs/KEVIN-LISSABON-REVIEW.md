# Kevin/Lissabon: granskning och nästa integration

## 2026-09-29 — gemensamt Lab och selektiv Kevin-integration

**Aktuellt läge; äldre avsnitt nedan är daterad historik.**

| Del | Ingår nu | Bevarat/återstår |
| --- | --- | --- |
| Kortprojektion och handmasker | Kevins bildrutestyrda renderer från `0d12b7a5`; nu även exakt dolt kort och vändning | Ouppmätta varianter får statisk reserv; ingen filmad full insamling |
| Filmbyte | Verifierad cache med 96 MiB mål, en förberedd decoder och en films framförhållning i öppningssekvensen | Pinnade aktiva klipp får inte kastas; iOS/native-URL-undantaget importerades inte |
| Spel och identitet | Vår serverägda shoe, kort, saldo, sessionsägarskap, konton och turordning | Kevins delade bord/deadlines och spelmotor importerades inte |
| Lab/Lissabon | En startare i `lab/start.mjs`, fokuserad studio på `/`, avancerad på `/tree`, `/lissabon` omdirigerar | Privata `lissabon/data` återanvänds utan flytt; historiskt namn behålls i kompatibilitetsflaggor |
| Inställningar | En produktionsseed, utan nio gamla demotriggers, 192 demovarianter eller 48 överflödiga exempelassets | Egen redigering och beroenden skyddas av exakta fingerprint-jämförelser; före-revision sparas |
| Filmregister | `presentation-runtime/media-families.mjs` äger familjer/sökvägar; byggare/validator/UI delar det | Genererat manifest har 28 familjer/45 MP4. Schema kvar under `lab/schemas` |

### Verifierat lokalt

- `npm --prefix lab test`: **492/492**, inklusive migration och faktisk katalogprojektion.
- `npm --prefix lab run typecheck` och koordinerat Next-produktionsbygge: godkända.
- 33 riktade tester för kort, auktoriserad reveal, delade hämtningar, avbrott, cachegräns och migrering.
- Full `.githooks/pre-commit` passerar; dess valfria systemberoende hoppade över ett prov.
- `node pipeline/audit-dealer-sync.mjs --probe`: oförändrade fyra dealerbaslinjer godkända. Kända saknade tal: Vera 8, Amira 2, Mei 3, Astrid 0. Ingen ny läppsynkacceptans.
- Koordinerat **enda** produkt/labbpar, tom temporär testdatabas, endast lokala tillåtna nätverksportar. Inga GPU-/röst-/modellkörningar.
- Browser: öppna Lab → Anslut → faktisk Astridspelare, minst två kompletta rundor med standardfilm, dolt kort, reveal och dealerextrakort. Inga konsolfel/varningar i stickprovet. Både `deal_hole` och `deal_flip` gav `video-frame-track` vid avslut. Kortet förblev dolt före reveal.
- Mobilprov med 390×844 viewport utfört; tillfälligt testläge återställt på Jakobs begäran och normal fönsterstorlek verifierad. Inga permanenta zoom-/layoutinställningar ändrade.
- Skärmbilder sparades som lokala Codex-artefakter för spel och den samlade kortkatalogen; inga privata konversationer exporterades.

### Uppmätt, med begränsning

Två observerade öppningssekvenser gav **27–42 ms** från PerformancePlayers
startanrop till första presenterade bild för de fyra förladdade utdelningsklippen.
`goodluck`: 71 respektive 54 ms. Flip: 46 ms vid första hämtningen, 17 ms med
varm cache. Kvittot innehåller `elapsedMs`, `mediaReadyMs`, `preloadHit`,
`cacheHit` och faktisk `video-frame`. Klippvalets HTTP-anrop sker före denna
mätpunkt. Detta är lokala stickprov, **inte** A/B-förbättring, komplett
svarslatens, första hörbara ljud, mobilnätsmätning eller GPU-kostnad.

### Fortfarande oprövat / nästa steg

- Jakob avslutade dagens manuella prov och avgränsade arbetet till Astrid.
  Därför kördes ingen ny fyra-dealer-rehearsal i denna leverans. De andra
  dealerbaslinjerna är automatiskt kontrollerade, men det är inte ett nytt
  visuellt prov. En pågående spelarhand bevarades när automatisk granskning
  nekade navigering innan avgränsningen kom.
- Visuell granskning av alla ytterplatser, split, verklig telefon/iOS,
  kortinsamling och mänsklig A/V-acceptans. Varianter kräver egna mätningar.
- Ingen Vercel-/Render-deployment, GPU-körning, Redis/Upstash eller ny
  betaltjänst har startats. AI-text/TTS/GPU-latens är inte mätt i detta prov.
- Nästa åtgärd: Jakobs granskning av Astrids lokala spel-/Lab-vy före vidare
  molnintegration. Fortsätt därefter med återstående Astrid-acceptans;
  övriga dealers ligger utanför dagens avgränsning.

### Rensning och återgång

Fem gamla `lissabon`-start-/snapshotfiler är ersatta av gemensam Lab-kod och
flyttade tester. Den stora snapshoten var en kopia av seed med några idleval;
nu finns dessa val i `lab/policies/local-profile.json`. Gamla demo-seed ligger
enbart i `lab/test/fixtures` för tester av bakåtkompatibilitet. `lissabon/data`,
aktiva filmer, modellunderlag, 3D-källor och privata env-filer är orörda.

Kod/ny standard kan återtas från föräldern `f2dce6fc`; återför endast
uppgiftens filer, aldrig andras commit eller hela arbetskopian. Sparade
projekt kan återställas från sin egen före-revision i `history` via ordinarie
revisionskontroll. Gamla mediebytes/baslinjer har inte skrivits över.


Granskat 2026-09-28. Vår bas: `e61261be` på `jakemanator123-github-work`.
Källa: [codex/astrid-languages](https://gitlab.com/scout-gg/croupier/-/tree/codex/astrid-languages),
verifierad fjärr-HEAD `0d12b7a559d328a333598b7e583b980e88d7925c`.
Den hämtades endast för läsning till `refs/review/kevin-astrid-languages`.
Ingen GitLab-push, inbox eller deployment ingår.

## Vad länken faktiskt innehåller

Branchen är leveranskopian av `EmaCodeHero/astrid-lipsync-demo-2` enligt dess
`LANGUAGE-HANDOFF.md`. Senaste committen har författaren ImpactPL och beskriver
Kevins granskning. Den är verifierad som den branch Jakob länkade, men inte
som den senaste av alla Kevins arbetsbrancher. Ingen gemensam Git-bas finns
med vårt nuvarande repo. Ta över avgränsade moduler med proveniens; helmerge
eller ersättning av vår spelmotor skulle bli fel integrationsmetod.

## Befintlig kedja och mediekälla

Spelservern äger kort, shoe, spelar-id, saldo och resultat. Browsern översätter
serverhändelser till uppspelning. Lissabon är en start-/konfigurationsmiljö:
den använder vår Web-spelare, `presentation-runtime`, Lab-projektet och
`emil/dealklipp-v1/lab-video-manifest.json`. Själva mobilfilmerna finns i
`emil/dealklipp-v1`, inte i en separat spelmotor under `lissabon`.
Rätt ingång är Astrid med `presentation=local`.

Alla åtta standardfilmer för `pos1`–`pos7` och `posdealer` har **identiska
Git-blobbar** i vår mediebank och den granskade branchens `public/media/deal`.
Ingen omkodning eller ny nedladdning behövs för dessa. Våra tre varianter har
ingen bevisad matchande kalibrering. Källans separata `hole.mp4` och `flip.mp4`
saknas i vår aktiva Lissabon-bank och måste införas som kompletta mediepaket
om deras rörelser ska användas.

## Vad som är bättre och vad vi kan återanvända

| Område | Granskad branch | Vår aktiva Lissabon-väg | Åtgärd |
| --- | --- | --- | --- |
| Kort under utdelning | `game-cards.js` följer filmens kortyta med två projicerade trianglar och synlig papperskontur | `deliverCard()` väntar på hela filmen och lägger sedan ut DOM-kortet; kvittot anger `calibratedContact: false` | Återanvänd projektion och source-frame-spår för de åtta exakta standardfilmerna |
| Handkontakt | `card-table-layout.js` flyttar gamla kort vid uppmätt kontaktruta, inte när hela klippet slutar | Ingen sådan koppling på råfilmsvägen | Koppla kontinuerlig `requestVideoFrameCallback` till samma serverägda `shoeDraw` |
| Fingrar framför kort | `dealer-hand-occlusion.js` maskar hela kortlagret, även redan lagda kort | Vår äldre performance-väg har masker, men de används inte av Lissabons råfilmer | Återanvänd källans exakta handspår; verifiera på mobil |
| Stabilitet | Ett SVG-element per `shoeDraw`, bibehållet vid reveal, split och omladdning | Kortidentiteter finns, men presentationen har flera vägar | Behåll serveridentiteten genom adaptern; undvik dubbla spelare |
| Kortplacering | 63×85 källpixlar, begränsad diagonal solfjäder, separat dealer-rad och splitplacering | DOM-layout efter film | Återanvänd layouten utan att applicera perspektiv två gånger |
| Uppspelning | Två videolager, nästa decoder förbereds, prioriterad cache, iOS använder native-URL | Hashverifierad Blob-cache, nytt videoelement per film, första synliga ruta och ended-kvittens | För in förladdning stegvis; behåll vår hashkontroll och avbrottsägare |
| Delat bord | Serverplan med beständiga deadlines och återanslutning till aktuell tid | Individuell serverägd shoe per spelare | Separat produktbeslut; importera inte delad timer/chattsynlighet som bieffekt |
| Upplockning/insamling | Renderer rensar kort när rundan försvinner; detta visar inte en filmad fullständig insamling | Separat avslutningsväg | Kräver ett eget visuellt prov; anta inte att all handkontakt är löst |

Källans cache har 96 MiB målgräns och laddar relevanta kort/fraser före spel.
Det kan minska väntan mitt i rundan men öka första laddningen. Mät på mobil
innan samma förladdningskrav införs här. Våra OpenClaw-regler, privata minnen,
talägarskap och GPU-kostnadsspärrar ska följa vår befintliga väg.

## Verifierat i denna granskning

- 36 riktade källtester för kortlayout, faktisk SVG-renderer, handmasker,
  återhämtning efter paus och videobuffring har passerat. Första körningen
  saknade handmasktestets mediefixtur; omprovet med källans exakta tio filmer
  och mätfil passerade. Koden kördes isolerat i temporär katalog.
- Handspårens SHA-256 kontrollerades av källtestet mot dess faktiska filmer.
- Våra åtta standardfilmer jämfördes med Git-blob-id mot källan; alla lika.
- Agent-talk testades med tio samtidiga skribenter, överlapp, kvittens,
  frigöring och begränsad historik. Lokal status och lås utesluts från Git
  och Docker-kontext. Anvisningar: `agent-talk/README.md`.

Vid den första granskningen var den kombinerade produkten ännu oprövad och
ingen spelarkod importerad. Nästa avsnitt om kortintegration beskriver den
efterföljande implementationen och dess begränsade browserprov.

## Webbplats och databas

Föreslagen första topologi: enkel Vercel-sida → Blackjack → HTTPS-spelserver
med inloggning → samma Astrid/Lissabon-presentation. SQLite finns redan med
servergenererat spelar-id, lösenordshashning, sessionscookie och transaktioner
för spel/saldo. Nuvarande produkt kopplar in CRAIG-identitet och stänger därför
av självregistrering; Lissabons namnlösa/lösenordsfria profiler är endast lokala.
En publik spelarregistrering behöver en uttrycklig kontoägare och kan inte
åstadkommas genom att slå på det lokala profilundantaget.

SQLite kan ligga på en beständig backend med en replika. Vercels funktionsdisk
är inte beständig eller gemensam mellan instanser, enligt
[Vercels SQLite-dokumentation](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel).
Om även spelservern ska ligga i Vercel krävs en separat databas samt anpassning
av transaktioner, projektlagring och händelse-/sessionshantering. Att enbart
byta inloggningssida löser inte dessa beroenden.

## Implementerad förberedelse efter granskningen

- `ops/vercel-entry` bygger en enkel statisk startsida med Blackjack-knapp.
  Exakt spelserver-origin krävs; localhost avvisas i vanligt bygge.
- `/blackjack` på vår spelserver erbjuder inloggning och, när
  `CROUPIER_PLAYER_ACCOUNTS=1`, separat spelarregistrering med användarnamn.
  Efter inloggning öppnas Astrid med `presentation=local`.
- Spelarkonton återanvänder SQLite och serverns befintliga spelar-id. En
  separat kontonamnrymd och sessionsstämpel bevarar CRAIG-/BO-gränsen.
  Den nya flaggan når endast Web i molnstartaren. Lokala lösenordsfria
  namnprofiler används inte samtidigt som den nya kontovägen.
- Tester provar registrering, inloggning, fel lösenord, främmande origin,
  kontoborttagning/hashändring, utloggning och nekad BO-åtkomst. Ett riktigt
  isolerat Web-HTTP-prov med tomma databaser bevarar spelar-id, saldo och
  bordstillstånd över processomstart; statiska ingången byggs i samma prov.
  Alla testprocesser stängs och testdatabaser tas bort.
- Ordinarie produkt/labbpar är fortsatt stoppat. Ingen Vercel-deployment,
  GPU-körning eller privat datamigrering ingår. Browsergranskning av den nya
  inloggningen återstår. Konfiguration och driftbegränsningar finns i
  `ops/vercel-entry/README.md`, inklusive den nu konservativa IP-begränsningen
  bakom proxy och avsaknad av lösenordsåterställning.

Nästa integrationssteg: besluta faktisk värd/origin och för in
kortprojektionen med de exakta standardfilmerna.
Behåll varianter utan kalibrering på den tydligt markerade reservvägen tills
deras egna spår är mätta. Använd tomma databaser för prov. Molnstartens
verifieringsspärr och tidigare krav på budgetgodkännande gäller fortfarande.

## Kortintegration — 2026-09-28

Kevins SVG-kort, projicerade framsidor, kontaktstyrda förflyttningar och
handmasker finns nu under `web/public/kevin-cards/`. Proveniens och anpassningar
står i dess README. Befintlig PerformancePlayer hämtar/verifierar samma MP4;
`requestVideoFrameCallback` förser kortlagret med faktiskt presenterad
`mediaTime`. Ingen separat videospelare eller spelmotor har införts.

`local-card-overlay.mjs` håller visade `shoeDraw` åtskilda från serverns
redan beslutade kommande kort. Återläsning, split, dolt kort, avbrott och byte
till reservfilm hanteras utan att avslöja nya kort för tidigt. En kalibrering
aktiveras endast för rätt plats och exakt SHA-256. Avbrutna/felande tagningar,
dolda kort och omätta varianter får inget kvitto på kalibrerad handkontakt.
Övriga dealers behåller sin gemensamma befintliga väg. Inga filmer eller
tidigare visuella godkännanden har ändrats.

Verifiering hittills:

- 25 riktade tester: faktiskt SVG-träd, handmask över befintliga kort,
  stabila noder, split/fyra händer, återläsning, dolda kort, avbrutna callbackar,
  omprov av halvvisat kort samt alla åtta standardfilmers faktiska SHA-256.
- `audit-dealer-sync --probe` passerar för fyra dealers mot oförändrad
  baseline. Kända saknade tagningar: Vera 8, Amira 2, Mei 3; Astrid 0.
  Detta är inte ett nytt läppsynkgodkännande.
- Isolerad produkt startad med den koordinerade jämförelselaunchern,
  `--game-only --media-directory <repo>/emil/dealklipp-v1`, tomma databaser,
  `localhost:4194` och spärrade externa generationstjänster.
- Browserprov: smal mobilvy (viewport override 390×844; Chrome rapporterade
  433×937 CSS-pixlar med befintlig zoom), två rundor i följd, extrakort,
  stand/avslut, återläsning mitt i första given. Kort låg på filmens kortyta,
  gamla kort fanns kvar, baksidekort var dolt och inga konsolfel noterades.
  Stillbilder fångades även under handrörelsen. Detta är ett stickprov av
  box 4/dealer, inte bildruta-för-bildruta-godkännande av alla åtta tagningar.
- Vera, Astrid, Amira och Mei: `?dealer=<namn>&rehearsal=1`, `greeting`,
  `Play twice` via riktiga spelaren. Samtliga återgick till aktiverade kontroller
  utan uppspelningsfel. Detta bekräftar livscykeln; ingen ny läppsynkacceptans.
- Testfliken stängd och den isolerade testservern stoppad efter kontrollen.

Kvarstående: Lissabon saknar exakt vald film för den dolda utdelningen och
visar `Exakt film saknas · 2D-reserv`; kortbaksidan visas statiskt. Kevins
`hole`/`flip`-spår aktiveras inte utan motsvarande filmer och egna
acceptansresultat. Filmad insamling/upptagning är inte integrerad. Visuell
split-, ytterbox-, landskaps- och verklig telefonkontroll återstår. Full
läppsynkbedömning kräver fortfarande mänsklig genomgång med ljud.

## Vercel och Redis/Upstash

Ingen Vercel-deployment eller Redis-tjänst har skapats. Vercel-ingången är
förberedd, medan spelserver, beständig SQLite och långa anslutningar fortfarande
kräver den beskrivna backendmiljön. Nästa driftsbeslut är exakt Vercel-projekt
och HTTPS-origin för spelservern.

Vercel erbjuder Redis via Marketplace, bland annat Upstash:
https://vercel.com/docs/redis . Det är en möjlig senare lösning för delad
rate limiting/cache vid flera serverinstanser. Det ersätter inte den
transaktionella spelardatabasen och förbättrar inte kortens bildrutesynk.
Ingen sådan integration införs innan ett mätt behov och driftmål finns.
