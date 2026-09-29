# Croupier: gemensamt molnläge 2026-09-29

Detta är en daterad driftkarta för agentarbete. Kontrollera leverantörernas
aktuella tillstånd innan en deploy eller radering; en äldre rubrik i ett
handoffdokument ändrar inte det som faktiskt körs. Arbetsbranchen är
`jakemanator123-github-work` i `Jakeminator123/github-work`. GitLab-flödet är
pausat enligt `AGENTS.md`. Inga hemlighetsvärden hör hemma i denna fil.

## Körande och förberedda ytor

| Resurs | Källa och nuvarande roll | Verifierat / kvar |
| --- | --- | --- |
| Render `croupier-v2` | GitHub `Jakeminator123/github-work`, `jakemanator123-github-work`; senaste observerade deploy `05906bd8`. Äger ännu spel, BO, Lab, kort, sko, saldo och två SQLite-filer på `/var/data`. | Live. Ingen verifierad samordnad produktionsbackup utanför Render eller Neon-cutover. |
| Render `croupier-lab-director` och privat `croupier-lab-openclaw` | Samma GitHub-branch, deploy `15bd1541`; Director är produkt-/Lab-gräns, Gateway har modellen och sin beständiga `/data/openclaw`. | Live. Interna status-/tokenprov lyckades; full giltig spel→modell→tal-kedja återstår. |
| Vercel `croupier-frontend` | Git-kopplat till `Jakeminator123/github-work`, produktionsbranch `jakemanator123-github-work`, rot `apps/croupier-frontend`; första deploy från `d78eb4cb`. | [Ny Git-kopplad startsida](https://croupier-frontend.vercel.app/) READY. Automatisk deploy efter push av `d8d4b707` blev READY: `dpl_9GcmrpbHQ91oTJwnBYUuvV5DzxDZ`. Startsida och `/demo` verifierade; `CROUPIER_GAME_URL` sparad för Production och Preview och pekar på Render-spelet. |
| Vercel `github-work-vercel-entry` | Publik Next-landning från `apps/croupier-frontend`, manuellt driftsatt efter import `da7f8807` och driftkvitto `d78eb4cb`. | [Publik startsida](https://github-work-vercel-entry.vercel.app/) och `/demo` verifierade i browsern; spelknapparna går till oförändrad Render-backend. Deployment `dpl_J4izEynK4vczr1N9XKUsd5L5Jv2T`. Projektet saknar nu Git-koppling, så en vanlig push publicerar inte nästa version. `CROUPIER_GAME_URL` är nu sparad och återläst för Production/Preview med samma Render-speladress. |
| Vercel `croupier-landing-preview-qa` | Manuell Next-preview från `apps/croupier-frontend`, importerad från `Jakeminator123/croupier-frontend/main` på `2ec2b3f2`. | [QA-landning](https://croupier-landing-preview-eokix0slk-jakeminator123s-projects.vercel.app/) är READY; ingen Git-koppling. `CROUPIER_GAME_URL` är nu sparad för Production/Preview/Development med den isolerade spel-Previewns URL och återläst med exakt matchning. Nuvarande deploy fick redan spellänken vid bygget; nya env gäller nästa bygge. |
| Vercel `croupier-player-preview-qa` + Render `croupier-vercel-preview-qa` | Separat spelklient och tom Render-testdata. | [QA-spel](https://croupier-player-preview-3esw2v3fl-jakeminator123s-projects.vercel.app/frontend-preview/blackjack/) provades med Astridvideo, serverrundor, saldo efter omladdning och utbetalning. Vercel-projektet saknar Git-koppling. Render-testtjänsten är **manuellt pausad** efter provet. |
| Tidigare Vercel `modern-landing-page` | Var kopplat till separata `Jakeminator123/croupier-frontend/main`; hade adress `modern-landing-page-kohl-xi.vercel.app`. | **Raderat 2026-09-29 på Jakobs uttryckliga bekräftelse.** CLI rapporterade success för projekt `prj_3zsY4c8kKQMp9CeHuwHVgy1tFLAs`; efterkontrollen rapporterade att projektet inte finns. GitHub-källrepot raderades inte. |

Importen till `apps/croupier-frontend` är levererad i `da7f8807`, och den
första publika adressen byttes kontrollerat i `d78eb4cb`. Den nya
`croupier-frontend` är den Git-kopplade produktionsytan; den tidigare
`github-work-vercel-entry` ligger kvar som separat, manuellt driftsatt adress
och får inte förväxlas med den nya. Innan
`croupier-landing-preview-qa` Git-kopplas: sätt dess rot
till `apps/croupier-frontend`, behåll sparad `CROUPIER_GAME_URL` för QA till den
isolerade spel-Previewn och välj uttryckligen
`jakemanator123-github-work` som produktionsbranch. Annars går nya QA-knappar
till produktions-Render som kodens fallback. Referenser till den raderade
separata sidan är historiska importkvitton. Se
[frontendkontraktet](VERCEL-FRONTEND-MIGRATION.md).

## Data och media

| Resurs | Syfte | Faktiskt läge |
| --- | --- | --- |
| Render `/var/data/players/croupier.db` och `craig.db` | Konton, sessioner, saldo, sko/rundor, CRAIG och BO | Produktion. Backupverktyg och syntetiska tester finns, men ingen verifierad extern kopia. Båda filerna behöver ett samordnat skrivstopp före export. |
| Neon `croupier-preview-neon` | Isolerad spel-Preview | Ansluten till QA-projektet, används ännu inte av spelet. |
| Neon `croupier-astrid-background-zones-db` | Astrids zonmetadata | Separat Free-resurs; Lab-zoner finns ännu i browserlagring och synkas inte till Neon. |
| Vercel Blob `croupier-astrid-zone-media-private` | Astrids privata zonmedia | Bara ansluten till spel-QA; en godkänd man-MP4 finns. Anonym HEAD gav 403. Det tidigare tomma publika `croupier-zone-videos` är raderat. Privat Blob behöver en behörighetskontrollerad serverväg för klientuppspelning. |
| Planerad separat game-Neon | Framtida produktionskonton, saldo och rundor efter Jakobs beslut | Ännu inte skapad eller inkopplad. [Schema och async kommandokärna](NEON-GAME-MIGRATION.md) är bara isolerad förberedelse. Gör först extern Render-backup, full adapter och provmigrering. |

`croupier-player-preview-qa` har en privat `BLOB_READ_WRITE_TOKEN` för Production/Preview/Development och 17
providerhanterade `CROUPIER_ZONES_*`-namn för Preview/Development. Inget av
zonernas env-namn läses ännu av spårad runtimekod. Använd
`CROUPIER_ZONES_DATABASE_URL` som kanoniskt servernamn när synken byggs;
skicka aldrig dessa nycklar som `NEXT_PUBLIC_*`. Se
[miljöregistret](ENVIRONMENT-VARIABLES.md) och
[zonlagringen](ZONE-CLOUD-STORAGE.md).

## AI och OpenClaw

RunPods separata testendpoint `croupier-astrid-gpu-test` (`zsudl8tmzcmiv1`)
kör privat GHCR-image från `12ce6d47`, release 3, högst en worker och noll
alltid aktiva. Två syntetiska 1,5-sekunders filjobb skapade 54-rutors MP4.
Senaste jobbet tog 21,3 sekunder i RunPod-kö och 1,45 sekunders exekvering.
FFmpeg rapporterade `OpenEncodeSessionEx: unsupported device (2)` trots att
RTX 4090 identifierades; `libx264` användes. Detta är inte ett prov av riktigt
tal, Cartesia, fragmentström eller synlig läppsynk. Befintlig
produktionsendpoint och Render-spelets GPU-flaggor är orörda. En efterkontroll
efter frontendpubliceringen visade 0 körande workers, 0 pågående/köade jobb
och aktuell workerdebitering $0/s i RunPod. Se
[GPU-kvittot](ASTRID-GPU-CLOUD-TEST.md).

Director använder `OPENCLAW_PRODUCT_SPEECH_TOKEN` skild från
`LAB_API_TOKEN`, medan privat Gateway har `OPENCLAWAPI_KEY` och separat
modellnyckel. Live-panelerna verifierades den 29 september: Gateway-token, Lab-token och separat speech-token matchar mellan tjänsterna. Lokal hälsa och autentiserad status gav HTTP 200; tom speech-envelope gav förväntad HTTP 400 före modellkörning. Inga Render-env behövde ändras. Listan med `OPENCLAW_MODEL_API=openai-responses`,
`OPENCLAW_MODEL_BASE_URL=https://api.openai.com/v1` och
`OPENCLAW_MODEL_ID=gpt-5.4-mini` är en giltig konfiguration enligt
[OpenClaw](https://docs.openclaw.ai/gateway/config-tools/custom-providers) och
[OpenAI](https://developers.openai.com/api/docs/models/gpt-5.4-mini). Den
beständiga Gateway-konfigurationen kan dock vara effektivt annorlunda än
nuvarande env efter en operatörsändring. Ett daterat driftprov såg
`gpt-5.4-mini` som primär speech-modell; ingen ny modellkörning ingår här.
`CROUPIER_SPEECH_VISION=1` gäller projektets Luna/Terra-bildgren och bevisar
inte ett fungerande kameraflöde. Se
[OpenClaws aktiveringskvitto](../open-claw/lab/docs/CLOUD-ACTIVATION-2026-09-29.md).

## Arbetskopior och nästa kontrollerade byte

Den primära arbetskopian innehåller pågående, ocommittade MP4,
mediemanifest, Lab-policyer och delbildsarbete. De är inte rensningsskräp.
`codex/skapa-del-bilder` hör sannolikt till den vilande men relevanta chatten
**Python-bilder** och behålls. Ett rent `inbox-publish`-worktree på
`codex/inbox-routing-cache` tillhör inte denna chatt; ägare okänd och det
arkiveras inte här. Den övergivna lokala `main`-branchen vid `b1476597`
togs bort med `git branch -d` efter verifierad anor till arbetsbranchen och
kontroll att inget worktree använde den. Inga remote-brancher raderades.
GitHub-leverans görs bara till `jakemanator123-github-work`
med `node tools/push-github-work.mjs`.

Ordningen är: behåll Git-publiceringen för nya landningen och den sparade
korrekt QA-länk, behåll Render som serverägd spelbackend, prova publik spelväg från Vercel,
skapa en verifierad extern SQLite-backup och isolerad game-Neon-import, och
planera först därefter produktionsdatabyte. Zon-Neon och Blob får inte
återanvändas för spelets konton eller plånbok.
