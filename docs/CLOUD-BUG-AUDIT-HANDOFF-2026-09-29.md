# Överlämning: granska molnkedjan och få uppladdade varianter till verifierad uppspelning

Skriven 2026-09-29 av `codex-media-upload` på Jakobs begäran. Detta är ett
arbetsuppdrag till nästa agent, inte ett intyg om att hela kedjan fungerar.
Leverantörernas aktuella deploy och effektiv runtimekonfiguration går före
äldre statusrader. Inga hemligheter ska skrivas i rapporter eller Git.

## Uppdrag och prioritet

Ta över och buggranska offensivt de tre aktiva Render-tjänsterna, deras
miljövariabler, autentisering, URL-vägar, lagring och mediepublicering.
Reproducera fel, rätta grundorsaker, kör relevanta tester och verifiera i drift.
Stanna inte vid en dokumentationslista eller en grön startsida.

1. Verifiera att Astrids vanliga chatt alltid syns, samt att Labbet fungerar
   efter inloggning, omladdning och utgången session.
2. Kartlägg faktiskt använda env och URL:er hela vägen mellan tjänsterna.
3. Fullfölj den redan beställda importen av alla 22 lokala varianter som
   manuella kandidater och bevisa hur ett uppladdat klipp når produktspelaren.
4. Redovisa och rätta luckor i Blob-/zonlagring och spel→Director→Gateway.
   Skilj färdig implementation från förberedda men oanvända integrationer.

Jakobs uttryckliga UI-krav: chattfält och konversation ska alltid synas.
Endast den privata panelen för egen transkription/kamerainformation ska vara
dold som standard. Inget långt tryck ska behövas för vanlig textchatt.

## Börja här och samordna

Läs `AGENTS.md`, `agent-talk/README.md`, `docs/JOHN-HANDOFF.md`,
`docs/ENVIRONMENT-RESTORATION.md`, `lab/docs/README.md` och
`open-claw/lab/docs/README.md`. Använd sedan selektivt:

- `docs/CLOUD-CURRENT-STATE-2026-09-29.md`
- `docs/ENVIRONMENT-VARIABLES.md` och `docs/environment-variables.json`
- `docs/VERCEL-FRONTEND-MIGRATION.md`
- `docs/MEDIA-UPLOAD-AND-ZONES.md` och `docs/ZONE-CLOUD-STORAGE.md`
- `open-claw/lab/docs/CLOUD-ACTIVATION-2026-09-29.md`
- `docs/NEON-GAME-MIGRATION.md` och `docs/ASTRID-GPU-CLOUD-TEST.md`

Kör agent-talk status med eget id, ta filanspråk och läs riktade meddelanden.
`root-orchestrator`, chatten **NY**, samordnar Render och äger för närvarande
driftdokumenten. Chatt-id: `01a0eb00-6a7e-77f3-a8c8-c5e83a3bbeea`.
Undvik dubbla deployer, env-sparningar och importer. Ny agent kan använda
underagenter för separata granskningar med tydliga fil- och tjänsteanspråk.

Arbeta i `C:\Users\jakem\Projects\croupier`, endast branch
`jakemanator123-github-work`, repo `Jakeminator123/github-work`.
Leverera med `node tools/push-github-work.mjs`. Kör chef-status före push.
GitLab och det gamla personliga dokumentarkivet är pensionerade.
Bevara alla ocommittade MP4, manifest, policyer och andra agenters dokument.

## Senast kända läge: kontrollera igen i drift

| Yta | Roll och bevis | Kvar att bevisa |
| --- | --- | --- |
| Render `croupier-v2` | Spel, konton, saldo/rundor, BO och Lab `/studio`. `16f1f53d` verifierad Live cirka 09:31 CEST; chattfält/logg synliga i desktop och 390 px mobilbredd. Bibliotekets **Läs in nya filer** fungerar sedan `d94346dd` efter reload utan auth-alert. | Autentiserad MP4-uppladdning, beständighet och faktisk produktuppspelning saknar slutkvitto. |
| Render `croupier-lab-director` | Publik gräns mot spel/Lab; separat produkt-speech-token. Senast dokumenterad kod `15bd1541`. | Effektiv deploy, alla klienters endpoint/tokenpar och giltigt beslut i hela kedjan. |
| Render `croupier-lab-openclaw` | Privat Gateway, modellanslutning, beständig `/data/openclaw`. | Effektiv konfiguration på disk kontra env, aktiv agent/modell, rättigheter och faktiskt beslut. |
| Vercel `croupier-frontend` | Publik ingång; Git-kopplad, rot `apps/croupier-frontend`. `/demo` länkar till Render-spelet. | Miljöernas avsikt: både Production och Preview pekar nu på produktionsspelet. Preview är därför inte isolerat speltest. |
| QA-resurser | `croupier-player-preview-qa` har privat Blob och två separata Neon-resurser. Render `croupier-vercel-preview-qa` är pausad. | Flytt/inkoppling är inte gjord. Starta inte betalda tjänster utan kostnad och stoppvillkor. |

