# Körplan: återstående arbete

Uppdaterad 31 oktober 2026 efter Jakobs nya beställning: tydliga satsningsrutor, bort med förbrukad legacy och dokumentation, och färre onödiga ändringsspärrar. **Talet väntar.** Den här filen är enda aktiva körordning för organisationsarbetet. Migreringen avslutades 28 oktober (20/20, PR #527); historiken finns i Git och [HISTORIK](../../HISTORIK.md).

## Utgångsläge och mandat

- Kanonisk checkout: `C:/Users/jakob/dev/scoutgaming`. S1–S3 utgår från `7589d2ba453346ce6fca33b3d53c541f72185138` efter #747–748. Ändringar görs i egna worktrees under `.claude/worktrees`; orkestratorns branch är `jakob/codex-cleanup-integration-1031`.
- Jakob har gett MERGEAGENTEN fullt beslutsmandat för nödvändiga merges och kontrollerade releaser utan upprepade frågor. Exakt head, verifierad ägare, relevant granskning och grön CI krävs. Inga force-operationer, ingrepp i kollegors resurser eller RunPod-endpoints ingår. GitHubs normala auto-delete behålls vid godkända PR-merges; äldre brancher/worktrees har inte gallrats i denna leverans.
- **Inga produktmappar, vyer, menynamn eller gamla implementationer är frysta.** Vi bevarar beteenden: serverägda kort och utfall, atomiska pengar, behörighet, bolags-/rumsisolering samt aktiva publicerade mediereferenser. Ersatt kod, dess förbrukade testlås och dokument tas bort tillsammans.
- Rums-/materialpublicering och data-/historikradering har konkreta beroenden och återställningskrav. De är inte blanketförbud mot UI-, adapter- eller dokumentändringar. Inga env-, databas- eller betalda providerändringar behövs för den startade etappen.

## Tre faser

| Fas | Parallellt arbete | Färdigt när |
| --- | --- | --- |
| 1. Rätta och rensa | R1 spelkontroller, R2 fixturer och R3 dokument har olika skrivare. Orkestratorn tar R4/R5. | Konsumenter och ändrat beteende är verifierade; avgränsade diffar och prov finns. |
| 2. Granska och integrera | Oberoende granskning av spel-/pengaflöden och CI. Dokument och beroenden kan granskas parallellt. | Relevanta lokala prov och CI på den exakta integrerade headen är gröna. |
| 3. Leverera och prova | Main/preview synkas enligt repoets mergegrind. Vercel och berörd Render-tjänst verifieras. | Rätt SHA och hälsa, plus verkligt demoprov av satsningsval och kontroller. |

## Den avslutade etappen

| ID / område | Ägare och avgränsning | Status | Acceptans |
| --- | --- | --- | --- |
| R1 Spelkontroller | Astra: `betting-spots-1031`; klient, rutägarskap och riktade prov | VERIFIERAD | Spelare/kameravy skiljs från satsningsruta. Flera lediga rutor kan väljas och satsas på. Rutbyte lägger ingen oavsiktlig insats; annans aktiva ruta, stängt fönster och otillåtet sidobet nekas. Begripliga markerare och kontroller även på liten skärm. |
| R2 Test och legacy | Sol: `legacy-fixtures-1031`; gamla kodkopior och deras tester | VERIFIERAD | `kevin-5aa7ed1` förklaras och avvecklas. Oberoende förväntningar för regler, pengar, proof och presentation finns kvar; nödvändiga små timingdata får tydlig hemvist. Inga skyddade brancher ändras. |
| R3 Dokument och regler | Sol: `docs-unlock-1031`; docs-index, ordlista och gamla planer | VERIFIERAD | Avklarade dubbletter borta; länkar hela. En körplan, kort ordlista, ingen historisk layout- eller mappfrysning. F11:s riktiga driftkvitto och aktiva sakguider kvar. |
| R4 Typer och runtime | MERGEAGENTEN; web/Studio-manifest och låsfiler | VERIFIERAD | Node-typer matchar Node 24, React-typer matchar respektive app. Frysta installationer, typkontroller och berörda byggen passerar utan bred runtimeuppgradering. |
| R5 Central objektkontroll | MERGEAGENTEN; CI och befintlig storlekskontroll | VERIFIERAD | Även en stor blob som läggs till och sedan tas bort före PR-slutet nekas centralt. Hela nya intervallet kontrolleras; saknad bas/ofullständig historik får inte passera tyst. Raderad eller orelaterad mediehistorik laddas inte ner som bieffekt; schedule/manual kontrollerar dagens HEAD-träd. |

R1–R5 levererades genom [PR #747](https://github.com/Jakeminator123/scoutgaming/pull/747), exakt CI [41205741884](https://github.com/Jakeminator123/scoutgaming/actions/runs/41205741884), release `bebe483c7f6c846c10d69545f6c67186839e808e`. Båda Vercel-projekten var READY och båda Render-motorerna live med samma revision och health=ok. Verkligt previewprov bekräftade rutbyte utan debitering, två samtidiga huvudinsatser på ruta 1/7 och Ångra av endast sista insatsen. Desktop visar alla sju rutor; separat mobil bordsvy verifierades i Chrome-fixturen. Vid rundstart upptäcktes även missvisande etiketter på tomma rutor; en separat efterrättning skiljer stängt insatsfönster från annans ägarskap, med negativa round/settled-prov. Talets konservativa öppnings-/avräkningstid återstår enligt pausen.

Kod, lokal verifiering, merge, driftsättning och produktacceptans är olika status. Markera inte en rad klar enbart för att agenten har öppnat en PR. G1 är löpande releasekontroll, ingen separat halvfärdig produktleverans.

## Återstående områden och tydliga gränser

| Område | Kvar / beslut | Vad som krävs för nästa ändring |
| --- | --- | --- |
| Legacy/Astrid | Den gamla clip-policy-kedjan är borttagen. Återstående worker-/medierester måste följas till faktisk användning; gatewaydelen är aktiv i spelcontainern. | Ta bort döda delar efter konsumentbevis; flytta eller ersätt levande konsument före radering. Inga RunPod-endpoints ändras. |
| Material och Admin | Kompatibelt materialbyte med påverkan per rum/bolag och atomisk publicering är kvarvarande produktarbete. | Scope/CAS/samtidighet, grannrummets utkast och låsta publicerade versioner ska hålla. Återställning får inte öppna rum eller aktivera tal. |
| Data och återställning | Återställningsprov från 28 oktober är dokumenterat. Det ersätter inte ett aktuellt prov för en ny destruktiv dataåtgärd. | Isolerat återställningsmål och jämförelse inför den data-/historikåtgärd som faktiskt beställs; inget generellt omprov för vanlig kod-/UI-städning. |
| Native, partner och sessioner | Aktiva adaptrar är inte legacy bara på grund av namnet. Extern partnerwallet är inte real-money-accepterad. | Konsolidera ett belagt dubbelt/felaktigt kontrakt i taget med behörighets-, samtidighets- och pengaprov. |
| Lounge och vyer | Prototyper och Admins layout får utvecklas; befintliga opublicerade prototyputkast är andras bevarade arbetsmaterial. | Välj ändringen i aktuell main och pröva den; merga inte en hel gammal prototypbranch. |
| Tal | **PAUSAT enligt Jakob.** Generated speech, ny bank och läppsynk ingår inte nu. Talberoende öppning/avräkning har kvar konservativ reservtid. | Eget uppdrag för aktualitet/mute/distribution och godkända ljud-/bildrutebundna medier. |
| Säkerhet och synlighet | Ingen ny bred historikscan eller synlighetsändring beställd. GitGuardians `too_large` innebär ofullständig historisk täckning trots 0 öppna fynd vid senaste kontroll. | Färsk säkerhetsstatus före push/merge. Ny scanning/synlighet kräver konkret scope och verifierade åtkomst-/kostnadsvillkor. |

Det finns inget uppmätt totalprocenttal för hela produkten. Den externa uppföljningen på `c0150add` uppskattar det bredare förenklingsarbetet till cirka 80 % (75–85 %), men detta är en bedömning, inget mål att fylla med nya städuppdrag. R1–R5 och S1–S6 är avslutade inom sina omfattningar. Redovisa leveranser och kvarvarande acceptanskriterier separat.

## Levererad första städvåg: S1–S3

Jakobs uppföljning 31 oktober flyttar tyngdpunkten från visuell putsning till levande konsumenter, färre överlappande vägar, namngivning och en begriplig systemkarta. MERGEAGENTEN 2 har tagit över efter #748; föregående huvudagent är klar. Extern granskning är underlag att kontrollera, inte en orderlista.

| Spår | Levererad avgränsning | Verifiering och gräns |
| --- | --- | --- |
| S1 Övergångskod | Konstanta native-/Neon-/lokalmedia-val, generation-media och oåtkomlig klippmappning borttagna med förbrukade prov. | API-beteenden jämförda före/efter, oberoende granskning och grön full CI. Aktiva adaptrar, behörighet och serverauktoritet består. |
| S2 Bolagsflöde och systemkarta | Separat skapa-formulär och routebundet Team med smal bolagsläsning; den nästlade bolagskatalogen är borta. Kallstart kräver inte projekt/video. Systemkartan finns i START-HERE. | Async-/scope-/CAS-/rollprov och verklig previewläsning. Transportfelet från första releasen rättat i #753. DB/schema/signer förblir obligatoriska. Skapa-flödets skrivning verifierad i tester; inga nya konton skapade i liveprovet. |
| S3 Tester och leverans | Byggkontroller körs efter befintligt bygge. Obligatoriskt och rådgivande browserjobb är åtskilda; det rådgivande jobbet ligger utanför CI:s väntkedja. | Verklig byggartefakt lokalt och i CI; CSS-/tema-/fokusprov utan kosmetiska källkodslås. Bredare CI-selektion återstår som separat avgränsning. |

REPOAGENTEN, ARKITEKTEN och DRIFTAGENTEN levererade avgränsade ändringar i egna worktrees. Huvudagenten ägde systemkarta, integration, granskning och release. De tre uppdragen är avslutade; inget nytt skrivansvar följer automatiskt av den tidigare tilldelningen.

Brancher och worktrees för S1–S3 och integrationen är bevarade enligt uppdraget. Inga schema-, env- eller talaktiveringar ingick.

**Leveransbevis:** [#752](https://github.com/Jakeminator123/scoutgaming/pull/752) förenade [S1 #749](https://github.com/Jakeminator123/scoutgaming/pull/749), [S2 #751](https://github.com/Jakeminator123/scoutgaming/pull/751) och [S3 #750](https://github.com/Jakeminator123/scoutgaming/pull/750). Integrationen passerade 77/77 riktade prov, Studio/Admin/Lobby-typer, verkligt klientbygge och exakt [CI 41209843388](https://github.com/Jakeminator123/scoutgaming/actions/runs/41209843388). Två oberoende granskningsfynd rättades: likvärdig platt fokus-CSS och saknade bolags-id som inte är slugs.

Första publicerade provet fann ett ytterligare transportfel på Team; [#753](https://github.com/Jakeminator123/scoutgaming/pull/753) rättade det efter röd reproduktion, 65/65 riktade prov och exakt [CI 41210914261](https://github.com/Jakeminator123/scoutgaming/actions/runs/41210914261). Slutlig publicerad verifiering och revision redovisas i beslutsloggen; den första releasens gröna CI räckte inte som UI-acceptans.

Efter första städvågen väljs en levande legacykedja åt gången: Admins isolerade provspel, sessionsutfärdande eller det äldre referens-/mappingflödet. Atomisk bolagspublicering och materialersättning är separata funktionsändringar. Namnbyten i molnet och stora workspaceomläggningar prioriteras inte framför belagda dubbletter. Talet väntar fortfarande.

## Levererad systemkarta och smal CI-selektion: S4–S6

Jakobs nästa uppdrag till de tre befintliga teamchattarna är genomfört. REPOAGENTEN #755 (`71af69d97351f3b21b737b5010ce3f03b76ad7a9`, CI 41212844431) verifierade och länkade kartans kod-/provgränser. ARKITEKTEN #757 (`6611a1398753cb6e16494441e2d08223a2772142`, CI 41213561936) byggde `tools/system-map.py`; 8/8 Pythonprov och oberoende granskning passerade. Orkestratorn genererade kartan på integrerad `1c920187b11f84b5c02abec72cad920a29428833`: sex områden, 37/37 referenser, inga fel eller varningar. Faktisk browserkontroll bekräftade läsbar layout, zoom och expandera/fäll ihop. Lokala fillänkar verifierades som referenser; klick från HTTP-preview till `file://` är inte ett accepterat webbflöde. Den fristående filen öppnas lokalt enligt START-HERE.

DRIFTAGENTEN #756 (`07ca8ee6ee145d292c82826010ff6f220472ec80`, CI 41213034222) begränsar endast vanliga M/100644-ändringar i tre befintliga Admin-CSS-filer till `studio-admin-contracts` + `access-presentation`, med verkligt bygge/artefaktkontroll och obligatorisk Chrome. Databas/engine och tal/gameplay utelämnas för just denna klass. Orkestratorns 22/22 riktade prov passerade, inklusive riktiga Git-mergefixturer och negativa gateprov. Okända/blandade ändringar, nya/raderade/omdöpta filer och preview/nattlig/manuell körning behåller full täckning. Inga sparade minuter eller bredare totalprestandavinster är uppmätta.

Alla tre PR:er är verifierat våra genom tilldelad teamchatt, rapporterad head och samma frysta GitHub-SHA. Ett commitnamn eller PR-kontot ensamt bevisar inte uppdragets ägare. Inga oklara kollegors PR:er ingick i denna mergeomgång.

## Avslutat underlag

Den tidigare organisationsvågen är avslutad: 4/4 + 3/3 + 2/2 leveranser (#723–737). Secure-cookie, pushkontroll, avvecklad clip-policy, tålig talstart och F11 ska inte beställas om. [Beslutsloggen](BESLUTSLOGG.md) och [F11-driftkvittot](F11-DRIFTKVITTO.md) anger bevis och gränser.

#740–742 levererade synliga kontroller, exakt talfri filmplan och stabila kortankare. Verkligt demoprov mätte Hit till cirka 5,3 sekunder; filmplanen var 4 155 ms och nästa beslut fick 15 sekunder. Talberoende reserver och hela produktens acceptans är skilda frågor. Den särskilda kalibreringen gäller det testade previewrummet, inte en generell publicering av alla rum.

Den gamla inventeringen, områdesplanerna och deras tomma aktiviteter är ersatta av denna körplan och sakguiderna i [docs-indexet](../../README.md). Git bevarar historiken; borttagna dokument redovisas i [HISTORIK](../../HISTORIK.md).

## Nya fynd och överlämning

Den externa uppföljningens små efterrättningar: **#762 mergad** (gemensamt
agentmandat och borttagna kosmetiska testlås), **#763 mergad** (avstängt
fristående röstprov avvecklat, social fallback kvar). Båda har grön exakt CI.
Tilldelning återanvänder förälderns katalog i **#764**; nio browserprov verifierar
läsantal, uppdatering, CAS, fel och bolagsbundna utkast. Publiceringsordningen
och partialresultaten består. Atomisk publicering/materialbyte är ett eget
produktuppdrag. Hela repoets filer och
tester är inte därmed granskade eller nödvändighetsbevisade.

[Atlas, PR #761](https://github.com/Jakeminator123/scoutgaming/pull/761) förenar de
tidigare kartorna. Ansvarstabell, handgranskade kedjor och statiska kodreferenser
visas tillsammans med tydliga bevisnivåer. 18 Pythonprov, generering och lokal
browserkontroll har passerat. Kontrollen av kodankare ingår i befintlig CI;
ändrade samband granskas och förbrukade samband raderas med koden. Kartan
bevisar inte att varje fil används eller att dokumenterade prov har körts.

Dokumentgranskning 31 oktober efter systemkartorna: sex ersatta planer avvecklas
med Git-hänvisningar i [HISTORIK](../../HISTORIK.md). Saktext om UI/bygg/partner
samlas i befintliga guider. Att bolagsplanerna står kvar har konkret kodstöd:
012/014 är `deploymentOptional`, och spelaradministrationens skapväg saknar
bolagsfält. Detta är kvarvarande arbete, inte återöppnad migreringsacceptans.
Dokumentindexet förklarar vilka underlag som är guider, pausade planer, daterade
beslutsunderlag och provmallar. Kontroll av länkar och rubriker kompletterar
granskning av sakuppgifter; den bevisar inte att ett moln- eller produktpåstående
fortfarande stämmer.

Skriv en kort rad i [BESLUTSLOGG](BESLUTSLOGG.md): reproduktion + full SHA/resurs + berörd aktivitet + beslut. Skilj produktval från fel och osäkerhet. Ändra berörd rad här; skapa ingen konkurrerande tracker eller rapporthierarki.

Underagenter får tom kontext, egna filer och konkreta prov; högst tre samtidigt. De öppnar granskbara PR:er och väntar inte på CI. Orkestratorn granskar, integrerar och verifierar leveransen. Rapport högst 200 ord med faktisk verifiering och kvarstående begränsning. Avslutade agenter återupptas inte.
