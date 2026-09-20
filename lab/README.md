# Croupier Studio — lokalt presentationslabb

Den nya Next.js-arbetsytan. Den riktiga spelklienten och OpenClaws egen
dashboard är separata. Inget du sparar här publiceras automatiskt.

[Historisk arbetsrapport: mappar, tester och videokoppling](../random-stuff-jakob/jakob-docs/arkiv/2026-09-20/2026-09-20-labbets-mappar-och-tester.md).

Aktuell läsväg: [systemkartan](../random-stuff-jakob/jakob-docs/systemkarta/README.md).
Buggar, förbättringar och öppna kontroller för labbet och övriga repot finns i
[findings](../docs/findings/README.md); implementation och QA följs i Jira CAC.

## Starta

**Windows: dubbelklicka [Start-Labb.cmd](../Start-Labb.cmd) i repots rot.**
Den använder [Start-Labb.ps1](../Start-Labb.ps1), öppnar webbläsaren och startar
studion om den inte redan körs. Ingen befintlig process stoppas, ingen nyckel
roteras och ingenting ändras på Render. Behåll serverfönstret öppet; Ctrl+C
stoppar servern i det. Efter en `.env`-ändring: stoppa den gamla servern först.

Node 22.16+ behövs; saknade beroenden installeras från låsfilen vid första start.
Variabler och placeringar utan hemliga värden: [_ENVIROMENT-INFO](../_ENVIROMENT-INFO.md).
Tekniska alternativ: `Start-Labb.ps1 -NoBrowser` öppnar inte webbläsaren;
`-CheckOnly` kontrollerar starten utan installation/serverstart; `-Port` väljer
en annan lokal testport. Kommandon för utvecklare, från repots rot:

```powershell
npm --prefix lab ci
npm --prefix lab run dev
```

Öppna <http://127.0.0.1:4188>. Stoppa med Ctrl+C. Den gamla lokala servern
ska inte köras samtidigt på samma port. För byggd version: `npm --prefix lab
run build`, därefter `npm --prefix lab start`. Studion är avsiktligt endast
för localhost; öppna den inte mot internet eller ett publikt nätverk.

## Fyra arbetsytor

- **Nodträdet (`/tree`):** spel → dealer → labbnod → konkret situation → linje → variant →
  animation/videoreferens. Alla fyra dealers använder samma eventkontrakt.
  Triggers är villkor för varianter, inte nya motor-events. Klicka vidare till
  editorn för att ändra den valda delen utan att tappa osparat arbete.

- **Eventstudion:** välj croupier/event, redigera namn, linje, varianter och
  triggers. Testa ett publicerat exempel med simulerad chatt, historik och
  framtoning. Den animerade scenen och beslutsspåret visar vad som händer.
- **Videobanken:** inspektera original och bind vald variant till ett exakt
  `videoGenerationId`. Efter ett eventtest kan scenen växla till just den
  videofilen. Detta är en labbkoppling, inte ett runtime-godkännande.
- **OpenClaw:** ansvar, anslutningsstatus och operatörschatt om det senast
  sparade projektet. Länk till den befintliga, separata native-dashboarden.
  Chatt kräver en konfigurerad anslutning; inga modellsvar fejkas.
  Här finns också **Prova rösten**: tre standardfraser, egen text eller en
  kopia av det senaste operatörssvaret. Explicit knapptryck genererar Sarah-röst
  via ElevenLabs (kan kosta krediter); återanvändning av samma prov kostar inget
  nytt modellanrop. Detta är separat ljud, inte spelarchatt eller videosynk.

## Filer och begrepp

```text
lab/
  policies/project.seed.json   startprojekt: blackjack, 4 dealers, 16 noder
  schemas/studio.schema.json   struktur och tillåtna värden
  animations/                 64 tysta, syntetiska rörelsesekvenser i JSON
  lib/studio-model.mjs         kontrakt, referenser, validering och konvertering
  data/project.json           ditt sparade projekt (lokalt, Git-ignorerat)
  data/history/               tidigare sparade revisioner (Git-ignorerat)
  data/voice-cache/            text/röst/modell-indexerade MP3-prov och metadata
  test/                       automatiska regler-, lagrings-, API- och videotester
  app/                        Next.js-sidor och lokalt API
  components/                 editor, scen, videobank och OpenClaw-panel
```

`policies` betyder här startregler; `schemas` beskriver strukturkraven.
`data/` skapas vid sparning och ersätter inte startprojektet i Git. Ingen separat
projektmanifest behövs. Rörelsebibliotekets lilla `animations/index.json`
listar däremot vilka rörelsefiler som ingår. `.next/` och `node_modules/` är
genererade verktygsmappar. [Rörelsernas format](animations/README.md).

Fristående ElevenLabs-prov (inte scen-/chattintegration):
`node tools/elevenlabs-lab-preview.mjs --check` från repots rot, eller
`--generate` för ett kort debiterbart röstprov. MP3 + text/röst/hash-metadata
sparas lokalt i `lab/data/voice-previews/`, utanför Git. Ingen produktmedia
eller lipsync ersätts. [Status och urvalsmodell](../random-stuff-jakob/jakob-docs/arkiv/2026-09-20/2026-09-20-rostprov-och-urvalsmodell.md).

Spel → croupier → eventnod → linje → standard/alternativ → animation/videofil.
En linje hör till en croupier och ett event. Starten har 64 linjer med en
standard och tre labbalternativ vardera (256 dealer-specifika variantposter,
64 gemensamma rörelser). Högst fyra alternativ plus standard kan redigeras.
Sparade äldre projekt fylls inte på automatiskt eller skrivs över.
Roulette är bara en synlig framtida plats, inte implementerat.