Vercel `github-work-vercel-entry` och `croupier-landing-preview-qa` är borttagna;
gamla bokmärken kan därför ge 404. Källrepot `croupier-frontend/main` importerades
till nuvarande monorepo; skapa inte en konkurrerande startsida där igen.

### Chatt och nyliga deployer

- `16f1f53dfeb80254677ba5a94013d3ed86efa8b8` är pushad: input, send, logg och
  minne ligger kvar i synlig `#chat`; privat voice-log styr inte deras synlighet.
  Astrids logg hålls öppen även vid timeout, Escape och kompakt viewport.
- 38 riktade tester godkända; full pre-commit-hook godkänd efter ett omprov av
  ett tillfälligt Windows EPERM i agent-talk-testets tempmapp.
  `audit-dealer-sync --probe` godkänd för fyra dealers; ingen ny visuell acceptans.
- Root verifierade chattdeploy `dep-datmfmnf3r2c73dtdvu0` Live med `16f1f53d`.
  Fält/logg syns i riktig browser i desktop och mobilbredd, utan långtryck.
  Ingen insats eller rundåtgärd gjordes; inget modell-/mikrofonprov ingick.
- Senaste meddelandet från root: Jakobs Whisper-rebuild
  `dep-datmccflot8c738514fg` blev Live. Root har därefter sparat
  `CROUPIER_ASTRID_CAMERA=1` och sett en färdig Environment updated-deploy
  på samma äldre SHA. Runtime verifierad: kamera=1, Whisper-nyckel finns,
  läsande OpenAI-modellanrop för `whisper-1` HTTP 200. Faktisk inspelning
  återstår. Genererat tal är fortsatt avstängt. Samordna före nästa driftändring.
- Terra är sparad som Astrids chatt-/Probe-modell och återläst efter reload.
  Probe är Av; modellvalet bevisar inte ett lyckat Terra-svar eller bildanalys.
- `CROUPIER_GAME_URL` i rätt Vercel-projekt är nu läsbar Config för
  Production och Preview: `https://croupier-v2.onrender.com/blackjack?dealer=astrid`.
  Tidigare var den Secret; blank export var inte bevis på tomt sparat värde.
  Båda mål återlästes korrekt. Redeploy `dpl_9hQHidFeomQPq8ihFHbrBK9bfypM`
  blev READY. Alias omfattar `croupier-frontend.vercel.app` och `www.scoutgaming.tech`.
- Korrekt Vercel-projekt-id är `prj_I6KkhVlk4qMSPlAwSPZdnz4aVQ2s`, scope
  `jakeminator123s-projects`. Lokal `.vercel`-länk är rättad från borttaget QA-projekt.

## Granska URL- och autentiseringskedjan

Följ i browserns faktiska nätverk, komplettera med isolerade API-prov:

| Från | Till / kontrakt |
| --- | --- |
| Vercel `/demo` | Render `/blackjack?dealer=astrid` → spelarlogin → `/?dealer=astrid&presentation=local`. `local` är presentationsläge, inte lokal dator. Vercel `/blackjack` är inte spelingången. |
| Vercel `/labb-lissabon`, `/labb` och Lab-genvägar | HTTP 307 till skyddat Render `/studio/` med avsett underläge. Bekräfta varje verklig Location. |
| Render BO-login | CRAIG/BO-session → kortlivad Lab-handoff → Lab-cookie → Studio/API. Spelarkonto är inte administratörskonto. |
| Browser `/studio/api/...` | Molngateway → intern Next-server. Kontrollera path/basePath, Host, forwarded headers, Origin, cookie och intern serverhemlighet. |
| Produktens presentation | `/api/presentation/select` → servervalt tillåtet fil-ID → `/api/presentation/videos/:id`, inklusive Range/206. |
| Spelets chatt/tal | Produkt-API → `OPENCLAW_PRODUCT_SPEECH_URL` på Director → privat Gateway → giltigt schema → godkänt beslut → spelarens exakta media/ljud. |

Lab-felets bevisade orsak var Nexts interna Request-URL, först `127.0.0.1:4188`
och sedan faktisk NextRequest-normalisering till `localhost:4188`.
`08343c17` och `d94346dd` rättar detta med kvarvarande Host/Origin/proxysecret-
kontroller. Testa riktig NextRequest, inte bara en vanlig Request-mock.
Öppna inte Lab-API publikt för att bli av med felet.
Root verifierade även 410 för utgången handoff och 401 utan Lab-session.

