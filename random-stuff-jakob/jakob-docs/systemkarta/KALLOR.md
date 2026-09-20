# Källor, omfattning och kontroll

[Till systemkartan](README.md)

Sammanställd 20 september 2026, Europe/Paris. Lokal Git-revision vid
inventeringen: `c0a5681`, branch `jakeminator123/work`. Rotuppgiftens
uppdaterade eventregister och nya situationsdokument lästes också medan
denna dokumentationsleverans skrevs. Annat parallellt arbete kan därefter
ändra källorna; det har inte automatiskt granskats här.

## Senare dokumentationsöversyn och arkivering

Efter den ursprungliga kartläggningen lästes även leveransen
[OpenClaw-instruktioner och röstpanel](../arkiv/2026-09-20/2026-09-20-openclaw-instruktioner-och-rostpanel.md)
(`0a1f9cb`/`7be5844`) och
[videoladdningsfyndet med Kevin-ping](../arkiv/2026-09-20/2026-09-20-videoladdning-och-kevin-ping.md)
(`bf4e82e`). De senare handoffnotiserna och relevanta kodställen granskades
också. Det tillför daterad drift-/röststatus och loaderfynd till ämnena;
det är ingen ny full kod-, media- eller remoteaudit.

Åtta arbetsrapporter och en datoragentprompt flyttades till
[arkivet](../arkiv/README.md). Även det tidigare rotindexet bevarades som
ögonblicksbild. Nedanstående ursprungliga källista har fått nya länkar;
den historiska läsomfattningen är oförändrad. Aktiva modelldokument behåller
sina stabila sökvägar, inklusive den som runtimepaketet refererar till.
Öppna fynd sammanställs i [docs/findings](../../../docs/findings/README.md),
med åtskild evidens och triage samt källor till beslut.

## Hur dagens underlag valdes

Inventeringen använde Git-historiken från `2026-09-20T00:00:00+02:00` och
`git ls-files`, samt dagens daterade Markdownfiler i `jakob-docs`. Aktuella
arkitektur-, labb-, media-, drift- och arbetsflödesdokument lästes.
Historiken visade bland annat `c0a5681` (röstprov), `ebd1f7e` (eventregister),
`b26ff83` (nodträd/rörelser), `d910ddc` (startfil), `7eac0b6`
(Windows-tester), `6efd3ba` (studio), `3f8524f` (videokarta), `7ec4e17`
(dashboard) och `3622515` (samlad V3-modell).

Detta är en inventering av dagens relevanta projektdokumentation, inte ett
påstående att varje fil i repot, varje version i Git eller alla externa
speglar har lästs. Vissa dokument har ändrats flera gånger under dagen;
deras aktuella text och dagens handoffnotiser användes som underlag.

## Lästa dokument

Följande dokument lästes i sin helhet, förutom den uttryckliga
avgränsningen av den långa handoffen nedan.

### Jakobs noter

- [Index](../README.md)
- [Eventregister och mental modell](../2026-09-20-eventregister-och-mental-modell.md)
- [Situationer, variantfamiljer och takes](../2026-09-20-situationer-variantfamiljer-och-takes.md)
- [Labbets mappar och tester](../arkiv/2026-09-20/2026-09-20-labbets-mappar-och-tester.md)
- [Nodträd, rörelser och anslutning](../arkiv/2026-09-20/2026-09-20-nodtrad-rorelser-anslutning.md)
- [OpenClaw och labbet](../arkiv/2026-09-20/2026-09-20-openclaw-och-labb.md)
- [Röstprov och urvalsmodell](../arkiv/2026-09-20/2026-09-20-rostprov-och-urvalsmodell.md)
- [V3-videoregister och placering](../arkiv/2026-09-20/2026-09-20-v3-videoregister-och-placering.md)
- [Windows-medietester](../arkiv/2026-09-20/2026-09-20-windows-medietester.md)
- [Prompt för Windows/Cursor/Bash](../arkiv/2026-09-20/PROMPT-windows-cursor-bash.md)

### Projekt, studio och verifiering

- [Rotens README](../../../README.md)
- [Miljövariablernas register](../../../_ENVIROMENT-INFO.md), endast dokumenterade namn/roller
- [JOHN-HANDOFF](../../../docs/JOHN-HANDOFF.md): samtliga 26 notiser daterade 2026-09-20 vid `c0a5681`; äldre handoffhistorik djupgranskades inte
- [Windows-testernas fulla rapport](../../../docs/WINDOWS-MEDIA-TESTS.md)
- [Studio](../../../lab/README.md)
- [Kompatibilitet](../../../lab/COMPATIBILITY.md)
- [Policies](../../../lab/policies/README.md)
- [Animationer](../../../lab/animations/README.md)
- [Labbets agentanvisning](../../../lab/AGENTS.md), som instruktion för kodarbete, inte runtimekontrakt
- [V3-videokartans rapport](../../../docs/animation-events/v3-video-map/README.md)

