# Animation events · dokumentationsnav

Det här är den versionsstyrda källan för Jakobs arbete med event, triggers och videovarianter i Croupier.

## Sanning och spegling

1. **GitLab `scout-gg/croupier`** är huvudrepo.
2. Jakob arbetar på **`jakeminator123/work`**.
3. Den gemensamma mänskliga ytan är [GitLab-wikin](https://gitlab.com/scout-gg/croupier/-/wikis/home).
4. GitHub/Vercel-presentationen är endast en spegling och uppdateras efter att GitLab-versionen är sammanhängande och granskad.

Runtime-sanning kommer alltid från Kevins aktuella Croupier-kod, manifest och verifierade testresultat. Dokumentationen får beskriva förslag, men ska märka dem som förslag.

## Versioner

| Version | Status | Sökväg |
| --- | --- | --- |
| `v2-long-term-goal-best-rng` | Fryst historiskt underlag | `archive/v2-long-term-goal-best-rng/` |
| `v3-9-days-mvp` | Aktiv dokumentationsversion | `v3-9-days-mvp/` |

V3 är ett dokumentnamn, inte en ny kodbranch. Aktiv kodbranch är fortsatt `jakeminator123/work`.

- Wiki V3: https://gitlab.com/scout-gg/croupier/-/wikis/animation-events/v3-9-days-mvp/README
- Wiki V2-arkiv: https://gitlab.com/scout-gg/croupier/-/wikis/archive/v2-long-term-goal-best-rng/README

## Synkregel

- Redigera och granska V3 här först.
- Spegla därefter samma beslutad text till wikin.
- Märk skillnaden mellan **mötesbeslut**, **verifierad runtime**, **Jakobs förslag**, **Kevin + Emil videoarbete** och **beslut krävs**.
- Lägg aldrig hemligheter, tokens eller `.env`-värden i dokumentationen.
- Pusha inte V3-regler till Kevins branch. Vanlig dokumentation styr inte hans agenter automatiskt.
- GitHub/Vercel uppdateras sist och får inte bli en parallell källa till sanning.

## Ansvar

- **Kevin:** chef, repo-/motorägare och slutligt integrationsbeslut.
- **Emil:** videoproduktion och variationer tillsammans med Kevin; nya videor går till Kevins branch.
- **Jakob:** backend, logik, eventträd, tester och dokumentation på sin branch; etappvisa samtal med Kevin.
