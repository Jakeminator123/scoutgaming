# Croupier Studio — lokalt presentationslabb

Den nya Next.js-arbetsytan. Den riktiga spelklienten och OpenClaws egen
dashboard är separata. Inget du sparar här publiceras automatiskt.

## Starta

Node 22.16+ behövs. Kör från repots rot:

```powershell
npm --prefix lab ci
npm --prefix lab run dev
```

Öppna <http://127.0.0.1:4188>. Stoppa med Ctrl+C. Den gamla lokala servern
ska inte köras samtidigt på samma port. För byggd version: `npm --prefix lab
run build`, därefter `npm --prefix lab start`. Studion är avsiktligt endast
för localhost; öppna den inte mot internet eller ett publikt nätverk.

## Tre arbetsytor

- **Eventstudion:** välj croupier/event, redigera namn, linje, varianter och
  triggers. Testa ett publicerat exempel med simulerad chatt, historik och
  framtoning. Den animerade scenen och beslutsspåret visar vad som händer.
- **Videobanken:** inspektera original och bind vald variant till ett exakt
  `videoGenerationId`. Efter ett eventtest kan scenen växla till just den
  videofilen. Detta är en labbkoppling, inte ett runtime-godkännande.
- **OpenClaw:** ansvar, anslutningsstatus och operatörschatt om det senast
  sparade projektet. Länk till den befintliga, separata native-dashboarden.
  Chatt kräver en konfigurerad anslutning; inga modellsvar fejkas.

## Filer och begrepp

```text
lab/
  policies/project.seed.json   startprojekt: blackjack, 4 dealers, 16 noder
  schemas/studio.schema.json   struktur och tillåtna värden
  lib/studio-model.mjs         kontrakt, referenser, validering och konvertering
  data/project.json           ditt sparade projekt (lokalt, Git-ignorerat)
  data/history/               tidigare sparade revisioner (Git-ignorerat)
  app/                        Next.js-sidor och lokalt API
  components/                 editor, scen, videobank och OpenClaw-panel
```

Spel → croupier → eventnod → linje → standard/alternativ → animation/videofil.
En linje hör till en croupier och ett event. Starten har 64 linjer med en
standard och ett alternativ vardera. Högst fyra alternativ plus standard.
Roulette är bara en synlig framtida plats, inte implementerat.

Motorns **sex typer** är `speak`, `deal`, `reveal`, `turn`, `settle`, `idle`.
De **16 noderna** är labbets begripliga mappningar, inte 16 nya motor-events.
Visningsnamn kan ändras; tekniska event-ID:n, matchning och exempel är låsta.
Standardvarianten kan inte raderas eller villkoras. Alternativ och triggers
kan läggas till och tas bort; använda triggers måste först kopplas loss.

Triggerkategorier: `deterministic` (publicerat spel/avgjord historik), `social`
(simulerad chatt/preferens), `temperament` (croupierns framtoning, inte en
diagnos av spelaren). Alla valda villkor måste stämma. Inga villkor betyder
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
Konfigurerad betyder inte hälsotestad; ett riktigt modellsvar återstår att
verifiera. [Officiellt OpenClaw-index](../open-claw/lab/docs/README.md).

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
nodträdsdesign kan ändra editorns översikt utan att ändra motorns kontrakt.

## Kontroller

```powershell
npm --prefix lab test
npm --prefix lab run typecheck
npm --prefix lab run build
npm --prefix open-claw/lab test
```

Tester använder isolerade filer och simulerade modelltransporter, inte riktiga
spelare eller modellnycklar. Byggnaden verifierar inte en Render-driftsättning.
