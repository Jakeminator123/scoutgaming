# Terminologi

Gemensamma ord för Jakob, John, Kevin och Emil. Grund: `croupier_terminologi.pdf`
och `croupier_flodeskarta_och_atkomst.pdf` (6 oktober 2026), uppdaterade mot koden
8 oktober. Kolumnen **I koden i dag** visar vad UI eller kod faktiskt säger; skiljer
den sig från standarden är det standarden som ska in, en ändring i taget.

## Flödet, en rad

```
Spelmotor (Render) --spelsignal--> Presentationsregissör --uppspelningsplan--> Spelklient (/play)
                                    │ läser publicerad lane
                                    │ frågar ev. OpenClaw-urvalsagent (råd, inte beslut)
```

Spelmotorn äger kort, regler, saldo och utfall. Presentationen väljer bara bland
redan godkända klipp. Ett klippval är inte bevis på uppspelning; kvitton är.

## Tre nivåer

| Nivå | Vem | Adress | Standardnamn | I koden i dag |
|---|---|---|---|---|
| 1 | Intern personal | `/control` | Kontrollrum (menyn: Översikt, Studio, OpenClaw, Drift, Åtkomst) | Samma. "Kontrollpanel" i PDF:en är utbytt |
| 2 | Operatörens personal | `/partner`, `/partner/{operatorSlug}` | Partnerportal | Samma |
| 3 | Spelare | `/play`, `/play/profil`, `/play/historik`, `/play/blackjack` | Spelaryta; `/play/blackjack` är spelklienten | Samma |

`/studio` är labbets basePath, inget produktnamn. `/bo` omdirigerar till `/control/administration`.
Nivånumret är dokumentation; servern kontrollerar identitet, rättighet, medlemskap och resursägarskap.

## Paket och konfiguration

| Svenska | Engelska | Betyder | I koden i dag |
|---|---|---|---|
| Lane | Presentation Lane | Ett paket av dealers, klipp och OpenClaw-rättigheter. Flera dealers kan ingå i samma lane. Grundprofilen är standardpaketet som kopieras. | `project.lanes[]`. Grundprofilen är `defaultPresentationLane` (`mobile-phone`). `lanes` i `operator_packages`. `lissabon-stream-lane` är ett lane-id, inget produktnamn |
| Operatörspaket | Operator Package | Bolagets konfiguration i `operator_packages`: lanes, spel, bord, branding och en revision per publicering. Renders `/blackjack?operator=` läser paketet. Vercels `/play/blackjack` gör det inte än. | `croupier_studio.operator_packages`, `web/storage/operator-package-reader.mjs` |
| Tre lager | Three layers | Bakgrund, dealer och bord. Varje lager kan tas bort. I dag finns det bara i förhandsvisningen, inte som spelväg. | `/control/preview`. På lanen: `layers.background`, `layers.dealer`, `layers.table` |
| Presentationsadapter | Presentation Adapter | Översätter spelsignaler till presentationshändelser. | `web/presentation-api.mjs` |
| Designprofil | Design Profile | Branding och bordsutseende som bolaget får justera inom lanen. `branding` kan läsas och skrivas, men skrivningen kräver roller (N2.2). | `branding` i paketet. Chips återstår (L4) |
| Visningsnamn | Clip label | Eget namn på ett klipp, skilt från filnamn och hash. Sparas från Klippbibliotek, 1–80 tecken. | `project.clipLabels` |
| Standardvariant | Standard variant | `legacyClipPolicy` översätts till varianter vid läsning och ligger kvar på disk tills en admin sparar. `think` blir `turn.player` och `gest` blir `settle.*`. `headTilt`, `deal` och `dealWatch` väljs inte. | `presentation-runtime/legacy-standard-variants.mjs` |
| Astrid-baslinje | Astrid baseline | 160 anrop (16 händelser × 5 lägen × 2 kontexter) som bevisar att Astrids select-svar är oförändrade. `--write` kräver Jakobs godkännande. | `tools/astrid-select-baseline.mjs`, `test/presentation-select-astrid-baseline.mjs` |

Adapter, lane och operatörspaket är tre olika saker.

## Klipplogiken, fyra delar

| Del | Standardnamn | Vad | I koden i dag |
|---|---|---|---|
| 1 | Viloloop / Idle Loop | Klipp när inget händer: grundloop plus korta variationer med vikter | `idlePolicy`, Dealers & klipp → Idle. Fungerar för Astrid |
| 2 | Händelseklipp / Event Clip | Klipp för en presentationshändelse: deal, reveal, turn, settle, speak | Ett system, **A**: `events`/`lines`/`variants`/`triggers` + `mediaPolicy`, via `POST /api/presentation/select` för alla sex dealers. `legacyClipPolicy` översätts till standardvarianter vid läsning. Vera, Amira och Mei spelar 2D-reserv där klipp saknas. Dragge och Paow spelar sina egna porträttbanker; vändning och Paows hålkort ger 2D-reserv |
| 3 | Bakgrundslager / Background Layer | Bakgrundsbild eller -video och masker | Bakgrundszoner `/control/zones`; styr inte spelet ännu (L16) |
| 4 | Probe | Talinitiativ när spelaren är inaktiv | `probePolicy`, `/control/probe`, `web/probe-runtime.mjs`; inte verifierad i produktion (L4) |

