# Handoff — nästa agent på Jakobs Croupier-branch

## Omfattning

Den här handoffen gäller endast `jakeminator123/work`. Den ska inte ändra eller
ersätta Kevins branch, agentregler eller integrationsbeslut.

Läs i denna ordning:

1. `AGENTS.md` för tekniska säkerhets- och regressionsregler.
2. `docs/shared/WORKFLOW.md` för Jakobs V4-arbetssätt.
3. `docs/animation-events/v4-8-days-mvp/` för det aktiva underlaget.
4. Senaste relevanta del av `docs/JOHN-HANDOFF.md` och
   `docs/ENVIRONMENT-RESTORATION.md` för verifierad runtime och mediahistorik.

V2 finns bevarad i [Jakobs-v1](https://github.com/Jakeminator123/github-work/tree/Jakobs-v1/docs/animation-events/archive/v2-long-term-goal-best-rng),
inte längre i arbetskopian. Den är historik, inte aktiv arkitektur.

## Roller och källor

- Kevin äger `scout-gg/croupier`, motorn och beslut om produktintegration.
- Jakob utvecklar backend, logik och eventpusslet på `jakeminator123/work` och
  håller sig etappvis ajour med Kevins branch.
- Emil arbetar nära Kevin med video och variationer. Nya videor landar på den
  branch Kevin anger.
- Jakob har en tunn koppling till Emil genom verifierade assets, manifest,
  event-/asset-id och handoff; skapa inte ett parallellt videosamarbete.
- GitLab-repot är runtimekälla och
  [wikin](https://gitlab.com/scout-gg/croupier/-/wikis/home) är gemensam
  besluts-/handoffyta. GitHub `animation-events-v1` är källrepo för den
  interaktiva canvasen, inte för RNG eller spelregler.

## Arbetsregel

- Kontrollera aktuell branch före ändringar. Arbeta inte vidare om den inte är
  `jakeminator123/work` utan ett nytt uttryckligt uppdrag.
- Bygg ovanpå Kevins faktiska RNG, events, Partner API och manifest. En nod som
  inte kan beläggas i runtime ska märkas **föreslagen**.
- Bevara orelaterade worktree-ändringar och committa endast uppgiftsägda filer.
- Pusha inte `main`, force-pusha inte och skapa inte en integrations-MR utan
  Kevins eller Jakobs uttryckliga beslut om målbranch.
- Vid färdig etapp: dokumentera kontrakt, tester/evidens och kvarvarande gap;
  stäm därefter av med Kevin innan eventuell inkorporering.
- Håll Jira CAC:s faktiska status uppdaterad; dokumentstatus i V4 ersätter inte
  `In Dev`, `Ready for QA`, `In Testing` eller verifierad `Done`.

## Kommunikation

- Kevin–Jakob–Emil: https://gitlab.com/scout-gg/croupier/-/work_items/1
- Läs [inbox-workflowet](AGENT-INBOX.md). Kontrollera `/ping-croupier` en gång
  i början av varje ny användartur. Använd ett stabilt agentnamn från chatten
  och en egen läsmarkering; ignorera den gamla gemensamma seen-filen.
- Var tyst om inget relevant hänt. Återge relevanta svar och agentens egna
  publicerade svar för den lokala användaren. Ingen polling mellan turerna.
- Uppgiftsspecifika frågor hör till relevant issue eller merge request.
- Lägg aldrig tokens, lösenord eller privata mediefiler i wiki, issue eller Git.
