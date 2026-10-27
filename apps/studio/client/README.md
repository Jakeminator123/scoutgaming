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

### Bygg om klienten när du sparar

Admin serverar det separata klientbygget från disk. Nexts vanliga omladdning
bygger inte om de filerna. Bygg Admin först (den tidigare `--offline`-fixturen är
pensionerad 27 oktober 2026) och använd den isolerade Admin-fixturen:

```powershell
node tools/admin-clips-fixture.mjs --ffmpeg <installerad-ffmpeg.exe>
```

Kör sedan i en andra terminal från reporoten:

```powershell
npm --prefix apps/studio run dev:client
```

Kommandot bygger klienten igen när dess källfiler eller återanvända komponenter
och kontrakt ändras. Det använder samma typkontroller och bygge som vanligt,
samlar flera sparningar och kör högst ett eget bygge åt gången. Ett byggfel
visas i terminalen; nästa ändring gör ett nytt försök. Klientens låsta
beroenden ska redan vara installerade av första bygget.
Ändras paketmanifest eller låsfil, stoppa bevakningen, kör det befintliga
förberedelsekommandot ovan och starta bevakningen igen.

När bygget lyckas, spara dina utkast och ladda om den befintliga Adminfliken.
Detta är automatisk ombyggnad med manuell siduppdatering; pågående utkast
laddas inte om automatiskt. Klientändringar kräver ingen Next-omstart.
Serverändringar följer fortfarande serverns vanliga utvecklingsflöde.
Scenförhandsvisningens separata `/preview/`-resurser från
`packages/presentation/compositor` och `packages/presentation/preview`
byggs fortfarande med `npm --prefix apps/studio run prepare:preview`.
Avsluta bevakningen med Ctrl+C innan du startar ett annat klientbygge i
samma arbetskopia; invänta att ett eventuellt pågående bygge avslutas.
Kommandot startar ingen egen produktserver eller databas.

Behåll `admin/`, `lobby/`, `runtime/`, `package.json`, `package-lock.json` och
proveniensfilen. `node_modules/`, `.cache/` och `apps/studio/design-preview-build/` är
återbyggbara lokala resultat och ska inte checkas in. Klientens installation
och typkontroller styrs av paketmanifestet här och hålls separata från
Studios Next-bygge. Ursprungshasharna i proveniensen ändras inte vid flytt.

Nytt UI-arbete hör hemma i `/admin` och `/lobby`. Återinför inte `/control`
som produktmål för att en ursprunglig sökväg står i proveniensen. Outputen
`apps/studio/design-preview-build` följer Studios källrot. De publika adresserna
är oförändrade efter flytten från `packages/design-preview`. Aktuell acceptans finns i
[handoffen](../../../docs/history/JOHN-HANDOFF-2026-10.md).
