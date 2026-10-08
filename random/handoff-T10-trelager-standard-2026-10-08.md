# Handoff T10: trelagrad uppspelning blir standard

> **Pekare 8 okt kväll:** detta är bakgrund, inte arbetorder.
> Läs `random/start-T10-2026-10-08.md` och följ `random/masterplan-t10-konsolidering-2026-10-08.md`.
> `/control/layers` och `layered` som spelstandard ikväll är ersatta. Ramarna i §0 gäller.

Startprompt för en ny ledaragent. Skriven 8 okt 2026 kl 19:00 av orkestrator 2 efter
`f3799749`. Jakobs ord samma kväll: *"den trelagrade videouppspelningen ska bli standard.
Jag vill att man ska kunna växla mellan bakgrundsvideo/bilder och/eller dealer och/eller
bord. Man måste kanske kunna spara nya bord/dealer/avatar. Du får fria händer att införa
denna standard om detta inte finns."*

**Modell för ledaragenten:** Claude Opus 5.5 (max) eller GPT-5.3-codex. Den rör
spelklientens presentationsväg och Studios datamodell. Underagenter enligt
`.cursor/rules/subagents.mdc` (standard `grok-4.7-xhigh-fast`, full brief, rapport med
`Tveksamt`). Agent-talk-id `t10-trelager`.

---

## 0. Ramar som gäller utan undantag

Du arbetar i `C:\Users\jakob\dev\projects\scoutgame` på `main` i `Jakeminator123/scoutgaming`.
Läs först, i denna ordning: `AGENTS.md` (hela), `CLAUDE.md`, `docs/JOHN-HANDOFF.md`,
`docs/ENVIRONMENT-RESTORATION.md`, `lab/docs/TERMINOLOGI.md` (särskilt *Paket och
konfiguration* och *Acceptans och prov*), `random/checklista-2026-10-08.md` (T-spåret),
`random/prompt-T9-lagerspelare-bakom-flagga.md` (vad som redan är byggt och varför).

- Leverans: `node tools/push-github-work.mjs` på `main`. Inga andra grenar eller
  worktrees. Före push: `node tools/croupier-chef.mjs status`, `node tools/security-status.mjs`,
  `node tools/agent-talk.mjs status t10-trelager`.
- Hooken `.githooks/pre-commit-full` kör hela sviten (≈4,5 min) via
  `& "C:\Program Files\Git\bin\bash.exe"`. En röd befintlig test återställs, skrivs inte om.
- **Inget får bli sämre.** Dagens produktionsväg (`gameLane: mobile-phone`,
  `presentation: local`, Astrid full-frame mp4 + SVG-kort) ska fungera identiskt tills en
  ny standard är bevisad i rehearsal av Jakob. Astrid-baslinjen
  (`tools/astrid-select-baseline.mjs`, 160 anrop) måste vara grön i varje commit;
  `POST /api/presentation/select` rörs inte.
- Medieregler (AGENTS.md → *Dealer speech, media, cards, and wallet*): varje taländring
  är ett replikset; ny video med annan hash upphäver godkännande; `build-index.mjs`
  skriver inte över kalibrerad video; `node pipeline/audit-dealer-sync.mjs --probe` PASS
  vid varje medie-/spelarändring; ingen godkännande från hash/test – bara rehearsal.
- Server äger kort, sko, saldo, utfall. `web/shoe-game.mjs`, wallet och auth rörs inte.
- `web/*.mjs` får inte importera `lab/` eller `web/public/` på toppnivå (Render-kopian
  saknar dem). Mönster: `web/demo-operators.mjs`.
- Studio-migration i två steg: SQL mot produktions-Neon först (Neon MCP, projekt
  `croupier-production` = `wandering-hill-60561912`, databas `croupier_game`), därefter
  kodmerge. CI:s migrationskontroll har ingen `continue-on-error`.
- Miljövariabler: varje ny/ändrad nyckel registreras i `docs/ENVIRONMENT-VARIABLES.md` +
  `docs/environment-variables.json` i samma commit (`node tools/check-environment-variables.mjs`).
- Max fem Markdown i `docs/`; uppdatera på plats. Systemkartan `docs/system-map/routes.json`
  + `catalog.json` för nya rutter/sidor; `lab/docs/guide.json` för nya menyval;
  `lab/docs/TERMINOLOGI.md` för nya begrepp. Arbetsanteckningar i `random/`.
- Skärmbilder från webbvyn sparas i `random/bilder-<datum>/` (gitignorerat).
- Jakob vill se **`Tveksamt`** i varje rapport. Beslut som ändrar vad en användare ser i
  dag tas inte utan hans ord.

