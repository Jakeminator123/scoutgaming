# Croupier: gemensamt molnläge 2026-09-29

Detta är en daterad driftkarta för agentarbete. Kontrollera leverantörernas
aktuella tillstånd innan en deploy eller radering; en äldre rubrik i ett
handoffdokument ändrar inte det som faktiskt körs. Arbetsbranchen är
`jakemanator123-github-work` i `Jakeminator123/github-work`. GitLab-flödet är
pausat enligt `AGENTS.md`. Inga hemlighetsvärden hör hemma i denna fil.

## Körande och förberedda ytor

Uppföljning 08:46 CEST: följdfixen `225433fe` för färsk idle-katalog är Live
i automatiska `dep-datlrou0tbcc7383arg0` (08:46:15). Render ersatte först
det manuella `dep-datlqlugekts73bbj7rg` med samma SHA. API-åtkomsten i Lab
hade därefter ett separat reproducerat proxyfel; se nedan och JOHN-HANDOFF.

### Enkel projektkarta och Lab-ingångar — 2026-09-29

- `croupier-frontend` är den gemensamma publika ingången. Använd detta projekt
  för nya frontendleveranser. `/labb`, `/labb/filmer`, `/labb/zoner` och
  `/labb/guide` gav verifierad HTTP 307 som genvägar till det autentiserade Labbet på
  Render `/studio/`; en slug flyttar inte servern eller lagringen till Vercel.
- `github-work-vercel-entry` är den äldre manuella ingången och
  `croupier-landing-preview-qa` är det äldre landningssidetestet. Båda är
  avvecklade. Vercels projekt-API och de publika adresserna gav 404 den
  29 september cirka 08:37 CEST. Samla framtida designpreview i
  huvudprojektets Preview-flöde med uttryckligt konfigurerade testadresser.
- `croupier-player-preview-qa` har en annan roll: isolerat speltest samt
  nuvarande kopplingar till privata Blob och två separata Neon-resurser.
  Render-testbackend är pausad. Flytta/verifiera dessa kopplingar före
  avveckling; radera inte projektet som om det vore en tom startsideskopia.
- Familjeuppladdning från `codex-media-upload` är deployad i `adae8772`. Den sparar via
  Labbet på Render-disk. Lokala original och browserns zonklipp flyttas inte
  genom en Git-push eller genom att Blob finns. Den återstående Blob-synken
  måste omfatta uppladdning, metadata och autentiserad Range-uppspelning.

QA betyder kvalitetstest. Målet är en begriplig huvudingång och en isolerad
testmiljö; antalet kvarvarande projekt speglar migreringssteg, inte ett behov
av tre konkurrerande startsidor. De två gamla projekten försvann mellan
förkontroll och raderingsförsök: CLI-försöket för `github-work-vercel-entry`
svarade att projektet redan saknades. Efterkontrollen bekräftar slutläget,
men fastställer inte vem som utförde raderingen. Ingen databas eller media
raderades av denna agent. Privat Blob har fortsatt ett objekt och samma QA-koppling.

