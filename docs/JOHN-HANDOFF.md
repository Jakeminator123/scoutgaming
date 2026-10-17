# Aktuell handoff — Scoutgaming

Uppdaterad 17 oktober 2026. Struktur- och testförenklingsfasen är avslutad.
Teknisk migrationsstatus och kvarvarande produktarbete finns i
[CLOUD-MIGRATION](CLOUD-MIGRATION.md). Användarsteg finns i
[lab/docs/README](../lab/docs/README.md); ingen ny tracker skapas.

## Dragan: registerbundet bankunderlag — 17 oktober 2026

Jakob valde befintliga Dragan-filmer i Blob för en egen avatarbank.
Ny kod finns på `codex/dragan-lipsync-registry`; detta är förberedelse och
en testad adapter, **inte aktiverat rörligt tal i spelet**.

- Neon `production/croupier` innehöll 56 Dragan-poster. Alla 56 Blob-filer
  lästes och verifierades mot registrerad SHA-256 och storlek. Separat
  återläsning visade oförändrade ID:n, revisioner och hashvärden.
- 50 rörelseklipp exporterades med sina exakta medie-ID:n. Fyra inspelade
  repliker ligger kvar på sitt befintliga talflöde. Två äldre `idle`-poster
  har samma 30-fps-fil och ingår inte i 24-fps-banken. Produktionsfilmerna
  har inte ersatts, raderats eller fått ändrad acceptans. Härledda testfiler
  överfördes endast till den separata tillfälliga GPU:n.
- Lokalt byggt CPU-underlag: 2 479 unika fullständiga YUV-bildrutor,
  `pool.mp4` 471 469 184 byte och explicit vila i ruta 0 av profilens
  `2f3955b0-b450-4cc2-a9f5-ac80f10abd2f` (Kevin V2 · andning).
  Källmanifestets SHA-256 är
  `e49f1e9e9e141d1725c7ea1ec104fddff5d9055db33c4181f2c7a2e9a797ef0d`.
  Privat authoring-underlag finns utanför Git; det är inget nytt runtime-register.
- `createRegisteredMovingSpeech` kopplar ett verifierat källmanifest till
  befintlig PCM-/bildruteplan och transport. Den kräver både aktuellt register,
  exakt media i spelarens frysta publiceringskontext och verifierad bank.
  Ett bildkvitto från GPU-leverantören räcker inte som bankverifikation.
- Verifierat: riktade tester för export, bankbygge, metadataförändring,
  nekad åtkomst, bildruteplan, PCM, sockettransport och dealerlagrets mask.
  Python/ffmpeg-provet byggde en syntetisk bank med exakt deduplicering.
  PR191 på `c1fffdf4` passerade full GitHub-CI. Det opt-in webbläsarprovet
  kördes inte; det senare betalda modellprovet redovisas separat nedan.
- Kvar: bank-/workerattestering i en autentiserad session,
  inkoppling mot befintlig autentiserad talsession och budgetjournal samt
  serverns tidsplanering/replanering och spelarens ljudklocka.
  Inga produktionsprofiler eller befintliga molntjänster ändrades. Kontroll av
  GitGuardian via ordinarie CLI gav 0 öppna och 18 ignorerade incidenter,
  aktiv övervakning, partiell platsmetadata och historisk scan `too_large`.
  Detta är inte bevis för fullständig historisk täckning.

Fortsättning 17 oktober: CPU-underlaget kan nu överföras separat till GPU-steget
med ett på källdatorn låst kvitto och filhashar. Riktat Python/ffmpeg-test
verifierar separat beredning, bevarade poolbyte och avvisning av ändrad karta
eller ändrat kvitto; modellberedningen ersätts av en uttrycklig teststub i detta
test och är ingen GPU-/bildacceptans.

