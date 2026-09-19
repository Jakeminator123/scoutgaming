# Beslutslogg · V3 9-dagars MVP

Dokumenterat 19 september 2026 från Jakobs sammanfattning efter mötet med Kevin, där Emil deltog.

## Beslutade ramar

| ID | Beslut | Konsekvens |
| --- | --- | --- |
| D01 | Kevin är chef och äger GitLab-repot, motorn och integrationsbeslutet. | V3 skrivs som underlag, inte som order till Kevin. |
| D02 | Kevins befintliga RNG och events är basen. | Ingen alternativ eller "ultimativ" RNG byggs i MVP:n. |
| D03 | Jakob ansvarar för backend/logik och eventpusslet på sin branch. | Varje nod härleds till runtime eller märks som förslag. |
| D04 | Emil arbetar nära Kevin med videoproduktion och variationer. | Nya videor och deras metadata går till Kevins branch/flöde. |
| D05 | Jakob och Emil har en tunn koppling. | Handoff sker genom manifest, metadata och beslutade artefakter. |
| D06 | Jakob stämmer av vid färdiga etapper. | Kevin väljer införliva, justera eller behåll separat. |
| D07 | Bettalotto är backoffice. | API-data används enligt behörighet; hemligheter dokumenteras aldrig. |
| D08 | GitLab Croupier och wikin är canonical. | GitHub/Vercel är en senare presentationsspegel. |
| D09 | Den passerade tiodagarsplanen ersätts av en niostegs-MVP. | S06 beskriver relativ ordning, inte automatiska kalenderorder. |

## Inte beslutat ännu

- Exakta runtime-event och payloadfält för varje gren; de måste verifieras mot färsk Kevin-revision.
- Vilka delar av Jakobs eventträd som ska införlivas i Kevins motor eller ligga som adapter.
- Slutlig video-/variantkatalog och vilka takes som är godkända.
- Om OpenClaw alls ska provas efter MVP:n. Det är inte en förutsättning för V3.
- Produktionsdatum eller merge till `main`.

## Ändringsregel

Nya beslut läggs till med datum, källa och påverkade sidor. Ett förslag blir inte "beslutat" bara för att det står i en canvas, wiki eller agentfil.
