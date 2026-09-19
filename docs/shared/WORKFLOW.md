# V3-workflow för Jakob

Detta arbetssätt gäller `jakeminator123/work`. Det är inte en instruktion till
Kevin eller hans agenter och får inte kopieras till hans branch som en automatisk
regel.

## Kanoniska ytor

1. GitLab-repot `scout-gg/croupier`: kod, motor, media och verifierad runtime.
2. [GitLab-wikin](https://gitlab.com/scout-gg/croupier/-/wikis/home): gemensamma
   beslut, kartor och handoff.
3. `docs/animation-events/v3-9-days-mvp/`: Jakobs aktiva V3-underlag.
4. `docs/animation-events/archive/v2-long-term-goal-best-rng/`: oförändrat
   V2-arkiv.

GitHub och Vercel får spegla presentationen efteråt, men är inte facit.

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

- Kort Jakob–Kevin-fråga: [work item #1](https://gitlab.com/scout-gg/croupier/-/work_items/1).
- Uppgiftsspecifik diskussion hör till relevant issue eller merge request.
- Videoöverlämning från Emil går till Kevin; Jakob konsumerar den verifierade
  artefakten och dess kontrakt när den är tillgänglig.

Workflow-wiki: https://gitlab.com/scout-gg/croupier/-/wikis/workflow
