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

Browserns faktiska mobiluppspelning, visuell handkontakt och våra alternativa
tagningar är ännu inte verifierade i den kombinerade produkten. Ingen
spelar-/mediekod har importerats som del av denna granskning.

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