## 1. Läget 8 okt kväll (verifierat)

| Del | Finns | Var |
|---|---|---|
| Lagerprov, statisk förhandsvisning | Paow + Dragge 720p, 12 MB, WebGL-kompositor | `/control/preview` → `test-videoeditor/preview/site` (byte-identisk spegel av raderade grenen `test-video-jakob`), byggs till `lab/preview-build` av `lab/tools/prepare-preview.mjs`, serveras bakom adminsession av `lab/app/preview/[...path]/route.ts` |
| Lagerlane i spelet (T9) | lane `layer-preview`, `renderer: 'layered'`, bakom `?lane=layer-preview` + cookie `croupier_layer_preview=1` | `web/public/game-lanes.mjs` (`LAYER_PREVIEW_LANE`, `gameChoicesForLane`), `web/public/layered-presentation.mjs` (canvas i `#scene`, `bridge.consume`), `web/layer-packs.mjs` (route `/layer-packs/*`, 404 utan cookie), `web/public/app.mjs` rad ~60–75 och ~515–550 |
| Lagerkörtid från grenen | `player.js`, `compositor.js`, `bridge.js`, `geometry.js`, `lanes.js` | `test-videoeditor/program/web/*` (speglas till `/layer-packs/runtime/`); `bridge.js` spelar deal/reveal som lager, `unsupported[]` för speak/settle/turn/split (värdspelet tar dem) |
| Paketbeskrivning | `catalog.json`: `scene` (layout, tableMode, dealer, variant, background, table, show{background,table,dealer,cards,foreground,overlay}, key{threshold,softness}, tableTransform, backgroundFit) + `dealer` (canvas 1080×1920 @24, `coordinate_space: emil-mobile-v3`, clips `deal_pos1..7`, `deal_pos6b`, `deal_posdealer`, `in_vila_till_redo`, `ut_redo_till_vila`, variants) | `test-videoeditor/preview/site/catalog.json`, `test-videoeditor/program/docs/FORMATLASNING.md`, `INTEGRATION.md` |
| Lane-modell i Studio | `project.lanes[]` med `layers.background{enabled,mode,allowed,default}`, `layers.dealer{allowed,default}`, `layers.table{colors,default}`, `probe`, `idle` | `lab/components/control-lanes-page.tsx`, `web/public/game-lanes.mjs` (`STANDARD_PRESENTATION_LAYERS`) |
| Operatörspaket | `operator_packages` {lanes, games, tables, branding, revision}; Render `/blackjack?operator=` och Vercel `/play/blackjack?operator=` läser; dealerraden följer paketet (`allowedDealerKeys`) | `lab/lib/operator-package-api.mjs`, `web/storage/operator-package-reader.mjs`, `web/game-entry-operator.mjs` |
| Bolagets justering (nivå 2) | `branding` GET/POST inom lanens `adjustable` (`table.color`, `background`, `dealer`, `branding`); kräver `presentations.configure` | `lab/components/partner-appearance.tsx`, `partner-session.mjs` (`brandingResponse`) |
| Spelarens val (nivå 3, N3.4) | `gameChoices` i dokumentet; dealer/bordsfärg/bakgrund inom lanen; panel `player-choices.mjs` | `web/public/player-choices.mjs`, `web/public/game-entry-contract.mjs` |
| Bakgrundszoner | egen Neon-databas `neondb` (`CROUPIER_ZONES_DATABASE_URL`), sidan `/control/zones`; **styr inte spelet** (L16) | `lab/app/control/zones`, `lab/lib/*zones*` |
| Medialager | Blob `croupier-media-private` (787 MB, arn1) via `CROUPIER_MEDIA_STORAGE`/`CROUPIER_MEDIA_BLOB_INDEX`; `croupier_studio.media_records` | `lab/lib/media-blob-index.mjs`, `lab/lib/studio-media-runtime.mjs`, `lab/lib/studio-upload-service.mjs` |
| Dealers i Studio | exakt fyra: astrid, vera, amira, mei (`project.dealers`, `studio-model`); Paow/Dragge finns bara i lagerlanen | `lab/lib/studio-model.mjs` |
| Keyat material | bara Astrid har godkänd full-frame-väg; keyad Astrid-overlay och Vera/Mei-paket är Emils spår (T7, `random/beslut-emil-2026-10-08.md`); Vera/Amira/Mei spelar 2D-reserv | — |

