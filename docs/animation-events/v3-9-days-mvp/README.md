# Animation events · V3

> V3 beskriver arbetssättet efter beslutsrundan mellan Jakob, Emil och Kevin.
> Kevins befintliga Croupier-motor, RNG och events är grunden. V3 ersätter
> varken motorn eller Kevins integrationsbeslut.

## Börja här

- [Öppna webcanvasen](https://animation-events-v1.vercel.app/) — den klickbara presentationen.
- [Öppna den gemensamma wikin](https://gitlab.com/scout-gg/croupier/-/wikis/home) — beslut, arbetsflöde och handoff.
- [Öppna källkoden till webcanvasen](https://github.com/Jakeminator123/animation-events-v1) — Markdown, HTML-generator och versionshistorik.

`animation-events-v1` är repots och Vercel-projektets historiska namn, inte
versionen på innehållet. V3 är den aktuella dokumentationsmodellen. Även
katalognamnet `v3-9-days-mvp` är historiskt: mötet beslutade inte en niodagarsfrist.

## Samma V3, tydliga källor

| Yta | Roll |
| --- | --- |
| GitLab `scout-gg/croupier` | Kod, motor, media och verifierbar runtime. |
| Croupier `docs/animation-events/v3-9-days-mvp/` | Redigerbar källa för V3:s sakmodell, s00–s06, beslutslogg och tekniska kvitto. |
| GitLab-wikin | Läsbar spegel av V3 samt gemensam inbox, beslutskällor och handoff. |
| GitHub `Jakeminator123/animation-events-v1` | Samma V3-texter, plus källrepo för HTML-generatorn och den interaktiva webcanvasen. |
| Vercel | Kör den byggda webcanvasen; är varken ett nytt repo eller en spelmotor. |

GitHub-canvasen är alltså en riktig del av dokumentationsflödet, men den är
inte källa för RNG, wallet, kort eller spelregler. De kommer alltid från
Croupier.

En `.html`-fil i GitLab-wikin är en käll-/nedladdningskopia och kan visas som
kod. Den är inte den klickbara webcanvasen. Använd Vercel-länken ovan, eller
öppna en nedladdad `index.html` lokalt.

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
- **Gemensamt språk:** begrepp som Kevin bekräftat i samarbetsytan; inte i sig kodnamn.
- **Verifierat i kod:** belagt med branch, commit och fil/symbol; säger inte att hela kedjan är körtestad.
- **Arbetsförslag:** namngiven persons modell eller plan; inte automatiskt en del av motorn.
- **Beslut krävs:** Kevin eller annan uttrycklig ägare behöver ta ställning.

## Samarbete utan extra brus

Kevin, Jakob och Emil använder samma [namngivna agent-inbox](https://gitlab.com/scout-gg/croupier/-/wikis/agent-inbox).
Varje ansluten chatt kontrollerar en gång när användaren skriver, behåller eget
läsminne och svarar med stabilt agentnamn. Relevant svar återges också i den
lokala chatten; ingen skriver ett meddelande bara för att den har kontrollerat.
En inboxfråga innebär inte automatiskt ett nytt uppdrag eller godkänd integration.

## Klart när

- alla runtimepåståenden kan följas till rätt Croupier-revision;
- wiki, repo och GitHub-canvas berättar samma V3 utan att blanda in V2 som nutid;
- Jakob kan arbeta etappvis ovanpå Kevins motor och lämna ett avgränsat underlag;
- Kevin kan införliva, justera eller avstå utan att dokumentationen redan har
  behandlat ett förslag som produktkod.
