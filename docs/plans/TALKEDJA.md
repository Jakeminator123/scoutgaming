# Talkedjan: dealer-generisk, Paow först

**Arbetet är pausat enligt Jakob.** Planen samlar återstående arbete enligt
beslutet 28 oktober: behåll GPU- och talspåret och gör det lika för alla dealers.
Vid återupptag gäller [körplanen](organisation/KORPLAN-v2.md) och mergeordningen
i [AGENTS](../../AGENTS.md). Bara Jakob godkänner ljud och läppsynk.

## Målbild

1. Varje dealer har inspelade repliker och genererat tal med läppsynk på GPU, styrt av chatten (Dialogtest och spelbordets chatt).
2. Röst, referens (stillbild eller rörligt), bank och driftprofil ställs in per dealer i Admin under **Röst och tal**.
3. Spelmotorn beställer tal som händelser; en taltjänst levererar media och strömmar.
4. Ingen dealer är ett specialfall i kod: inga hårdkodade dealerlistor, ID eller budgetnamn.
5. Dragan blir en dealer bland andra och byts aldrig ut i produktionen under arbetet.

## Underlag och acceptans

[Fryst verifiering och kodavstämning 30 oktober–1 november](https://github.com/Jakeminator123/scoutgaming/blob/91b4e1888ea28c008b4ff25f827474a78f4f79db/docs/plans/TALKEDJA.md#verifierat-30-oktober-2026-kl-11071124)
och [RunPod-underlaget](../media/TALKEDJA-RUNPOD.md) bär de daterade proven.
De visar inte dagens provideråtkomst eller godkänd läppsynk. Jakob-2:s
referens- och TTS-prov gav ingen spelacceptans; moving var av och banken saknades.
Kontrakt för paket, filmprofil, media-id/hash/timing och uppspelning finns i
[runtimeguiden](../media/PRESENTATION-RUNTIME.md).

## Återstående steg

Numreringen behålls för hänvisningar. Uppdraget är pausat; kod- och
provideråtgärder följer den återupptagna tilldelningen. Env-ändringar ska
föras i båda miljöregistren. T3 är genomförd, medan T3b återstår att
bedöma efter verkliga konsumenter.

### T1. Paow talar via stillbild (spår 1, ännu inte verifierat)

- **Görs:** Admin → Dealers → Paow → Röst och tal. Välj röst och språkprofil ur [röstkatalogen](../../packages/presentation/contracts/dealer-voice-catalog.json), `video-frame` mot ett av Paows vilaklipp och `offsetMs` på vilorutan (helst samma ruta som Kevins `talk_base.png`). Granska rutan, "Begär AI-tal", spara.
- **Delat bord:** enligt kodavstämningen saknar `generated-speech-stream` `assertCurrent` och visas därför bara som text. Gemensam distribution gäller också bara moving. Stillbildsvägen behöver aktuell session/svar, avbrott och distribution i `services/game/public/shared-room-presentation.mjs` och `services/game/shared-room-chat.mjs`; Admin-konfiguration ensam räcker inte som bevis.
- **Underlag:** vid godkänt änd-till-änd-prov dokumenteras profilrevision, referensklippets ID och sha256, journalrad, reservation och GPU-tid i `docs/<datum>-TALKEDJA-T1-ACCEPTANCE.json`. Nödvändiga kodrättningar avgränsas efter de verifierade spärrarna; inget sådant kvitto finns i denna uppdatering.
- **Förutsättningar:** aktiv nyckel måste nå vald röst. Den 30 oktober gav Paow `voice_not_found`; den befintliga endpointen `zsudl8tmzcmiv1` har ännu inte verifierad image/protokollkedja. Varken röst-ID, flaggor eller health HTTP 200 räcker som driftbevis.
- **Mandat:** inget DDL-behov fastställt; eventuell nyckeländring följer T7 och miljöförteckningen.
- **Prov:** Dialogtest mot Paow: text → röst → läppsynk från stillbild. Kontrollera att sessionsjournalen tar svaret (`generated-speech-stream.mjs:239–243`: utan journal tas bara den gamla avataren emot) och att reservationen räknas mot `CROUPIER_SPEECH_RUNPOD_*`.
- **Preview:** först efter verifierad provideruppsättning. `/studio-preview` har AI och tal avstängda och kan inte utgöra detta prov. Ingen tidigare planerad produktionskörning är genomförd acceptans.
- **Driftprov:** verifiera aktuella workerinställningar, kallstart, grön kant från padden i `dealer-speech-reference.mjs` och teckenkvot; gamla inställningar och health HTTP 200 bevisar inte svarstid.

### T2. Preview får verifierad taluppsättning

Preview har daterade nyckel- och konfigurationskvitton i
[miljöguiden](../operations/ENVIRONMENT-VARIABLES.md#verifierad-tal--och-miljöstatus-30-oktober-2026); den äldre uppgiften
att alla talnycklar saknas ska inte användas. Kontrollera nuvarande
miljöspecifik röst-, endpoint-, budget- och callbackbindning innan prov.
Produktionens nycklar kopieras inte som genväg. Godkänt dealermaterial
får ligga i preview-Blob enligt [START-HERE](../../START-HERE.md#preview).
En konfigurationskontroll eller HTTP 200 är inte ett komplett talprov.
Produktionens callbackrättning är redan kvitterad där; kör inte den
historiska fixern igen utan en aktuell felbild.

### T3. Infört; återstående T3b

Bankkartan, dealerbundna driftprofiler och budgetar är införda (#549);
de gamla variablerna för en enda bank/endpoint är avvecklade.
T3b gäller den gamla transportvägen och avatarlistan i
`services/astrid-gpu-worker/gateway/moving-transport.mjs`.
Spåra aktiva anrop innan radering och behåll den ägda workerns verifierade
`workerAvatar`-, release-, bankhash- och kvittokontrakt.

### T4. Paows bank byggs och verifieras

Följ [PAOW-BANK-KORNING](../media/PAOW-BANK-KORNING.md), vars källmanifest hämtas
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

K04:s produktkatalog och revisionshjälpare är avvecklade. Dealerlistor och timingdata hör till testfixturen
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
- **Nuläge:** speloutboxens presentationsadapter saknar skrivport till spelet, men talets journal, budget, TTS, RunPod-jobb, banker, drift och callback delar fortfarande v3-processen. `apps/speech` är ingress, inte en fristående arbetande taltjänst. `speech-startup.mjs` har redan gemensam avbrytbar femsekundersdeadline för valfria bankläsningar: förväntade konfigurations-/bankfel degraderar talet; obligatoriska databasfel, programmeringsfel och oväntade filsystemfel stoppar start. Processisolering återstår och är inte en förutsättning för den införda startbegränsningen.
- **Gräns:** en separat Render-process äger befintliga talmoduler och providerhemligheter. Motorn behåller medlemskap, behörighet, runda och färskhetskontroll via ett smalt autentiserat kontrakt. Talhändelser får inte skriva spelutfall eller plånbok; sena eller felbundna medier ska avvisas även vid återanslutning.
- **Plan före flytt:** namnge tjänsten (inte `croupier-speech`, som är en OpenClaw-roll), specificera jobbidentitet, avbrott/färskhet, journal/budget, bank- och driftägare, callback/origin samt hur `apps/speech` pekar om. Flytta därefter befintlig funktion i avgränsade leveranser, utan en parallell v2-implementation.
- **Filer, sedan:** `services/game/generated-speech-*`, `moving-speech-*`, `dealer-speech-*`, `moving-drift-*`, berörda director-/gateway-adaptrar och `apps/speech`.
- **DDL:** egen begränsad databasroll kräver separat godkänd åtgärd. **Env:** talnycklar flyttas först när den nya ägaren är driftsatt och verifierad; inget tas bort från en aktiv konsument i förväg.
- **Verifiering:** spelet ska starta och fortsätta när taltjänsten är nere, felkonfigurerad eller långsam. Behåll rum-/bolagsisolering, biljettengångsanvändning, budget och avvisning av gammal runda. Processflytten löser inte i sig stillbildsspärrarna i gemensam uppspelning.
- **Ordning:** egen bankförberedelse och isolerade GPU-prov fortsätter utanför v3. Tjänstegräns och callback ska vara konkreta före en ny produktionsaktivering; en godkänd röst eller GPU-rendering bevisar inte processisolering. Ingen tjänst, roll eller skarp talflagga ändrades i granskningen.

## Vid återupptag

Privata startunderlag för det pausade Jakob-2-arbetet är
`.cache/jakob2-moving-probe-20261030/PAUSED-HANDOFF.md` och
`.cache/jakob2-realtime-preview-20261030/PROVRUM-HANDOFF.md`.
Det första skiljer senaste container-/proxyfelet HTTP 404 från tidigare
`IMAGE_AUTH_ERROR`; det andra beskriver previewimporten och filmprofilen.
Verifiera aktuellt läge före fortsättning. `.cache/elevenlabs-kevin-consolidation/`
är förberedelseunderlag, inte en genomförd röstflytt.

Kostnadsram för GPU-prov samt beslut om eventuell produktionsaktivering
eller varm worker återstår. Redan godkända media i preview behöver inget
nytt generellt godkännande.
Ändra inga providerinställningar med endast en gammal inventering som stöd.

T8 kräver ett konkret tjänstekontrakt före processflytten; eventuell DDL
och flytt av aktiva hemligheter följer den tilldelningens mandat.
Radera verifierat förbrukade transportvägar och specialfall tillsammans
med konsumenter och prov. När kedjan är klar förs kontrakten till
sakguiderna och denna plan raderas. Git bär den avslutade historiken.
