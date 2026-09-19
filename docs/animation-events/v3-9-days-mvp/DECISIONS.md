# Beslutslogg · Animation events V3

Dokumenterat 19 september 2026 från Jakobs sammanfattning efter mötet med Kevin
och Emil. Formuleringarna nedan är den auktoritativa grunden för V3.

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
| D08 | Dokumentationen har flera ytor med olika roller. | GitLab Croupier är runtimekälla, wikin är gemensam arbetsyta och GitHub-repot är källa för den interaktiva canvasen. |

## Arbetsförslag — inte mötesbeslut

Följande får finnas i V3, men ska inte beskrivas som beslutade enbart för att de
står i dokumentationen:

- den exakta formen på Jakobs eventträd och adapter;
- en niostegsplan eller andra tids-/etappindelningar;
- exakta event- och payloadnamn som inte har verifierats i aktuell kod;
- slutlig katalog över video, varianter och godkända takes;
- OpenClaw eller annan AI-regi;
- hur Kevins senare branchändringar ska införlivas i `jakeminator123/work`;
- datum för merge, publicering eller produktion.

## Ändringsregel

Ett nytt beslut får status **Mötesbeslut** först när källa, datum och berörda
ytor är dokumenterade. Ett diagram, en agentregel eller en canvas kan förklara
ett beslut men kan inte skapa beslutet på egen hand.
