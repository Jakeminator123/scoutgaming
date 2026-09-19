# S00 · helheten

> **Mötesbeslut:** Kevin leder projektet och äger Croupier-repot,
> spelmotorn och integrationsbesluten. Jakob och Emil bistår som konsulter med
> olika ansvarsområden.

## Den nya helheten

`Kevins motor, RNG och events` → `Jakobs backend-/logikarbete` → `avgränsad etapp` → `samtal med Kevin` → `införliva, justera eller håll separat`

Samtidigt arbetar Kevin nära Emil med videogenerering, nya takes och
variationer. När media är redo går den till den branch och det flöde Kevin har
valt. Jakob har en tunn koppling till Emil genom färdiga artefakter och deras
metadata, inte genom ett separat gemensamt utvecklingsspår.

## Roller

| Part | Roll | Äger eller levererar | Gräns |
| --- | --- | --- | --- |
| Kevin | Projektledare och produktägare | GitLab-repot, motor, RNG/events, videoarbetsflöde och integrationsbeslut | V3 ändrar inte hans branch eller agentregler automatiskt. |
| Jakob | Backend-/logikkonsult | Sortering av spellogik, eventträd, verifiering och integrationsunderlag på `jakeminator123/work` | Bygger ovanpå Kevins motor och skapar inte en konkurrerande RNG. |
| Emil | Videokonsult nära Kevin | Generering, takes, variationer och mediahandoff i Kevins valda flöde | Har endast en tunn artefaktkoppling till Jakobs spår. |
| Bettalotto | Backoffice | Behörig data- och mediaåtkomst | Hemligheter och produktionsdata hålls utanför Git, wiki och canvas. |

## Det som ändras från V2

- V3 jämför inte tre motorer för att hitta den ”bästa” lösningen.
- `spelsajt` och Emils äldre GitHub-repo är historiska referenser, inte
  integrationsbas.
- Kevins redan existerande Croupier-motor är teknisk grund.
- Jakob arbetar utanför Kevins branch mellan avstämningarna.
- Emil arbetar i första hand med Kevin, inte i ett separat Jakob–Emil-spår.
- OpenClaw, en ny RNG och andra större arkitekturidéer är möjliga framtida
  förslag, inte förutsättningar för V3.

## Dokumentationsytorna

| Yta | Ansvar |
| --- | --- |
| Croupier på GitLab | Produktkod och runtime. |
| Croupier `docs/animation-events/` | Redigerbar V3-sakmodell nära koden. |
| GitLab-wikin | Läsbar V3-spegel, gemensam inbox, beslutskällor och handoff. |
| GitHub `animation-events-v1` | Samma V3-texter och källkod för HTML-generatorn. `v1` är ett historiskt reponamn. |
| Vercel | Den klickbara webcanvasen, byggd från GitHub. Branchpreview är automatisk; produktionspublicering är ett medvetet steg. |

[Öppna webcanvasen](https://animation-events-v1.vercel.app/) eller
[öppna wikin](https://gitlab.com/scout-gg/croupier/-/wikis/home).
En `.html`-länk i GitLab-wikin kan visa källkod; den är inte den körbara canvasen.

## En gemensam inbox, flera tydliga agentnamn

Varje ansluten chatt använder ett stabilt namn, exempelvis
`Agent-granska-andringar, Jakob`, och ett eget läsminne. Vid en ny användartur
gör den en snabb kontroll i [den gemensamma inboxen](https://gitlab.com/scout-gg/croupier/-/wikis/agent-inbox).
Inget relevant nytt: fortsätt tyst med användarens uppgift. Relevant fråga:
kontrollera mottagare och mandat, svara inom uppdraget och återge samma besked
i den lokala chatten. Inga kontrollkvitton eller polling mellan turerna.

Kevin och Emil kan ansluta sina egna agenter med samma upplägg. En annan
agents meddelande är samordningsunderlag, inte automatisk behörighet att ändra
motor, godkänna media eller integrera en branch.

## Arbetsprincip

Jakob når en tydligt definierad etapp, verifierar vad som är runtime och vad som
är förslag och tar sedan ett nytt samtal med Kevin. Kevin beslutar om arbetet
ska införlivas, justeras eller ligga kvar separat.

---

**V3 i en mening:** Kevins motor är grunden, Jakob sorterar backend och logik
runt den, Emil bygger video nära Kevin och Kevin avgör vad som går in.