**Två saker du måste kontrollera först (okänt läge):**
1. Finns `lab/preview-build` på Render (`croupier-v2`) och på Vercel-funktionen som
   serverar `/layer-packs/*`? `prepare-preview` körs i Lab-bygget; Render-bygget är
   troligen utan. Då ger prod `Lagerpaket saknas · 2D-reserv` för `layer-preview`.
   Verifiera med `?lane=layer-preview&rehearsal=1` i prod (spelarinloggning krävs; Jakob
   kan göra det, eller läs Render-loggen).
2. T9 är **aldrig sedd i webbläsare** (checklistan rad T9). Första uppgiften är att få
   lagerlanen att faktiskt spela lokalt (`node lab/start.mjs --no-open`, återanvänd fliken,
   en skärmbild) innan något byggs ovanpå.

## 2. Målbild (Jakobs krav, tolkade)

```
[Lagerbibliotek i Studio]  --sparar-->  bakgrunder (video/bild) · bord · dealerpaket/avatarer
          │
          ▼
[Lane-redigeraren]  per lane: vilka lager är PÅ, vilka alternativ är tillåtna, standardval
          │ publicera
          ▼
[Operatörspaket]  nivå 2 väljer inom det tillåtna (bakgrund, bord, dealer, färg, branding)
          │
          ▼
[Spelklienten]  renderer 'layered' är STANDARD; spelaren växlar bakgrund / dealer / bord
                inom paketet; val sparas; Astrid full-frame fungerar oförändrat som ett
                "dealerlager som täcker allt" tills keyat material finns
```

Krav, i prioritetsordning:

**K1. `layered` blir standardrenderer** för nya lanes och, efter Jakobs rehearsal, för
`mobile-phone`. Förslag som bevarar dagens väg: inför dealerlagertyp `fullframe`
(dagens Astrid-mp4 ritas som lager som täcker canvasen; bakgrund/bord döljs automatiskt,
`show.background=false`, `show.table=false`) bredvid `keyed` (grenens kompositor med
`key{threshold,softness}`). Då kan `mobile-phone` köras genom samma kompositor med
byte-identiskt resultat på skärmen, och bytet till keyad Astrid blir ett byte av
dealerpaket, inte av spelväg. Bevisa med skärmdiff/skärmbild i rehearsal, inte med test
enbart. Kortritning: dagens SVG-lager ovanpå (T9-valet), `boxBase: 0` i bridge.

**K2. Växla lager.** Per lane tre reglage: bakgrund (av / bild / video + tillåtna
alternativ + standard), dealer (av / tillåtna dealerpaket + standard), bord (av /
tillåtna bord + färger + standard). "Av" betyder att lagret inte ritas (bakgrund av →
bordets/dealerns egen bild; dealer av → bara bord + kort, ett "tyst bord"; bord av →
kort ritas direkt över bakgrunden med `tableTransform` från dealerpaketet). Samma
tre reglage visas, begränsade av lanen, för nivå 2 (`partner-appearance`) och nivå 3
(`player-choices`). Spelarens val sparas per spelare (se K4).

**K3. Spara nya bord / dealerpaket / avatarer / bakgrunder** = ett *lagerbibliotek* i
Studio. Förslag: ny sida i `/control`-menyn under Studio: **Lager** (`/control/layers`)
med fyra flikar – Bakgrunder, Bord, Dealerpaket, Avatarer – eller utöka Klippbibliotek
med lagertyper. Varje post: id (slug), namn, typ, filer (hash, mått, fps, längd),
koordinatrum (`emil-mobile-v3` eller nytt), status (utkast / granskad / godkänd),
skapad av, revision. Lagring: filer i Blob `croupier-media-private` via befintlig
`studio-upload-service` + `media_records`; metadata i ett nytt Studio-dokument eller
tabell `croupier_studio.layer_assets` (migration två steg). Validering fail-closed:
fel mått/fps/koordinatrum avvisas med klartext. **Avatar**: tolka som *dealerpaket utan
tal* (en visuell dealer som Paow/Dragge) till skillnad från *dealer* (identitet med
röst och repliker: Astrid m.fl.). Fråga Jakob i rapporten om tolkningen håller.

**K4. Persistens av spelarens val.** Förslag: kolumn `presentation_choices JSONB` på
`croupier_game.player_accounts` (eller `players`) via `ops/neon-game/007-*.sql`, skrivs
genom befintlig `PATCH /api/profile`-väg (N3.3). Alternativ: `native_presentations`.
Serverägt, valideras mot paketet vid varje läsning (ett val utanför paketet → standard).

**K5. Publicering och rättigheter.** Lane-redigeraren publicerar lagerkonfigurationen i
`operator_packages` (carry-forward av `branding` finns redan). Nivå 2 skriver via
`presentations.configure`. Nivå 1 kräver intern admin. Ingen operatörsväljare ger
behörighet.

