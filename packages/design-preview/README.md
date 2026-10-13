# Admin- och lobbygränssnitt

Mappen innehåller den aktiva UI-källan för `/admin`, `/admin/lobby` och den
separata publika `/lobby`. Det historiska namnet `design-preview` betyder inte
att hela mappen är en borttagbar designexport. Övergången från `/control` och
`/play` pågår; deras fungerande delar används fortfarande.

| Del | Ansvar |
| --- | --- |
| `admin/` | Administration, Studio, dealerimport och anslutna arbetsytor. Innehåller även vyer vars produktkoppling är ofullständig. |
| `lobby/` | Lobby-UI, med skilda katalogadaptrar för intern visning och publik spelaringång. |
| `runtime/` | Navigations-/bildadaptrar, gemensam CSS och den publika lobbykatalogen. |
| `build.mjs` | Typkontrollerar admin/lobby och bygger tre browserpaket till `lab/design-preview-build/`. |
| `source-provenance.json` | Ursprungliga källhashar före anpassningarna; historik, inte ett krav att återställa gamla UI-vägar. |

`lab/tools/prepare-design-preview.mjs` installerar paketets låsta npm-beroenden
vid behov och bygger det i Lab:s `dev` och `build`. Lab:s
`app/admin/[[...path]]/route.ts` skyddar admindokument och resurser med
befintlig staff-auktorisering. `app/lobby/[[...path]]/route.ts` serverar det
fristående publika lobbybygget utan att exponera adminpaketet. UI:t använder
befintliga Studio-/spel-API:er; paketet är ingen egen databas eller spelmotor.
Vercel skickar båda adresserna till Studio-servicen.

## Bygga och behålla

Normal lokal start går via [Lab-startaren](../../lab/README.md). För enbart
UI-bygget, från reporoten med Node 24:

```sh
node lab/tools/prepare-design-preview.mjs
```

Behåll `admin/`, `lobby/`, `runtime/`, `package.json`, `package-lock.json` och
proveniensfilen. `node_modules/`, `.cache/` och `lab/design-preview-build/` är
återbyggbara lokala resultat och ska inte checkas in. De två appmapparnas
egna manifest är importerad UI-proveniens; den gemensamma installationen och
bygget styrs av paketmanifestet här.

Nytt UI-arbete hör hemma i `/admin` och `/lobby`. Återinför inte `/control`
som produktmål för att en ursprunglig sökväg står i proveniensen. En flytt av
källmappen kräver uppdaterade byggverktyg, routes och deploymentspår; gör den
inte genom att enbart byta mappnamn. Aktuell acceptans finns i
[handoffen](../../docs/JOHN-HANDOFF.md).
