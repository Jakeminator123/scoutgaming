# A21 · Flyttrapport

Flytten är en commit på molnbranchen. Orkestratorn integrerar på `jakob/repo-ordning` och kör Studio-bygge, frontendbygge och hela sviten med Node 24.

| | |
| --- | --- |
| Branch | `cursor/a21-presentation-runtime-00a5` |
| Flyttcommit | `04a8b854dea106ff0f5efa9bed4a8a26f210cdba` |
| Bas | `e3a476ef` (`jakob/repo-ordning`, PR #40, ovanpå `main` `3e841f82` vid start) |
| `origin/main` vid leverans | `52064fd0` (säkerhetsläsning; inte inmergad) |
| Öppen PR vid start | #44 rör `lab-studio.tsx` och `registered-idle-editor.tsx`. Bara importsträngarna är ändrade där. |

## Commit

62 filer, +311 / −290. Siffran är uppsvälld: `live-idle.mjs` bokförs som tillägg plus en ny fil på den gamla sökvägen, inte som rename, eftersom båda sökvägarna finns i samma commit.

- 13 rename av modulerna. Sex är 100 %: `legacy-clip-policy.mjs`, `legacy-standard-variants.mjs`, `media-families.mjs`, `media-family-policy.mjs`, `media-family-resolver.mjs`, och de övriga sju nedan är lägre bara för att `../` blev `../../../` på utåtimporter.
- `live-idle.mjs` har samma blob `5a713c40e86f39162a6d250dd6e37a359e59b154` före och efter (192 rader, oförändrade byte). Git visar `A` på `packages/presentation/runtime/live-idle.mjs` och `M` på shim-filen, inte `R100`.
- `packages/presentation/runtime/` är 14 filer, 68 107 byte.
- Ny fil: `presentation-runtime/live-idle.mjs` (Node-återexport, 4 rader).

### Rader som ändrades inuti flyttade filer

Bara importprefix. Ingen annan rad.

| Fil | Rader |
| --- | --- |
| `idle-policy.mjs` | 1–2 |
| `legacy-clip-policy.d.mts` | 1–2 |
| `registered-idle-policy.d.mts` | 1–3 |
| `registered-idle-policy.mjs` | 1, 3 |
| `registered-idle-rules.mjs` | 1–4 |
| `registered-idle.mjs` | 1–2 |
| `selection.mjs` | 3–8 |
| `shoe-transitions.mjs` | 1 |

`web/server.mjs` är oförändrad. Den släpper redan in URL:en `/presentation-runtime/`. Filen läses i `web/presentation-api.mjs`: URL-nyckeln är kvar, filsökvägen är `packages/presentation/runtime/<fil>.mjs`.

`player-ui-build.mjs` följer webbläsarens `../../presentation-runtime/` till paketfilen och skriver fortfarande ut `presentation-runtime/<fil>`. Next, tsconfig, Dockerfile, `.dockerignore`, `vercel.json`, rotens ignore-filer och miljöregistret nämner inte mappen och är orörda. `.githooks/pre-commit-full` pekar på `lab/test/presentation-runtime-readiness.test.mjs`, som inte flyttats.

## Kanter

`node ordning/verktyg/cross-imports.mjs --all-edges`.

Utåt, 22 före och 22 efter (samma mål):

| Antal | Kant |
| ---: | --- |
| 13 | `runtime` → `lab/lib` |
| 1 | `runtime` → `lab/components` |
| 1 | `runtime` → `lab/policies` |
| 3 | `runtime` → `open-claw/lab/src` |
| 2 | `runtime` → `web/public` |
| 2 | `runtime` → `web(server)` |

Inåt flyttade 53 av 54 kanter från området `presentation-runtime` till `packages/presentation` (där kompositorns tidigare kanter redan låg: lab/test 2, test 3, web(server) 2). Summorna stämmer: lab/test 11+2=13, test 11+3=14, web(server) 10+2=12.

Kvar lexikalt: `web/public/local-presentation.mjs` → `presentation-runtime/live-idle.mjs`, och shimens kant tillbaka till paketfilen. `join`/`resolve` i byggaren, Astrid-arkivet och `cloud-readiness` syns inte i verktyget. De är bytta.

## Beroendekarta för A22

| Modul | Mål | Namn |
| --- | --- | --- |
| `idle-policy.mjs` | `web/public/dealer-identity.mjs` | `isDealerId` |
| `idle-policy.mjs` | `lab/policies/idle-policy.seed.json` | JSON-import |
| `legacy-clip-policy.d.mts` | `lab/lib/studio-model.mjs` | `LegacyClipBinding`, `StudioProject` |
| `legacy-clip-policy.d.mts` | `lab/lib/legacy-clip-inventory.mjs` | `LegacyClipEntry`, `LegacyClipInventory`, `LegacyClipRuntime` |
| `registered-idle-policy.d.mts` | `lab/lib/studio-model.mjs` | `StudioProject`, `DealerId` |
| `registered-idle-policy.d.mts` | `lab/lib/idle-policy.mjs` | `IdlePolicy` |
| `registered-idle-policy.d.mts` | `lab/components/studio-types` | `VideoInventory` |
| `registered-idle-policy.mjs` | `web/dealer-identity.mjs` | `MAX_DEALERS`, `isDealerId`, `isActiveDealerId` |
| `registered-idle-policy.mjs` | `lab/lib/video-intake.mjs` | `videoFitsLine` |
| `registered-idle.mjs` | `web/dealer-identity.mjs` | `registeredDealerIds` |
| `registered-idle.mjs` | `lab/lib/video-intake.mjs` | `videoFitsLine` |
| `registered-idle-rules.mjs` | `web/public/dealer-identity.mjs` | `isActiveDealerId`, `registeredDealerIds` |
| `registered-idle-rules.mjs` | `open-claw/lab/src/engine.mjs` | `prepareDecision` |
| `registered-idle-rules.mjs` | `lab/lib/studio-model.mjs` | `buildRuntimeCatalog` |
| `registered-idle-rules.mjs` | `lab/lib/video-intake.mjs` | `selectionFor` |
| `selection.mjs` | `open-claw/lab/src/openclaw.mjs` | `askDirector`, `boundedJson` |
| `selection.mjs` | `open-claw/lab/src/engine.mjs` | `prepareDecision`, `finalizeDecision` |
| `selection.mjs` | `lab/lib/studio-model.mjs` | `buildRuntimeCatalog`, `isDirectorSourceType`, `validateProject` |
| `selection.mjs` | `lab/lib/project-store.mjs` | `StudioError` |
| `selection.mjs` | `lab/lib/video-registry.mjs` | `loadVideoRegistry` |
| `selection.mjs` | `lab/lib/video-intake.mjs` | `selectionFor`, `videoFitsLine`, `videoFitsEvent` |
| `shoe-transitions.mjs` | `lab/lib/video-intake.mjs` | `videoFitsLine` |

## Prov (Node v22.14.0)

| Kommando | Resultat |
| --- | --- |
| `node --test` de 17 provfilerna som importerar paketet, plus `studio-preview-client` och `player-ui-build` | 177/177 gröna |
| `node docs/system-map/verify.mjs --check` | exit 0, 0 röda, 14 gula |
| `node tools/check-environment-variables.mjs` | exit 0 |
| `node tools/check-orphan-tests.mjs` | 351 filer, 0 föräldralösa, 2 undantag |
| `node tools/astrid-select-baseline.mjs` | exit 1, ingen baslinje skriven |

`lab/node_modules` installerades med `npm ci` (motorn vill ha Node 24). Astrid-verktyget faller i HEAD-arkivet: `lab/lib/studio-model.mjs` importerar `web/public/dealer-speech-profile.mjs`, som inte ligger i `ARCHIVE_PATHS`. Samma import saknas i arkivet av föräldern `e3a476ef`. Det är inte den borttagna banken. Arbetsbladet rördes inte (`--write` användes inte).

Inte kört: `sh .githooks/pre-commit-full`, `npm --prefix lab run build`, frontendens `npm run build`. `ops/vercel-entry/test/build-preview.mjs` finns inte (A18). VM:ens `core.hooksPath` anropar inte `.githooks/pre-commit`.

## Kvarvarande `presentation-runtime`

| Klass | Var |
| --- | --- |
| Publik URL `/presentation-runtime/` | `web/server.mjs`, URL-nyckeln i `web/presentation-api.mjs`, `test/local-presentation.mjs` (förväntade adresser), `docs/JOHN-HANDOFF.md`, `packages/presentation/README.md` |
| Webbläsarens relativa form av samma URL | `web/public/local-presentation.mjs`: `../../presentation-runtime/live-idle.mjs` |
| Utdata för den URL:en | `player-ui-build.mjs` (mappning och kommentar), `apps/croupier-frontend/test/player-ui-build.mjs`, `apps/croupier-frontend/.gitignore` (`/public/presentation-runtime/`) |
| Node-shim | `presentation-runtime/live-idle.mjs` |
| Annat modulnamn, inte mappen | `presentation-runtime-readiness` i `.githooks/pre-commit-full`, `lab/lib/*`, `lab/test/*`, `test/layer-asset-store.mjs` |
| Historiskt citat | `ordning/` |

## Säkerhetsstatus

`node tools/security-status.mjs` mot `main` `52064fd0`: GitHub-täckning komplett för den committen, GitGuardian-kontrollen köad, incidentlistan oläst, platstäckning oläst. Ingen incidentpost lästes. Vid start var samma läsning `bf01c8bb`.

## Tveksamt

- `presentation-runtime/` finns kvar med en fil. `web/public/local-presentation.mjs` måste behålla `../../presentation-runtime/live-idle.mjs`: från URL:en `/local-presentation.mjs` blir det `/presentation-runtime/live-idle.mjs`, och provet som går importgrafen kräver just den adressen. Samma sträng från filsystemets `web/public/` träffar inte paketets nya djup. Utan shimen ger `node --test test/local-presentation.mjs` `ERR_MODULE_NOT_FOUND` innan något prov körs. En ändrad importsträng skulle be webbläsaren hämta `/packages/presentation/runtime/live-idle.mjs`.
- Därför är `live-idle.mjs` inte `R100` i `git diff -M`, trots identisk blob. Övriga sex oförändrade filer är `R100`.
- `docs/system-map/verify.mjs` tappade prefixet `presentation-runtime` och fick `packages`. A20 lämnade `packages` utanför. Sökvägsfält kontrolleras ändå. `--check` är 0 röd / 14 gul.
- Astrid-baslinjens 160 anrop är inte jämförda. Verktyget var redan trasigt mot arkivlistan på föräldern. Jag lade inte till `web/public` i `ARCHIVE_PATHS`.
- Hela pre-commit-sviten och de två byggena är inte körda här. Node är v22.14.0.
- Om en extern part hämtar `/presentation-runtime/*` direkt är adressen kvar. Det är inte verifierat här att någon gör det.
