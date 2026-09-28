# Kevin/Lissabon: granskning och nästa integration

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
