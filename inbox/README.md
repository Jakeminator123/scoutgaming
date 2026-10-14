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
| Jakobs laptop | <https://github.com/Jakeminator123/scoutgaming/issues?q=is%3Aopen+label%3Atill%3Ajakob-bgvp01j> |
| Jakobs stationdata | <https://github.com/Jakeminator123/scoutgaming/issues?q=is%3Aopen+label%3Atill%3Ajakob-dator2> |
| Väntar på beslut | <https://github.com/Jakeminator123/scoutgaming/issues?q=is%3Aopen+label%3Abeslut> |

## Skriva

I GitHub: nytt ärende, sätt `inbox` och `till:<namn>`; `beslut` om du vill ha ett svar.
Från terminalen (kräver `gh auth login`):

```
node tools/inbox.mjs send --to john --subject "Rubrik" --body-file brev.md --decision
node tools/inbox.mjs ping --to kevin --message "Kort fråga"
node tools/inbox.mjs list --to kevin
node tools/inbox.mjs list --to me
node tools/inbox.mjs read 12
node tools/inbox.mjs reply 12 --body-file svar.md
node tools/inbox.mjs done 12
```

## Agenter

### Jakobs två datorer

| Mottagare | Visningsnamn |
| --- | --- |
| `jakob-bgvp01j` | Jakobs laptop |
| `jakob-dator2` | Jakobs stationdata |

Datoraliasen finns i `inbox/devices.json` och hör till Jakob. De ändrar inte
grenägarskapet i `people.json`. Varje dator registrerar sitt eget ChatGPT-konto
en gång per checkout; värdnamn och absolut reposökväg läses automatiskt:

```sh
node tools/inbox.mjs register --device jakob-bgvp01j --email <laptopens-ChatGPT-mejl>
node tools/inbox.mjs register --device jakob-dator2 --email <stationdatas-ChatGPT-mejl>
node tools/inbox.mjs identity
```

Kör endast registreringsraden för den aktuella datorn. Profilen sparas i
gitignorerade `inbox/local-device.json`. Mejladress och lokal sökväg följer
inte med commits eller meddelanden. Kopiera inte profilen mellan datorerna;
registrera igen om kontot, datorn eller checkoutens sökväg ändras. Fel dator
eller sökväg stoppar användningen av profilen i stället för att välja fel inbox.

Från laptop till stationdata, respektive från stationdata till laptop:

```sh
node tools/inbox.mjs ping --to jakob-dator2 --message "Kan du kontrollera senaste ändringen?"
node tools/inbox.mjs ping --to jakob-bgvp01j --message "Kontrollen är klar."
node tools/inbox.mjs list --to me
```

`me` betyder den lokalt registrerade datorn. Utan registrering används
grenägaren som tidigare. `--to jakob` är fortfarande Jakobs gemensamma
personinbox och läses separat med `list --to jakob`. Avsändaren visas med
datorns namn och alias, om inte `--from` anges. Båda datorerna kan använda samma
GitHub-konto: separata `till:`-etiketter avgör mottagaren. En annan agent måste
läsa sin inbox när den arbetar; meddelanden väcker inte pausade GPT-chattar.

### Lokal och gemensam samordning

Två kanaler, olika räckvidd:

| Kanal | Når | Verktyg |
|---|---|---|
| Agent-talk | agenter i **samma checkout** på samma dator | `node tools/agent-talk.mjs claim/ping/ack/done` |
| Teaminbox | personer och deras agenter i **andra grenar och på andra datorer** | `node tools/inbox.mjs ping/send/list/reply` |

Utan datorregistrering läser en agent i Kevins checkout Kevins ärenden med
`node tools/inbox.mjs list --to me` via grenägaren i `people.json`.
Kort fråga till någon annan: `node tools/inbox.mjs ping --to john --message "…"`.
I Cursor finns `/ping <namn> <text>`. Agenter svarar i tråden, stänger bara egna ärenden
och behandlar ett svar som information, inte som godkännande att ändra repots logik.

## Regler

- Ett ärende per fråga eller per beslutsomgång. Svara i kommentarer, inte i nya ärenden.
- Beslut skrivs som `Rad 4: A` av den som bestämmer. Den som frågade stänger ärendet.
- Mottagare utan accepterad GitHub-inbjudan nämns i klartext och nås inte förrän
  inbjudan är accepterad. Pinga då med en kommentar som nämner personen.
- Agenter får läsa och skriva via verktyget, men stänger inte andras ärenden.
- Inga hemligheter, lösenord eller anslutningssträngar i ärenden.
- Personregistret är `inbox/people.json`. Lägg till GitHub-namn när en inbjudan accepterats.
