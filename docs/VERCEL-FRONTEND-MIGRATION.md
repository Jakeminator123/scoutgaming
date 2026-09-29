# Vercel som spel-frontend – migrationskontrakt 2026-09-29

## Beslut och nuvarande läge

Målet är **en synlig Vercel-adress** (den befintliga `.vercel.app`-adressen
räcker; egen domän behövs inte nu). Vercel ska bygga och leverera spelarens
HTML, JavaScript och CSS. Render ska fortsätta köra spelmotorn, serverägda
kort/skor/plånbok, autentisering, SQLite på `/var/data`, BO, Lab och
OpenClaw-/mediaanslutningar. RunPod/GPU är ett separat, valbart steg för
genererat tal och läppsynk, inte ett villkor för förinspelad Astrid.

Jakob beslutade 2026-09-29 att ta in den separata startsidan i detta repo och
låta den ersätta den enklare sidan som länkar till blackjack. Källan
[`Jakeminator123/croupier-frontend`](https://github.com/Jakeminator123/croupier-frontend)
`main` vid `2ec2b3f2` är nu importerad till `apps/croupier-frontend/`.
Källprojektet och dess publicerade
[`modern-landing-page-kohl-xi.vercel.app`](https://modern-landing-page-kohl-xi.vercel.app/)
finns kvar för v0-designarbete; ändringar där synkas inte automatiskt.
Den importerade `/demo` har två spelknappar som kan byggas mot en exakt
`CROUPIER_GAME_URL`. Klientsidans äldre låtsasspel har ingen publik rutt.

I dag är Render `croupier-v2` Live och Vercel `github-work-vercel-entry`
publicerad, men Vercel levererar **bara en landningssida med en extern länk**
till Render `/blackjack`. Detta är inte den önskade front/back-delningen.
Lyckad inloggning, hel spelrunda, BO/Lab, omstart och backup/restore är
inte verifierade i den publika driften. Tidigare stycken i
`CLOUD-LAUNCH-HANDOFF.md` som säger att ingen tjänst skapats beskriver ett
äldre läge.

`apps/croupier-frontend/` har ett eget isolerat Vercel-testprojekt,
`croupier-landing-preview-qa`. Den separata spel-Previewn i
`ops/vercel-entry/preview/` använder test-Render
`croupier-vercel-preview-qa` med egen tom SQLite och disk. Ett syntetiskt konto
har verifierat Vercels inloggningscookie, Origin, två serverägda rundor och
omladdning mitt i en runda. Direkt mot test-Render gav video-Range HTTP 206;
206 genom Vercels rewrite och visuell läppsynk återstår. Den senaste
landnings-Previewn är
`https://croupier-landing-preview-eokix0slk-jakeminator123s-projects.vercel.app`
och länkar till den senaste spel-Previewn
`https://croupier-player-preview-3esw2v3fl-jakeminator123s-projects.vercel.app`.
Ingen befintlig produktionsadress har flyttats.

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
plånbok; se [zonlagringen](ZONE-CLOUD-STORAGE.md). Zonernas Lab- och
spelkoppling återstår. Inga Redis- eller OAuth-tjänster behövs för denna
första migration. Backup/restore av befintlig SQLite och disk måste bevisas
innan viktiga data anförtros den. Utgifter för GPU-prov kräver separat
kostnadstak och stoppvillkor.

Källor i repot: `apps/croupier-frontend/`, `ops/vercel-entry/build.mjs`, `web/public/blackjack-entry.*`,
`web/public/index.html`, `web/player-auth.mjs`, `ops/cloud/gateway.mjs`,
`ops/cloud/config.mjs`, `docs/ENVIRONMENT-VARIABLES.md`.
