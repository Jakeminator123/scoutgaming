# Beslutslogg · Animation events V3

Mötesramarna dokumenterades 19 september 2026 från Jakobs sammanfattning efter
mötet med Kevin och Emil. Senare samarbetsnoteringar och dokumentationsval
hålls separat så att de inte framstår som nya mötesbeslut.

## Beslutade ramar

| ID | Beslut | Konsekvens |
| --- | --- | --- |
| D01 | Kevin är projektledare och äger Croupier-repot samt integrationsbeslutet. | V3 är underlag till Kevin, inte en order till hans branch eller agenter. |
| D02 | Kevins befintliga RNG, spelmotor och events är grunden. | Jakob bygger inte en konkurrerande eller ”bättre” RNG. |
| D03 | Jakob bistår som backend-/logikkonsult. | Han sorterar spel- och eventlogik på `jakeminator123/work` och arbetar utanför Kevins branch tills en etapp granskas. |
| D04 | Emil bistår Kevin nära med videogenerering, takes och variationer. | Ny media går till den branch och det flöde Kevin väljer. |
| D05 | Jakob och Emil har en tunn koppling. | Kopplingen går genom avgränsade assets, manifest, metadata och handoff — inte ett parallellt gemensamt utvecklingsspår. |
| D06 | Jakob stämmer av med Kevin när en etapp är färdig. | Kevin väljer att införliva, justera eller låta arbetet fortsätta separat. |
| D07 | Bettalotto är backoffice. | Behörig data och media får användas som underlag; hemligheter hör aldrig hemma i Git, wiki eller canvas. |

## Bekräftat språk och Kevins efterföljande förslag

Källa: [Kevins inboxnotering 3869829140](https://gitlab.com/scout-gg/croupier/-/work_items/1#note_3869829140),
19 september 2026 kl. 20:31:39 UTC.

| Status | Innehåll | Vad det inte betyder |
| --- | --- | --- |
| **Gemensamt språk** | Kevin bekräftar uppdelningen `rng`/`show` och begreppen linje, variant, trigger och take. | Att alla `rng.*`/`show.*`-namn redan emitteras av Croupier eller att en adapter är införd. |
| **Kevins arbetsförslag** | Ett diskbaserat träd per dealer och presentationsbehov, exempelvis `show.deal.centre/line` och `show.line.lose/variant.near`. | Att den slutliga katalogstrukturen eller dess schema är fastställt och implementerat. |
| **Kevins arbetsförslag** | YAML per event eller take för prompt, modell, Higgsfield-id, landning, frame-index, kalibrering, trigger, cooldown och verdict. | Att dokumentationens YAML-fält redan är ett runtimekontrakt. |
| **Kevins arbetsförslag** | Backoffice-intag med `want`/`no`; utvalt material går vidare till trädet och metadata. | Att `want` ersätter kalibrering, visuell granskning eller produktionsgodkännande. |
| **Öppen avstämning** | Kevin frågar om Jakob är överens och vill lägga schema/träd på sin arbetsbranch för granskning. | Att en agent automatiskt får svara ja, genomföra hela förslaget eller integrera det. |

Det read-only Generations-API som Kevin nämner finns i hans granskade branch;
det gör inte hela träd-/YAML-förslaget färdigt. Se [tekniskt kvitto](RUNTIME-EVIDENCE.md).

## Dokumentations- och samarbetsval

Jakob vill behålla V2:s klickbara upplägg men korrigera innehållet till V3.
Croupiers V3-texter är redigerbar sakmodell, GitHub äger HTML-generatorn, wikin
är en läsbar spegel och Vercel är webcanvasen. Detta är dokumentationsflödet,
inte ett nytt beslut om spelmotorn.

Den [namngivna agent-inboxen](https://gitlab.com/scout-gg/croupier/-/wikis/agent-inbox)
ger varje ansluten chatt en stabil identitet och ett eget läsminne. Jakob har
valt en snabb kontroll vid varje ny användartur, utan mellanliggande polling.
Kevin och Emil ansluter motsvarande regel i sina egna miljöer; dokumentet
ändrar inte deras lokala inställningar automatiskt.

## Arbetsförslag — inte mötesbeslut

Följande får finnas i V3, men ska inte beskrivas som beslutade enbart för att de
står i dokumentationen:

- den exakta formen på Jakobs eventträd och adapter;
- en niostegsplan eller andra tids-/etappindelningar;
- exakta event- och payloadnamn som inte har verifierats i aktuell kod;
- slutlig katalog över video, varianter och godkända takes;
- Kevins exakta disk-/YAML-schema och automatisering av `want`-intaget;
- OpenClaw eller annan AI-regi;
- hur Kevins senare branchändringar ska införlivas i `jakeminator123/work`;
- datum för merge, publicering eller produktion.

## Ändringsregel

Ett nytt beslut får status **Mötesbeslut** när det faktiskt kommer från ett
dokumenterat möte. Bekräftelser och förslag i inboxen får i stället sina egna
etiketter, med källa och datum. Ett diagram, en agentregel eller en canvas kan
förklara ett beslut men kan inte skapa beslutet på egen hand.
