# A18 · Ops-arv: `vercel-entry`, `preview/` och Caddy

Steg 1–2. B15 är öppet, så inget i `ops/vercel-entry/` eller `ops/caddy/` är
raderat. `build.mjs` är flyttad med `git mv`, inte borttagen som projekt.

## Steg 0

| Mätning | Värde |
| --- | --- |
| Start på `jakob/repo-ordning` | `43bb429cf5dc4d70b7b95fac8c8567e481f9f769` |
| `origin/main` efter fetch | `919691072212c044ccaf5aeaa8f0b2fbf99b1bf5` (Pin Studio migration 008) |
| Gemensam bas | `e160af12aea6fa1f99cff8a5e95186890a1d8220` |
| Main efter den basen | `12a12fd6`, `91969107`. Ingen av dem rör ägda filer |
| Ägda filer mot `origin/main` | oförändrade före denna aktivitet |
| Känd rörelse sedan `00ea55c5` | `c0b029f7` (Dealer Forge) ändrar env-dokumenten, inte `vercel-entry`-raden |
| Systemkarta före start | gul, 0 röda, exit 0 (BASLINJE §7: fortsätt och notera) |
| Node | 24.21.0 |

## Klassning

| Fil | Klass | Konsumenter | Rekommendation |
| --- | --- | --- | --- |
| `apps/croupier-frontend/tools/player-ui-build.mjs` | levande | `prepare-platform-ui.mjs:4`, `test/blackjack-entry-http.mjs:10`, `test/player-signup.mjs:9`, `ops/vercel-entry/test/build-preview.mjs:7`, `ops/vercel-entry/preview/build.mjs:4`, `ops/vercel-entry/preview/prepare.mjs:4` | ägs av frontenden. Behåll |
| `ops/vercel-entry/index.html` | levande mall | läses av `player-ui-build.mjs:95` | behåll tills landningssidan har en ny mall |
| `ops/vercel-entry/.env.example` | levande mall | `docs/environment-variables.json` templates | behåll. Bara nyckelnamnet `CROUPIER_GAME_ORIGIN`, tomt värde |
| `ops/vercel-entry/vercel.json` | pensionerad projektkonfiguration, testläst | `ops/vercel-entry/test/build-preview.mjs:46`, `preview-routes.mjs:14` | behåll tills B15. `buildCommand` är fortfarande `node build.mjs` och träffar ingen fil |
| `ops/vercel-entry/README.md` | pensionerad projektext | människor | behåll. Kommandona pekar nu på den nya filen |
| `ops/vercel-entry/.gitignore` | pensionerat stöd | ignorerar `dist/` och `.vercel/` | behåll tills B15 |
| `ops/vercel-entry/test/build-preview.mjs` | levande test | `.githooks/pre-commit-full:63` | behåll. Importen uppdaterad |
| `ops/vercel-entry/test/preview-routes.mjs` | prov-verktyg | `.githooks/pre-commit-full:64` | behåll |
| `ops/vercel-entry/preview/build.mjs` | prov-verktyg | `preview-routes.mjs:8`. Egen `buildCommand` `node build.mjs` i preview-roten | behåll. Anropar frontendens `build` |
| `ops/vercel-entry/preview/prepare.mjs` | prov-verktyg | `preview/build.mjs`, `preview-routes.mjs:9` | behåll |
| `ops/vercel-entry/preview/route-guard.js` | prov-verktyg | kopieras av `preview/build.mjs` | behåll |
| `ops/vercel-entry/preview/preview-only.css` | prov-verktyg | kopieras av `preview/build.mjs` | behåll |
| `ops/vercel-entry/preview/vercel.template.json` | prov-verktyg | `prepare.mjs`, `preview-routes.mjs:15` | behåll. Platshållare, ingen riktig backend |
| `ops/vercel-entry/preview/README.md` | prov-verktyg | människor | behåll |
| `ops/vercel-entry/preview/.gitignore` | prov-verktyg | ignorerar `dist/`, genererad `vercel.json`, `.vercel/`, `.env.local` | behåll |
| `ops/caddy/bettalotto-game-auth.Caddyfile` | pensionerad i repot, eventuell extern drift | ingen träff på filnamnet utanför `ordning/` | radera inte förrän T6 |

`test/vercel-presentation-video-origin.mjs:13` importerar inte bygget. Den
använder originen `https://github-work-vercel-entry.vercel.app` som opt-in för
Range/206. Sökvägen är oförändrad.

## Caddy, struktur utan värden

Två site-block. `www`-värden omdirigerar permanent till apex och behåller `{uri}`.
Apex har tre handledare: en namngiven match för partnerytor (API v1, docs,
dealers, dealer, assets) med encode och `reverse_proxy` till loopback; en
namngiven match för inloggning och backoffice (auth-API, bo-API, bo-sidor) med
`reverse_proxy` till samma loopback; en default med `forward_auth` mot loopback
på `/api/auth/access`, därefter encode och `reverse_proxy`. Inga adresser eller
portar här. Partnerdokumentationen och `BETTALOTTO_PARTNER_*` är en annan sak
än den här filen.

## Flytt

`git mv` till `apps/croupier-frontend/tools/player-ui-build.mjs` är en egen
commit. Därefter bara sökvägar som annars pekar fel efter flytten:

- repots rot och `tools/media-layout.mjs` är tre nivåer upp
- landningsmallen är kvar i `ops/vercel-entry/index.html`
- CSS är kvar i `web/public/blackjack-entry.css`
- `outputName` rad 20 släpper fortfarande igenom `presentation-runtime/` och
  `lab/policies/idle-policy.seed.json` (A21)

Anropare som skickar `output` är oförändrade. CLI utan `output` skriver `dist/`
bredvid det nya skriptet. Ogiltiga CLI-argument namnger den nya filen. Det är
den enda texten som inte är en sökväg.

`.githooks/pre-commit-full` är orörd: testerna ligger kvar.

## Frågor bara Vercel eller Jakob kan besvara

1. Finns Vercel-projektet `github-work-vercel-entry` kvar?
2. Körs `ops/caddy/bettalotto-game-auth.Caddyfile` på en extern server? (T6)
3. Ska `ops/vercel-entry/preview/` fortsätta som QA-verktyg efter B15?

## Inte gjort (B15)

Steg 3. Ingen radering av projektkonfiguration, `preview/` eller Caddy.
Env-tjänsten `vercel-entry` finns kvar. Källan är den nya filen. Mallen är
`.env.example`.

## Dokument som andra äger

- `docs/system-map/index.html` bäddar in katalogen och namnger fortfarande
  `ops/vercel-entry/build.mjs`. Inte ägd här.
- `ordning/BASLINJE.md` §3, `ordning/README.md` och
  `ordning/aktiviteter/A21-presentation-runtime.md` pekar på den gamla sökvägen.
  A21 ska följa `apps/croupier-frontend/tools/player-ui-build.mjs` rad 20.

## Tveksamt

- `ops/vercel-entry/vercel.json` kan inte bygga det pensionerade projektet
  längre. Ingen shim är tillagd. Säg till om den historiska roten ska kunna
  byggas tills B15.
- CLI-standardens `dist/` följer skriptet. Alla anropare i repot skickar
  `output`. Säg till om standarden ska låsas till `ops/vercel-entry/dist/`.
- `preview/build.mjs` och `prepare.mjs` läser samma `CROUPIER_GAME_ORIGIN` men
  står inte som egna `sources`. Det var så före flytten. Nyckeln ligger kvar
  på tjänsten `vercel-entry`.
