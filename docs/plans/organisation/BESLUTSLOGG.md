# Beslutslogg och nya fynd

Loggen innehåller korta skäl och hänvisningar, inte en andra aktivitetsstatus. Ändra [KORPLAN-v2](KORPLAN-v2.md) när beslut påverkar aktiv körordning eller mandat. Nya fynd följer [arbetssättet](ARBETSSATT.md).

| ID / datum | Observation och beslut | Påverkan / bevis |
| --- | --- | --- |
| B-001 / 2026-10-31 | Jakob beställer inventering, tre faser, områdesplaner, separata agentchattar och tvärgående arbete. Första etappen är planering. | [MASTERPLAN](MASTERPLAN.md); ingen produkt-/molnändring i etappen. |
| B-002 / 2026-10-31 | Senaste rapportens påstående om en nyare `master` används inte. Färska GitHub-refar visar ingen sådan branch; lokal och remote main har samma nya handoff. | [NULAGE](NULAGE.md), [UNDERLAG](UNDERLAG.md). |
| B-003 / 2026-10-31 | Redan utförda valuta-, callback-, nyckel- och branchskyddsåtgärder beställs inte igen. Rättad kod och kvarvarande acceptans skiljs åt. | [Fyndbedömningen](UNDERLAG.md). F11 stannar hos GAM-01. |
| B-004 / 2026-10-31 | A–C används som omfattning, tre faser som arbetsordning. Aktivitetsfilen bär ensam sin status. | [Arbetssätt](ARBETSSATT.md). Ingen ny migrationsbacklog. |
| B-005 / 2026-10-31 | Git-historik/repo-byte hålls som separat beslut. Städning av dagens filträd får inte bli historikomskrivning. | [GEM-03](gemensamt/aktiviteter/GEM-03.md), befintliga incidentguider. |
| F-20261031-01 | Repoagenten noterade möjlig lucka för stora mellanliggande objekt som inte syns i slutträdet. Verifiera skyddet innan någon kod ändras. | [CI-04](omraden/08-toolchain-och-ci/aktiviteter/CI-04.md), bas e20fe6f143e447f805c63b75b328f39f48521ca3; separat från historikomskrivning. |
| F-20261031-02 | Oberoende Astra/high-granskning fann att F11-kriteriet kunde godkänna en fryst klientvy före 1012. Kriteriet är skärpt till löpande snapshots/versioner/dealerhändelser på båda instanserna under överlapp, därefter reconnect. | [GAM-01](omraden/04-spel-och-adaptrar/aktiviteter/GAM-01.md), mot återställningsguidens beskrivna grundfel. Ett P2-fynd åtgärdat; ingen produktkod ändrad. |

Nästa fynd skrivs med ID, datum, observation/reproduktion, full bas-SHA, berörda aktiviteter, bedömning och uttryckligt beslut. Ingen automatisk auktorisation följer av ett nytt fynd.

## Reviderad körplan 31 oktober

- B-006: Fables tre huvudfiler och sex briefs jämförda mot #722 och färsk main 394fbb02. KORPLAN-v2 blir enda aktiva körordning; äldre områdesfiler behålls som referenser. Färre samtidiga uppdrag, ingen branch-/worktree-/inboxstädning.
- B-007: Jakob beställer därefter uttryckligen plan-PR och merge samt genomförande med de tre uppstartade agentchattarna. Planmergen är godkänd. Tidigare särskilda spärrar för övriga merges och driftändringar kvarstår. Etapploggen mäter verifierade leveranser och skiljer dem från driftsättning.
- F-20261031-03: Pre-push-källan anropar enbart check-push-target.mjs. Mellanliggande nya Git-objekt har ingen motsvarande pushgrind; CI-04 går från misstanke till belagt kontrollgap. En framtida lösning får inte tyst hoppa över commits vid maxgräns/saknad bas.
- F-20261031-04: Fables F11-brief behöver instansbevis, verifierade SQL-namn och korrekt revisionskontinuitet. Två klienter utan instansidentitet räcker inte; roundRevision behöver inte vara konstant när legitima kommandon sker. DRIFTAGENTEN förbereder underlaget före någon mutation.
