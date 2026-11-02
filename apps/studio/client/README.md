# Admin- och lobbyklienten

`apps/studio/client` innehåller UI-källan för Admin (`/admin`) och den publika
lobbyn (`/lobby`). Klienten har ett eget låst React-/TypeScript-bygge; Studio
äger rutter, inloggning och server-API:er.

React, react-dom, deras `@types`, esbuild och TypeScript har exakt samma
versioner här som i `apps/studio/package.json`, eftersom de delade
komponenterna i `apps/studio/components` byggs av båda. Uppgradera dem i båda
paketen i samma PR; `apps/studio/test/delivery/client-version-sync.test.mjs` kontrollerar
det. Aktuella versioner läses ur paketmanifesten, inte ur äldre införandeplaner.

| Del | Ansvar |
| --- | --- |
| `admin/` | Admin: Studio-sidorna (sceneditor, klippkarta, dealers, bord och bakgrunder), bolag, rum, konton, drift och ekonomi |
| `lobby/` | Lobbyn, med skilda katalogadaptrar för intern visning och publik spelaringång |
| `runtime/` | Navigations- och bildadaptrar, gemensam CSS och den publika lobbykatalogen |
| `build.mjs` | Typkontrollerar admin och lobby och bygger tre browserpaket till `apps/studio/design-preview-build/` |

`apps/studio/tools/prepare-design-preview.mjs` installerar paketets låsta
npm-beroenden vid behov och bygger klienten i Studios `dev` och `build`.
`app/admin/[[...path]]/route.ts` skyddar Admin med personalbehörighet;
`app/lobby/[[...path]]/route.ts` serverar det publika lobbybygget utan
Admin-paketet. Den publika lobbyn läser bara publicerad katalogdata via
`runtime/public-lobby-catalog.mjs` och `packages/player-catalog`.

[`admin/lib/roulette/`](admin/lib/roulette/) samlar klippbindning, startredigering
och mediegranskning med deklarationer och fyra beteendeprov. Komponenterna i
`admin/components/studio/` använder samma moduler; full regression registrerar
proven på deras nya sökvägar.

## UI, tema och kontrakt

Admin och lobbyn byggs med Tailwind 4. Delade färger och typsnitt definieras i
[tokens.css](../../../packages/ui/tokens.css). Studios Next-layout och klientbygget
använder samma [temastart](../lib/theme-mode.mjs): sparat `sg-theme`, annars mörkt
läge. Partnerportalens CSS mappar sina befintliga namn till samma `--sg-*`-tokens.
Äldre alternativ om Tailwind 3 eller en framtida tokenflytt är inte återstående
införandearbete.

Återanvänd [Admin-kitet](admin/components/ui/kit.tsx), [sidhuvudet](admin/components/ui/page-header.tsx)
och befintliga formulär-, tabell- och dialogkomponenter. Partnerportalens egna
adaptrar beskrivs i [dess guide](../components/partner/README.md). De har levande
konsumenter och kan förenklas tillsammans med dem. Historiska pixelmått, menyantal
och komponentnamn är inte låsningar av nästa design.

Behåll tangentbordsåtkomst, synligt fokus, kontrast och begripliga tom-/feltillstånd.
Status ska kunna förstås utan enbart färg. Relevanta prov är
[kitets beteenden](../test/admin/admin-ui-kit.test.mjs), [valda menyposters fokus](../test/admin/css-focus-ring.test.mjs),
[knappars och diagrams fokus](../test/admin/admin-chart-focus.test.mjs) och [tokens](../../../test/presentation/theme/ui-tokens.mjs).
Browserproven mäter tangentbordsfokus och kontrast i båda teman och högkontrastläge.
Ett provkvitto gäller den provade versionen;
en dokumentlänk är inget nytt godkännande av layout eller produktbeteende.

Publicering, bolagsisolering, revisioner och sparade utkast är serverkontrakt.
Följ [användarguiden](../docs/README.md), [publiceringsmodulen](../lib/rooms/room-release.mjs)
och dess [beteendeprov](../test/rooms/room-release.test.mjs). Kvarvarande produktarbete
samlas i [körplanen](../../../docs/plans/organisation/KORPLAN-v2.md).

Den som ändrar bygget, temat eller dessa kontrakt uppdaterar denna guide i samma
PR. Kontrollera manifest, konsument och berörda beteendeprov; en ny datumstämpel
ersätter inte den kontrollen.

## Bygga

Från reporoten med Node 24:

```sh
node apps/studio/tools/prepare-design-preview.mjs
```

### Bygg om när du sparar

Admin serverar klientbygget från disk; Nexts omladdning bygger inte om det.
Starta den isolerade fixturen och bevakningen i två terminaler:

```powershell
node tools/admin-clips-fixture.mjs --ffmpeg <installerad-ffmpeg.exe>
npm --prefix apps/studio run dev:client
```

Bevakningen bygger om när klientens källfiler eller återanvända komponenter
och kontrakt ändras, kör högst ett bygge åt gången och visar byggfel i
terminalen. Ladda om Adminfliken när bygget lyckats; osparade utkast laddas
inte om automatiskt. Ändras paketmanifest eller låsfil: stoppa bevakningen,
kör förberedelsekommandot ovan och starta igen. Scenförhandsvisningens
`/preview/`-resurser byggs med `npm --prefix apps/studio run prepare:preview`.

`node_modules/`, `.cache/` och `apps/studio/design-preview-build/` är lokala
byggresultat och checkas inte in. Nytt UI-arbete hör hemma i `/admin` och
`/lobby`; `/control` är bara en redirect.