RunPods inloggade konsol visar `croupier-astrid-gpu-test` (`zsudl8tmzcmiv1`),
imagen `ghcr.io/jakeminator123/astrid-gpu-worker:sha-a041e48b9085a3cc4e324fa960551dde2822229b`,
en GPU i klassen 24 GB Pro och högst en worker. Koden i repot stöder fler dealers
via referensbild, men det är inte verifierat att denna driftsatta image innehåller
samma senare stöd. Den separata rörliga motorn använder en bildrutebank per dealer.
Avsikten är en gemensam talväg och delade workers, inte en permanent GPU per avatar.
Den befintliga RunPod-nyckeln lämnades orörd. Efter Jakobs uttryckliga
godkännande skapades `croupier-dragan-prep-20261017` med GraphQL Read/Write
och AI API None, sparad endast i huvudcheckoutens gitignorerade
`.env.dragan-gpu.local`. Jakob godkände högst 5 USD för det separata provet.

**Genomfört GPU-prov 17 oktober:** en separat RTX A6000, 48 GB GPU/50 GB RAM,
med Emils granskade `rorlig.py`/`motor.py`, MuseTalk-commit
`0a89dec45a0192b824e3cf4daf96c239440c5ed8` och samma beredningsrecept
(`sigma=1`, `cheek=90`). Alla 2 479 bildrutor hade hittat ansikte; beredningen
tog 744,6 sekunder. TAR-filen är 594 432 000 byte med SHA-256
`5dcf0f323f707ad6fa58f740a560a1aa62a73b1a6ebeaa916b6b026f6a47f14c`.
Efter nedladdning verifierades arkivet, alla sju filer och ansiktsmetadata lokalt.

Ett verkligt modellprov använde 89 exakta bildrutor ur `Kevin V2 · andning`
och befintligt inspelat ljud från `0f285c18-69da-43e4-8b28-f9fc8cce2d5f`.
Ingen annan persons TTS-konto användes. Uppvärmd motor gav 45,9 bildrutor/s,
första bit efter 496 ms; initial modell-/bankladdning och uppvärmning tog
57,3 sekunder. Provet är en 3,709-sekunders MP4, **inte verifierat live i spelet
och inte visuellt godkänd läppsynk**. Hashkontroll och ett granskat stillbildsprov
ersätter inte kontroll av hela videon med ljud.

Testpodden `dmo7wwtvcurqw6` avvecklades efter att banken, filmen och kvittona
hämtats hem. API-återläsning visade inga kvarvarande Pods; Astrids endpoint
har kvar samma ID/namn och workergränser 0–1. Beräknad GPU-/diskkostnad:
0,17 USD (tids- och prisberäkning, inte fakturakvitto). Nyckelfilen bevaras lokalt.
Privata resultat finns i denna chatts `visualizations`-katalog under
`dragan-gpu-result/`; de är authoring-/testunderlag och ligger inte i Git.

**Lokalt rörelseprov 17 oktober:** Jakob bad om utdelning till box 3 och
”Jakob är kung”. Neon-profilens befintliga ElevenLabs-klon `Dragge`
(`7f95xPL4S3ySZ4OS1pw8`, `eleven_multilingual_v2`) verifierades och användes
för ett enda TTS-anrop med profilens sparade inställningar. Klippet
`d207c889-cede-41be-98a9-4355ffc1f1c2` är registrerat som `box3`,
`Kevin pos4-iv`; dess aktuella Neon-hash matchade den bevarade Blob-kopian.
Emils motor och samma verifierade modellvikter kördes i en isolerad WSL-miljö
på Jakobs RTX 3060, 12 GB. Hela utdelningen behölls: 66 rutor/2,75 sekunder,
utan loop eller fryst slutruta; repliken använde exakt ruta 8–57. Bildrutorna
i testbanken matchade originalets avkodade YUV-byte före läppsynk.
FFmpeg verifierade H.264/AAC och full avkodning av resultatet. Tre utvalda
ansiktsbilder granskades; full audiovisuell acceptans är fortfarande öppen.
Renderingen av 50 talrutor tog 4,245 sekunder (11,8 fps), alltså ett
**offlineprov, inte verifierat direkttal**. Ingen ny RunPod-resurs startades.
Privat video: `dragan-jakob-ar-bast/dragan-box3-jakob-ar-kung.mp4` i samma
visualizations-katalog, med kvitto `preview-receipt.json`; video-SHA-256
`56ab4888c9677ba17fcd1495c04a5a170483f2e92f7a126ffbc4163641cc2c89`.
Original, röstprofil, produktionsregister och Astrids tjänst ändrades inte.

