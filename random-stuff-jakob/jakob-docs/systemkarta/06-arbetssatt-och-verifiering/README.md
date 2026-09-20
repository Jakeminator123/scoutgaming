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
| [Jakobs arkiv](../../arkiv/README.md) | Daterade arbetsrapporter och underlag |
| [Findings](../../../../docs/findings/README.md) | Buggar, förbättringar och granskningsbehov med separat evidens och triage |
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
90 stream-prober. CLI-röstprovet redovisade 114 studiotester; den senare
[runtime-/röstpanelleveransen](../../arkiv/2026-09-20/2026-09-20-openclaw-instruktioner-och-rostpanel.md)
redovisar 138 labbtester, 79 runtime-tester samt typecheck och bygge.
Dessa siffror hör till respektive leverans och är inga nykörningar gjorda
av systemkartan.

## Dokumentation som går att fortsätta arbeta i

Lägg systemförklaringar i rätt ämne, observationer i findings och daterade
arbetskvitton i arkivet. Behåll ett fynds ID när slutsatsen ändras och länka
dess Jira-issue när sådan finns. Ett arkiverat underlag kan fortfarande
beskriva ett öppet problem. F-001/F-002 inväntar Kevins särskilda besked;
denna omorganisation ändrar inte det villkoret.

JOHN-HANDOFF behåller sin kanoniska plats och historik. Senare notiser har
ibland lagts längst ned, så toppens placering ensam fastställer inte senaste
läget. Använd länkad leveransrapport, datum och revision. Nya korta handoff-
notiser bör läggas överst och länka till rätt ämne, fynd och arkivrapport.

För Windows-frågor, läs [testreparationen](../../../../docs/WINDOWS-MEDIA-TESTS.md)
och [den separata datoragentens diagnosprompt](../../arkiv/2026-09-20/PROMPT-windows-cursor-bash.md).
Ett gammalt process-PATH eller nekad sandboxåtkomst är inte automatiskt ett
nytt produktfel eller skäl att installera om verktyg.

Agentkommunikationen finns beskriven i [inboxguiden](../../../../docs/shared/AGENT-INBOX.md).
Exakt mottagare, tydligt uppdrag och länkat underlag hjälper till att hålla
samma språk. Ingen bakgrundspollning eller automatisk inkoppling till
spelarchatt följer av denna dokumentationsmapp.
