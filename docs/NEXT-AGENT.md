# Nästa agent

Aktuell samordning 31 oktober 2026. Kanonisk checkout: `C:/Users/jakob/dev/scoutgaming`. Läs [START-HERE](../START-HERE.md) och [AGENTS](../AGENTS.md); den äldre checkouten `dev/projects/scoutgame` och andras prototyper är inte integrationsytor. `migrering/status.json` är fortsatt migrationsplanens enda statuskälla.

## Leveransen som avslutas

- **L3 steg 5–6:** Studio 023 är installerad i båda miljöerna. Nya paketrevisioner bär produktionens fyra och previews sex befintliga rum (nio respektive fyra bolagspaket). Den gamla dokumentlistan avvecklas med vanlig CAS-sparning efter kodens driftsättning, utan att skriva om material eller låsta spelkonfigurationer. Paketens `rooms` är enda aktiva rumsregistret; Admins `administration.rooms` är en härledd svarsvy. `gameLanes` är kvarvarande uppspelningskonfiguration, inte en andra rumslista; dess avveckling var L3 steg 7, inte någon av de två beställda delarna.
- **Rapportens pengar/valuta:** #708 rättade reserverat saldo i roulette och belopp under en cent. #551 tog bort dubblerade blackjackhandregler. #711 rättar kontovaluta i klienten, bevarar avräkningsvaluta efter valutabyte och beskriver att extern partnerwallet ännu är blockerad. Browsergranskningen rättade även överlappande valutatexter på små skärmar. Intern demoplånbok är fortfarande stödd väg; detta är inte real-money-acceptans.
- **Insatsrutor och perspektiv:** sju rutor är inte sju olika spelare. En spelare får satsa på flera lediga rutor; kamerans/lokalvyns fokus är separat. #714 rättar klient/server-glappet för huvudinsats på en ledig ruta. Annans ruta, sidobet utan huvudinsats och stängt insatsfönster förblir spärrade. Köregeln om högst tre behållna rutor gäller efter rundan när bordet är fullt och någon väntar.
- **Admin:** #713 förbättrar den befintliga sökningen för mobil, aktuella katalogdata och direktnavigation. Materialets användningar länkas till befintliga miljöer. Radering får inte tyst välja en godtycklig dealer eller publicera om olika bolags rum; filmprofil, vald röst, bord och godkänt material måste passa ihop.

Slutliga PR-, CI-, deploy- och städkvitton samlas privat i `.cache/l3-closeout-20261030/REPORT.md`. Äldre `.cache/closeout-20261030/REPORT.md` beskriver det föregående avslutet och har ersatts som lägesbild av denna leverans.

## Jakob-2 och tal: fortsatt pausat

Ingen ny bank, GPU-körning eller talaktivering ingår. Jakob-2 har en registrerad ElevenLabs-röst och previewmaterial, men saknar en verifierad egen GPU-bank och godkänd nygenererad läppsynk i spelet. Förinspelade godkända repliker är inte samma sak som genererat livetal.

- LIPSNK: `.cache/jakob2-moving-probe-20261030/PAUSED-HANDOFF.md`. Offlinekontrakt, 39 originalrutor, ljud och runner/transport finns; egna tillfälliga GPU-poddar är borttagna. Senaste stoppet var container-/proxy-readiness HTTP 404, skilt från tidigare IMAGE_AUTH_ERROR.
- Importagenten: `.cache/jakob2-realtime-preview-20261030/PROVRUM-HANDOFF.md`. Preview har 48 klipp, filmprofil med 35 tagningar och tio inspelade svar. 96 verifierade tillfälliga videokopior (cirka 225 MB) är borttagna. Inga original eller publicerade rum raderades.
- Röstnyckeln som senast API-verifierades på Render når Jakob/ABYDM, inte Paow/Dragan. Kevins andra konto och endpointägarskap måste verifieras före ett senare byte. Inga hemligheter ska kopieras till Git eller handofftext. `.cache/elevenlabs-kevin-consolidation/` innehåller privat förberedelseunderlag, inte genomförd röstflytt.
- RunPod-mall `5dkkc3wolw` pekar nu på `https://croupier-v3.onrender.com`. Lokal RunPod-nyckel och produktionens movingnyckel når olika konton; deras endpoints är inte utbytbara. Rättningen aktiverade inte Jakob-2.
- Previews tre talhemligheter är separata, 64 tecken och olika från produktionens. Två olästa produktionsvariabler togs bort med privat krypterad återställningskopia. Aktuell miljökarta: [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md). En L3-/UI-ändring kräver ingen ny nyckelrotation.