**Utdelningspose / Deal pose** är H3:s REDO: dealern med handen vid skon, mellan
in- och utklippet i KLARA-leveranserna för Dragge och Paow. Den är inte **ready**. I
koden betyder ready vila eller talberedskap (`idle.ready`, `state({ready})`), och
utdelningsposen får aldrig mappas dit. Dragges och Paows filmer är förbakade från
vila till vila, så spelet har ännu ingen utdelningspose. REDO-kedjning återstår.

## Händelser

| Svenska | Engelska | Betyder | I koden i dag |
|---|---|---|---|
| Spelhändelse | Game Event | Något hände i spelet: ett kort delades | Spelmotorns utdata |
| Presentationshändelse | Presentation Event | Instruktion till presentationen: deal, reveal, speak, turn, settle, idle | `sourceType` på varje event i projektet |
| Administrationshändelse | Administrative Event | Ändrad roll, publicerat paket, publicerat klipp | `audit_events` |
| BO-event | — | **Utgått.** Backoffice skapar inga presentationssignaler | Finns inte; gammal GitLab-term |

Sidan **Händelser** (`/control/events`) är en sida sedan 8 okt (rad 37, beslut 52): utan `?event=`
visas översikten över alla event för vald dealer, med `?event=` redigeraren. `/control/tree`
omdirigerar dit med hela frågesträngen kvar.

## Redigering i Studio

| Standard | Ersätter | I koden i dag |
|---|---|---|
| Händelsekategori / Event Category | Eventgrupp | Ej infört |
| Klippuppsättning / Clip Set | Linje | UI säger "Linje" (2 ställen) |
| Variant | Variant | Samma |
| Villkor / Selection Condition | Trigger | UI säger "Trigger" (26 ställen), "Villkor" (5) |
| Urvalsregler / Selection Rules | Policy | UI säger "Policy" (9 ställen) |
| Situation | — | Samma |
| Replik-ID / Speech Line ID | — | `lab/lib/studio-voice-lines.mjs`; 39 ljudfiler under `media/dealers/astrid` |

Urvalslägen: Standard (standardklippet), Regler, Slump, OpenClaw (validerat AI-råd),
Skuggläge (rådet loggas, standard spelas).

## OpenClaw, AI-lagret

| Svenska | Engelska | Gör | Rör aldrig |
|---|---|---|---|
| Urvalsagent | Selection Agent | Råd om en redan tillåten variant | Kort, saldo, utfall |
| Studioassistent | Studio Assistant | Förklarar konfiguration för personal | Sparar inget |
| Croupieragent | Dealer Agent | Spelarens dialog via separat serveradapter | Spelregler |
| Agentanslutning | Agent Gateway | Anrop till OpenClaw; credentials på servern | — |

Sidan heter Agentmodeller (`/control/openclaw`) med fliken Chatt.

## Organisation och konton

| Svenska | Engelska | Betyder | I koden i dag |
|---|---|---|---|
| Operatör | Operator | Kundorganisation, stabil `operator_id` | `croupier_studio.operators` |
| Varumärke | Brand | Branding inom en operatör, ingen behörighetsgräns | `branding` i paketet |
| Bord | Table | Spelresurs med ägare och inställningar | `tables` i paketet |
| Medlemskap | Membership | Person ↔ operatör, rollprofil, status | `operator_memberships` |
| Rollprofil | Role Profile | Namngivna rättigheter, t.ex. `team.roles.assign` | `operator_roles`. Sista administratören kan inte tas bort (409) |
| Produktkonto | Product Account | Inloggning till en av de tre ytorna | `croupier_auth.users` (admin, superadmin, staff, reader), partner- och spelarsessioner |
| Repobehörighet | Repository Permission | GitHub-åtkomst. Ger ingen produktåtkomst, och tvärtom | `Jakeminator123/scoutgaming`, grenar `main`, `john`, `kevin`, `emil` |

## Kommunikation

| Kanal | Når | Verktyg |
|---|---|---|
| Teaminbox | personer och agenter i andra grenar/datorer | GitHub Issues `inbox`, `node tools/inbox.mjs`, `/ping` |
| Agent-talk | agenter i samma checkout | `node tools/agent-talk.mjs` |
| Beslut | rader med nummer och A/B/C | `random/beslutsmatris-*.md`, etikett `beslut` |