Jakob påpekade att äldre Blob-filmer och Neon-/UX-registreringar kan vara fel
eller inaktuella. Den verifierade banken är därför en **teknisk testbaseline**:
exakta byte/ID:n bevisar inte rätt spelhändelse eller senaste tagning. Original,
ostagade filmer och tidigare acceptans ska bevaras medan dessa val reds ut.


## Levererat och verifierat

- [PR188](https://github.com/Jakeminator123/scoutgaming/pull/188) är mergad
  som `620ab98198914d83c51e51d9eb28b192e18d9cf3`. Regressionerna körs i
  tidsatta grupper. POSIX-processstädning och bevarade exitkoder är rättade;
  frivillig kartrapportering ersätter inte produktprovets resultat.
- [PR190](https://github.com/Jakeminator123/scoutgaming/pull/190) är mergad
  som `d7dd04dcbc1c3eab6358ac64b63ad7b5d97a9166` efter integration av PR188.
  [PR189](https://github.com/Jakeminator123/scoutgaming/pull/189) är stängd
  som innehållsmässigt ersatt. Förbrukad lokal registeruppgradering,
  kosmetiska tester och dubblerad dokumentation är avvecklade.
- Integrationshead `c7d23eca0211870cce39ab9de56a1e2a3d2fe41a` hade
  [grön full CI](https://github.com/Jakeminator123/scoutgaming/actions/runs/38982387926).
  Lokal hook: 39 pass, 5 POSIX-skip på Windows. ChatGPT Pro läste detta
  publicerade head via GitHub och fann ingen nytillkommen blockerare.
- [Main-CI på d7dd04dc](https://github.com/Jakeminator123/scoutgaming/actions/runs/38982989384)
  passerade alla regressionsgrupper, Studio/typkontroll, SQL/omstart/HTTPS
  och schemaberedskap. Detta är inte visuell spel- eller läppsynkacceptans.
- Produktionskvitto 17 oktober cirka 01:53 svensk tid: Vercel
  `dpl_74WdAmdxWGjtn6xJMuUNMVx1rYut` READY och Render
  `dep-db9bggrm8hqs73ac2n70` live på samma fullständiga d7dd04dc-SHA ovan.
  Publik startsida, engine health och version gav HTTP 200; versionen matchade.
  Detta daterade kvitto ska inte beskrivas som kontroll av senare kod.

## Nästa produktarbete

Den tekniska Neon-/Blob-/runtimeflytten är avslutad. Nästa huvuduppgift bör
vara en avgränsad produktförbättring, exempelvis lobbyns tillåtna dealer-/
bordval och överföring till spelstart, eller ett sammanhängande Admin-flöde.
Det är en rekommendation; nästa agent ska utgå från Jakobs val.

<a id="2-öppna-kontroller-och-kända-fel"></a>

Unika öppna frågor finns i
[CLOUD-MIGRATION](CLOUD-MIGRATION.md#verkliga-migrationsfel-och-kvarvarande-utredningsspår):
N2:s motordata/rapporter, global ändringsloggs API, lobbyns bordval,
konto-/integrationsfunktioner, nytt tal/läppsynk, B18/B19, plattformsbeslut
#52 och backup/QA. Äldre auth-, publicerings-, idle-/frame-/zonobservationer
behöver reproduceras innan de klassas som aktuella fel.

Behåll riktade prov för behörighet, bolag/rum, revision, sparande, pengar och
spelregler. Det finns inget generellt krav på två spel, upprepade manuella
prov eller visuell acceptans för varje commit/merge. Godkända tester och
mediahashar bevisar inte läppsynk. Aktiva Control-komponenter och `lab/lib`
kan fortfarande vara delade beroenden; radera efter konsumentkontroll.

## Samordning och skyddat arbete

Två andra chattar fortsätter parallellt:

- **lipsync**, chatt `01a14685-3cb7-7020-8f18-414e8bbbd5fe`.
  Aktivt spår: `codex/dragan-lipsync-registry`,
  `C:\Users\jakem\.codex\worktrees\dragan-lipsync-registry-3518\croupier`,
  [PR191](https://github.com/Jakeminator123/scoutgaming/pull/191).
  Kontrollera aktuell status med chatten innan medie-/runtimeändringar.
- **STÄD-CL**, chatt `01a14631-14e2-7d53-ba3f-50a5f7a4c8f4`.
  Bevarad arbetsyta `C:\Users\jakem\.codex\worktrees\b07d\croupier`,
  branch `codex/dealer-regression-timing`. Agenten har bekräftat att inga
  andra worktrees eller temporära PR188-loggar behövs för dess arbete.

Jakob har tillåtit samordning med dessa chattar. Codex kan skicka meddelanden
mellan dem; `agent-talk` når bara agenter i samma checkout. Kontrollera
aktuella filanspråk och utse en ägare för Git/integration. En agents svar
är information, inte ett nytt användarmandat.

Huvudcheckouten `C:\Users\jakem\Projects\croupier` har skyddade lokala
ändringar i `.codex/config.toml`, `apps/croupier-speech/package.json`,
`.agents/skills/source-command-ping/`, `.cursor/settings.json` och
`web/public/review/`. 143 filer var hashbevarade vid PR190-leveransen.
Privata filmer, källoriginal, exportpaket, kalibrering och återställningsdata
ska samordnas med lipsync; de ingår inte i strukturfasens radering.
`ai-system-map` har ocommittade ändringar och `8e3c` privata arbetsdata;
båda lämnas för separat ägaravstämning.

## Leverans och återställning

Vercel-projekt/team `scoutgaming`: nya Preview-deployments stängdes av
17 oktober (`previewDeploymentsDisabled=true`), medan `main` fortsatt är
produktionsbranch. Befintliga preview-länkar har inte raderats.
GitHub-CI gäller fortsatt för PR:er. Render `croupier-v2` följer `main`
med `autoDeploy=yes`, `autoDeployTrigger=checksPass`.
Merge kan alltså publicera webb/Studio och därefter spelmotor automatiskt.
CI, deployment och faktisk live-version ska redovisas separat.

GitGuardian-läsningen på d7dd04dc gav aktiv övervakning och 0 öppna/18
ignorerade incidenter, med ofullständig plats-/historiktäckning.
QA/Preview-utbyggnad är pausad; ursprunglig ingresshemlighet är inte återställd.
[ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md) och
[ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md) äger återställning och miljöansvar.

Äldre detaljkvitton finns i
[handoffen på d7dd04dc](https://github.com/Jakeminator123/scoutgaming/blob/d7dd04dcbc1c3eab6358ac64b63ad7b5d97a9166/docs/JOHN-HANDOFF.md)
och PR188/190. Fasens egna körskript, utkast och temporära CI-loggar är rensade.
17 historiska fjärrbrancher och två lokala brancher togs bort efter kontroll
av exakta PR-huvuden och main-innehåll. PR189:s avslutade worktree
`simplify-test-policy` togs bort med återställningsbar Codex-snapshot.
STÄD-CL:s och lipsyncs arbetsytor bevarades.
