# Vercel som spel-frontend – migrationskontrakt 2026-09-29

## Beslut och nuvarande läge

Målet är **en synlig Vercel-adress** (den befintliga `.vercel.app`-adressen
räcker; egen domän behövs inte nu). Vercel ska bygga och leverera spelarens
HTML, JavaScript och CSS. Render ska fortsätta köra spelmotorn, serverägda
kort/skor/plånbok, autentisering, SQLite på `/var/data`, BO, Lab och
OpenClaw-/mediaanslutningar. RunPod/GPU är ett separat, valbart steg för
genererat tal och läppsynk, inte ett villkor för förinspelad Astrid.

Den separata startsidan finns nu i privata
[`Jakeminator123/croupier-frontend`](https://github.com/Jakeminator123/croupier-frontend)
och är publicerad på
[`modern-landing-page-kohl-xi.vercel.app`](https://modern-landing-page-kohl-xi.vercel.app/).
Dess `/demo` är en tydlig väg till det riktiga Render-spelet, inte längre ett
klientsidigt låtsasspel. Den separata repoindelningen bevaras under fortsatt
spelklientmigration. Vercel-projektets nuvarande namn och domän är oförändrade.

I dag är Render `croupier-v2` Live och Vercel `github-work-vercel-entry`
publicerad, men Vercel levererar **bara en landningssida med en extern länk**
till Render `/blackjack`. Detta är inte den önskade front/back-delningen.
Lyckad inloggning, hel spelrunda, BO/Lab, omstart och backup/restore är
inte verifierade i den publika driften. Tidigare stycken i
`CLOUD-LAUNCH-HANDOFF.md` som säger att ingen tjänst skapats beskriver ett
äldre läge.

Kodläget har avancerat utan publik cutover: `ops/vercel-entry/preview/` är en
separat, fail-closed Vercel-projektrot med en explicit spelar-/Astrid-proxylista
och en mall som inte kan användas förrän en isolerad testbackend med annan
hostname och databas anges. Render kan opt-in acceptera en enda exakt
`CROUPIER_VERCEL_FRONTEND_ORIGIN` för spelar-POST och videons Range-anrop.
Detta är lokalt testad kod, **inte** ett påstående om att Vercel faktiskt
vidarebefordrar rätt Host/Origin/cookies eller att spelet fungerar där.

## Målrutter

| Synlig väg på Vercel | Ägare efter migration |
| --- | --- |
| `/` | Vercels landningssida |
| `/blackjack` och `/table` | Vercelbyggd inloggnings- respektive spelklient |
| `/api/auth/*`, `/api/table`, övriga spel-/presentation-API:er, `/chat` | Render via uttryckligt same-origin-proxykontrakt; aldrig direkt browser-CORS |
| Dealerfilm, index, ljud och andra stora spelmedier | Render bakom verifierad Vercel-rewrite eller senare separat media-CDN; version och HTTP Range måste stämma |
| `/backoffice` och `/lab` | Vercel-adress som ingång, men BO:s skyddade HTML och Labs dynamiska Next-app ligger kvar på Render tills en egen frontendmigrering är klar |
| `/speech-stream` | Eget WebSocket-acceptansprov före aktivering; förinspelade klipp fungerar utan den |

Kopiera **inte** hela `web/public` till Vercel: den innehåller cirka 499 MiB,
bland annat skyddad BO-UI och gamla QA-ytor. Välj spelarfrontens källfiler
och deras exakta beroenden. Att en extern Vercel-rewrite behåller adressen
gör inte BO/Lab till Vercelbyggda appar; redovisa detta tydligt.

## Ordning och stoppvillkor

1. Skaffa en isolerad Render-testbackend med tom databas, separat disk och
   annan hostname. Bygg därefter den opt-in-förhandsversion som serverar
   verklig statisk blackjack-front från Vercel utan att ändra Production-länken.
   Mät vad Vercel faktiskt skickar som Host/Origin och hur Set-Cookie,
   Location, Cache-Control och Range/206 beter sig genom en read-only
   rewrite till Render.
2. Lägg till ett **exakt** betrott Vercel-origin-kontrakt i Render, med
   regressionstester för CSRF, cookies, adminroller, BO→Lab-handoff och
   felaktiga/okända hosts. Använd inte wildcard `*.vercel.app` och stäng
   inte av befintliga spärrar för att få ett grönt klicktest.
3. Prova inloggning/utloggning, omladdning mitt i en serverägd runda,
   betalning med demokrediter, BO/Lab-anonymt och som admin, två Astrid-
   uppspelningar, media-Range och mobilbrowser på Vercel-preview.
   Visa att Render-disken bevarar data efter omstart och att en separat,
   konsistent backup kan återställas i isolerad miljö.
4. Först efter dessa prov: ändra Production-ingången till intern
   `/blackjack` och behåll Render som backend. Testa WebSocket och lång
   SSE separat innan genererat tal/kamera/GPU aktiveras.

Inga nya Blob-, Redis-, Postgres- eller OAuth-tjänster beställs för denna
första migration. Befintlig SQLite och disk räcker för en enda pilotinstans,
men backup/restore måste bevisas innan viktiga data anförtros den. Blob är
objektlagring för filer, inte ersättning för speldatabasen; ta beslutet först
när dynamiska uppladdningar eller mediabandbredd kräver det. Utgifter för
GPU-prov kräver separat kostnadstak och stoppvillkor.

Källor i repot: `ops/vercel-entry/build.mjs`, `web/public/blackjack-entry.*`,
`web/public/index.html`, `web/player-auth.mjs`, `ops/cloud/gateway.mjs`,
`ops/cloud/config.mjs`, `docs/ENVIRONMENT-VARIABLES.md`.
