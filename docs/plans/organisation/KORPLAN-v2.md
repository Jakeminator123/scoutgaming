# Körplan: återstående arbete

Uppdaterad 2 november 2026 mot `91b4e1888ea28c008b4ff25f827474a78f4f79db`.
Kvarvarande uppdrag och beslut samlas här. Migreringen och organisationsvågorna
R1–R5, S1–S6 och förenklingsvåg 2 är avslutade inom sina omfattningar;
Git och PR:er bär de avslutade leveransernas historik.
**Talet är pausat enligt Jakob.**

## Utgångsläge och mandat

- Kanonisk checkout är `C:/Users/jakob/dev/scoutgaming`; aktuell tilldelning avgör skrivare och samordnare. Tidigare agentuppdrag ger inget nytt skrivansvar.
- Jakobs fullmandat för nödvändiga merges och kontrollerade releaser består. Ägar-, head-, CI- och verifieringskraven i [AGENTS](../../../AGENTS.md) gäller. Äldre frågespärrar och städpauser är ersatta; egna verifierat mergade resurser städas enligt samma regler. Andras arbete, osäkra resurser och RunPod-endpoints rörs inte av dokument- eller kodstädningen.
- Inga produktmappar eller gamla implementationer är frysta. Bevara serverauktoritet, atomiska pengar, behörighet, bolags-/rumsisolering och aktiva publicerade mediereferenser. Data-/historikradering, repo-byte och betald drift följer sina konkreta uppdrag och återställningsunderlag.
- [F11-driftkvittot](F11-DRIFTKVITTO.md) styrker att kompatibla Render-releaser saknar den tidigare generella tomt-bord-spärren. Flaggbyte, publicering och övrig acceptans följer sina egna kriterier; driftprovet bevisar inte generell last, real-money eller ljud-/bildacceptans.

## Återstående områden och tydliga gränser

| Område | Kvar / beslut | Verifiering för ändringen |
| --- | --- | --- |
| Legacy/Astrid | Clip-policy-kedjan är borta; kvarvarande worker-/medierester bedöms efter faktisk användning. Gatewaydelen används i spelcontainern. | Följ konsumenterna, ersätt levande anrop och ta bort död kod med förbrukade prov. Astrid avvecklas enligt dataavsnittet nedan. |
| Material och Admin | Avgränsat blackjackmaterialbyte och atomisk bolagstilldelning är levererade. Sammanhållet ersätt-och-radera över flera beroende objekt återstår. | Scope, CAS, samtidighet, grannrummets utkast och låsta paketversioner ska hålla. Återställning får inte öppna rum eller aktivera tal. |
| Bolag, native och partner | Nyckel-/spelarbindning och kravhöjning återstår enligt avsnittet nedan. Extern partnerwallet är inte real-money-accepterad. | Prova faktisk behörighet, samtidighet och pengar för berörd ingång. Aktiva adaptrar är inte legacy på grund av sitt namn. |
| Lounge och vyer | Produktutveckling väljs mot aktuell main; opublicerade prototyputkast är andras arbetsmaterial. | Avgränsa ändringen och dess prov; en gammal prototypbranch är inget implementationsmandat. |
| Tal | **PAUSAT.** Talberoende öppning/avräkning har konservativ reservtid. [TALKEDJA](../TALKEDJA.md) samlar det pausade uppdraget. | Aktualitet, mute/distribution, bank/worker och ljud-/bildrutebundna medier prövas inom återupptaget taluppdrag. |
| Säkerhet och repo | Färsk säkerhetsstatus krävs före push/merge. GitGuardians historiska `too_large` ger ofullständig täckning. | Ny bred scan, synlighetsändring eller repo-byte har separat scope; de beställda [incidentunderlagen](../../incidents/2026-10-31-repository-history.md) finns kvar. |

Ett tidigare rapportfynd är en hypotes, ingen automatisk arbetsorder. Three-kärnan,
Provspel/gästpreview, aktiva register och importkällor har följts till konsumenter;
`lab_sessions` har en producent. Dessa avslutade bedömningar öppnar ingen ny
migrationsvåg. Hela produkten har inget uppmätt totalprocenttal.

## Bolagsbindning: kvarvarande leverans

