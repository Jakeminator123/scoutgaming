# Körplan: återstående arbete

Uppdaterad 31 oktober 2026 efter Jakobs nya beställning: tydliga satsningsrutor, bort med förbrukad legacy och dokumentation, och färre onödiga ändringsspärrar. **Talet väntar.** Den här filen är enda aktiva körordning för organisationsarbetet. Migreringens avslutade 20/20 aktiviteter ligger kvar i `migrering/status.json`.

## Utgångsläge och mandat

- Kanonisk checkout: `C:/Users/jakob/dev/scoutgaming`. Etappens bas är `465c03fcd14ba2f96884816b1d2094e2d8cf7617`, levererad till main och preview. Ändringar görs i egna worktrees under `.claude/worktrees`; orkestratorns branch är `jakob/codex-rest-integration-1031`.
- Jakob har gett MERGEAGENTEN fullt beslutsmandat för nödvändiga merges och kontrollerade releaser utan upprepade frågor. Exakt head, verifierad ägare, relevant granskning och grön CI krävs. Inga force-operationer, raderade brancher/worktrees, kollegors resurser eller RunPod-endpoints ingår.
- **Inga produktmappar, vyer, menynamn eller gamla implementationer är frysta.** Vi bevarar beteenden: serverägda kort och utfall, atomiska pengar, behörighet, bolags-/rumsisolering samt aktiva publicerade mediereferenser. Ersatt kod, dess förbrukade testlås och dokument tas bort tillsammans.
- Rums-/materialpublicering och data-/historikradering har konkreta beroenden och återställningskrav. De är inte blanketförbud mot UI-, adapter- eller dokumentändringar. Inga env-, databas- eller betalda providerändringar behövs för den startade etappen.

## Tre faser

| Fas | Parallellt arbete | Färdigt när |
| --- | --- | --- |
| 1. Rätta och rensa | R1 spelkontroller, R2 fixturer och R3 dokument har olika skrivare. Orkestratorn tar R4/R5. | Konsumenter och ändrat beteende är verifierade; avgränsade diffar och prov finns. |
| 2. Granska och integrera | Oberoende granskning av spel-/pengaflöden och CI. Dokument och beroenden kan granskas parallellt. | Relevanta lokala prov och CI på den exakta integrerade headen är gröna. |
| 3. Leverera och prova | Main/preview synkas enligt repoets mergegrind. Vercel och berörd Render-tjänst verifieras. | Rätt SHA och hälsa, plus verkligt demoprov av satsningsval och kontroller. |

## Den startade etappen

| ID / område | Ägare och avgränsning | Status | Acceptans |
| --- | --- | --- | --- |
| R1 Spelkontroller | Astra: `betting-spots-1031`; klient och riktade prov | PÅGÅR | Spelare/kameravy skiljs från satsningsruta. Flera lediga rutor kan väljas och satsas på. Rutbyte lägger ingen oavsiktlig insats; annans aktiva ruta, stängt fönster och otillåtet sidobet nekas. Begripliga markerare och kontroller även på liten skärm. |
| R2 Test och legacy | Sol: `legacy-fixtures-1031`; gamla kodkopior och deras tester | PÅGÅR | `kevin-5aa7ed1` förklaras och avvecklas. Oberoende förväntningar för regler, pengar, proof och presentation finns kvar; nödvändiga små timingdata får tydlig hemvist. Inga skyddade brancher ändras. |
| R3 Dokument och regler | Sol: `docs-unlock-1031`; docs-index, ordlista och gamla planer | PÅGÅR | Avklarade dubbletter borta; länkar hela. En körplan, kort ordlista, ingen historisk layout- eller mappfrysning. F11:s riktiga driftkvitto och aktiva sakguider kvar. |
| R4 Typer och runtime | MERGEAGENTEN; web/Studio-manifest och låsfiler | PÅGÅR | Node-typer matchar Node 24, React-typer matchar respektive app. Frysta installationer, typkontroller och berörda byggen passerar utan bred runtimeuppgradering. |
| R5 Central objektkontroll | MERGEAGENTEN; CI och befintlig storlekskontroll | PÅGÅR | Även en stor blob som läggs till och sedan tas bort före PR-slutet nekas centralt. Hela nya intervallet kontrolleras; saknad bas/ofullständig historik får inte passera tyst. Gammal mediehistorik laddas inte ner som bieffekt. |

