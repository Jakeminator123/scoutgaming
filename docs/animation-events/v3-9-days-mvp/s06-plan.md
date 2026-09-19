# S06 · föreslagen etappplan

> Etapperna nedan är ett arbetsförslag för Jakobs spår, inte ett separat
> mötesbeslut och inte kalenderlöften. Kevin äger motor och integration. Emil
> arbetar nära Kevin med video.

## Status och Jira CAC

Dokumentstatusen **Öppen**, **Pågår**, **Grön** och **Blockerad** beskriver
underlaget på denna sida. Den ersätter aldrig Jira CAC, som är projektets aktiva
work-tracker för implementation och QA.

## Etapper

| Etapp | Jakobs arbete | Bevis | Kontrollpunkt |
| --- | --- | --- | --- |
| 1. Frys verklighetsbilden | Registrera aktuell Jakob- och Kevin-revision. Jämför motor, events, Partner API, mediaflöde och öppna skillnader. | Korta fil-/symbolreferenser och en korrekt runtime-verifiering. | Ingen kodintegration krävs. |
| 2. Avgränsa första eventytan | Välj den minsta sammanhängande ytan ovanpå de event och presentationstyper som redan finns. | Varje rad har källa, ägare och status. | Kevin bekräftar scope. |
| 3. Rita eventträdet | Dokumentera baspresentation, tillåtna publika triggers, varianter och fallback. | Varje gren kan följas och påverkar inte spelutfall. | Kevin granskar gränsen mot motorn. |
| 4. Bygg avgränsat | Implementera minsta adapter eller mappning på `jakeminator123/work`. | Tester visar oförändrade kort, shoe, saldo och settlement. | Ingen automatisk merge till Kevins branch. |
| 5. Koppla media | Konsumera endast video och metadata som Kevin och Emil har gjort tillgänglig i Kevins valda flöde. | Asset-id, ursprung, hash, kalibrering, visuell status och gap är dokumenterade. | Kevin + Emil bekräftar medialeveransen. |
| 6. Testa fallback | Testa kandidat → annan kandidat → bas → neutral → UI-only. | Rundan fortsätter korrekt vid saknad eller underkänd media. | Öppna fel går tillbaka till arbetet. |
| 7. Kör sammanhängande rehearsal | Kör relevanta tester och upprepade spelningar för den avgränsade etappen. | Reproducerbar testnotering med commit och kända avvikelser. | Inga visuella godkännanden antas av hash eller testpass. |
| 8. Stäm av med Kevin | Presentera diff, evidens och öppna produktbeslut. | Beslutet dokumenteras med datum och källa. | Kevin väljer införliva, justera eller håll separat. |
| 9. Lämna integrationsunderlag | Förbered en liten patch/MR mot den målbranch Kevin godkänner. Synka docs, wiki och canvas. | Granskbar diff, tester och handoff utan beroende av chatthistorik. | Merge eller publicering sker först efter beslut. |

## Definition av en grön etapp

- arbetet bygger på Kevins faktiska Croupier-motor och publicerade kontrakt;
- runtimefakta och Jakobs förslag är visuellt och textuellt åtskilda;
- presentation kan inte påverka RNG, kort, shoe, wallet eller settlement;
- media kommer genom Kevin/Emils verifierade flöde och har säker fallback;
- GitHub-canvas, GitLab-wiki och repo-kopia berättar samma sak;
- Jira CAC och relevant issue/MR återspeglar den verkliga arbetsstatusen.

## Efter den första leveransen

OpenClaw, friare persona/chatt, fler triggers, fler dealers eller byte av
spelmodell kräver egna beslut. De får inte beskrivas som delar av Kevins
nuvarande motor bara för att de finns i V2 eller i ett framtidsdiagram.
