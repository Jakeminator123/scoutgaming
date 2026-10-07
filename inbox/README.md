# Teaminbox

Meddelanden och beslut mellan Jakob, John, Kevin och Emil ligger som GitHub Issues
på `Jakeminator123/scoutgaming` med etiketten `inbox`. Inget nytt system att logga
in i: GitHub skickar e-post vid omnämnande, trådar svaren och går att söka.
Det här är inte den nedlagda GitLab-inboxen; `.croupier-inbox/` återskapas inte.

## Läsa

| Vem | Länk |
|---|---|
| Allt öppet | <https://github.com/Jakeminator123/scoutgaming/issues?q=is%3Aopen+label%3Ainbox> |
| Till John | <https://github.com/Jakeminator123/scoutgaming/issues?q=is%3Aopen+label%3Atill%3Ajohn> |
| Till Kevin | <https://github.com/Jakeminator123/scoutgaming/issues?q=is%3Aopen+label%3Atill%3Akevin> |
| Till Emil | <https://github.com/Jakeminator123/scoutgaming/issues?q=is%3Aopen+label%3Atill%3Aemil> |
| Till Jakob | <https://github.com/Jakeminator123/scoutgaming/issues?q=is%3Aopen+label%3Atill%3Ajakob> |
| Väntar på beslut | <https://github.com/Jakeminator123/scoutgaming/issues?q=is%3Aopen+label%3Abeslut> |

## Skriva

I GitHub: nytt ärende, sätt `inbox` och `till:<namn>`; `beslut` om du vill ha ett svar.
Från terminalen (kräver `gh auth login`):

```
node tools/inbox.mjs send --to john --subject "Rubrik" --body-file brev.md --decision
node tools/inbox.mjs list --to kevin
node tools/inbox.mjs read 12
node tools/inbox.mjs reply 12 --body-file svar.md
node tools/inbox.mjs done 12
```

## Regler

- Ett ärende per fråga eller per beslutsomgång. Svara i kommentarer, inte i nya ärenden.
- Beslut skrivs som `Rad 4: A` av den som bestämmer. Den som frågade stänger ärendet.
- Mottagare utan accepterad GitHub-inbjudan nämns i klartext och nås inte förrän
  inbjudan är accepterad. Pinga då med en kommentar som nämner personen.
- Agenter får läsa och skriva via verktyget, men stänger inte andras ärenden.
- Inga hemligheter, lösenord eller anslutningssträngar i ärenden.
- Personregistret är `inbox/people.json`. Lägg till GitHub-namn när en inbjudan accepterats.