Kod, lokal verifiering, merge, driftsättning och produktacceptans är olika status. Markera inte en rad klar enbart för att agenten har öppnat en PR. G1 är löpande releasekontroll, ingen separat halvfärdig produktleverans.

## Återstående områden och tydliga gränser

| Område | Kvar / beslut | Vad som krävs för nästa ändring |
| --- | --- | --- |
| Legacy/Astrid | Den gamla clip-policy-kedjan är borttagen. Återstående worker-/medierester måste följas till faktisk användning; gatewaydelen är aktiv i spelcontainern. | Ta bort döda delar efter konsumentbevis; flytta eller ersätt levande konsument före radering. Inga RunPod-endpoints ändras. |
| Material och Admin | Kompatibelt materialbyte med påverkan per rum/bolag och atomisk publicering är kvarvarande produktarbete. | Scope/CAS/samtidighet, grannrummets utkast och låsta publicerade versioner ska hålla. Återställning får inte öppna rum eller aktivera tal. |
| Data och återställning | PITR och backupskript är inte ett genomfört restore-prov. | Isolerat återställningsmål och jämförelse före destruktiv data-/historikåtgärd. Ingen produktionsrensning bara för att tabeller ser gamla ut. |
| Native, partner och sessioner | Aktiva adaptrar är inte legacy bara på grund av namnet. Extern partnerwallet är inte real-money-accepterad. | Konsolidera ett belagt dubbelt/felaktigt kontrakt i taget med behörighets-, samtidighets- och pengaprov. |
| Lounge och vyer | Prototyper och Admins layout får utvecklas; befintliga opublicerade prototyputkast är andras bevarade arbetsmaterial. | Välj ändringen i aktuell main och pröva den; merga inte en hel gammal prototypbranch. |
| Tal | **PAUSAT enligt Jakob.** Generated speech, ny bank och läppsynk ingår inte nu. Talberoende öppning/avräkning har kvar konservativ reservtid. | Eget uppdrag för aktualitet/mute/distribution och godkända ljud-/bildrutebundna medier. |
| Säkerhet och synlighet | Ingen ny bred historikscan eller synlighetsändring beställd. GitGuardians `too_large` innebär ofullständig historisk täckning trots 0 öppna fynd vid senaste kontroll. | Färsk säkerhetsstatus före push/merge. Ny scanning/synlighet kräver konkret scope och verifierade åtkomst-/kostnadsvillkor. |

Det finns inget meningsfullt totalprocenttal för hela produkten. Redovisa avslutade leveranser och kvarvarande acceptanskriterier, inte en uppskattad procent baserad på antal dokument eller gröna tester.

## Avslutat underlag

Den tidigare organisationsvågen är avslutad: 4/4 + 3/3 + 2/2 leveranser (#723–737). Secure-cookie, pushkontroll, avvecklad clip-policy, tålig talstart och F11 ska inte beställas om. [Beslutsloggen](BESLUTSLOGG.md) och [F11-driftkvittot](F11-DRIFTKVITTO.md) anger bevis och gränser.

#740–742 levererade synliga kontroller, exakt talfri filmplan och stabila kortankare. Verkligt demoprov mätte Hit till cirka 5,3 sekunder; filmplanen var 4 155 ms och nästa beslut fick 15 sekunder. Talberoende reserver och hela produktens acceptans är skilda frågor. Den särskilda kalibreringen gäller det testade previewrummet, inte en generell publicering av alla rum.

Den gamla inventeringen, områdesplanerna och deras tomma aktiviteter är ersatta av denna körplan och sakguiderna i [docs-indexet](../../README.md). Git bevarar historiken; borttagna dokument redovisas i [HISTORIK](../../HISTORIK.md).

## Nya fynd och överlämning

Skriv en kort rad i [BESLUTSLOGG](BESLUTSLOGG.md): reproduktion + full SHA/resurs + berörd aktivitet + beslut. Skilj produktval från fel och osäkerhet. Ändra berörd rad här; skapa ingen konkurrerande tracker eller rapporthierarki.

Underagenter får tom kontext, egna filer och konkreta prov; högst tre samtidigt. De öppnar granskbara PR:er och väntar inte på CI. Orkestratorn granskar, integrerar och verifierar leveransen. Rapport högst 200 ord med faktisk verifiering och kvarstående begränsning. Avslutade agenter återupptas inte.
