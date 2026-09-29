# Vercel som spel-frontend – migrationskontrakt 2026-09-29

## Aktuell driftkarta 2026-09-29

Läs [den korta aktuella molnkartan](CLOUD-CURRENT-STATE-2026-09-29.md)
för senaste livekontroller och resursroller. Texten nedan är kontraktet för
en framtida flytt av själva spelklienten, inte en instruktion att byta den
nu fungerande Studio- eller spelvägen.

Den Git-kopplade startsidan är nu
[`croupier-frontend.vercel.app`](https://croupier-frontend.vercel.app/).
Vercel-projektet `croupier-frontend` bygger `apps/croupier-frontend` från
`Jakeminator123/github-work`, branch `jakemanator123-github-work`. Första
deploymenten från `d78eb4cb` blev READY; `/` och `/demo` har kontrollerats.
`CROUPIER_GAME_URL` är sparad för Production och Preview och pekar på
`https://croupier-v2.onrender.com/blackjack?dealer=astrid`. En senare push
(`d8d4b707`) gav automatiskt READY-deployment
`dpl_9GcmrpbHQ91oTJwnBYUuvV5DzxDZ`. Spellänken går fortfarande till Render;
spelklienten, spel-API:erna och data har inte flyttats till Vercel eller Neon.

De ersatta projekten `github-work-vercel-entry` och
`croupier-landing-preview-qa` är borttagna. Vercels API gav 404 för båda vid
kontroll den 29 september. Använd huvudprojektet för nya frontendleveranser.
Det äldre Vercel-projektet
`modern-landing-page`, med adress `modern-landing-page-kohl-xi.vercel.app`,
raderades 2026-09-29 efter Jakobs uttryckliga bekräftelse. Vercels CLI
bekräftade raderingen och en efterkontroll fann inget projekt med det namnet.
Det separata GitHub-källrepot `Jakeminator123/croupier-frontend` raderades
inte. För alla övriga aktuella resurser, se
[gemensam molnkarta](CLOUD-CURRENT-STATE-2026-09-29.md).

## Beslut och nuvarande läge

Målet är **en synlig Vercel-adress** (den befintliga `.vercel.app`-adressen
räcker; egen domän behövs inte nu). Vercel ska bygga och leverera spelarens
HTML, JavaScript och CSS. Render ska fortsätta köra spelmotorn, serverägda
kort/skor/plånbok, autentisering, SQLite på `/var/data`, BO, Lab och
OpenClaw-/mediaanslutningar. RunPod/GPU är ett separat, valbart steg för
genererat tal och läppsynk, inte ett villkor för förinspelad Astrid.

Jakob beslutade 2026-09-29 att ta in den separata startsidan i detta repo och
låta den ersätta den enklare sidan som länkar till blackjack. Källan var det
dåvarande GitHub-repot `Jakeminator123/croupier-frontend`, `main` vid
`2ec2b3f2`, och importerades till `apps/croupier-frontend/`.
Det separata källrepot uppdaterar inte den importerade koden automatiskt.
Dess tidigare Vercel-publicering är nu borttagen enligt driftkvittot ovan.
Den importerade `/demo` har två spelknappar som kan byggas mot en exakt
`CROUPIER_GAME_URL`. Klientsidans äldre låtsasspel har ingen publik rutt.

Tidigare env-kvitton för de två avvecklade landningsprojekten är historiska.
Nu används `CROUPIER_GAME_URL` i `croupier-frontend`. Både Production och
Preview pekar på Render-produktion; konfigurera isolerad speladress före
spel-QA i Preview. Se [miljöregistret](ENVIRONMENT-VARIABLES.md).

Render `croupier-v2` är Live. `croupier-frontend` levererar den importerade
Next-landningssidan med en extern länk till Render `/blackjack`. Den planerade
Vercelbyggda spelklienten med Render som API-backend återstår.
Den 29 september fungerade befintliga sessionscookies i både Studio och
spelarens `/blackjack`-ingång; spelaren gick vidare till rätt Astrid-väg och
video spelade i 1080 × 1920. Detta var läsande kontroll, ingen ny
lösenordsinloggning, spelrunda, omstart eller backup/restore. Tidigare stycken i
`CLOUD-LAUNCH-HANDOFF.md` som säger att ingen tjänst skapats beskriver ett
äldre läge.

Den separata landnings-QA:n är avvecklad. Den kvarvarande spel-Previewn i
`ops/vercel-entry/preview/` använder test-Render
`croupier-vercel-preview-qa` med egen tom SQLite och disk. Ett syntetiskt konto
har verifierat Vercels inloggningscookie, Origin, två serverägda rundor och
omladdning mitt i en runda. Direkt mot test-Render gav video-Range HTTP 206;
206 genom Vercels rewrite och visuell läppsynk återstår. Spel-Previewns adress är
`https://croupier-player-preview-3esw2v3fl-jakeminator123s-projects.vercel.app`.
Dess Render-testbackend är pausad. Projektets Blob- och Neon-kopplingar
behålls tills en kontrollerad flytt är genomförd. Spelklientens produktionsbyte
återstår. Den Git-kopplade startsidans `/labb`, `/labb/filmer`, `/labb/zoner`
och `/labb/guide` gav verifierad HTTP 307 till motsvarande skyddade Render-
`/studio`-vägar den 29 september.

## Målrutter

| Synlig väg på Vercel | Ägare efter migration |
| --- | --- |
| `/` | Importerade Next-landningssidan från `apps/croupier-frontend/` |
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

Den första spelklientmigrationen flyttar fortfarande inte speldata från
Render/SQLite. Neon Free `croupier-preview-neon` är kopplad endast till
spel-Previewn men används ännu inte av spelet. En separat Neon Free-resurs
och Vercel Blob skapades för **Astrids bakgrundszoner**, inte för spel eller
plånbok; se [zonlagringen](ZONE-CLOUD-STORAGE.md). Lab kan nu läsa zoner
från separat Neon och spara privat media. Full liveacceptans av zonupload
och zonernas koppling till speluppspelningen återstår. Inga Redis- eller OAuth-tjänster behövs för denna
första migration. Backup/restore av befintlig SQLite och disk måste bevisas
innan viktiga data anförtros den. Utgifter för GPU-prov kräver separat
kostnadstak och stoppvillkor.

Källor i repot: `apps/croupier-frontend/`, `ops/vercel-entry/build.mjs`, `web/public/blackjack-entry.*`,
`web/public/index.html`, `web/player-auth.mjs`, `ops/cloud/gateway.mjs`,
`ops/cloud/config.mjs`, `docs/ENVIRONMENT-VARIABLES.md`.
