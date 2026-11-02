# Nästa agent

Aktuellt arbetsläge 2 november 2026, granskat mot `91b4e1888ea28c008b4ff25f827474a78f4f79db`.
Kanonisk checkout: `C:/Users/jakob/dev/scoutgaming`. Börja i [START-HERE](../START-HERE.md)
och [AGENTS](../AGENTS.md); kontrollera färsk branch, HEAD och uppdragsägare.
En daterad uppgift här är inte aktuell molnacceptans.

## Pågående arbete

Testerna grupperas efter funktion och dokumentationen kortas i en gemensam
integration. Samordnaren äger PR, granskning och CI. Aktuell privat överlämning
och flyttmanifest finns i `.cache/test-folders-completion-1102/`; respektive
worktrees uppdrag registreras enligt [IDE-guiden](../START-HERE.md#byta-ide-eller-återuppta-arbete).
Ta bort detta avsnitt när integrationen avslutas; skriv ingen leveranslogg här.

## Verkligt restarbete

| Område | Kvar och nästa underlag |
| --- | --- |
| Mappstruktur | Efter test-/dokumentintegrationen återstår funktionsgranskning av Studios `lib`, Admins `lib`, `components`, `services/game`, delade `contracts` och `tools`. Avsiktliga publika ingångar får ligga kvar; följ konsumenter och beteenden innan andra filer grupperas. Denna integration avslutar inte hela mappbeställningen. |
| Tal och Jakob-2 | **Pausat enligt Jakob.** Ingen GPU-, bank- eller talaktivering ingår. Egen verifierad GPU-bank, genererad läppsynk och full distribution/`assertCurrent` för delat bord återstår; faktisk RunPod-användning/GPU-runtime saknar ny acceptans. `/studio-preview` har AI/tal av. Se [TALKEDJA](plans/TALKEDJA.md) och [RunPod-underlaget](media/TALKEDJA-RUNPOD.md); konton och endpointägarskap måste verifieras före byte. |
| Bolagsbindning | Game-012/014 och samtliga skap-/startvägar är ännu inte fullt kravhöjda. [Körplanen](plans/organisation/KORPLAN-v2.md#bolagsbindning-kvarvarande-leverans) bär ordning och beslut; [Partner-API](games/partner-api.md#company-binding) bär kontraktet. Extern partnerwallet saknar real-money-acceptans. |
| Data och media | Astrids produktionsdata och startsidemedier är inte avvecklade. Labbchattens kod är borta, men dess lagrade data återstår enligt [AI-guiden](AI/README.md#avvecklad-labbchatt). Följ [avgränsningen](plans/organisation/KORPLAN-v2.md#data-och-medieavveckling) och [lagringsguiden](storage/BLOB-NEON.md#avveckling-av-produktdata-och-original), med aktuella referenser och verifierad återgång. |
| Materialersättning | Avgränsat materialbyte för ett blackjackbord och atomisk bolagstilldelning är levererade. Ett sammanhållet ersätt-och-radera-flöde över flera beroende objekt återstår. Låsta rums paketrevisioner behövs tills referenserna ersatts atomiskt. |
| Dragan-test | Rummet saknar publicerad spelkonfiguration (`room_config_missing`) i det tidigare isolerade klonprovet. Öppna det inte med en gissad standardkonfiguration; kontrollera aktuell rumsrevision inom ett nytt avgränsat uppdrag. |
| OpenClaw/Slack | `files:read` och ominstallation är godkända men inte utförda; tidigare browseranslutning blockerade arbetet. Koppling till samtliga spelares namn/utbetalningar är inte verifierad. Privat underlag: `.cache/agent-tva-openclaw/REPORT.md`. |
| Säkerhet och repo | Noll öppna GitGuardian-incidenter vid föregående läsning bevisar inte historisk täckning: skanningen stod som `too_large`. Läs färsk status före push/merge. [Historikmätning](incidents/2026-10-31-repository-history.md) och [övergångsplan](incidents/2026-10-31-clean-repository-plan.md) är separat beslutsunderlag; inget repo-byte är genomfört. |
| Databasbehörighet | Ett äldre fynd om skrivrättigheter för `READONLY_USE` behöver återkontrolleras i ett separat behörighetsuppdrag. Det är inte verifierad aktuell rollstatus; inga nycklar eller rättigheter har ändrats av dokumentarbetet. |
| Lounge/prototyper | `local-test/bordmall` och `local-test/lounge` under `C:/Users/jakob/dev/worktrees/scoutgaming/` är bevarade. Loungen hade ocommittade Admin-ändringar vid överlämningen. Kontrollera aktuell ägare/status och uppdragets README före återanvändning; merga inte en gammal prototypbranch som hel produkt. |

## Aktiva gränser

- [F11-kvittot](plans/organisation/F11-DRIFTKVITTO.md) verifierar överlapp och återanslutning på `e8d0b935`. Kompatibla releaser har ingen generell F11-spärr; flaggbyte och publicering följer egna tomt-bord-villkor. Det är inte generell last-, real-money- eller AV-acceptans.
- Native-, partner- och Provspelsadaptrar har aktiva konsumenter. `game-013` är separat schemaefterregistrering, inte bevis på saknade pengaposter. Se [spelbackendens gräns](../services/game/README.md#vad-som-får-ändras).
- Sakguider finns i [dokumentindexet](README.md), testgrupper i [testguiden](../test/README.md) och kod-/provrelationer i [Atlas-guiden](../tools/system-map/README.md). Aktuell körordning finns i [körplanen](plans/organisation/KORPLAN-v2.md).
- Uppdatera bara aktuellt restarbete och nästa steg här. Avslutade leveranser, fulla SHA:n och kod-/CI-bevis hör till PR/Git; behåll särskilda driftbevis endast medan ett aktivt beslut behöver dem.
