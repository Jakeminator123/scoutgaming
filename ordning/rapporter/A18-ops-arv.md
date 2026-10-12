# A18 · Ops-arv: `vercel-entry`, `preview/` och Caddy

B15 (2026-10-12): ta bort, men beskriv vad det var och behåll det som fortfarande
används. Vercel-projektet `github-work-vercel-entry` finns inte. `bettalotto.se`
körs av Caddy på `37.27.199.225`, svarar 301 till `https://croupier.scoutgg.dev/`
och använder inte filen i repot.

Levande bygglogik: `apps/croupier-frontend/tools/player-ui-build.mjs`.
Landningsmallen följde med till `player-ui-landing.html`.
`presentation-runtime/` släpps fortfarande igenom på rad 20.
Provet som skyddar bygget ligger i `apps/croupier-frontend/test/player-ui-build.mjs`.

Återställning av en borttagen sökväg: `git checkout 00ea55c5 -- <sökväg>`.
Det återskapar trädet vid baslinjen, inklusive den gamla `ops/vercel-entry/build.mjs`
bredvid den nya filen.

## Borttaget

| Del | Vad det var | Tillagd | Varför den inte används |
| --- | --- | --- | --- |
| `ops/vercel-entry/README.md`, `vercel.json`, `.env.example`, `.gitignore` | Fristående Vercel-projekt "Enkel Vercel-ingång till Blackjack". `vercel.json` byggde `node build.mjs` till `dist/` | `4dec3e1a` 2026-09-28, Jakob Eberg | Projektet `github-work-vercel-entry` finns inte. Bygget ägs av frontenden |
| `ops/vercel-entry/index.html` | Landningsmall med `{{BLACKJACK_URL}}` | samma commit | Flyttad, inte slängd: `apps/croupier-frontend/tools/player-ui-landing.html` |
| `ops/vercel-entry/preview/` | Isolerad, odriftsatt Preview-rot med ogiltig platshållar-proxy, route-guard och CSS som låste Astrid | `2941c577` 2026-09-29, Jakob Eberg. `route-guard.js`: `f31a06de` samma dag | Ingen publik Preview. Skyddade bara den mappen |
| `ops/vercel-entry/test/preview-routes.mjs` | Prov av preview-routrar och `prepare.mjs` | `2941c577` 2026-09-29, Jakob Eberg | Skyddade bara preview-projektet |
| `ops/vercel-entry/test/build-preview.mjs` | Prov av `build()` plus det pensionerade `vercel.json` | `5e693abc` 2026-09-29, Jakob Eberg | `build()`-delen flyttad till `apps/croupier-frontend/test/player-ui-build.mjs`. CSP-kontrollerna av `vercel.json` följde inte med |
| `ops/caddy/bettalotto-game-auth.Caddyfile` | Caddy för `www` → apex, partnerytor, inloggning/backoffice och `forward_auth` mot loopback på `/api/auth/access`. Inga adresser i den här texten | `bdb01f31` 2026-09-20, ImpactPL (Kevin), "Connect backoffice sign-in to original and V2 games" | Den live servern använder inte filen. Kevins aktuella Caddy-filer ligger på `kevin/croupier-scoutgg/drift/` |

## Env och karta

Tjänsten `vercel-entry` är kvar. `CROUPIER_GAME_ORIGIN` läses av
`player-ui-build.mjs` och finns också som villkor på `render-game`, med en
annan betydelse (samma publika origin som partnerbasen). Mallen
`.env.example` är borta. Systemkartans `environment.vercel-entry` pekar på
spelarbygget.

## Dokumentändringar som behövs

- `docs/CLOUD-MIGRATION.md`: `github-work-vercel-entry` är borta.
  `ops/vercel-entry/` och `ops/caddy/bettalotto-game-auth.Caddyfile` är
  borttagna. `bettalotto.se` svarar 301 till `https://croupier.scoutgg.dev/`
  och använder inte den filen. Aktuell Caddy-drift: `kevin/croupier-scoutgg/drift/`.
- `docs/system-map/index.html` kan fortfarande bädda in den gamla källsökvägen.
- `ordning/BASLINJE.md`, `ordning/README.md`, `A21-presentation-runtime.md`
  och `A19-lokal-hygien.md` nämner `ops/vercel-entry`. A21:s prov ska vara
  `apps/croupier-frontend/test/player-ui-build.mjs`, och genomsläppet är
  `player-ui-build.mjs` rad 20.

## Tveksamt

- Tjänsten heter fortfarande `vercel-entry` fast projektet är borta, så att
  läsaren av nyckeln har en källa. Säg till om posten ska slås ihop med
  `render-game`.
- `test/vercel-presentation-video-origin.mjs` använder fortfarande
  `https://github-work-vercel-entry.vercel.app` som exakt testorigin. Den
  hämtar inte projektet.
- `check-orphan-tests.mjs` inventerar inte `apps/**/test`. Kroken kör det
  flyttade provet, samma mönster som övriga frontendprov.