Partner-API:ts **sex presentationstyper** är `speak`, `deal`, `reveal`, `turn`, `settle`, `idle`.
De **16 noderna** är labbets begripliga mappningar, inte 16 nya motor-events.
Visningsnamn kan ändras; tekniska event-ID:n, matchning och exempel är låsta.
Standardvarianten kan inte raderas eller villkoras. Alternativ och triggers
kan läggas till och tas bort; använda triggers måste först kopplas loss.

Triggerkategorier: `deterministic` (publicerat spel/avgjord historik), `social`
(simulerad chatt/preferens), `temperament` (croupierns framtoning, inte en
diagnos av spelaren). I nodträdet visas två huvudgrupper: **spelstyrda** och
**sociala/uttryck** (social + temperament). Alla valda villkor måste stämma. Inga villkor betyder
alltid tillåten. [Detaljer om policyerna](policies/README.md).

**Spara projekt** validerar, kontrollerar revision och skriver atomiskt med
historik. Ett annat fönsters nyare ändringar skrivs inte över. Startfilen
används endast när `data/project.json` saknas. Export-knappen ger JSON för
granskning/versionering; ingen import- eller publiceringsknapp finns ännu.
`LAB_STUDIO_DATA_DIR` kan välja en separat datamapp för QA.

## OpenClaw och Render

**Nuvarande blueprint:** [open-claw/lab/render.yaml](../open-claw/lab/render.yaml).
Den ligger kvar på den driftsatta sökvägen; den nya Next.js-sajten ingår inte
i blueprinten. `open-claw/` äger Gateway, adapter och Docker/Render-drift;
den äldre mappen `open-claw/lab/` behålls tills vidare för dessa beroenden.
Det är inte en andra ny OpenClaw-installation.

```text
Lokal studio → lokal server → HTTPS till Render Director → privat OpenClaw
                      ← validerat variantförslag ←
```

`off` använder standard utan modell. `rules` väljer högst prioriterade
tillåtna variant utan modell. `shadow` tar emot råd men spelar standard.
`active` tillåter bara ett godkänt variant-ID för exakt event, dealer och
utkastrevision. Fel, timeout eller otillåtet råd ger standard. RNG, kort,
saldo och utbetalningar är aldrig OpenClaws ansvar.

Vid senare anslutning: sätt `LAB_REMOTE_URL` till Directors HTTPS-adress och
`LAB_REMOTE_TOKEN` till dess `LAB_API_TOKEN`, i rotens `.env` eller labbets
`.env.local`. De läses endast på servern. Ingen `NEXT_PUBLIC_*`-nyckel.
`OPENCLAW_MODEL_API_KEY` stannar på Gatewayen; `OPENCLAWAPI_KEY` är Gatewayens
inloggning och är inte samma sak som Directors API-token.

Den här ändringen tillför `/api/studio/advice` och `/api/studio/chat` i
Director. De behöver driftsättas innan nya studion kan använda Render med
sin tillfälliga katalog. Anropen sparar **inte** utkastet i Render. Direkt
lokal Gateway stöds också via `OPENCLAW_BASE_URL` och `OPENCLAWAPI_KEY`.
Konfigurerad betyder inte automatiskt hälsotestad. Den 20 september 2026
driftsattes Director `7f056f7`: aktivt val, shadow och operatörschatt gav
riktiga modellsvar via lokal Next-server. Första rådanropet fick timeout;
fallback fungerade och omprovet gav giltigt råd. Detta är ett daterat
anslutningsprov, inte en garanti för svarstiden i spelet.
[Officiellt OpenClaw-index](../open-claw/lab/docs/README.md).

## Video och kvarvarande integration

Registret läses från den befintliga
[V3-snapshoten](../docs/animation-events/v3-video-map/snapshot.json).
På Jakobs Windows hittas originalarkivet automatiskt; annars anges
`LAB_VIDEO_ARCHIVE` i `lab/.env.local`. Inga videor flyttas eller läggs i Git.
Servern tillåter bara kända generation-ID:n och kontrollerar storlek och
SHA-256 före uppspelning. `want` är intake, inte visuell acceptans.

Spelarminne, riktig spelarchatt/moderering och integration med produktens
gemensamma videospelare återstår. Labbet har ännu bara manuella testvärden.
IDE-agenternas GitLab-inbox hör inte hit. Videor måste granskas per take
med text/ljud, hash och kalibrering innan de aktiveras i spelet. Nästa
nodträdsdesign ändrar editorns översikt utan att ändra motorns kontrakt.

### Samstämmighet med Croupier

[Kompatibilitet och gränser](COMPATIBILITY.md) skiljer verifierade källfält
från labbpolicy och från godkända videotakes. `settle` är inte `speak`:
resultatgrupperingen får aldrig ersätta motorns exakta `speak.line`.
`speak.other` samlar flera repliker och kan inte användas som en gemensam
godkänd talvideo. En labbrörelse byter inte språk eller inspelat ljud.

Labbets JSON-animation får inte ändra delningsriktning eller ta bort en
kortvändning. En videoreferens kontrolleras mot registret men är fortfarande
en **ogranskad labbpreview**, inte automatiskt rätt dealer/action/talrad.
Produktionskopplingen måste granskas separat tillsammans med Kevin.

## Kontroller

```powershell
npm --prefix lab test
npm --prefix lab run typecheck
npm --prefix lab run build
npm --prefix open-claw/lab test
```

Tester använder isolerade filer och simulerade modelltransporter, inte riktiga
spelare eller modellnycklar. Byggnaden verifierar inte en Render-driftsättning.
