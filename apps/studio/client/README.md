# Admin- och lobbygränssnitt

`apps/studio/client` innehåller Studios UI-källa för `/admin`, `/admin/lobby` och den
separata publika `/lobby`. Klienten har eget låst React-/TypeScript-bygge;
Studio äger routes, autentisering och server-API:er. Övergången från `/control`
och `/play` pågår; deras fungerande delar används fortfarande.

| Del | Ansvar |
| --- | --- |
| `admin/` | Administration, Studio, dealerimport och anslutna arbetsytor. Innehåller även vyer vars produktkoppling är ofullständig. |
| `lobby/` | Lobby-UI, med skilda katalogadaptrar för intern visning och publik spelaringång. |
| `runtime/` | Navigations-/bildadaptrar, gemensam CSS och den publika lobbykatalogen. |
| `build.mjs` | Typkontrollerar admin/lobby och bygger tre browserpaket till `apps/studio/design-preview-build/`. |
| `source-provenance.json` | Ursprungliga källhashar före anpassningarna; historik, inte ett krav att återställa gamla UI-vägar. |

`apps/studio/tools/prepare-design-preview.mjs` installerar paketets låsta npm-beroenden
vid behov och bygger det i Studios `dev` och `build`. Studios
`app/admin/[[...path]]/route.ts` skyddar admindokument och resurser med
befintlig staff-auktorisering. `app/lobby/[[...path]]/route.ts` serverar det
fristående publika lobbybygget utan att exponera adminpaketet. UI:t använder
befintliga Studio-/spel-API:er; paketet är ingen egen databas eller spelmotor.
Vercel skickar båda adresserna till Studio-servicen.

Båda lobbybyggena använder samma `lobby/`-källa. Den publika varianten får
egen katalogadapter och publika resursadresser; den exponerar inte Admins
paket eller katalog. Adaptern `runtime/public-lobby-catalog.mjs` använder den gemensamma läsaren
`packages/player-catalog`, navigationens operatörsvalidering och
presentationens publika rumskontrakt. Den läser bara publicerad katalogdata;
Admin-data och osparade utkast ingår inte.

## Bygga och behålla

Normal lokal start går via [Studio-startaren](../README.md). För enbart
UI-bygget, från reporoten med Node 24:

```sh
node apps/studio/tools/prepare-design-preview.mjs
```

Behåll `admin/`, `lobby/`, `runtime/`, `package.json`, `package-lock.json` och
proveniensfilen. `node_modules/`, `.cache/` och `apps/studio/design-preview-build/` är
återbyggbara lokala resultat och ska inte checkas in. Klientens installation
och typkontroller styrs av paketmanifestet här och hålls separata från
Studios Next-bygge. Ursprungshasharna i proveniensen ändras inte vid flytt.

Nytt UI-arbete hör hemma i `/admin` och `/lobby`. Återinför inte `/control`
som produktmål för att en ursprunglig sökväg står i proveniensen. Outputen
`apps/studio/design-preview-build` följer Studios källrot. De publika adresserna
är oförändrade efter flytten från `packages/design-preview`. Aktuell acceptans finns i
[handoffen](../../../docs/JOHN-HANDOFF.md).
