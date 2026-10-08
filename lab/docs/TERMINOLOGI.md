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
| Operatörspaket | Operator Package | Bolagets konfiguration i `operator_packages`: lanes, spel, bord, branding och en revision per publicering. Renders `/blackjack?operator=` läser paketet; Vercels `/play/blackjack?operator=` bär slugen genom spelarinloggningen till samma dokument, och dealerraden följer paketet. | `croupier_studio.operator_packages`, `web/storage/operator-package-reader.mjs`, `web/public/app.mjs` (`allowedDealerKeys`) |
| Tre lager | Three layers | Bakgrund, dealer och bord som tre val i den sparade lanen. Preview och Lanes delar modellen. Godkända fullbildsfilmer förblir kompatibla: deras inbakade pixlar kan inte tas bort. Frilagda Paow/Dragge är fortfarande ett prov och opt-in-spelspår. | `/control/preview`, `layers.background`, `layers.dealer`, `layers.table`, `project.layerAssets`. T9: lane `layer-preview`, `/layer-packs/*` |
| Presentationsadapter | Presentation Adapter | Översätter spelsignaler till presentationshändelser. | `web/presentation-api.mjs` |
| Designprofil | Design Profile | Branding och presentationsval som bolaget får justera inom en publicerad lane (`adjustable`: `table.color`, `table`, `background`, `dealer`, `branding`). Väljbara lager kommer från det frysta paketet; skrivningen kräver `presentations.configure`. | `branding` och reserverade `_scoutPresentation` i paketet, `lab/components/partner-appearance.tsx`. Chips återstår (L4) |
| Visningsnamn | Clip label | Eget namn på ett klipp, skilt från filnamn och hash. Sparas från Klippbibliotek, 1–80 tecken. | `project.clipLabels` |
| Standardvariant | Standard variant | `legacyClipPolicy` översätts till varianter vid läsning och ligger kvar på disk tills en admin sparar. `think` blir `turn.player` och `gest` blir `settle.*`. `headTilt`, `deal` och `dealWatch` väljs inte. | `presentation-runtime/legacy-standard-variants.mjs` |
| Astrid-baslinje | Astrid baseline | 160 anrop (16 händelser × 5 lägen × 2 kontexter) som bevisar att Astrids select-svar är oförändrade. `--write` kräver Jakobs godkännande. | `tools/astrid-select-baseline.mjs`, `test/presentation-select-astrid-baseline.mjs` |

Adapter, lane och operatörspaket är tre olika saker.

## Klipplogiken, fyra delar

| Del | Standardnamn | Vad | I koden i dag |
|---|---|---|---|
| 1 | Viloloop / Idle Loop | Klipp när inget händer: grundloop plus korta variationer med vikter | `idlePolicy`, Dealers & klipp → Idle. Fungerar för Astrid |
| 2 | Händelseklipp / Event Clip | Klipp för en presentationshändelse: deal, reveal, turn, settle, speak | Ett system, **A**: `events`/`lines`/`variants`/`triggers` + `mediaPolicy`, via `POST /api/presentation/select` för alla fyra dealers. `legacyClipPolicy` översätts till standardvarianter vid läsning. Vera, Amira och Mei spelar 2D-reserv där klipp saknas |
| 3 | Bakgrundslager / Background Layer | Bakgrundsbild eller -video och masker | Bakgrundszoner `/control/zones`; styr inte spelet ännu (L16) |
| 4 | Probe | Talinitiativ när spelaren är inaktiv | `probePolicy`, `/control/probe`, `web/probe-runtime.mjs`; inte verifierad i produktion (L4) |

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

## Acceptans och prov

| Svenska | Engelska | Betyder | I koden i dag |
|---|---|---|---|
| Rehearsal (repetition) | Rehearsal | Spelklientens acceptansläge: samma spelare som i skarpt läge, men varje dealerreplik spelas två gånger i följd så att läppsynk och bild kan bedömas. Ingen medieändring är godkänd förrän Jakob sett den så; hash, vågform eller grönt test räcker inte. Kräver spelarinloggning. | `?dealer=<namn>&rehearsal=1` på `/play/blackjack` (en länk per dealer: astrid, vera, amira, mei). `?lane=layer-preview&rehearsal=1` provar lagerlanen |
| Lagerprov | Layer preview | Statisk förhandsvisning av tre lager (Paow, Dragge, 720p) för intern personal. Ett prov, ingen spelväg: ingen spelmotor, saldo, blob eller databas. Materialet ligger i repot sedan 8 okt; grenen `test-video-jakob` är raderad. | `/control/preview`, `test-videoeditor/preview/site`, `/studio/preview/[...path]` |
| Lagerlane | Layer lane | Lane med `renderer: layered` som kör tre lager i den riktiga spelklienten. Saknat lagerpaket ger `Lagerpaket saknas` och 2D-reserv. | lane `layer-preview`, `web/layer-packs.mjs`, cookie `croupier_layer_preview=1` |
| 2D-reserv | 2D fallback | Spelet ritar bord och kort utan dealervideo när ett klipp eller lagerpaket saknas. Vera, Amira och Mei spelar så tills Emils paket (T7). | `web/public/app.mjs` |
| Astrid-baslinje | Astrid baseline | Se Paket och konfiguration. | `tools/astrid-select-baseline.mjs` |
| Replikset | Speech set | En taländring är alltid ett set: exakt text, inspelat ljud, video, bildindex, kalibrering och godkännandenotering. En annan ljud-/videohash upphäver tidigare visuellt godkännande. | `pipeline/audit-dealer-sync.mjs --probe`, `.githooks/pre-commit` |

## Inbjudan och aktivering

| Svenska | Engelska | Betyder | I koden i dag |
|---|---|---|---|
| Inbjudan | Invitation | Admin lägger till en e-postadress som medlem i ett bolag på `/control/lanes` (kortet Bolag). En ny adress får ett partnerkonto med status `invited` och ett aktiveringsmejl; en befintlig partner kopplas direkt som `active`. | `POST /studio/api/admin/operator-membership`, `lab/lib/operator-accounts.mjs` |
| Aktiveringslänk | Activation link | Länken i mejlet till `/partner/set-password?t=<token>`. Giltig 72 timmar; förbrukas bara när lösenordet sparats, så samma länk kan öppnas igen efter ett tillfälligt fel. Aktiveringen sätter medlemskapet till `active`. | `lab/app/partner/set-password/page.tsx`, `setPassword` i `lab/lib/partner-session.mjs` |
| Partnersession | Partner session | Operatörens inloggning på `/partner/login`; cookien `partner_session` kan aldrig öppna `/control`, och tvärtom. | `lab/lib/partner-session.mjs` |

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
| Produktkonto | Product Account | Inloggning till en av de tre ytorna | `croupier_auth.users` (admin, superadmin, staff, reader, partner), partner- och spelarsessioner |
| Repobehörighet | Repository Permission | GitHub-åtkomst. Ger ingen produktåtkomst, och tvärtom | `Jakeminator123/scoutgaming`, grenar `main`, `john`, `kevin`, `emil` |

## Kommunikation

| Kanal | Når | Verktyg |
|---|---|---|
| Teaminbox | personer och agenter i andra grenar/datorer | GitHub Issues `inbox`, `node tools/inbox.mjs`, `/ping` |
| Agent-talk | agenter i samma checkout | `node tools/agent-talk.mjs` |
| Beslut | rader med nummer och A/B/C | `random/beslutsmatris-*.md`, etikett `beslut` |
