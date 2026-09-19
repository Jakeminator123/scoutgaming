# Animation events · dokumentationsnav

Det här är den versionsstyrda källan för Jakobs arbete med event, triggers och videovarianter i Croupier.

## Ytor med olika ansvar

1. **GitLab `scout-gg/croupier`** är källan för motor, spelkod, media och runtime.
2. Jakob arbetar på **`jakeminator123/work`**.
3. [GitLab-wikin](https://gitlab.com/scout-gg/croupier/-/wikis/home) är den gemensamma ytan för beslut, workflow och handoff.
4. [GitHub `animation-events-v1` · V3](https://github.com/Jakeminator123/animation-events-v1/tree/v3-9-days-mvp) är källbranch för den interaktiva canvasen och dess V3-presentation.

Runtime-sanning kommer alltid från Kevins aktuella Croupier-kod, manifest och verifierade testresultat. Dokumentationen får beskriva förslag, men ska märka dem som förslag.

## Versioner

| Version | Status | Sökväg |
| --- | --- | --- |
| `v2-long-term-goal-best-rng` | Fryst historiskt underlag | `archive/v2-long-term-goal-best-rng/` |
| `v3-9-days-mvp` | Aktiv V3-branch/sökväg; namnet är historiskt och innebär inte ett beslutat niodagarslöfte | `v3-9-days-mvp/` |

V3 är ett dokumentnamn, inte en ny kodbranch. Aktiv kodbranch är fortsatt `jakeminator123/work`.

- Wiki V3: https://gitlab.com/scout-gg/croupier/-/wikis/animation-events/v3-9-days-mvp/README
- Wiki V2-arkiv: https://gitlab.com/scout-gg/croupier/-/wikis/archive/v2-long-term-goal-best-rng/README

## Synkregel

- Redigera och granska V3 här först.
- Spegla därefter samma beslutad text till wikin.
- Märk skillnaden mellan **mötesbeslut**, **verifierad runtime**, **Jakobs förslag**, **Kevin + Emil videoarbete** och **beslut krävs**.
- Lägg aldrig hemligheter, tokens eller `.env`-värden i dokumentationen.
- Pusha inte V3-regler till Kevins branch. Vanlig dokumentation styr inte hans agenter automatiskt.
- GitHub-canvasen uppdateras tillsammans med repo och wiki. Den är källa för
  presentationen, men får inte bli en parallell spelmotor eller runtimekälla.

## Ansvar

- **Kevin:** chef, repo-/motorägare och slutligt integrationsbeslut.
- **Emil:** videoproduktion och variationer tillsammans med Kevin; nya videor går till Kevins branch.
- **Jakob:** backend, logik, eventträd, tester och dokumentation på sin branch; etappvisa samtal med Kevin.
