# Animation events · V3

> V3 beskriver arbetssättet efter beslutsrundan mellan Jakob, Emil och Kevin.
> Kevins befintliga Croupier-motor, RNG och events är grunden. V3 ersätter
> varken motorn eller Kevins integrationsbeslut.

## Samma V3 på fyra ytor

| Yta | Roll |
| --- | --- |
| GitLab `scout-gg/croupier` | Kod, motor, media och verifierbar runtime. |
| GitLab-wikin | Gemensamma beslut, arbetsdokument och handoff. |
| GitHub `Jakeminator123/animation-events-v1` | Källrepo för den interaktiva V3-canvasen och den publika presentationsversionen. |
| Den här katalogen | Repo-nära kopia som gör V3 granskningsbar tillsammans med Croupier-koden. |

GitHub-canvasen är alltså en riktig del av dokumentationsflödet, men den är
inte källa för RNG, wallet, kort eller spelregler. De kommer alltid från
Croupier.

## Läsordning

1. [s00 · helheten](s00-helheten.md)
2. [s01 · kartan](s01-kartan.md)
3. [s02 · språket](s02-spraket.md)
4. [s03 · eventträdet](s03-eventtradet.md)
5. [s04 · säker presentation](s04-saker-presentation.md)
6. [s05 · ordlistan](s05-ordlista.md)
7. [s06 · etappplanen](s06-plan.md)
8. [Beslutslogg](DECISIONS.md)
9. [Teknisk runtime-verifiering](RUNTIME-EVIDENCE.md)
10. [Canvas och publiceringsflöde](CANVAS.md)

## Statusord

- **Mötesbeslut:** kommer från beslutsrundan och styr V3:s riktning.
- **Verifierat i runtime:** belagt med branch, commit och fil/symbol.
- **Arbetsförslag:** Jakobs modell eller plan; inte automatiskt en del av motorn.
- **Beslut krävs:** Kevin eller annan uttrycklig ägare behöver ta ställning.

## Klart när

- alla runtimepåståenden kan följas till rätt Croupier-revision;
- wiki, repo och GitHub-canvas berättar samma V3 utan att blanda in V2 som nutid;
- Jakob kan arbeta etappvis ovanpå Kevins motor och lämna ett avgränsat underlag;
- Kevin kan införliva, justera eller avstå utan att dokumentationen redan har
  behandlat ett förslag som produktkod.