Det varaktiga kontraktet finns i [Partner-API-guiden](../../games/partner-api.md#company-binding).
Kodbasen har fortfarande `deploymentOptional` för game-012 och game-014.
Admins `player-administration.mjs` och partner-API:ts skapväg skriver ännu inte
spelarens `operator_id`; `async-player-auth.mjs` har toleranta läsningar.
Detta är kodrestarbete, inte en ny databas- eller driftkontroll.

1. Läs aktuell game-ledger och readiness per miljö. `prepare-api-key-operator.mjs` och `prepare-player-operator.mjs` renderar SQL offline. 012:s preflight kräver tom nyckeltabell; radera inte aktiva nycklar för att få kontrollen grön. DDL följer mandat och [återställningsguiden](../../operations/ENVIRONMENT-RESTORATION.md).
2. När readiness tillåter: gör 012 obligatorisk, neka obundna nycklar/launch-token och avveckla förbrukade toleranta läsvägar. Följ `keys.list/create` och `allowLegacyPartnerSessions`. Bevara felkoder, rotation/återkallelse, låsordning och återvalidering vid samtidiga kommandon.
3. Bind spelaren till validerat aktivt bolag i varje skapväg: Admin, partner, registrering, personal-/Craig-koppling, `/api/player` och förhandsvisning. Partnerns spelarvy ska filtreras på sessionens bolag. Samma identitet behövs vid sida, socket, kommando, roulette och partner-API; saldo och transaktioner består.
4. Besluta verifierat reservbolag, globalt eller bolagsunikt inloggningsnamn och vilka vägar utan bolagskontext som ska stängas eller kräva bolag. Besluta även om spelarens bolag får ändras. `player_accounts.email` är global primärnyckel i dagens kontrakt. 014:s backfillförslag använder nyckelns bolag, senaste bolagsbundna bord och ett uttryckligt reservbolag; senaste bord är en heuristik, inte auktoritet. Visa aktuell NULL-fördelning före skrivning.
5. Leverera fungerande skapvägar före återstående migrering och kravhöjning: tolerant kod → godkänd migrering → obligatoriskt krav. `game-015` var ett planerat namn, ingen levererad migrering i denna bas. Ta bort toleranta grenar först efter readiness.
6. Prova isolerat en bunden partners hand med atomiska plånboksrader och nativebolagsisolering. Fel bolag, okänt rum, förfalskad claim, rotation och återkallelse ska nekas utan sessionsläcka, även vid återanslutning/samtidiga kommandon. Återpröva den gamla #538-rapportens skillnad mellan främmande och okänt rum mot dagens kod.

Befintliga relevanta prov: `test/storage/api-key-operator-migration.mjs`,
`test/access/studio-admin-accounts.mjs`, `test/access/partner-launch-route.mjs`,
`test/rooms/shared-room-access.mjs` och `test/rooms/shared-command-auth.mjs`.

## Data och medieavveckling

Följande avgränsning från Jakobs beslut 28 oktober består; en gammal inventering
är ingen aktuell kandidatlista:

- Behåll Johns Bet (`johns-bet`), `room-76640ca1-b619-7948-596e-3d102202b7d0`, Paow, rummets använda paket, konfigurationer och media samt de konton Jakob använder. Äldre paketrevisioner 1–11 och 53 klipp begränsar inte senare giltiga revisioner.
- Behåll talkedjan och Dragans dealer, talbank och bindningar som referens för generaliseringen. Genererade Paow-svar och Dragans talreferens får inte försvinna som bieffekt.
- Astrid, även märkt legacy-referens, ska tas bort helt. Avveckla konsumenter innan underlaget tas bort. Namnen `retained`/`legacy` är inget bevarandebeslut.
- Övriga bolag, rum, papperskorgsposter och oanvända medier är kandidater först efter aktuell konsumentinventering. Beslutet är inget generellt mandat att radera allt utom Johns Bet. Spelare, saldon, transaktioner och användbara taldata omfattas inte av vanlig mediestädning; ändra inga talflaggor som del av städningen.

Ordningen och de konkreta referenserna finns i [lagringsguiden](../../storage/BLOB-NEON.md#avveckling-av-produktdata-och-original).
En ny destruktiv åtgärd behöver avgränsad lista, frysta revisioner och verifierbart
återgångsunderlag i rätt miljö; ett daterat restoreprov räcker inte för nya data.
Återgång får inte automatiskt öppna rum eller slå på tal.

## Överlämning

Ändra berört restarbete här och sakguiden när kontraktet ändras. [NEXT-AGENT](../../NEXT-AGENT.md)
bär aktuell överlämning; PR:en bär ändringens granskning och kod-/CI-bevis.
Ange full SHA och verklig verifiering. Skilj kod, deploy och produktacceptans.
Daterade etappkvitton och beslut finns i Git; F11 behåller sitt
separata bevis eftersom ett aktuellt releasebeslut använder det.