## 3. Föreslagen arbetsordning (etapper, var och en levererbar)

| Etapp | Innehåll | Bevis innan nästa |
|---|---|---|
| E0 | Reproducera T9 lokalt och i prod; lista `unsupported[]`; avgör var lagerfiler ska ligga i prod (Blob, inte `lab/preview-build`) | skärmbild + Jakobs ok på platsval |
| E1 | Lagerfiler till Blob: `prepare-preview` → upload till `croupier-media-private` med `media_records`; `/layer-packs/*` läser Blob-index (som `publicBlobMedia` i `web/server.mjs`) med Range; cookie-flaggan kvar tills E3 | `layer-preview` spelar i prod |
| E2 | Datamodell + migration `007` (layer_assets, presentation_choices) körd mot prod-Neon först; `web/` läsare utan lab-import | `node ops/...` idempotent; CI migrationskontroll grön |
| E3 | Lagerbibliotek i Studio (`/control/layers`): uppladdning, validering, status; menyn, guide.json, routes.json, TERMINOLOGI | underagent kan ladda upp ett bord och en bakgrund lokalt |
| E4 | Lane-redigeraren: tre reglage, standardval, `renderer`-val med `layered` förvalt; publicering bär lagerkonfig | publicerat paket innehåller lager; `operator-package-api`-tester |
| E5 | Spelklienten: `fullframe`-dealerlager, lager av/på, bakgrund video/bild, bord av; `player-choices` + persistens | rehearsal-länkar till Jakob, en per kombination |
| E6 | Nivå 2 (`partner-appearance`) får samma reglage inom lanen | partnerinloggning i prod (fungerar sedan `e97f32df`) |
| E7 | Byt standard: nya lanes `layered`; `mobile-phone` → `layered/fullframe` **efter Jakobs rehearsal** | byte-jämförelse + Jakobs ord |
| E8 | Docs-synk: AGENTS/CLAUDE/README/lab-README/RUNTIME/MIGRATION/TERMINOLOGI/guide, checklista | `node docs/system-map/verify.mjs --check` 0 fel |

Delegera E1, E3 och E6 till underagenter med egna fullständiga briefer (mönster:
`random/prompt-N2.2-skrivrutter-operator.md`). E2, E5 och E7 gör ledaragenten själv eller
med Opus/Codex.

## 4. Vad som inte ingår

- Tal för Paow/Dragge eller nya dealers med röst (det är replikset + rehearsal, eget spår).
- Keya Astrid/Vera/Mei (Emils T7). Du bygger lagret som kan ta emot keyat material.
- Bakgrundszoner (`/control/zones`) kopplas inte om; en bakgrund i lagerbiblioteket
  kan referera en zon senare.
- Spelare/transaktioner/rapporter till nivå 2 (N2.4).
- Pythonverkstaden från grenen (`program/studio/*.py`) tas inte in.

## 5. Tester som minst ska finnas eller förbli gröna

`test/game-lanes.mjs`, `test/layered-presentation.mjs`, `test/layer-packs-route.mjs`,
`test/player-choices.mjs`, `test/presentation-select-astrid-baseline.mjs`,
`test/presentation-select-dealers.mjs`, `lab/test/control-lanes-page*.test.mjs`,
`lab/test/operator-package-api.test.mjs`, `lab/test/partner-session.test.mjs`,
`lab/test/studio-upload-service*.test.mjs`, `node test/fuzz-blackjack.mjs`,
`node pipeline/audit-dealer-sync.mjs --probe`, systemkartans `--check`, orphan-test-kontrollen
i hooken (nya testfiler läggs i `.githooks/pre-commit-full`).

## 6. Rapportformat till Jakob

Per etapp: en rad vad som är gjort; matris Åtgärd | Status | Verifierat hur | Risk %;
rehearsal-länkar han ska klicka; **Tveksamt** med varje val mellan grenens antaganden
och repots (kortritning, box-mappning 0..6→1..7, `fullframe`-tolkningen, avatar-begreppet,
var spelarens val sparas, om `mobile-phone` ska byta renderer).

## 7. Öppna frågor till Jakob (svara i första svaret om du vill, annars används förslaget)

1. Avatar = dealerpaket utan tal? (förslag: ja)
2. Får `mobile-phone` byta till `layered/fullframe` när rehearsal visar identisk bild? (förslag: ja, som E7)
3. Lagerfiler i Blob `croupier-media-private` (förslag) eller i repot?
4. Spelarens val per konto (förslag) eller per webbläsare?
5. Ny sida **Lager** i menyn (förslag) eller flikar i Klippbibliotek?
