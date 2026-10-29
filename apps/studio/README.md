# `apps/studio`: utvecklarreferens

Användarsteg står i [användarguiden](docs/README.md). Admins **Hjälp**
(`/admin/guide`) listar vad varje sida gör och länkar till guiden och till
[TERMINOLOGI](docs/TERMINOLOGI.md). Läget står i
[överlämningen](../../docs/NEXT-AGENT.md).

## Vad tjänsten gör

- Next.js-tjänsten `studio` i Vercel-projektet `scoutgaming`. Den serverar
  Admin (`/admin`), Partnerportalen (`/partner`), lobbyn (`/lobby`) och deras
  API:er. `/studio` är tjänstens tekniska basePath; API:erna ligger under
  `/studio/api/…`.
- [`client/`](client/README.md) är Admin- och lobbyklienten med eget
  React-/TypeScript-bygge till `design-preview-build/`.
- Spelmotorn är `services/game` på Render `croupier-v3`. Neon är
  produktregistret och privat Blob lagrar mediebytes. Checkouten har inget
  lokalt produktregister och ingen diskreserv.
- `/control`, `/lab` och `/labb` svarar bara med redirect till motsvarande
  `/admin`-sida (`packages/navigation/control-flow.mjs`,
  `admin-workspace-routes.mjs`, `proxy.ts` och
  `lib/legacy-studio-document.mjs`); `/bo` är borta. Bygg inga nya flöden där.

## Starta och bygga

```powershell
# Skriver den publicerade lobbyns adress; startar inga lokala servrar.
node apps/studio/start.mjs --no-open
```

Node 24.x (Volta pinnar versionen i `package.json`) och `npm ci` i
`apps/studio`. Den SQLite-baserade offlinefixturen (`--offline`,
`--skip-build`) och lägena `--check`, `--cloud-storage` och `--astrid-camera`
är pensionerade och avvisas. Isolerade prov körs i staging eller i CI:s
isolerade Postgres.

Admin-UI:t kan provas lokalt mot den isolerade fixturen:

```powershell
node tools/admin-clips-fixture.mjs --ffmpeg <installerad-ffmpeg.exe>
npm --prefix apps/studio run dev:client   # bygger om klienten när källan ändras
```

`npm --prefix apps/studio run prepare:preview` kopierar renderarmodulerna
`compositor.js` och `geometry.js` till `/preview/`. `.next/`, `node_modules/`, `preview-build/` och
`design-preview-build/` är genererade och Git-ignorerade.

## Var saker ägs

| Ansvar | Källa | Kontroll |
| --- | --- | --- |
| Event-ID, källtyper och klippbegrepp | `packages/presentation/contracts/policies/studio-contract.json` | `test/studio-contract.test.mjs` |
| Projektschema, seed och validering | `packages/presentation/contracts/` (`schemas/`, `policies/`, `studio-model.mjs`) | `validateProject` och kontraktstester |
| Mediefamiljer och standardfiler | `packages/presentation/runtime/media-families.mjs` | Byggare och validator importerar samma register |
| Runtime-katalogens källor (utan presentationsbank sedan 2026-10-28) | `media/layout.json`, `media/blob-index.json`, `media/catalog/*.json` | `node tools/build-runtime-media-catalog.mjs --check` |
| Uppmätta kortspår | `services/game/public/card-presentation/` | `test/local-card-overlay.mjs` i reporoten och browsergranskning |
| Medieorkestrering och läsare | `packages/studio-registry/server/`; bindning i `packages/presentation/server/` | Paketens tester |
| Director-, tal- och sociala kontrakt | `packages/director/`; Studios miljöläsning i `lib/director-settings.mjs` | `packages/director`-tester |
| Adresser och bolagssluggar | `packages/navigation/` | Navigationstester |
| Lobbykatalogen | `packages/player-catalog/` | Katalogtester |
| Sparade projekt, policy och mediemetadata | Neon (`croupier_studio`) med revisionslås och historik | Studio-API:ts konfliktprov |

Repot bygger ingen presentationsbank: katalogbygget skriver alltid den tomma presentationen. Produktionens nuvarande katalog med Astrids bank läses tills den byts i [REN-START](../../docs/plans/REN-START.md) steg 6.

## Mappar

