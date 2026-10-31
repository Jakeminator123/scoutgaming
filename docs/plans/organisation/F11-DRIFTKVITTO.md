# F11: verifierat driftprov och beslut

Kvitterat 31 oktober 2026 av MERGEAGENTEN efter oberoende granskning med Astra/high och ett eget återprov mot Render-loggarna. Detta är ett avgränsat driftkvitto; [KORPLAN-v2](KORPLAN-v2.md) bär aktivitetsstatus.

## Beslut och gräns

F11:s uteblivna uppdateringar på den gamla instansen är driftverifierade i isolerad preview på runtime `e8d0b935fd33b7e625f157788033359085d16f96`. Den tidigare generella F11-spärren med tomma bord före en kod- och schemakompatibel Render-release hävs inom Jakobs fullmandat. Bedöm fortfarande kompatibilitet och återgång för varje release; kvittot godkänner inte godtyckliga framtida ändringar.

Tomma bord krävs fortfarande vid byte av shared-table-flagga och där publicerings-/konfigurationskontraktet kräver det. Inga sådana kontrakt, spelregler eller envvärden har ändrats. Ändrad observation, avstängning eller återanslutning kräver relevanta omprov.

Provet omfattar två syntetiska spelare och tre rundor. Det styrker inte generell produktionslast, real-money-acceptans eller mänsklig bedömning av bild, tal och läppsynk.

## Exakt körning

- RunId: `f11-1031-064402-4c69`, 06:06:49.415–06:11:41.695 UTC.
- Preview: `preview.scoutgaming.tech`; Neon `red-violet-36066351` / `br-plain-voice-b9yu49xi` / `croupier_staging`.
- Render `srv-dbf61l0m7kps73ft7mk0`: `dep-dbinum6417fc73a59h40` → `dep-dbiob649v7es7385p7u0`, båda exakt runtime-SHA ovan.
- Vercel-preview `prj_7dgyvW5zakx1qJ8YaH5pueVTVi14`, `dpl_9iiTaeuJ9PkfohHD3bdujhksX4Ua`, READY på samma SHA.
- Driver/validator från main `20f14a316ff96c87706fa764075b5aae37e4a57e` (#735). Den kördes via en privat startfil med statiska imports av samma granskade moduler. Den direkta CLI-vägens importcykel rättades separat i #736 (head 03de02d219cf4a50b11a061ff660617f22010d2b, merge 73cc59d58c6549acd6991a09c94690d66156c045); inga valideringsregler ändrades i startfilen.
- Endast ett nytt eget bolag, ett rum och två demokonton skapades via produktens API. Befintligt registrerat material återanvändes. Förkontroll visade att identiteterna saknades; efterläsning band rum, paketrevision, konfiguration och konton till skapandekvittot. Befintliga projekt-/administrationsdokument och andra bolags paket var oförändrade.

## Verifiering

| Kontroll | Verkligt resultat |
| --- | --- |
| Två instanser | Socketnonce/process-ID matchar ursprungliga Render-apploggar och respektive provider-instance-label. Kall granskare hämtade loggarna igen. |
| Offentlig servergräns | Gamla gatewayens listener 2 gick till drain 06:10:51.750Z. Samma fulla instans/runtime/listener är bunden till offentlig listening; startupens loopback räknas inte. |
| Överlapp | 168 998 ms, 27 frames: 13 gamla + 14 nya. Båda visar nya revisioner och dealerhändelser; inga konflikter i gemensamt tillstånd/presentation. |
| SQL-täckning | 81 läsningar under överlappet. Största observationsglapp 3 234 ms, längsta läsning 874 ms, sista observationens start 1 703 ms före drain. Revisionerna går framåt och stämmer mot socketarna. |
| Återanslutning | Gammal klient fick 1012, 9 297 ms efter verifierad drain. Ny anslutning efter 471 ms: samma roundId, version 23→28 och presentation 12→14; rundan hinner avslutas. |
| Pengar | 6 insatsdebiteringar, 3 utbetalningar, 6 settlementposter, totalt 11 ledgerposter inklusive 2 öppningsposter. Alla fångade saldon stämmer. Slutsaldon 99 900/100 150 cent; inga dubbla effektidentiteter. |
| Negativa prov | Fel rum och återkallad session gav båda 403 och 0 tillståndsframes. |
| Normal avslutning | Båda medlemskapen inaktiva och sätena tomma före logout; 0 reservationer/0 händer. Inga manuella penga-/DB-rättningar. |
| Oberoende efterkontroll | Neon MCP 06:12:42.944Z: hela preview hade 0 aktiva medlemmar, aktuell närvaro, reservationer och händer. Eget rum hade 0 aktiva/ägda säten; 0 saldo-ledger-avvikelser och 0 dubbla effektkeys. |

## Bevis och återanvändning

Privata, gitignorerade råbevis finns på Jakobs dator i `C:/Users/jakob/dev/scoutgaming/.cache/f11-1031/f11-1031-064402-4c69/`; providerfilen ligger bredvid som `f11-1031-064402-4c69-provider.ndjson`. Bevisen innehåller syntetiska observationer, inga lösenord eller cookies. De egna inaktiva fixturerna behålls för granskning; inget konto, paket eller medium raderades.

| Fil | SHA-256 |
| --- | --- |
| manifest.json | `2385fde502db968ff509a23071088ab33d82732a285e9be990e8b0e219b57d5c` |
| capture.ndjson | `dce67c0204f564b43b5ea9e52ef8fe4719ccd1132be129c2d414a55f177bc8bf` |
| ownership.json | `23d9386698de4a54975c626c8b07e0361530fe50bcfc34eff5bee0c17fb1a3ef` |
| provider.ndjson | `30860a71565ab9a91b348c0e583081029db33f6306d4315fb95678a551d9656f` |

`review.json` förblir oförändrad: `evidence-complete-review-required`, `acceptance:false`. Verktyget ger aldrig självt driftacceptans; beslutet ovan bygger på faktisk körning, egen SQL-efterkontroll och oberoende proveniensgranskning. Första körningen `f11-1031-061659-e276` förblir underkänd som bevis och accepteras inte retroaktivt.