[ENVIRONMENT-RESTORATION](../../../docs/ENVIRONMENT-RESTORATION.md) lästes
som kompletterande äldre underlag i avsnitten om ursprunglig återställning,
speech/rehearsal, persistent shoe och publik spelvy. Hela den efterföljande
historiken i den filen ingår inte i denna nya kartläggning.

### Aktiv V3 och samarbete

- [Animation events-navet](../../../docs/animation-events/README.md)
- [V3 README](../../../docs/animation-events/v3-9-days-mvp/README.md)
- [Canvas/publicering](../../../docs/animation-events/v3-9-days-mvp/CANVAS.md)
- [Beslutslogg](../../../docs/animation-events/v3-9-days-mvp/DECISIONS.md)
- [Tekniskt kvitto](../../../docs/animation-events/v3-9-days-mvp/RUNTIME-EVIDENCE.md)
- [S00 helheten](../../../docs/animation-events/v3-9-days-mvp/s00-helheten.md)
- [S01 kartan](../../../docs/animation-events/v3-9-days-mvp/s01-kartan.md)
- [S02 språket](../../../docs/animation-events/v3-9-days-mvp/s02-spraket.md)
- [S03 eventträdet](../../../docs/animation-events/v3-9-days-mvp/s03-eventtradet.md)
- [S04 säker presentation](../../../docs/animation-events/v3-9-days-mvp/s04-saker-presentation.md)
- [S05 ordlista](../../../docs/animation-events/v3-9-days-mvp/s05-ordlista.md)
- [S06 etappplan](../../../docs/animation-events/v3-9-days-mvp/s06-plan.md)
- [Shared README](../../../docs/shared/README.md)
- [Workflow](../../../docs/shared/WORKFLOW.md)
- [Agenthandoff](../../../docs/shared/AGENT-HANDOFF.md)
- [Inboxguide](../../../docs/shared/AGENT-INBOX.md)

### OpenClaw

Det lokala OpenClaw-indexet lästes först, enligt projektets instruktion.

- [OpenClaw-nav](../../../open-claw/README.md)
- [Director/labb-guide](../../../open-claw/lab/README.md)
- [Dokumentationsindex](../../../open-claw/lab/docs/README.md)
- [Officiella källor/versionsindex](../../../open-claw/lab/docs/OPENCLAW-DOCS.md)
- [Deployment](../../../open-claw/lab/docs/DEPLOYMENT.md)
- [Render-start](../../../open-claw/lab/docs/RENDER-START-SV.md)
- [Dashboard](../../../open-claw/lab/docs/DASHBOARD-SV.md)
- [Take-registrets tidigare startmall](../../../open-claw/lab/media/README.md)
- [Arkivindex](../../../open-claw/archive/README.md), för att fastställa vad som är historiskt

## Oberoende kod- och datakontroller

| Källa/kontroll | Omfattning och resultat |
| --- | --- |
| [blackjack.mjs](../../../web/public/blackjack.mjs) | Hela filen läst; tio unika interna `emit`-namn räknade, initial deal och split följda |
| [shoe-game.mjs](../../../web/shoe-game.mjs) | Hela filen läst; sju boxar, commands, publika/dolda fält och dragidentitet kontrollerade |
| [partner-presentation.mjs](../../../web/partner-presentation.mjs) | Hela filen läst; sex presentationstyper, vykonvertering, destinationsfamiljer, reveal och separat exakt tal |
| [studio-model.mjs](../../../lab/lib/studio-model.mjs) | Tillåtna triggerfält, projektvalidering och `buildRuntimeCatalog` lästa; senare UI-redigeringshjälpare inte fullständigt granskade |
| [project-store.mjs](../../../lab/lib/project-store.mjs) | Hela filen läst; seed vid saknad fil, revisionskontroll, historik och atomisk sparning |
| [Director engine](../../../open-claw/lab/src/engine.mjs) | Relevanta utdrag om projektion, fält, matchning, prioritet och rådskontroll; ingen ny full kodreview |
| [Studio-schema](../../../lab/schemas/studio.schema.json) | Rotstruktur och fasta nodfält inspekterade; inte en separat full JSON Schema-validering |
| [Startprojekt](../../../lab/policies/project.seed.json) | Parsat och godkänt av riktiga `validateProject`; alla fyra härledda dealerkataloger godkända av `validateCatalog` |
| [Rörelseindex](../../../lab/animations/index.json) och refererade filer | Parsade: 16 eventfiler och 64 klipp; ingen individuell visuell granskning |
| Fyra dealer-stream-index | Parsade: Astrid 20, Vera 39, Amira 16, Mei 15; totalt 90 |
| [Performance-manifest](../../../web/public/dealers/astrid/performance/manifest.json) | Parsat: fyra grundtakes och två continuations, samtliga `review` |
| [V3-snapshot](../../../docs/animation-events/v3-video-map/snapshot.json) | Struktur inspekterad; inventeringsresultaten hämtas från den lästa rapporten, inga nya originalhashar beräknade |
| [Gateway-Dockerfile](../../../open-claw/lab/deploy/Dockerfile.gateway) | Versions-/digestankaret inspekterat: 2026.9.5 |
| [Render blueprint](../../../open-claw/lab/render.yaml) | Tjänstenamn, typer, Dockerpaths och kod-auto-deploy-fält inspekterade; inga liveinställningar lästa |
| [Pre-commit](../../../.githooks/pre-commit) | Kommandolistan läst; produkttesterna kördes inte om för kartans Markdownfiler |