**Kvarstående separat fel:** Spel & uppspelning visar nu
**Partner-konfiguration saknas eller är ogiltig**, med inaktiv Anslut.
Utred den faktiska avsedda produktanslutningen och dess env; en fungerande
biblioteks-API betyder inte att denna flik är klar. Använd inte skarp
spelardata eller nya partnerhemligheter som gissning.

## Env-granskning: värden ska stämma, inte bara namn

Gör en matris per tjänst och miljö: variabelnamn, läsande kod, obligatorisk/
villkorlig/oanvänd, källa, närvaro, maskerad likhet mellan ändpunkter,
effektiv runtime, samt föreslagen rättning. Läs rotens `.env`/`.env.local`,
`lab/.env*` och OpenClaws relevanta env-filer selektivt och privat.
Spåra laddordning och alla pekare till env-filer så att gamla repots värden
inte skuggar de nuvarande. Skriv aldrig ut råa hemlighetsvärden.

- **Spelet:** molnlayout, basePath, datarot/härledda kataloger, login,
  presentationens Director-par, Lab remote-par, produkttalets URL/token,
  kamera/Whisper, Cartesia, RunPod och opt-in-flaggor. Läs `ops/cloud/config.mjs`,
  start/gateway och faktisk konsumerande kod.
- **Director:** `LAB_API_TOKEN`, `OPENCLAWAPI_KEY`, produkt-speech-token,
  `LAB_DATA_DIR`, intern Gateway-adress/port, agentval och tidsgränser.
- **Gateway:** `OPENCLAWAPI_KEY`, separat `OPENCLAW_MODEL_API_KEY`, modellens
  API/base URL/id, `OPENCLAW_CONFIG_PATH`, state-dir och dashboard-origin.
  Kontrollera beständig `openclaw.json`: sparat env är inte säkert effektiv modell.
- Kontrollera likhet där tokenpar ska matcha och olikhet där roller ska separeras.
  Director/Lab-token, Gateway-token och produkt-speech-token är olika gränser.
- Vercels startsida behöver speladressen, inte modellnycklar eller BO-lösenord.
  Granska Production/Preview/Development separat och förklara varje fallback.
- `BLOB_READ_WRITE_TOKEN` och `CROUPIER_ZONES_*` på QA-projektet kopplar inte
  automatiskt in lagring i produktionskoden. Identifiera faktisk konsument.
- Save only, rebuild och restart har olika effekt. Ange exakt vilka tjänster
  behöver ny deploy och verifiera därefter, utan dubbla samtidiga ändringar.
- Bootstrap-admin-env skapar första kontot endast vid tom CRAIG-användartabell;
  att ändra env återställer inte ett befintligt lösenord.

## Så når uppladdade varianter produkten i nuvarande kod

Familjeuppladdningen finns i `adae8772`, uppföljning `225433fe`:

1. **Ladda upp & bibliotek**: MP4/WebM, högst 128 MB, namn och exakt familj
   (kortplats, replik eller Idle). Browsern förhandsvisar filen.
2. Autentiserad POST till Lab `/api/videos` under publika `/studio` sparar
   filen på beständig Render-disk, avsett `/var/data/studio/videos`, med
   metadata/hash. Verifiera faktisk effektiv datarot och diskmontering.
3. `lab/lib/video-uploads.mjs` och `video-registry.mjs` validerar familjekoppling;
   uppladdningen återläses. Den blir **manuell variantkandidat** i samma
   exakta familj som den gemensamma presentationen använder.
4. **Välj hur klippet ska användas** öppnar familjens editor. Sparad policy,
   tillåtelse, frekvens och villkor avgör om runtime överhuvudtaget får välja den.
   Kandidat i biblioteket betyder inte automatiskt aktiv eller visuellt godkänd.
5. Produktens gemensamma `presentation-runtime/` och `web/presentation-api.mjs`
   väljer tillåten variant på servern och levererar den till
   `web/public/local-presentation.mjs`. Bevisa vald familj + ID + hash och
   faktisk videobegäran; ett lyckat upload-svar räcker inte.
6. Idle-registret läses om inför nya beslut efter `225433fe`; befintlig
   retry-/frekvensbokföring bevaras. Guiden instruerar omladdning av spelet
   när pågående hand är slut. Verifiera även andra familjers uppdateringsväg.