| Resurs | Källa och nuvarande roll | Verifierat / kvar |
| --- | --- | --- |
| Render `croupier-v2` | GitHub `Jakeminator123/github-work`, `jakemanator123-github-work`; deploy `adae8772` (`dep-datlnp2d0e5s73ckjt30`), start 08:34:12, Live 08:37:38 CEST. Äger ännu spel, BO, Lab, kort, sko, saldo och två SQLite-filer på `/var/data`. | Hälsa och spelingång HTTP 200 efter deploy, `/studio/` 401 utan inloggning. Ingen verifierad samordnad produktionsbackup utanför Render eller Neon-cutover. Familjeuppladdningens autentiserade live-QA återstår. |
| Render `croupier-lab-director` och privat `croupier-lab-openclaw` | Samma GitHub-branch, deploy `15bd1541`; Director är produkt-/Lab-gräns, Gateway har modellen och sin beständiga `/data/openclaw`. | Live. Interna status-/tokenprov lyckades; full giltig spel→modell→tal-kedja återstår. |
| Vercel `croupier-frontend` | Git-kopplat till `Jakeminator123/github-work`, produktionsbranch `jakemanator123-github-work`, rot `apps/croupier-frontend`; första deploy från `d78eb4cb`. | [Ny Git-kopplad startsida](https://croupier-frontend.vercel.app/) READY. Automatisk deploy efter push av `d8d4b707` blev READY: `dpl_9GcmrpbHQ91oTJwnBYUuvV5DzxDZ`. Startsida och `/demo` verifierade; `CROUPIER_GAME_URL` sparad för Production och Preview och pekar på Render-spelet. |
| Tidigare Vercel `github-work-vercel-entry` | Ersatt landning; tidigare deployment `dpl_J4izEynK4vczr1N9XKUsd5L5Jv2T`. | **Borttaget.** Projekt `prj_hRrGtpAgb0HBEt1sssqOPZVlROh4` och dess gamla publika adress ger 404. Vid förkontroll fanns bara två speladressvariabler, ingen Blob-koppling och ingen egen domän. API:t visade då en sourceless Git-länk, vilket rättar äldre uppgiften om helt saknad Git-länk. |
| Tidigare Vercel `croupier-landing-preview-qa` | Ersatt manuell landningspreview. | **Borttaget.** Projekt `prj_iWnezDxPevS1Bd4hMVbA26NWfKGf` och dess gamla publika adress ger 404. Vid förkontroll fanns bara `CROUPIER_GAME_URL`, ingen Blob-koppling eller egen domän. |
| Vercel `croupier-player-preview-qa` + Render `croupier-vercel-preview-qa` | Separat spelklient och tom Render-testdata. | [QA-spel](https://croupier-player-preview-3esw2v3fl-jakeminator123s-projects.vercel.app/frontend-preview/blackjack/) provades med Astridvideo, serverrundor, saldo efter omladdning och utbetalning. Vercel-projektet saknar Git-koppling. Render-testtjänsten är **manuellt pausad** efter provet. |
| Tidigare Vercel `modern-landing-page` | Var kopplat till separata `Jakeminator123/croupier-frontend/main`; hade adress `modern-landing-page-kohl-xi.vercel.app`. | **Raderat 2026-09-29 på Jakobs uttryckliga bekräftelse.** CLI rapporterade success för projekt `prj_3zsY4c8kKQMp9CeHuwHVgy1tFLAs`; efterkontrollen rapporterade att projektet inte finns. GitHub-källrepot raderades inte. |

Importen till `apps/croupier-frontend` är levererad i `da7f8807`, och den
första publika adressen byttes kontrollerat i `d78eb4cb`. Den nya
`croupier-frontend` är den Git-kopplade produktionsytan; den tidigare
`github-work-vercel-entry` och landningssidans separata QA-projekt är
avvecklade. Innan spel-QA körs genom huvudprojektets designpreview måste dess
Preview-miljö få den isolerade speladressen i `CROUPIER_GAME_URL`;
nuvarande Production och Preview pekar båda på produktionsspelet.
Referenser till den raderade
separata sidan är historiska importkvitton. Se
[frontendkontraktet](VERCEL-FRONTEND-MIGRATION.md).

## Data och media

### Inloggning, spelaradress och minne

`/blackjack?dealer=astrid` är inloggningsingången. Efter en giltig session
väljer `web/public/blackjack-entry.mjs` adressen
`/?dealer=astrid&presentation=local`. `local` är namnet på Astrids
Web/Render-ägda presentationsväg: klipp väljs via serverns
`/api/presentation/select` och serveras via `/api/presentation/videos/:id`.
Det betyder inte att spelet körs på Jakobs dator eller att Neon är aktivt.
`croupier-v2` är Render-tjänstens namn.

Labbet använder CRAIG-/BO-administratören. Root verifierade inloggning med
den befintliga bootstrap-identiteten `jakob` och kom in i Astrid Studio samt
**Ladda upp & bibliotek**. Inget lösenord skrivs i dokumentationen. Den
separata spelarregistreringen finns med `CROUPIER_PLAYER_ACCOUNTS=1` och
lagrar ännu konton/sessioner i SQLite. Spelarminne är serverbundet till
kanonisk spelaridentitet och dealer; OpenClaw får servervald namn- och
minneskontext. Den kontrollerade Neon-flytten återstår enligt
[migrationsplanen](NEON-GAME-MIGRATION.md). Cashier är fortsatt demoinsättning
till testbalans, utan betalningsleverantör eller riktiga uttag.

Lab-inloggning och bibliotekets rendering bevisar inte full media-QA.
**Spel & uppspelning** visade `Referensspelets konfiguration kunde inte läsas`
och inaktiv Anslut-knapp på `adae8772`; detta har återrapporterats till
filmagenten. Orsaken är Nexts interna Request-URL för API-anrop, trots
korrekta autentiserade proxyheaders. En avgränsad guardfix och regressionstest
är integrerade; liveprovet görs efter nästa deploy. Utgången/återanvänd
inloggningslänk får samtidigt en begriplig 410-sida med ordinarie nystart.
Ingen lokal MP4 laddades upp under denna kontroll.

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

Efter detta sparade Jakob en egen `RUNPOD_API_KEY` på Render. Endpointnamnet
rättades till `CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID` med värdet `zsudl8tmzcmiv1`
via Save only. Nyckelns närvaro är verifierad, men dess giltighet och det
genererade talflödet är ännu inte API-testade. Jakob sparade därefter även
`CARTESIA_API_KEY` på samma Render-tjänst; namnets närvaro verifierades före
deploy `adae8772`. Aktiveringsflaggorna är orörda och saknas fortfarande;
detta bygge aktiverar därför inte genererat tal.

`CROUPIER_CLOUD_BOOTSTRAP_ADMIN_PASSWORD` och motsvarande bootstrap-user
hör till Render `croupier-v2` Environment. De skapar första administratören
bara när CRAIG:s användartabell är tom. En ny env ändrar inte lösenordet
för ett befintligt konto. Vercels landning behöver ingen av dessa hemligheter.

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