```text
app/          Next.js-sidor och API-rutter (app/api/…)
client/       Admin- och lobbyklienten (eget bygge)
components/   delade React-komponenter, bland annat Partnerportalens arbetsyta (partner/)
lib/          serveradaptrar: lagring, behörighet, observation, tal
policies/     appens egna policyer, till exempel social.seed.json
schemas/      appens egna scheman (manifest, social policy)
test/         Studio-, API- och lagringsprov
tools/        byggsteg för förhandsvisning och klient
docs/         användarguiden och TERMINOLOGI (Admins Hjälp länkar hit)
```

Se också [policies](policies/README.md) och [scheman](schemas/README.md).

## Klippval och OpenClaw

Spelmotorn anger händelsen; dealer och exakt situation väljer talfack eller
klippfack. Klippvalet har fem lägen:

- `off` spelar standardklippet utan modell.
- `rules` väljer den högst prioriterade tillåtna varianten utan modell.
- `random` lottar mellan standard och uttryckligen slumpaktiverade varianter vars villkor matchar.
- `shadow` tar emot modellens råd men spelar standard.
- `active` tillåter bara ett godkänt variant-ID för exakt händelse, dealer och utkastrevision.

Fel, timeout eller otillåtet råd ger standard. Kort, regler, saldo och
utbetalningar är aldrig OpenClaws ansvar. `POST /api/presentation/decision`
delar samma pågående eller sparade beslut för ett oförändrat `requestId`;
ändrat innehåll ger 409. Cachen gäller en Node-process.

Studio når Director med `LAB_REMOTE_URL` och `LAB_REMOTE_TOKEN` (serversidan,
ingen `NEXT_PUBLIC_*`). `OPENCLAW_MODEL_API_KEY` stannar på Gatewayen. Alla
nycklar och var de sätts står i
[ENVIRONMENT-VARIABLES](../../docs/ENVIRONMENT-VARIABLES.md). Director-tjänsten
och dess blueprint ligger i `services/openclaw/lab/`;
[OpenClaw-guiden](../../docs/AI/openclaw/README.md) har källorna.

## Spelmotorns presentationskontrakt

- Spelmotorn publicerar sex presentationstyper: `speak`, `deal`, `reveal`,
  `turn`, `settle`, `idle`. Klippkartans 16 grupper är visningsgrupper över
  dem, inte nya motorhändelser.
- `settle` är inte `speak`: resultatgruppen ersätter aldrig motorns exakta
  `speak.line`. `speak.other` samlar flera repliker och kan inte vara en
  gemensam talvideo.
- Plats 1–7 är `box0`–`box6`. Vänster, mitten och höger (0–1, 2–4, 5–6) är
  tekniska grupper; välj den exakta platsen.
- Dolt kort förblir `null` i publika vyer. Ett variantbeslut ändrar aldrig
  publicerade fakta.

`node --test apps/studio/test/engine-compatibility.test.mjs` provar den
riktiga presentationsfunktionen (`services/game/partner-presentation.mjs`) med
syntetiska publika vyer. Det är inget spel- eller videotest.

## Partnerreferens (diagnostik)

`/api/inputs/reference` (`lib/partner-reference.mjs`) provar kopplingen till
partnern: behörighet, spelöppning och videokarta. Den är valfri, gör inga
spelhandlingar och kräver `BETTALOTTO_PARTNER_*`-nycklarna i processmiljön (se
[ENVIRONMENT-VARIABLES](../../docs/ENVIRONMENT-VARIABLES.md)).
`lib/partner-observer.mjs` kontrollerar bara att nycklarna och adressen är
giltiga; den öppnar ingen anslutning.

## Prov

```powershell
npm --prefix apps/studio test
npm --prefix apps/studio run typecheck
npm --prefix apps/studio run build
```

- `sh .githooks/pre-commit --full` kör produktens sviter; en svit körs med
  `sh .githooks/pre-commit-full <svit>`. Högst fyra testarbetare.
- `node tools/check-orphan-tests.mjs` visar JS/TS-prov som ingen körlista tar
  med; `tools/orphan-tests-exceptions.json` namnger manuella prov med skäl.
- Prov använder isolerade filer och simulerade modelltransporter, aldrig
  riktiga spelare eller modellnycklar. Lägg nya kontroller i ett befintligt
  beteendeprov när det räcker; behåll negativa prov för hemliga fält, åtkomst
  och ägarskap.