Kvar för senare taluppdrag: delat bords `generated-speech-stream` behöver komplett `assertCurrent`-/distributionsväg; `/studio-preview` har AI/tal av. Taladaptrar delar ännu Render-process med spelet, medan TTS/GPU sker utanför regelkärnan. Se [TALKEDJA](plans/TALKEDJA.md) och [RunPod-underlaget](TALKEDJA-RUNPOD.md). Bank- eller hashkontroller bevisar inte läppsynk.

## Kända återstående frågor

1. **Dragan-test:** det befintliga rummet saknar publicerad spelkonfiguration (`room_config_missing`) både före och efter L3 på den isolerade produktionsklonen. Tre andra produktionsrum ger identiskt materialurval och konfiguration. Rummet ska inte öppnas genom en gissad standardkonfiguration.
2. **Materialersättning och gallring:** dagens materialpapperskorg kan avpublicera och arkivera berörda spelbord. Ett framtida “ersätt och radera” ska visa berörda rum/bolag, välja uttryckligen kompatibelt material, publicera atomiskt och därefter ta bort förbrukade referenser. Ingen ny global reservdealer eller reservbank har införts. Dokument-/pakethistoriken är inte ett parallellt aktivt produktregister; refererade versioner behövs fortfarande av låsta rum. Oanvänd kod och arbetsfiler ska däremot raderas, inte sparas av vana.
3. **Lounge/prototyper:** #707/#709 är återanvändbara bordstillgångar, inte full loungeintegration. V6 är omergad och blandad med annat arbete. Bevarade worktrees: `dealer-table-template-1030`, `interactive-lounge-1030`, `lounge-runtime-1030`, `lounge-tsx-1030`. Privat handoff: `C:/Users/jakob/.codex/visualizations/2026/10/30/01a18a56-82c3-7a11-903f-4b0c42deb6c2/next-lounge/HANDOFF-v6.md`. Den begärda lokala previewn lämnades kvar av ägaren; kontrollera aktuell aktivitet före städning.
4. **Native och drift:** native-/partner-/provspelsadaptrar har levande konsumenter trots gemensam regelkärna. Ersätt deras anrop innan de raderas. `game-013` är separat schemaefterregistrering, inte bevis på saknade pengaposter. F11:s driftacceptans återstår: tomma bord och noll saldoreservationer före Render-deploy. V2-tjänsten är raderad; `croupier-v3` är nuvarande spelbackend. Den oanvända socketdiagnostiken för de raderade preview-värdarna är borttagen tillsammans med sitt ensamma test; transportens autentisering, tidsgränser och kögränser är kvar.
5. **Säkerhet:** GitGuardian återlästes 31 oktober: noll öppna incidenter, 25 ignorerade. Incidenterna 39166318 och 39166319 är ignorerade som `test_credential`: påhittade Postgres-uppgifter i Studios tester av loggmaskering. Monitoreringen är aktiv. Den historiska skanningen från 2 oktober står däremot kvar som `too_large` med noll skannade commits; noll öppna incidenter bevisar därför inte full historisk täckning.

Miljöinventeringen från 29 oktober är borttagen; aktuella kontrakt och återstående kontroller finns i [miljöguiden](ENVIRONMENT-VARIABLES.md) och [återställningsguiden](ENVIRONMENT-RESTORATION.md#kvar-att-bedöma-för-gallring). Dokumentstädningen ändrar inga molnresurser eller prototypers arbetsfiler.

## Arbetsgräns och avslut

Regler, slump, sko, kort och spelutfall är spelkärnan. Hela `services/game` är inte orörbar kod: klient, sessioner, rum, presentation och taladaptrar får förenklas och flyttas med bibehållen behörighet, serverauktoritet och atomiska pengatransaktioner. Läs [ansvarsgränsen](../services/game/README.md#vad-som-får-ändras).

De ursprungliga fyra chattarna har avslutat och lämnat över. KOPPLINGSAGENTENs äldre rapport `.cache/kopplingsagent-audit-20261030/HANDOFF.txt` har bedömts mot aktuell kod; importera inte dess gamla reproduktionsskript som smoke tests. #550 stängdes som ersatt; #551, #593, #701, #709 och #710 är mergade. Den nya L3-/valuta-/Adminleveransen har egna slutkvitton ovan. Återuppta inte avslutade underagenter; starta ett avgränsat nytt uppdrag vid behov.
