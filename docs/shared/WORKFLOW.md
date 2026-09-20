# V4-workflow för Jakob

Detta arbetssätt gäller `jakeminator123/work`. Det är inte en instruktion till
Kevin eller hans agenter och får inte kopieras till hans branch som en automatisk
regel.

## Kanoniska ytor

1. GitLab-repot `scout-gg/croupier`: kod, motor, media och verifierad runtime.
2. [GitLab-wikin](https://gitlab.com/scout-gg/croupier/-/wikis/home): gemensamma
   beslut, kartor och handoff.
3. [GitHub `animation-events-v1` · V4](https://github.com/Jakeminator123/animation-events-v1):
   källrepo för den interaktiva V4-canvasen och den publika presentationen.
4. `docs/animation-events/v4-8-days-mvp/`: repo-nära V4-underlag.
5. `docs/animation-events/archive/v2-long-term-goal-best-rng/`: oförändrat
   V2-arkiv.

Canvasen är facit för hur presentationen är uppbyggd. Croupier är fortsatt
facit för motor, RNG, events, media och faktisk runtime.

## Roller efter beslutsmötet

- **Kevin** äger GitLab-repot, Croupier-motorn och beslut om integration. Han
  avgör vad som tas in i produktspåret.
- **Jakob** arbetar med backend, logik och eventpusslet på
  `jakeminator123/work`, byggt ovanpå Kevins RNG och faktiska events.
- **Emil** arbetar nära Kevin med videoproduktion och variationer. Nya videor
  ska landa på den branch Kevin anger.
- **Jakob ↔ Emil** är en tunn artefaktkoppling: manifest, event-/asset-id,
  acceptanskriterier och handoff, inte gemensam daglig implementation.

## Etappflöde

1. Före en etapp: hämta och jämför Kevins senaste branch. Utgå från körande kod,
   event, Partner API och manifest; uppfinn inte en parallell spelmotor.
2. Bygg en avgränsad etapp på `jakeminator123/work`. Märk dokumentation som
   **beslutad**, **föreslagen** eller **verifierad i runtime**.
3. När etappen är testad: sammanfatta ändrade kontrakt, berörda filer, evidens
   och öppna frågor för Kevin.
4. Ta ett avstämningssamtal med Kevin. Integration sker endast genom den
   granskade väg och målbranch som Kevin godkänner.
5. Rebasea eller force-pusha inte delade branches. Pusha aldrig direkt till
   `main`.

## Kommunikation

- Kevin–Jakob–Emil och deras namngivna agenter:
  [work item #1](https://gitlab.com/scout-gg/croupier/-/work_items/1).
- Uppgiftsspecifik diskussion hör till relevant issue eller merge request.
- Videoöverlämning från Emil går till Kevin; Jakob konsumerar den verifierade
  artefakten och dess kontrakt när den är tillgänglig.

På Jakobs begäran kontrolleras inboxen nu en gång i början av varje ny
användartur. Agenten har ett namn som liknar chatttiteln och en egen
läsmarkering. Inget relevant nytt ger ingen extra text i den lokala chatten.
Ett relevant svar återges kort med avsändare och länk; agentens svar om den
aktuella uppgiften återges både i GitLab och för den lokala användaren.
Ingen polling sker mellan turerna och ingen kommentar skickas bara för att
agenten har läst. Se [hela inbox-workflowet](AGENT-INBOX.md), inklusive snabb
API-kontroll, webbläsarreserv och hur Kevin/Emil ansluter sina egna agenter.

`.agents/skills/ping-croupier/SKILL.md` är Codex-källan. Den byte-identiska
`.cursor/skills/ping-croupier/SKILL.md` behålls som kompatibilitetskopia för
Cursor och ska uppdateras i samma commit när skillen ändras.

## Aktiv arbetsstatus i Jira CAC

GitLab-repot är källan för kod och runtime, GitLab-wikin är källan för
gemensamma beslut och dokumentation och Jira CAC är den aktiva work-trackern
för implementation och QA.

Innan implementation läser Jakob aktuell issue description, Expected Result
och custom fields, upptäcker tillgängliga transitions och flyttar arbetet till
**In Dev**. **Ready for QA** används först när fix och reproduktionsevidens är
klara. **In Testing** används endast medan faktisk QA pågår. **Done** används
först när hela Expected Result är verifierat; misslyckad QA går tillbaka till
**In Dev**.

## Canvas-synk

När sakmodellen ändras uppdateras i samma leverans:

1. s00–s06 och den interaktiva `index.html` i GitHub-canvasens publiceringsbranch;
2. motsvarande V4-sidor i Croupier och GitLab-wikin;
3. beslutslogg och teknisk runtime-verifiering när fakta eller revisionsankare
   ändras.

Workflow-wiki: https://gitlab.com/scout-gg/croupier/-/wikis/workflow
