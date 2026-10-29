# Admin- och lobbyklienten

`apps/studio/client` innehåller UI-källan för Admin (`/admin`) och den publika
lobbyn (`/lobby`). Klienten har ett eget låst React-/TypeScript-bygge; Studio
äger rutter, inloggning och server-API:er.

React, react-dom, deras `@types`, esbuild och TypeScript har exakt samma
versioner här som i `apps/studio/package.json`, eftersom de delade
komponenterna i `apps/studio/components` byggs av båda. Uppgradera dem i båda
paketen i samma PR. Planen för resten av verktygskedjan (en Tailwind, en
tokenfil, ett mörkt läge) står i
[VERKTYGSKEDJA](../../../docs/plans/VERKTYGSKEDJA.md).

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
