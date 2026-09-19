# S06 · föreslagen etappplan

> Etapperna nedan är ett arbetsförslag för Jakobs spår, inte ett separat
> mötesbeslut och inte kalenderlöften. Kevin äger motor och integration. Emil
> arbetar nära Kevin med video.

Katalognamnet `v3-9-days-mvp` är historiskt. Nio etapper är inte nio dagar
och inget mötesbeslut om leveransdatum. Tabellen beskriver en arbetsordning,
inte ett påstående att stegen redan är genomförda.

## Status och Jira CAC

Dokumentstatusen **Öppen**, **Pågår**, **Grön** och **Blockerad** beskriver
underlaget på denna sida. Den ersätter aldrig Jira CAC, som är projektets aktiva
work-tracker för implementation och QA.

## Etapper

| Etapp | Jakobs arbete | Bevis | Kontrollpunkt |
| --- | --- | --- | --- |
| 1. Frys verklighetsbilden | Registrera aktuell Jakob- och Kevin-revision. Jämför motor, events, Partner API, mediaflöde och öppna skillnader. | Korta fil-/symbolreferenser och en korrekt runtime-verifiering. | Ingen kodintegration krävs. |
| 2. Avgränsa första eventytan | Välj minsta yta och anslutningspunkt: Partner-API eller vanlig webbklient. Dessa använder inte samma presentationskodväg. | Varje rad har källa, ägare och status. | Kevin bekräftar scope. |
| 3. Rita eventträdet | Dokumentera baspresentation, publika triggers, varianter och fallback. Pröva Kevins träd-/YAML-förslag som schema, inte som redan införd kod. | Varje gren kan följas och påverkar inte spelutfall. | Kevin granskar gränsen mot motorn och metadataflödet. |
| 4. Bygg avgränsat | Implementera minsta adapter eller mappning på `jakeminator123/work`. | Tester visar oförändrade kort, shoe, saldo och settlement. | Ingen automatisk merge till Kevins branch. |
| 5. Koppla media | Konsumera video och metadata från Kevin och Emils valda flöde. Skilj `want`-urval, review och livegodkännande. | Asset-id, ursprung, hash, kalibrering, visuell status och gap kan följas; katalogförekomst räcker inte. | Kevin + Emil bekräftar medialeveransen. |
| 6. Testa fallback | Testa kandidat → annan kandidat → bas → neutral → UI-only. | Rundan fortsätter korrekt vid saknad eller underkänd media. | Öppna fel går tillbaka till arbetet. |
| 7. Kör sammanhängande rehearsal | Kör relevanta tester och upprepade spelningar för den avgränsade etappen. | Reproducerbar testnotering med commit och kända avvikelser. | Inga visuella godkännanden antas av hash eller testpass. |
| 8. Stäm av med Kevin | Presentera diff, evidens och öppna produktbeslut. | Beslutet dokumenteras med datum och källa. | Kevin väljer införliva, justera eller håll separat. |
| 9. Lämna integrationsunderlag | Förbered en liten patch/MR mot den målbranch Kevin godkänner. Synka docs, wiki och canvas. | Granskbar diff, tester och handoff utan beroende av chatthistorik. | Merge eller publicering sker först efter beslut. |

## Definition av en grön etapp

- arbetet bygger på Kevins faktiska Croupier-motor och publicerade kontrakt;
- runtimefakta och Jakobs förslag är visuellt och textuellt åtskilda;
- presentation kan inte påverka RNG, kort, shoe, wallet eller settlement;
- media kommer genom Kevin/Emils verifierade flöde och har säker fallback;
- Croupiers V3-källor, GitLab-wikins spegel och GitHub/Vercel-canvasen berättar samma sak;
- Jira CAC och relevant issue/MR återspeglar den verkliga arbetsstatusen.

## Den lilla samarbetsloopen

Anslutna agenter följer [den gemensamma inboxrutinen](https://gitlab.com/scout-gg/croupier/-/wikis/agent-inbox):
en kontroll vid ny användartur, stabilt chattnamn med ägare och eget läsminne.
Relevant fråga/svar kopplas till rätt agent och återges i den lokala chatten.
Inget relevant nytt ger inget meddelande och ingen vänteloop.

Vid en etapphandoff anges vad som ändrats, vad som testats, kvarvarande gap
och vilket beslut Kevin behöver ta. Inboxen samordnar; Jira CAC spårar arbetet;
commit/MR visar ändringen. Ingen av dem ersätts av ett automatiskt agentsvar.

## Efter den första leveransen

OpenClaw, friare persona/chatt, fler triggers, fler dealers eller byte av
spelmodell kräver egna beslut. De får inte beskrivas som delar av Kevins
nuvarande motor bara för att de finns i V2 eller i ett framtidsdiagram.
