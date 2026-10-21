# Kevin: spelmodulen K01–K07

**Leveransmål:** de valda Kevin-beteendena kör som en avgränsad spelmodul på mains plattform och styrs av publicerad Admin-konfiguration. Ingen helmerge av Kevins plattform ingår.

- Ägare: Kevin eller hans uttryckligen utsedda implementerare. Samma instruktioner gäller i Claude Code och Codex, oberoende av Slack-klient.
- Beroenden och utförandestatus ägs av [status.json](../status.json). Varje godkänd aktivitet ger 5 procentenheter av hela planen; K01–K07 omfattar 35 procentenheter. Checklistorna här är acceptanskriterier, ingen separat statusräknare.
- Gemensamma kontrakt och integration ägs av O01–O03 i [masterplanen](../MASTERPLAN.md). J07 äger Postgres-adapter, transaktioner och lås; J08 äger Admin-konfigurationen.
- Planfilen ger inte tillstånd till produktionsmigrering, molnändring eller merge. Kevins långlivade branch behåller sitt ägarskap; GitHub-identitet ska verifieras, inte antas från namn eller `github: null` i personregistret.

## Fryst källunderlag och läsgräns

| Beteckning | Källa och omfattning |
| --- | --- |
| K | [kevin-merge-admin vid 5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc](https://github.com/Jakeminator123/scoutgaming/tree/5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc/kevin/croupier-scoutgg); alla K-sökvägar nedan är relativa till `kevin/croupier-scoutgg/` |
| M | Main vid `15988f32fd572c453d2189502acbe324c4566815`; M-sökvägar är relativa till reporoten |
| Historik | `kevin-staging` är äldre analysunderlag, inte portningskälla. Mappnamnet `kevin-ks-migrering` ändrar inte detta. |

Verifierat genom avgränsad kodläsning 21 oktober 2026:

- K `vendor/croupier/shoe-game.mjs` skiljer regler från servern men skapar sko-ID via `crypto.randomUUID()` och anropar shuffle; `shoe-proof.mjs` skapar nonce via `randomBytes`. Reproducerbarhet kräver uttryckliga slump-/ID-indata. Proof-koden verifierar inspelad sko, inte oberoende RNG-certifiering.
- K `server/shared-table.mjs` importerar SQLite, transaktioner, backoffice, spelhändelser och lipsync. `createSharedTable` blandar databas, saldo, bordstider, manifest och videoplan; detta är ett utgångsmaterial för uppdelning.
- K `server/studio-tables.mjs` har filbaserad JSON-sparning och val för dealer, rum, språk, filt, insatsprofil, logotyp och layout. Valen är referensbeteenden, inte en ny auktoritativ datakälla.
- M `services/game/public/card-presentation/README.md` beskriver redan portad buffring/förladdning i `verified-video-buffer.mjs` och `performance-player.mjs`. Dessa ska jämföras och återanvändas.

K01-inventeringen ovan omfattar ingen spelkörning, visuell acceptans eller full medieinventering. Senare isolerade kontraktsprov redovisas separat nedan. Commitens uppgift om borttagna oanvända V1-klipp ska verifieras i K01; den bevisar inte att branchen saknar kvarvarande media eller plattformskopplingar.

## K01 — Inventera den rensade Kevin-modulen

**Verifierad inventering:** 21 oktober 2026, [PR #314](https://github.com/Jakeminator123/scoutgaming/pull/314), 7f42c8f6d39f929d30c1b5fcec7a52c114e6ce33. Oberoende kod-/dokumentgranskning; körningsresultat förblir tillskrivna Kevin. Status och procent beräknas endast i status.json. Ingen runtime- eller importacceptans.

**Etapp/beroenden:** E1; inga. Levererar underlag till O01.
**Mål:** en provbar urvalslista där varje beteende har ägare, kontraktsgräns, konsument och acceptanstest.
**Startfiler:** K `server/shared-table.mjs`, `server/studio-tables.mjs`, `server/media-registry.mjs`, `vendor/croupier/shoe-game.mjs`, `public/game-presentation.js`, `public/idle-chain.js`, `test/shared-table.test.mjs`; M `services/game/shoe-game.mjs` och `services/game/public/card-presentation/README.md`.

- [x] Frys käll-SHA och inventera regler, platser, countdown, återanslutning, idempotens, tal/idle, kort och responsivitet. Prioritera delat bord, moving lipsync och idleklipp enligt Kevins DM-uppgifter; verifiera dem i K01/O01 och märk oprövade förbättringar som kandidater.
- [x] Följ varje kandidat till SQL, filer, auth, wallet, media, timers och externa tjänster. Kartlägg `createSharedTable`-callbackarna `talk`, `readyFor`, `onPlan` och `winners`, samt gränsen mellan `vendor/croupier/shoe-game.mjs` och `public/game-events.js`. Föreslå kommando-, händelse-, lagrings- och presentationsportar till O01; nuvarande callbackar bevisar inte färdig separation.
- [x] Inventera mediereferenser och borttagna V1-poster via spårade manifest/metadata och ändringslista. Notera kvarvarande referenser, okänd identitet och saknade filer; ladda inte ned binärmassor för inventeringen.
- [x] Klassificera varje del: porta, återanvänd från main, ersätt/radera eller utred. Bevara mains konto/rum/auth, Neon/Blob, Render och OpenClaw; jämför redan portade preloads innan ny kod planeras.

**Raderas/importeras inte:** inga produktfiler i K01; markera Kevins SQLite-/JSON-register, demoidentiteter, egen wallet, alternativa backoffice/serverstarter och bortvalda V1-media som ej avsedda för import. Specificera undantag som O01 måste avgöra.
**Klart när:** O01 har en komplett avgränsad urvals- och beroendematris med testbara krav och öppna frågor; en kodläsning får inte anges som ett godkänt runtimeprov.
**Verifiering/bevis:** matrisrader `beteende → K-fil:rad → M-konsument → beslut → kontrakt → testfall`; bifoga frysta SHA, lästa metadata, fullständighet/luckor och eventuell befintlig testutskrift med miljö. Lägg besluten i befintlig kanonisk dokumentation, med länk i status.json.

Kompletterande medieinventering53f6693610acc44fb45295da76a67d940a989125 gäller staging238d6dd6/worker, inte fryst5aa7ed10. Dess storlekar, tagningar och borttagningsförslag är rapporterade; ingen import/radering godkänd. Rotens repliker och Astrid-fallback har däremot kodverifierats även på fryst5aa7ed10. K04 behöver versions-/hashmappning och återställningsberoenden före urval.

## O01 — faktiskt körda isolerade kontraktsprov, 21 oktober

plan_review körde K02 på `0493af3ec15f2c379e0172aa8d0bdfea1ff3c8a1` och K03 på `b8e1c957c99c5a16ee861f9767ec28041b2270dd`: **13/13 + 30/30**, samt **1/1** avgränsat språkprov; alla exit0, inga skips. Volta Node24.21.0 uppfyller frysta engines (game>=22.16; Studio24.x/pin24.21.0), max4 workers. Endast provens modulslutning hämtades från GitHub; samtliga24 filer verifierades bytevis mot källornas Git-blobhashar. Inga installationer eller produktändringar.

| O01-gräns | Faktiskt prov på fryst källa |
| --- | --- |
| Regler, saldoeffekter, dolda kort och proof | `test/blackjack-core.mjs:91,114,155,211,232,264,327`: giltigt/ogiltigt drag, reserverad/fri finansiering, exakt en avräkning, dolt kort, skoövergång och manipulerat proof |
| Determinism och explicit slump | Samma fil:288,305,359: `same explicit inputs reproduce outcome and public events`, ambient slump spärrad och jämförelse mot byteverifierad Kevin-fixtur |
| Replay utan extra effekter och stabil identitet | `test/blackjack-table.mjs:104,140,187,201,512,528,585,599`: samtidiga dubletter över deadline, lagrat resultat, inga nya tick/auditrader, fönster/runda/tur/medlemskap, spelarunik frånvarotick och rumsscoperad ledger |
| Blockering, paus och rollback | Samma fil:214,244,281,298,343,382,424,558,609,639: stake/insurance, ändringsstyrd retry, bindande ja, sen paus/replay, medlemsrace, clear och injicerade wallet-/auditfel |
| Konfigurationsfrysning och språk | Samma fil:651 fryser limits till nästa fönster. `o01-language.test.mjs` provar en→sv via verklig outboxpayload: spelarinput vid join och language-op ändrar inte bordsspråket; snapshot skriver inget; gammal version består över koordinatorrekonstruktion; nästa fönster använder sv för båda spelarna |
| Outbox och återläsning | Samma fil:161,447,475: rekonstruerad snapshot/deadline, nekad leverans utan ny debitering, samma talkId/ver vid återleverans, äldre version avvisas och identisk accepterad version appliceras inte igen |

**Reproduktion/bevis:** i primary `C:\Users\jakem\Projects\croupier\arkiv\2026-10-21\o01-contract-verification` finns `source-manifest.json`, `source-verification.log`, `k02.log`, `k03.log`, `language.log` och det kompletterande språkprovet. Kör `node --test --test-concurrency=4 --test-reporter=tap test/blackjack-core.mjs` från `k02/`, motsvarande `test/blackjack-table.mjs` från `k03/`, samt `o01-language.test.mjs` från bevisroten. Språkfixturens två första körningar saknade insats/ready för båda sittande spelare; bara fixturen rättades och felloggarna behölls.

**Bevisgräns:** referensadaptern använder en global minnesmutex och omstart betyder ny koordinator med samma minnesstore. Ingen processkrasch, PG-durabilitet/flerprocesslås, faktisk mottagarpersistens, Adminvalidator/publicerings-UI, HTTP-auth eller media har verifierats. Det nya språkprovet ligger i privat bevisarkiv, inte i CI. O01 fick spårbara kontraktsbevis. K02/K03 har därefter fullacceptans enligt avsnitten nedan och J07 har separat verifierats mot riktig PostgreSQL. J08:s publicerings-/materialacceptans återstår; detta ändrar inte bevisgränsen för det tidigare O01-provet.

## K02 — Ren regelkärna med explicit slump

**VERIFIED som isolerad regelmodul:** [PR325](https://github.com/Jakeminator123/scoutgaming/pull/325), `codex/kevin-k02-regelkarna / 0493af3ec15f2c379e0172aa8d0bdfea1ff3c8a1`. kevin_plan har slutgranskat samtliga fyra kriterier och återverifierat12/12 källblobbar; tidigare självständiga13/13,0skip återanvänds. Root har läst kärna, säker slumpadapter och bevis. CI39660600012 success på exakt head återverifierad. Inga blockerande fynd. Finansieringsfynd stängda: start/insurance använder reservation, double/split fri available. Ingen runtimeinkoppling, merge, drift- eller RNG-certifiering; J07 äger nästa integration.

**Etapp/beroenden:** E3; O01.
**Mål:** samma tillstånd, kommando, konfiguration och explicita slump-/tid-/ID-indata ger samma resultat och spelhändelser.
**Startfiler:** K `vendor/croupier/shoe-game.mjs`, `vendor/croupier/public/blackjack.mjs`, `vendor/croupier/shoe-proof.mjs`, `server/game-audit.mjs`, `test/croupier-shoe.test.mjs`; M `services/game/shoe-game.mjs`, `services/game/public/blackjack.mjs`, `packages/shared/blackjack-shoe-rules.mjs`, `test/shoe-game.mjs`.

- [x] Porta endast O01:s godkända regelbeteenden och sko-/auditdata. Definiera validerade kommandon, fel, tillståndsversion, spelhändelser och publik vy; dölj skoordning, burn och ännu dolda kort.
- [x] Flytta slump, UUID och eventuell tid till uttryckliga indataportar. Produktionsadaptern ska behålla säker slump; reproducerbara testsekvenser får aldrig bli produktionsfallback.
- [x] Låt kärnan returnera nödvändiga ekonomiska effekter till koordinatorn; kärnan äger inget saldo och anropar ingen wallet. I denna migrering utför J07:s separata demoadapter effekterna i den serverägda transaktionen. Klientens saldo, kort, regler eller insatsgränser får inte bli betrodda indata.
- [x] Behåll sko, cut/burn, försäkring, split/double, sidospel och avräkning enligt O01. Bevara shoe proof commit/reveal: bind öppningscommitment till exakt sko/runda, exponera fullständigt bevis först efter godkänd skostängning och verifiera draws/återstående kort. Dokumentera regelskillnader; framtida kort får inte läcka.

**Raderas/importeras inte:** SQL, filåtkomst, HTTP/WS, UI, videoval, lipsync och interna timers i kärnan; duplicerad gammal regelimplementation först när alla konsumenter använder den verifierade ersättningen.
**Klart när:** kärnan kör isolerat utan lagring/nätverk; samma explicita indata reproducerar utfallet och motsvarande offentliga händelser. Produktionsslumpen är oförsvagad.
**Verifiering/bevis:** regeltester för giltiga/ogiltiga drag, saldogräns, dolt kort, skoövergång och exakt en avräkning; reproduktion med samma indata och variation med annan slump. Prova commitment före första draw, ingen förtida reveal samt att ändrad nonce, draw eller återstående sko underkänns. Ange testnamn, kommandon, exitkod, SHA och kontraktsversion; kalla inte detta RNG-certifiering.

## K03 — Delat bord utan SQL- och videokoppling

**VERIFIED som isolerad bordstjänst:** [PR327](https://github.com/Jakeminator123/scoutgaming/pull/327), `codex/kevin-k03-bord / b8e1c957c99c5a16ee861f9767ec28041b2270dd`. plan_review har slutgranskat samtliga fem kriterier, återverifierat12/12 källblobbar och återanvänt självständiga30/30+1/1 språkprov. Ett nytt1/1 debit-replayprov på Node24.21.0 täcker settlement → nytt fönster → rekonstruktion utan nya effekter; ändrad fingerprint avvisas. Root har granskat portar, relevant kod, prov och logg. Inga blockerande fynd. K02/O01 är VERIFIED. GitGuardian success; ingen K03-Actions-körning finns eftersom PR-bas är K02 medan workflowet bara triggar mot main. Samlad integrations-CI och faktisk PG-/flerprocess-/kraschpersistens hör till J07/K07, beständig mottagare till J07/K04. Ingen runtimeinkoppling eller merge.

**Etapp/beroenden:** E3; K02. Lagringskontraktet överlämnas till J07.
**Mål:** servern samordnar rum, spelare, platser, deadlines och återanslutning genom O01:s portar. Jakobs beslut: demo först med förberedd aggregatorgräns. WalletPort binds av J07 till mains demowallet; faktisk extern walletintegration är en senare leverans.
**Startfiler:** K `server/shared-table.mjs`, `server/transactions.mjs`, `server/game-audit.mjs`, `public/shared-table.js`, `public/round-clock.js`, `test/shared-table.test.mjs`; M `packages/storage/server/postgres-store.mjs` läses som J07:s integrationsgräns.

- [x] Separera bordets tillståndsövergångar från SQL, auth, saldoimplementation, manifest och lipsync. Använd mains verifierade spelar-/rumskontext och versionsbundna konfiguration.
- [x] Håll walletportens kontrakt skilt från saldoimplementation och HTTP. Föreskriv inte att en framtida aggregator delar Postgres-rollback; dess osäkra svar och avstämning kräver separat verifierat API-kontrakt. Ingen extern adapter aktiveras i denna aktivitet.
- [x] Definiera port för atomisk läsning/ändring av rum, berörda spelare, sko, kvitto och kommandonyckel; J07 implementerar Postgres-transaktion/lås. Ingen lokal SQLite-fallback i drift.
- [x] Gör countdown och timeout serverägda med explicit klocka och beständiga deadlines. Lås O01:s policy för återanslutning, tom plats, avhopp, sena kommandon och samtidiga beslut.
- [x] Definiera varaktig idempotens, versionskonflikt och snapshot/händelsesekvens. Samma nyckel med annat innehåll avvisas; replay efter annan åtgärd eller omstart får inte debitera på nytt.

**Raderas/importeras inte:** `DatabaseSync`/DDL, filregister, lokal demo-wallet/refillimplementation och tokenidentitet, hårdkodade media-URL:er och lipsyncanrop ur bordstjänsten. K03:s idempotenta refillkommando genom mains walletport ingår enligt O01; den gamla lokala saldoimplementationen importeras inte. Behåll nödvändiga tidsregler som uttryckliga serverregler, inte som klient- eller videokvittens.
**Klart när:** bordstjänsten klarar kontraktstester mot en isolerad adapter och lämnar ett entydigt avtal för J07; mediefel kan inte ändra utfall eller skapa en ny debitering.
**Verifiering/bevis:** två spelare/två rum, samtidiga platsanspråk, sena/dubbla kommandon, frånkoppling och rekonstruerad snapshot/deadline. Redovisa händelsesekvens, versioner och förväntad ledger utan persondata; verklig Postgres-atomicitet verifieras av J07 och samprovas i K07.

Kompletterande K03-bevis: primary `arkiv/2026-10-21/o01-contract-verification/k03-acceptance-replay.test.mjs` och `.log`; `node --test --test-concurrency=4 --test-reporter=tap k03-acceptance-replay.test.mjs`,1/1,exit0. Rekonstruktionen återanvänder minnesstore och bevisar inte process-/PG-beständighet.

## K04 — Spelklient och presentation från händelser

**IN_PROGRESS 22 oktober:** aktuell PR333/headd226f53370e4355267d8875bc9168e91357f41ba är oberoende läsgranskad mot9e62923be61d203640276f1f28a37eb65e0d2200. PG-read-fyndet i6328762858 är stängt i kodläsning: assertInstalled/lastAccepted/current använder begränsade transaktioner; ingen egen PG-körning påstås. Två presentationsfynd kvarstår och är återkopplade i6329131459: äldre aldrig ritad munpatch A godtas efter end(B), och samma serverstyrda idle-entry återupptas inte efter avbrott. Root körde Node24.21-repro open(A), open(B), offer(B), end(B), sen offer(A): accepted=true och [B,null,A-late]. Materialplaneringsproducenten finns nu och binder dealer/språk, exakta metadata-/mediehashar och leadMs/cardMs till revision; fem metadatafixturer matchar fryst5aa7ed10 på Gitblobnivå. Bindning till mains Neon/Blob-identiteter och publicerade paket återstår för J08; inga fixturetider får ersätta den. Kevinrapporterade testresultat är skilda från egna kodläsningar och roots reproduktion. Ingen full K04-, visuell/lipsync-/PG-runtimeacceptans eller ny färdigbock.

**Etapp/beroenden:** E3; K03 och J07.
**Mål:** utvalda förbättringar av idle, tal, kort och layout återger committade spelhändelser utan att styra spelutfallet.
**Startfiler:** K `public/shared-table.js`, `public/game-events.js`, `public/game-presentation.js`, `public/game-cards.js`, `public/idle-chain.js`, `public/dealer-layer.js`, `public/lip-layer.js`, `public/table-layout.js`, `public/phone-dock-fit.js`; M `services/game/public/performance-player.mjs`, `services/game/public/verified-video-buffer.mjs`, `packages/presentation/runtime/`.

- [ ] Mappa O01:s offentliga händelser till befintliga presentationskontrakt och publicerat paket. Kort avslöjas först av committad serverhändelse; klienten gissar inte nästa kort eller handlingsrätt.
- [ ] Porta accepterad lugn idle, moving lipsync, övergångar, tal och kortplacering. Prova tal under idle, vänteläge och kortövergång samt när lipsyncworker saknas eller svarar sent. Bevara exakt dealer-/källframe-/audio-/bankkoppling; ingen fristående munanimation eller återdebitering vid återställning.
- [ ] Återanvänd verifierad buffring och förladdning. Lägg till kod endast för ett dokumenterat gap; skilj spelhändelse, presentationstid och klientens laddningsfel.
- [ ] Kontrollera pekare/touch, tangentbord, läsbara fel och relevant mobil-/datorlayout. Definiera beteendet vid saknat media, avbrutet tal, långsam laddning och återanslutning.

**Raderas/importeras inte:** alternativ klientägd spelmotor, hårdkodade dealer-/rumregister, egna wallet-anrop, duplicerade preloadspår och ersatta renderare med deras enda layouttester. Radera först efter konsumentkontroll.
**Klart när:** O01:s valda UI-beteenden fungerar genom J07-adaptern; laddning, talfel och replay påverkar inte serverns saldo, sko eller utfall.
**Verifiering/bevis:** isolerat flöde insats → utdelning → beslut → resultat → återanslutning på mobil och dator; skärmbild per kontrollerad övergång, händelse-ID/configversion och korta observationer. Hashar och tester redovisas separat från faktisk visuell granskning/lipsyncacceptans.

## K05 — Exakt mediakoppling till Neon och Blob

**Etapp/beroenden:** E4; K01 och K04.
**Mål:** varje accepterat mediaobjekt har exakt identitet och koppling till befintligt register, Blob-objekt och publicerat paket.
**Startfiler:** K `server/media-registry.mjs`, `public/dealers.js`, `public/runtime-event-links.js`, `public/media_omkodad_crf20_2026-09-25/manifest.json`; M `packages/presentation/contracts/material-catalog.mjs`, `packages/presentation/server/package-rooms.mjs`, `docs/LOCAL-PRESENTATION-RUNTIME.md`.

- [ ] Slutför K01:s urval med dealer, händelse, språk, take, exakt SHA-256, källa, ljud/video/frameindex/kalibrering och befintlig acceptans. Okända eller ändrade hashar förblir oaccepterade.
- [ ] Mappa varje post till befintligt Neon-ID/Blob-objekt eller en uttryckligt planerad ny post. Skilj design-ID, uppladdad layer-UUID, dealer, rum och fryst paket; ingen namn- eller längdmatchning som identitetsbevis.
- [ ] Prova manifestvalidering och paketupplösning isolerat; avvisa saknad/mismatched identitet och bortvalda V1-referenser. Bevara historiskt refererade main-media och Astrids märkta legacyreferens.
- [ ] Leverera granskbar registrerings-/importordning till plattformsägaren. Eventuell faktisk molnimport kräver rätt auktorisation och separat kvitto; planen eller Kevins meddelande godkänner den inte.

**Raderas/importeras inte:** bortvalda V1-klipp, oregistrerade träningskopior, parallella lokala produktkataloger och ungefärligt matchade ersättningar. Ingen generell radering av historiska main-media.
**Klart när:** samtliga valda runtimeposter löses till exakt accepterat material; avvisade/okända poster kan inte väljas. Visuell acceptans gäller endast oförändrade godkända bytes och sammanhang.
**Verifiering/bevis:** manifestmatris `käll-SHA/sökväg → hash → Neon-ID → Blob-identitet → paket/händelse → acceptans`; valideringsresultat och negativa fall. Registreringsbevis, mediehämtning och visuell granskning hålls åtskilda.

## K06 — Verifiera Admin till spel efter omstart

**Etapp/beroenden:** E4; J08 och K05.
**Mål:** bevisa att varje överenskommen Admin-inställning når rätt spelversion genom sparning, publicering, launch och omstart.
**Startfiler:** K `server/studio-tables.mjs`, `server/shared-table.mjs`, `public/shared-table.js` som beteendereferenser; M `apps/studio/lib/presentation-room-api.mjs`, `packages/presentation/contracts/operator-rooms-contract.mjs`, `packages/presentation/server/package-rooms.mjs` samt J08:s faktiska Admin-writer och versionskontrakt.

- [ ] Skapa en testmatris från O01: insatsgränser/chips, deadlines, dealer, tal/idle, språk och tillåtna utseendeval som faktiskt ingår. Varje fält får skrivmål, publiceringspunkt, läsväg och observerbart spelresultat.
- [ ] Prova spara → återläs → publicera → lobby → auktoriserad launch → ny session → serveromstart → återläsning, i isolerad miljö. Visa rätt rum, paket och configversion i varje led.
- [ ] Prova O01:s policy för en redan aktiv hand/session: ändringar blir aldrig halvt tillämpade. Rumsutseende skrivs genom scoped `roomOverrides`; ett valt rum får inte ändra delad mall av misstag.
- [ ] Avvisa fel roll/ägare/rum, gammal revision, ogiltiga värden och media från fel paket. Förfalskade klientval får inte överstyra serverns regler eller publiceringsbeslut.

**Raderas/importeras inte:** Kevins JSON-bordsregister, egna backoffice-sidor, klientlagrade auktoritativa inställningar och defaults som döljer ett saknat publicerat värde. J08 äger nödvändiga Admin-kodändringar.
**Klart när:** varje godkänt fält har ett positivt flödesbevis och relevant negativt test; omstart behåller rätt tillstånd/version utan lokal produktfallback.
**Verifiering/bevis:** tabell `Admin-fält → writer → lagrad revision → publicerat paket → runtimevärde → effekt efter omstart`; skärmbilder för flödets kontrollerade steg, API-resultat och serverbevis utan hemligheter. Brister lämnas som blockerare till J08 eller berörd K-aktivitet.

## K07 — Verifiera spelbeteenden och samtidighet

**Etapp/beroenden:** E5; K04 och K06. Levererar till O02; den ersätter inte O02:s oberoende samprov.
**Mål:** den integrerade porten har verifierad regel-/saldo-/rumsintegritet och motiverade förbättringar jämfört med main.
**Startfiler:** K `test/shared-table.test.mjs`, `test/game-integration.test.mjs`, `test/table-limits.test.mjs`, `test/idle-chain.test.mjs`, `test/game-cards-fixed.test.mjs`; M `test/shoe-game.mjs`, berörda beteendetester samt J07/J08:s nya integrationstester.

- [ ] Porta relevanta beteendetester och kör dem på den integrerade kandidaten med högst fyra arbetare där verktyget stöder det. Bevara CI:s obligatoriska fullregression; upprepa inte tunga gröna körningar utan ändrad grund.
- [ ] Verifiera samtidiga spelare/rum, parallella kommandon mot samma saldo, upprepade request-ID, konflikt, krasch/omstart och återanslutning. Förväntningen är exakt en giltig debitering/avräkning och inga rumsläckor.
- [ ] Jämför main och kandidat i samma isolerade miljö med samma testindata och scenarier. För varje vald förbättring redovisas observerat före/efter, exempelvis idleövergång, kortpresentation, återanslutning eller responsivitet.
- [ ] Om prestanda åberopas: ange enhet, nätverk, antal mätningar och mätvärden; redovisa osäkerhet. Befintliga portade preloads räknas som återanvändning, inte en ny förbättring.

**Raderas/importeras inte:** obsolete källsträng-/CSS-/layoutlås, dubbla tester utan egen beteenderisk och tillfälliga alternativa produktvägar som portningen ersatt. Bevara auth, spelregler, idempotens, persistens och rumsisolering.
**Klart när:** kandidatens relevanta tester passerar, jämförelsen belägger O01:s accepterade förbättringar och alla kvarvarande brister är uttryckligt klassificerade. Ingen uppmätt förbättring påstås utifrån enbart kodläsning.
**Verifiering/bevis:** full kandidat-SHA, jämförelse-SHA, miljö/schema, kontrakt/configversion, kommandon/exitkoder, relevanta loggar och visuella observationer. Leverera en kompakt kvittens till O02; orkestratorn uppdaterar status.json och avgör godkänd aktivitet.

## Gemensam arbets- och leveransordning

- Läs AGENTS, agent-talk och relevanta kanoniska guider före implementation; gameplay/media kräver även JOHN-HANDOFF och ENVIRONMENT-RESTORATION. Verifiera Node-version och paketets krav.
- Arbeta i egen avgränsad featurebranch från aktuell main; dokumentera accepterat delta när käll-/bas-SHA ändras. Respektera filanspråk och låt orkestratorn äga gemensamt Git-index/integration.
- En leveranskvittens innehåller aktivitet, full head, ändring/radering, testmiljö, körda kontroller, bevislänkar, granskare och återstående blockerare. Ett meddelande är information, ingen merge-/DDL-behörighet.
- Begär saknat kontrakt eller beslut hos dess ägare. Skapa inte en permanent fallback för att komma runt en blockerare. Släpp egna claims när leveransen är klar; inga återkommande statuspingar behövs.