Alla tillgängliga kandidater visas, men runtime har fortfarande begränsade
urvalsplatser (högst fyra frekvensvarianter per dealfamilj). En femte kandidat
får inte tyst klippas bort ur biblioteket eller aktiveras utan policybeslut.
Äldre generiska bankuppladdningar saknar ibland familjekoppling; gissa inte
familj med klipplängd eller godtyckligt filnamn.

### Import som fortfarande väntar

Lokalt inventerades 51 klipp, varav 22 varianter. Jakob har redan uttryckligen
begärt att alla varianter läggs in i uppspelningsmodulen. Import som manuella
kandidater är auktoriserad; ändra inte aktiva policyer eller godkännandebaslinje.

Förberedda tillfälliga filer kan finnas kvar:

- `C:\WINDOWS\TEMP\croupier-candidate-import.json` — 22 exakta sökvägar/familjer/hashar.
- `C:\WINDOWS\TEMP\croupier-import-candidates.mjs` — läs och granska före körning;
  tar valfri privat env-filväg, loggar inte credentials, använder BO-login och
  Lab-handoff, hoppar över samma hash/familj, kontrollerar återläsning och Range.
- Planerat kvitto: `C:\WINDOWS\TEMP\croupier-candidate-import-receipt.json`.

Kontrollera om root redan importerat innan nytt försök. Tempfiler är inte en
beständig källa; återskapa vid behov från aktuell inventering utan att skriva
över media. Lokala env saknade bootstrap-adminlösenord; root har fungerande
inloggning i browser. Begär aldrig att lösenord klistras in i chatt eller Git.
Byteprov med Range är inte två visuella uppspelningar.

### Blob, små zoner och Neon: verkliga luckor

Familjeuppladdningen använder **Render-disk**, inte Vercel Blob.
Privat Blob `croupier-astrid-zone-media-private` är kopplad till QA-projektet;
senast fanns ett objekt och anonym HEAD gav 403. Zon-Neon är separat och
browserns zondata är ännu inte synkade dit. En token ensam flyttar inga filer.

Inventera zonernas faktiska IndexedDB/localStorage, MP4-referenser, maskgeometri,
koppling till dealer/scen och sparandeflöde. Redovisa vad som saknas för:
autentiserad upload → beständig metadata → behörig Range-uppspelning → produktens
runtime → återläsning på annan browser. Föreslå en tydlig kanonisk lagringsväg;
kopiera inte runt hemligheter eller lova att befintlig Blob redan är integrerad.

Spelkonton, minne, saldo och rundor kör fortfarande SQLite på Render.
Neon-resursernas existens bevisar inte en spelmigration. OpenClaw får
servervald kontext; den får inte bestämma plånbok, sko, kort eller utbetalning.

## Kräv konkreta testkvitton

- Per tjänst: aktuell Live-SHA, startkommando, region/plan, diskmount, health,
  senaste env-deploy, effektiv konfiguration och maskerad anslutningskontroll.
- URL-matris: källa → status/Location → slutmål → session/Origin/Host-krav.
  Visa både godkänd väg och avvisade obehöriga/originförfalskade anrop.
- Chatt: desktop + mobil, direkt vid laddning, efter 26 sekunder och Escape;
  privat panel kan stängas utan att chatten försvinner. Mikrofon kräver samtycke.
- Lab: ny session, utgången handoff, omladdning, API GET/POST, verklig upload,
  sparad fil efter reload och beständighet efter samordnad omstart/deploy.
- Media: faktisk servervald variant, exakt fil/hash, Range/206 och två
  uppspelningar i rätt familj via riktiga spelaren. Testa beslut med isolerad
  server/databas och annan hostname; förändra inte skarpa rundor eller saldo.
- Tal/bild: syntetisk profil, rätt Director/Gateway-roll, giltigt beslut,
  uppspelning och korrelerat kvitto. Separata lyckade hälsoprov räcker inte.
  Redovisa kostnad, maxanrop och stopptid före betalda modell-/GPU-anrop.
  Roots separata Cartesia→RunPod-prov gav MP4 på 52,5 s men är inte godkänd läppsynk.
- För spel/mediaändringar: obligatoriska hook-tester, audit --probe, fyra
  dealers och visuella acceptanskrav enligt AGENTS. Inget baselinebyte enbart
  på hash/testresultat. Ingen skarp DB-manipulation eller oprövad Neon-cutover.

Leverera en prioriterad fellista med reproduktion, grundorsak, fix-SHA,
testbevis och kvarstående hinder. Uppdatera den aktiva handoffen och env-registret
vid relevanta förändringar. Slutrapporten ska besvara konkret:
**Var hamnar min MP4, hur väljer jag dess användning, och vilket kvitto visar
att just den spelades upp i produkten?**
