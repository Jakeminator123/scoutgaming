# Talkedjan: dealer-generisk, Paow först

Genomförandeplan för talkedjan efter O03, skriven 28 oktober 2026 efter att migreringen nått 100 %. Underlaget är [det historiska Paow-underlaget](../HISTORIK.md) (#528, proven och verifierat läge) och Jakobs beslut samma natt: behåll hela GPU- och talspåret och gör det lika för alla dealers. O03 är genomfört (#527); milstolpar som byggts markeras i planen. Se [TALKEDJA-RUNPOD](../TALKEDJA-RUNPOD.md) för daterat driftunderlag. Arbetet är pausat enligt Jakob. Vid återupptag gäller aktuell körplan och mergeordningen i AGENTS; daterade mätningar nedan är inte färsk molnstatus. Bara Jakob godkänner ljud och läppsynk.

## Målbild

1. Varje dealer har inspelade repliker och genererat tal med läppsynk på GPU, styrt av chatten (Dialogtest och spelbordets chatt).
2. Röst, referens (stillbild eller rörligt), bank och driftprofil ställs in per dealer i Admin under **Röst och tal**.
3. Spelmotorn beställer tal som händelser; en taltjänst levererar media och strömmar.
4. Ingen dealer är ett specialfall i kod: inga hårdkodade dealerlistor, ID eller budgetnamn.
5. Dragan blir en dealer bland andra och byts aldrig ut i produktionen under arbetet.

## Verifierat 30 oktober 2026, kl. 11:07–11:24

Kontrollerna nedan är orkestratorns liveverifiering mot kodbas `638a138d07690cc1bfa50e790dd744db95b441c7`. De ersätter äldre antaganden om röståtkomst och driftberedskap; PR-sekvensen nedan är fortfarande en plan.

| Del | Verifierat | Återstår |
| --- | --- | --- |
| ElevenLabs | Aktiv `ELEVENLABS_API_KEY` på Render når Jakob (`lMIZLGqZiWeEKgssOCKm`) och ABYDM (`PiGyGh3I6t288DXzqeDV`). Paow och Dragan ger `voice_not_found`; `ELEVEN_KEVIN` saknas. | Kevins uppgift om Impactwin respektive hans vanliga konto är rapporterad, inte verifierad via profil-API. Alla fyra ska samlas hos Kevin enligt Jakobs beslut; åtkomst till alla fyra måste verifieras före byte. |
| Stillbildsendpoint | `zsudl8tmzcmiv1` gav health HTTP 200, noll workers och noll jobb. Inget GPU-jobb startades i denna kontroll. | Deployad image och protokoll är okända; health bevisar inte att endpointen tar produktens begäran eller levererar användbar läppsynk. |
| Jakob 2 | Talprofilen är `preparation` med `video-frame`. Ordinarie referenstjänst verifierade registrerad Blob-SHA och tog ut PNG 1080×1920. Ett tvåsekunders Jakob-TTS-prov gav HTTP 200 och PCM 24 kHz. | Ingen läppsynk, spelacceptans eller godkänd talprofil följer av referens- eller ljudprovet. |
| Delat spelbord | `generated-speech-stream` visas bara som text eftersom dess uppspelningsväg saknar `assertCurrent`; enbart `moving-speech-stream` får spelas. Chattens utsändning till alla deltagare gäller också enbart moving. | Stillbildsvägen behöver stöd för aktuell session/svar och avbrott samt gemensam distribution innan den kan godkännas vid bordet. Källor: `services/game/public/shared-room-presentation.mjs:51–54`, `services/game/shared-room-chat.mjs:229–238`. |
| Adminspel | `/studio-preview` deklarerar `externalServices.ai=false` och `speech=false` (`services/game/studio-preview.mjs:198`). | Ett godkänt Adminspel provar därför inte nytt AI-tal. |
| Rörligt tal | Moving är fortsatt av och Jakob 2 saknar bank. Ingen global konfiguration ändrades av verifieringen. | Bank, verifierad worker/protokollkedja och ljud-/bildacceptans krävs för det rörliga spåret. |

## Kodavstämning 1 november 2026

Bas `e3dbed2c17afe91deb81ff9b9e9d88264958d38f`. Tabellen ovan är ett
daterat prov; den visar inte dagens provideråtkomst eller ny AV-acceptans.

- T3:s banker och driftprofiler per dealer är införda (#549).
- T5:s referensval finns i `studio-speech-panel.tsx`: `video-frame` och
  `motion-video`. Rörligt tal kräver fortfarande en verifierad bank.
- Valfri talstart är isolerad av `services/game/speech-startup.mjs`:
  en gemensam avbrytbar femsekundersdeadline täcker bankläsningarna.
  Förväntade konfigurations-/bankfel degraderar talet; obligatoriska databasfel,
  programmeringsfel och oväntade filsystemfel ska fortfarande stoppa start.
  Den äldre uppgiften att en saknad moving-bank alltid fäller spelet är
  rättad genom TAL-02. Det innebär inte att talet är godkänt i drift.
- Faktisk rumspublicering använder `resolveNativeRoomGameMaterial` i
  `packages/presentation/server/native-room-game-material.mjs`, via
  `apps/studio/lib/studio-native-runtime.mjs` och `room-release.mjs`.
  Den binder fryst paket, registrerad filmprofil och media-id/hash/timing.
  Den historiska K04-katalogen och revisionshjälparen är avvecklade;
  den kvarvarande testkedjan använder detta publiceringskontrakt.
- Callbackrättningen för produktionsmallen är kvitterad 30 oktober 16:46 UTC
  i [miljöguiden](../ENVIRONMENT-VARIABLES.md). Kör inte den historiska
  fixern igen utan en aktuell felbild. Previews separata bindning måste
  verifieras i sin egen miljö.

Speloutboxen försörjer presentationen utan skrivport till kort, sko, saldo
eller utbetalningar. Providerorkestrering och tal delar fortfarande
motorns process; separat tjänst är kvarvarande T8, inte en förutsättning
för den redan införda begränsningen av valfri talstart.

## Återstående steg

Numreringen behålls för hänvisningar. Uppdraget är pausat; kod- och
provideråtgärder följer den återupptagna tilldelningen. Env-ändringar ska
föras i båda miljöregistren. T3 är genomförd, medan T3b återstår att
bedöma efter verkliga konsumenter.

### T1. Paow talar via stillbild (spår 1, ännu inte verifierat)

- **Syfte:** bevisa hela stillbildsvägen för vald dealer. Antagandet att enbart Admin-konfiguration räcker är inte verifierat; delat spelbord har kodspärrarna ovan.
- **Görs:** Admin → Dealers → Paow → Röst och tal. Röst ur katalogen (`WZVEBKUreb9jAKojf0QF`; sv `eleven_v3` 0,5/0,85/speaker boost, en `eleven_multilingual_v2` 0,38/0,8/style 0,3), referens `video-frame` mot ett av Paows vilaklipp, `offsetMs` på vilorutan (helst samma ruta som Kevins `talk_base.png`), granska rutan, "Begär AI-tal", spara.
- **Underlag:** vid godkänt änd-till-änd-prov dokumenteras profilrevision, referensklippets ID och sha256, journalrad, reservation och GPU-tid i `docs/<datum>-TALKEDJA-T1-ACCEPTANCE.json`. Nödvändiga kodrättningar avgränsas efter de verifierade spärrarna; inget sådant kvitto finns i denna uppdatering.
- **Förutsättningar:** aktiv nyckel måste nå vald röst. Den 30 oktober gav Paow `voice_not_found`; den befintliga endpointen `zsudl8tmzcmiv1` har ännu inte verifierad image/protokollkedja. Varken röst-ID, flaggor eller health HTTP 200 räcker som driftbevis.
- **DDL:** inget behov fastställt. **Env:** inget ändrat; eventuell nyckeländring följer T7 och miljöförteckningen.
- **Prov:** Dialogtest mot Paow: text → röst → läppsynk från stillbild. Kontrollera att sessionsjournalen tar svaret (`generated-speech-stream.mjs:239–243`: utan journal tas bara den gamla avataren emot) och att reservationen räknas mot `CROUPIER_SPEECH_RUNPOD_*`.
- **Preview:** först efter verifierad provideruppsättning. `/studio-preview` har AI och tal avstängda och kan inte utgöra detta prov. Planens tidigare Dialogtest i produktion med Paow otilldelad till bolag är ingen redan utförd acceptans.
- **Risk:** låg för spelet. Planens historiska uppgifter för `zsudl8tmzcmiv1` var min 0 och idle 5 s; dagens healthkontroll verifierar inte dessa inställningar eller svarstid. Kallstart, grön kant från padden i `dealer-speech-reference.mjs:89` och teckenkvot behöver bedömas i det faktiska provet.

### T2. Preview får verifierad taluppsättning

Preview har daterade nyckel- och konfigurationskvitton i
[ENVIRONMENT-VARIABLES](../ENVIRONMENT-VARIABLES.md); den äldre uppgiften
att alla talnycklar saknas ska inte användas. Kontrollera nuvarande
miljöspecifik röst-, endpoint-, budget- och callbackbindning innan prov.
Produktionens nycklar kopieras inte som genväg. Godkänt dealermaterial
får ligga i preview-Blob enligt [START-HERE](../../START-HERE.md#preview).
En konfigurationskontroll eller HTTP 200 är inte ett komplett talprov.

### T3. Infört; återstående T3b

Bankkartan, dealerbundna driftprofiler och budgetar är införda (#549);
de gamla variablerna för en enda bank/endpoint är avvecklade.
T3b gäller den gamla transportvägen och avatarlistan i
`services/astrid-gpu-worker/gateway/moving-transport.mjs`.
Spåra aktiva anrop innan radering och behåll den ägda workerns verifierade
`workerAvatar`-, release-, bankhash- och kvittokontrakt.

### T4. Paows bank byggs och verifieras

Följ [PAOW-BANK-KORNING](../PAOW-BANK-KORNING.md), vars källmanifest hämtas
ur aktuell registerexport. Använd inte äldre fasta klippantal eller rå
`avatar-paow.tar` som om den vore vår verifierade bank. Bygg i separat
staging och registrera arkiv, kvitto, källornas ID/hashar och worker-release
i samma miljö. Preview först enligt uppdragets kostnadsram; bankposten och
driftprofilen aktiverar inte i sig tal.

### T5. Rörligt tal: bank och acceptans återstår

Admin kan redan välja referenstyp. Det återstående arbetet är att koppla
den verifierade banken och dealerbundna driftprofilen samt prova Dragan
och Paow i samma miljö: Dialogtest, spelad hand, omladdning, kvitto per
dealer och budgettak. Jakob bedömer ljud och läppsynk. Produktionsaktivering
är ett eget driftsbeslut, inte en följd av att UI:t kan spara profilen.

### T6. Dealerantaganden i aktiva talkedjor

Följ de faktiska konsumenterna i `dealer-chat-persona.mjs`,
`product-speech.mjs`, `speech-routing.mjs`, `speech-package.mjs`,
`generated-speech-stream.mjs` och motorns integration. Flytta eller ta bort
hårdkodade specialfall när de ersätts av dealerdata; avveckla Astrid enligt
[körplanens datauppdrag](organisation/KORPLAN-v2.md#data-och-medieavveckling). Behåll behörighet, tids-/revisionsbindning och
verifierad mediekomposition; ta bort rena testlås på pensionerat beteende.

K04:s dealerlistor och timingdata hör till testfixturen
`test/fixtures/blackjack/`. Att flytta eller städa den kräver ingen
ompublicering av produktionsrum. Om ett faktiskt publicerat materialkontrakt
ändras ska däremot dess paket, hash och konsumtion verifieras.

### T7. Samla rösterna hos Kevin (beslut 30 oktober)

- **Syfte:** samla Jakob, ABYDM, Paow och Dragan på Kevins konto enligt Jakobs senaste beslut; den tidigare planen om ett separat eget konto är ersatt.
- **Görs:** verifiera åtkomst till Kevins målkonto och flytta/återskapa Jakob och ABYDM från deras privata ljudunderlag. Verifiera sedan alla fyra röster före ett samordnat byte av aktiv nyckel och berörda voiceId i katalog/profiler. Ingen kopiering eller aktivt nyckel-/profilbyte är genomfört. En saknad röst ger fel, aldrig en annan dealers röst.
- **DDL:** nej. **Env:** ja, en nyckel byts.
- **Prov:** ett svar per dealer och språk i Dialogtest; Jakob godkänner rösten.
- **Preview:** samma prov med preview-nyckeln först.
- **Risk:** låg tekniskt; rösten kan låta annorlunda.

### T8. Taltjänsten ut ur motorn

- **Riktning bekräftad 30 oktober:** v3 ska behålla spelregler, kort, sko, saldo och auktoritativ tid. Saknade gamla v2-variabler är inte fel i sig; gamla tjänster eller providerinställningar kopieras inte tillbaka för att fylla en lista.
- **Nuläge:** speloutboxens presentationsadapter saknar skrivport till spelet, men talets journal, budget, TTS, RunPod-jobb, banker, drift och callback delar fortfarande v3-processen. `apps/speech` är ingress, inte en fristående arbetande taltjänst. Valfri bankläsning har nu en avbrytbar deadline och degradering enligt kodavstämningen ovan; obligatoriska startupfel förblir fatala. Logisk separation är därför verifierad, processisolering återstår.
- **Gräns:** en separat Render-process äger befintliga talmoduler och providerhemligheter. Motorn behåller medlemskap, behörighet, runda och färskhetskontroll via ett smalt autentiserat kontrakt. Talhändelser får inte skriva spelutfall eller plånbok; sena eller felbundna medier ska avvisas även vid återanslutning.
- **Plan före flytt:** namnge tjänsten (inte `croupier-speech`, som är en OpenClaw-roll), specificera jobbidentitet, avbrott/färskhet, journal/budget, bank- och driftägare, callback/origin samt hur `apps/speech` pekar om. Flytta därefter befintlig funktion i avgränsade leveranser, utan en parallell v2-implementation.
- **Filer, sedan:** `services/game/generated-speech-*`, `moving-speech-*`, `dealer-speech-*`, `moving-drift-*`, berörda director-/gateway-adaptrar och `apps/speech`.
- **DDL:** egen begränsad databasroll kräver separat godkänd åtgärd. **Env:** talnycklar flyttas först när den nya ägaren är driftsatt och verifierad; inget tas bort från en aktiv konsument i förväg.
- **Verifiering:** spelet ska starta och fortsätta när taltjänsten är nere, felkonfigurerad eller långsam. Behåll rum-/bolagsisolering, biljettengångsanvändning, budget och avvisning av gammal runda. Processflytten löser inte i sig stillbildsspärrarna i gemensam uppspelning.
- **Ordning:** egen bankförberedelse och isolerade GPU-prov fortsätter utanför v3. Tjänstegräns och callback ska vara konkreta före en ny produktionsaktivering; en godkänd röst eller GPU-rendering bevisar inte processisolering. Ingen tjänst, roll eller skarp talflagga ändrades i granskningen.

## Vid återupptag

Kvar står T7:s verifierade röståtkomst och röstunderlag, bank/worker-
protokoll och faktisk ljud-/bildacceptans, kostnadsram för GPU-prov samt
beslut om eventuell produktionsaktivering eller varm worker. Redan
godkända media i preview behöver inget nytt generellt godkännande.
Ändra inga providerinställningar med endast en gammal inventering som stöd.

T8 kräver ett konkret tjänstekontrakt före processflytten; eventuell DDL
och flytt av aktiva hemligheter följer den tilldelningens mandat.
Radera verifierat förbrukade transportvägar och specialfall tillsammans
med konsumenter och prov. När kedjan är klar förs kontrakten till
sakguiderna och denna plan raderas via [HISTORIK](../HISTORIK.md).
