# Arbetssätt och verifiering

[Till systemkartan](../README.md) · [Lästa källor och avgränsning](../KALLOR.md)

Utgå från den konkreta situation Jakob beskriver och ange sedan källtyp,
data och kodnamn. Ett begripligt träd kan visa behov, alternativ, saknade
inspelningar och befintligt material utan att bestämma fysisk filplacering.

| Källa | Ansvar |
| --- | --- |
| Croupier-repot | Produktkod, kontrakt, media och kontrollerbar implementation |
| [Gemensamma wikin](https://gitlab.com/scout-gg/croupier/-/wikis/home) | Beslut, samarbete och handoff |
| [Aktiv V3-dokumentation](../../../../docs/animation-events/v3-9-days-mvp/README.md) | Repo-nära sakmodell och förslag för produktintegration |
| [Jakobs daterade noter](../../README.md) | Begripliga arbetsrapporter och lokala resonemang |
| [JOHN-HANDOFF](../../../../docs/JOHN-HANDOFF.md) | Daterade leveranser, testresultat och kvarstående gap |
| [GitHub/Vercel-canvasens källguide](../../../../docs/animation-events/v3-9-days-mvp/CANVAS.md) | Presentation av dokumentationen |
| Jira CAC | Implementation och faktisk QA-status |

Kevin äger motor och produktintegration. Jakob arbetar med backend, logik
och avgränsade förslag på sin work-branch. Kevin och Emil äger videoflödet.
En lokal labbändring eller agentförklaring är inte ett integrationsbeslut.
[Roller och etappflöde](../../../../docs/shared/WORKFLOW.md).

Verifiering har flera olika frågor:

| Kontroll | Vad den kan belägga |
| --- | --- |
| Läsning av kod/schema/register | Att fält, typer och referenser finns |
| Studio-/Director-tester | Regler, kontrakt, projektion, sparning och fallback |
| Riktigt råd/chattanrop | Att just den modellvägen fungerade vid provet |
| Medieaudit och hash | Att överenskomna bytes/metadata inte ändrats oavsiktligt |
| Visuell rehearsal i riktig spelare | Exakt tal, kontakt, rörelse och två påföljande uppspelningar |
| Kontrollerad aktuell bindning | Vilket material den angivna revisionen/körningen faktiskt väljer |

Ingen enskild rad bevisar alla de andra. Vid media-/spelarändringar gäller
[AGENTS.md](../../../../AGENTS.md), [pre-commit-kontrollerna](../../../../.githooks/pre-commit)
och `node pipeline/audit-dealer-sync.mjs --probe`, tillsammans med granskning
av alla fyra dealers i riktig rehearsal. Dokumentationens kartläggning
godkänner inga nya takes.

**Tidigare verifierat:** Windows-rapporten dokumenterar 113 hooktester och
90 stream-prober. Senare nod-/röstleveranser utökade studions testsuite;
den senaste röstnoteringen redovisar 114 studiotester. Dessa siffror hör
till respektive leverans och är inga nykörningar gjorda av systemkartan.

För Windows-frågor, läs [testreparationen](../../../../docs/WINDOWS-MEDIA-TESTS.md)
och [den separata datoragentens diagnosprompt](../../PROMPT-windows-cursor-bash.md).
Ett gammalt process-PATH eller nekad sandboxåtkomst är inte automatiskt ett
nytt produktfel eller skäl att installera om verktyg.

Agentkommunikationen finns beskriven i [inboxguiden](../../../../docs/shared/AGENT-INBOX.md).
Exakt mottagare, tydligt uppdrag och länkat underlag hjälper till att hålla
samma språk. Ingen bakgrundspollning eller automatisk inkoppling till
spelarchatt följer av denna dokumentationsmapp.