Rena validerare kördes enbart i minnet. Seedräkningen blev 4 dealers,
16 noder, 9 triggers, 64 linjer, 256 varianter och 64 assets. Inga
startvarianter hade ett icke-null `videoGenerationId`. Inget projekt sparades.
Lokala relativa Markdownlänkar i den nya mappen kontrollerades separat.

## Tidslager och kvarstående motsägelser

| Läsfälla | Hur kartan hanterar den |
| --- | --- |
| Vissa guider säger ”motorns sex typer” | Koden visar att dessa sex kommer från Partner-presentationen; `Round` har tio interna typer |
| Tidiga rapporter säger 32 assets/två varianter | Det avser äldre Director-katalog/äldre tidpunkt; nya studions seed har 64 rörelser/256 dealerposter |
| Äldre driftguider säger att ett riktigt modellsvar återstår | Senare daterad notis belägger råd/chatt via Director `7f056f7`; ingen ny livekontroll görs här |
| V3 säger att OpenClaw ligger senare | V3 avgränsar produktintegrationen; ett separat fungerande labb innebär inte produktintegration |
| Root-README visar ett förenklat linjärt runtimeflöde | Detaljkällor/kod skiljer vanlig klient via `/api/table` från Partner-API:s `presentation[]` |
| `want`, katalogförekomst och standardvariant ser ut som godkännande | Intake, hashbunden visuell review, kompatibel täckning och faktisk aktivering är olika frågor |
| Kortutdelning räknas som 16 noder eller 256 filmer | Nod-/variantantal mäter inte konkreta situationer eller unika godkända takes |

Den befintliga Partner-adapterns `h.split`-kontroll jämfört med motorns
`splitFrom` är ett redan dokumenterat granskningsbehov i eventregistret.
Kartan ändrar inte resultatklassificeringen. Aktuella BO-bindningar,
produktens deployment, täckning för varje kortposition/sekvens och
hashbunden takeacceptans är fortsatt öppna kontroller.

## Medvetet utanför läsningen

- Privata ospårade loginnoter, `.env`, nyckelfiler, råa konversationsexporter
  och ignorerade användarprojekt/QA-projekt lästes inte.
- Arkiverade V2-paket som flyttades oförändrade under dagen djupgranskades
  inte. Arkivets index lästes; gamla kontrakt behandlas inte som runtime.
- Agentinstruktionernas Codex-/Cursor-dubbletter och chef-/ping-skillernas
  fulla implementationer granskades inte som systemfunktioner. Samarbets-
  sammanfattningen bygger på givna projektregler och lästa shared-guider.
- Externa wiki-/GitHub-/Vercel-speglar och officiella webbsidor hämtades inte
  på nytt av denna deluppgift. Länkade tidigare verifieringar är källnotiser.
- Inga nya API-, modell-, röst-, databas-, deployment- eller medieanrop
  gjordes. Ingen ny visuell dealergranskning eller Jira-statusövergång ingår.
- Nya parallella förändringar efter källankaret blir inte automatiskt fakta
  i kartan. Läs deras senare handoff och commit innan nästa integration.

Ämneskartan kopierar inte originaldokumentens fulla innehåll. Rapporternas
arkivflytt beskrivs ovan; denna mapp samlar läsordning, samband och
källpekare för fortsatt arbete.
