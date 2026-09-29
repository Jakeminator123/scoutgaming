# Croupier: aktuell molnkarta

Kontrollerad 2026-09-29 cirka 15:35 UTC. Den här filen är den korta
**aktuella driftkartan**. Daterade QA-rapporter och äldre avsnitt i
[handoffen](JOHN-HANDOFF.md) är historiska bevis, inte startinstruktioner.
Kontrollera leverantörens status igen före nästa deploy eller resursändring.

## En ingång, en spelpresentation, ett Studio

| Yta | Adress och ansvar |
| --- | --- |
| Publik frontend | [croupier-frontend.vercel.app](https://croupier-frontend.vercel.app/), Next-appen i `apps/croupier-frontend`. `/demo` länkar till spelet på Render. |
| Spel | [Render /blackjack?dealer=astrid](https://croupier-v2.onrender.com/blackjack?dealer=astrid). Render äger inloggning, kort, sko, rundor, saldo och uppspelning. |
| Astrid Studio / Lab | [Render /studio](https://croupier-v2.onrender.com/studio). Samma Lab-app för bibliotek, policy, Probe och zoner. Vercels `/labb` är en genväg hit. |
| BO | Render `/bo`, administration och administratörsinloggning. BO är inte en alternativ dealerström. |
| Isolerat speltest | Vercel `croupier-player-preview-qa` och Render `croupier-vercel-preview-qa`. Testbackenden har tidigare stoppats och återstartas bara på begäran. |

`presentation=local` är det historiska **kodnamnet för den gemensamma
Lab/Lissabon-presentationen**. Det betyder inte lokal dator. På Render
används samma `presentation-runtime`, familjer, policy och videoregister.
`CROUPIER_STREAM_LANE=lissabon-stream-lane` är ett internt kompatibilitets-ID.
Det är inte ytterligare en tjänst eller ett val mellan BO och Studio.

Tre olika saker har tidigare kallats ström:

- **Speluppspelning:** den gemensamma spelaren väljer exakt inspelat klipp
  via `/api/presentation/select` och `/api/presentation/videos/:id`.
- **Observation:** Studios läsande händelseflöde följer det riktiga spelet.
  Det kräver Partner-konfiguration men behövs inte för att öppna själva spelet.
- **Genererat tal/video:** autentiserad WebSocket via Render, Cartesia och
  RunPod. Det är ett valbart, separat talflöde med egen budget och acceptans.

Lokala Lissabon-startaren är en utvecklingsmiljö. GitHub är kodleveransen;
GitLab-inbox, wiki och spegelpush är pausade. Inga GitLab-instruktioner i
äldre rapporter återaktiverar dem.

## Leverans och verifierat utgångsläge

Enda leveransmål: `Jakeminator123/github-work`, branch
`jakemanator123-github-work`, genom `node tools/push-github-work.mjs`.
Den 29 september 15:32–15:35 UTC verifierades:

- GitHub HEAD `365f283b4005f0ca2f52312f745af9bfe05fa5e3` och gröna
  [GitHub checks](https://github.com/Jakeminator123/github-work/actions/runs/36548386444).
- Vercel `croupier-frontend`: samma commit, READY,
  `dpl_xEm5acbNA4NX8ctufwpqcmXXX8E4`. Projekt-API bekräftar rätt repo,
  produktionsbranch och rot `apps/croupier-frontend`.
- Render `croupier-v2`: samma commit, Live, automatiskt deployad på 2m46s.
  Tjänst `srv-datg3j6gekts73amgli0` i Frankfurt.
- En befintlig administratörssession öppnade `/studio`. Det bevisar aktuell
  åtkomst, inte en ny lösenordsinloggning eller full spelrunda.
- Befintlig spelarsession gick från `/blackjack?dealer=astrid` till
  `/?dealer=astrid&presentation=local`; Astrids video hade `readyState=4`,
  1080 × 1920 och spelade. Inga insatser eller rundåtgärder gjordes.
- Render-dashboarden visar 5 GB beständig disk på `/var/data`.
- Studio → Bakgrundszoner → Läs från molnet gav **Molnzonerna är inlästa**,
  0 zoner och version 0. Det verifierar den riktiga dedikerade
  Neon-anslutningens läsväg; ingen sparning eller migration gjordes.

Senaste leverans och efterkontroll förs överst i [JOHN-HANDOFF](JOHN-HANDOFF.md).
Vercel-landningen och Render bygger automatiskt från arbetsbranchen; ingen
manuell publicering till ett gammalt frontendprojekt behövs.
Render är inställt på **After CI Checks Pass** (återläst 16:04 UTC), så
dess deploy börjar först efter gröna GitHub-kontroller.

De tidigare Vercelprojekten `github-work-vercel-entry`,
`croupier-landing-preview-qa` och `modern-landing-page` är avvecklade enligt
föregående verifierade kvitton. Deras gamla adresser ska inte användas som
startpunkter. Det kvarvarande `croupier-player-preview-qa` bär däremot
lagringskopplingar och ska inte raderas som en dubblett.

## Var informationen faktiskt lagras

| Data | Nuvarande lagring | Kvarvarande arbete |
| --- | --- | --- |
| Spelarkonton, sessioner, saldo, sko och rundor | Render `/var/data/players/croupier.db` (SQLite) | Separat game-Neon, full adapter, extern återläsbar backup och isolerad provmigrering före byte. |
| CRAIG/BO-konton, roller, Lab-sessioner | Render `/var/data/players/craig.db` (SQLite) | Ska migreras samordnat med spelaridentiteter och återkallning av sessioner. |
| Studio-projekt, familjeindex och uppladdningsmetadata | Render `/var/data/studio` | Ingår fortfarande i diskbackup även när själva MP4 ligger i Blob. |
| Ursprungliga/bundlade MP4 | Git/deploy och befintliga Render-diskposter | En Git-push och en Blob-upload är olika leveranser. |
| Nya privata familjeklipp | Vercel Blob genom skyddade Lab-/spelar-API:er | Exakt hash, familj och Range måste matcha. Visuell acceptans är separat. |
| Zonmetadata | Dedikerad Neon `croupier-astrid-background-zones-db`, schema `croupier_zones` | Browserkopian flyttas bara genom uttrycklig molnsparning. Zoner är ännu Lab-preview. |
| Lokala zonutkast och egna zonklipp | Webbläsarens localStorage/IndexedDB | Bevaras separat från molnläge och molnutkast. |
| Modellminne och rollkonfiguration | Director/Gateways egna beständiga diskar | Är inte Neon-speldata eller Vercel-frontenden. |

### Blob och Neon: resurser finns, rollerna är skilda

Båda Neon-resurserna återlästes som **Available** via Vercel den 29 september
15:34 UTC och är kopplade till `croupier-player-preview-qa`:

- `croupier-astrid-background-zones-db`: enbart zoner, med
  `CROUPIER_ZONES_DATABASE_URL`; inga generiska `DATABASE_URL`-fallbacks.
- `croupier-preview-neon`: separat Preview-resurs, används inte av spelets
  nuvarande SQLite-runtime. Ingen produktionsflytt sker genom dess existens.

Det privata Blob-lagret heter `croupier-astrid-zone-media-private`,
`store_AqwvebTbBHarOjvG`, `arn1`. Namnet är historiskt: den avsedda aktiva
adaptern använder separata namnrymder `croupier/videos/` för familjeklipp
och `croupier/zones/` för zonklipp. En tidigare manuellt uppladdad zonfilm
ligger också i lagret. Privat läsning sker med serverhemlighet och skyddad
medierutt, inte en publik direktlänk. En ny token eller ett nytt lager
behövs inte för denna struktur.

Render-aktiveringen av Blob och zonanslutningen verifierades i föregående
liveimport; Vercels projektkoppling ensam överför inga nycklar till Render.
[Importkvittot](qa/cloud-media-import-2026-09-29.json) avser **22 tillgängliga
kandidater: 12 i privat Blob och 10 befintliga diskposter**, inte 22 Blob-objekt.
Det aktuella [mediekvittot](MEDIA-BEST-TAKES-2026-09-29.md) jämför dagens
projektfiler med dessa exakta hashvärden. Ingen hashkontroll godkänner
läppsynk, kortkontakt eller den sparade användningspolicyn.

Vercel-frontenden behöver bara `CROUPIER_GAME_URL` (och valfri explicit
Studio-adress enligt frontendkontraktet). Den har dessutom 16 äldre
modell-/Partner-/OpenClaw-variabelnamn utan konsument i frontendkoden.
Namn och målmiljöer är kontrollerade utan att värden skrivits ut. De är inte
aktiva Render-inställningar och ska inte användas för att felsöka spelet.
De har inte raderats i denna granskning.

## Kvar innan större driftbyte

- Separat game-Neon och produktionsbyte är **inte genomförda**.
  Följ [Neon-planen](NEON-GAME-MIGRATION.md) och
  [backup/restore](RENDER-BACKUP-RESTORE.md); byt inte bara `DATABASE_URL`.
- Spelklienten ligger ännu på Render. Vercels publika frontend länkar dit;
  [same-origin-migrationen](VERCEL-FRONTEND-MIGRATION.md) är separat.
  Nuvarande frontend-Preview pekar också mot produktion: prova inga
  syntetiska konton/rundor där utan isolerad backend.
- Sessionsfixen är Live, men två riktiga talrepliker i följd, svarstid och
  audiovisuell läppsynk kräver fortfarande eget driftprov. Tidigare
  första bildrutor tog cirka 42 och 86 sekunder.
- Terra är standard i kod och Astrids sparade val. Gatewayns globala
  beständiga modellval blockerades tidigare av `EPERM fchmod`; det har
  inte ändrats eller verifierats på nytt här.
- Fysisk mikrofon/kamera, verkligt Terra-bildsvar, extern återläsbar
  Render-backup och full zon-upload/spara/återläs-acceptans återstår.
- Jira CAC saknar verktygsanslutning och den öppnade Jira-sidan kräver
  inloggning. Inga ärenden har markerats klara utan verifierat Expected Result.

Läs vidare efter behov: [användarguide](../lab/docs/README.md),
[systemkarta](systemkarta/README.md), [miljöregister](ENVIRONMENT-VARIABLES.md),
[zonlagring](ZONE-CLOUD-STORAGE.md), [talflöde](LIVE-SPEECH-ACTIVATION-2026-09-29.md).
