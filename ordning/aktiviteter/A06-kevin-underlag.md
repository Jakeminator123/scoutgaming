# A06 · Kevin-branchen: integrationsunderlag (läsande)

| Fält | Värde |
| --- | --- |
| Våg | 1 · parallell med alla · skriver bara i `ordning/rapporter/` |
| Väntar på | – |
| Leder till | B14 och svar på inkorg #10 (skickas av Jakob) |
| Branch / worktree | `jakob/ordning-inventering` (delas med A04 och A05) |
| Modell | grok-4.7-xhigh-fast |
| Risk | 5 % |

## Mål

Ett beslutsunderlag för vad som ska tas från `kevin` till `main`, utan att
någon helmerge görs som del av städningen.

## Fakta (00ea55c5 / `origin/kevin` `76bc5827`)

- `kevin` ligger 113 commits före och 83 efter `main` (merge-base `7714ec6c`).
  Kevin mergade in `main` vid `0a1279a`.
- Kevins app finns i `kevin/croupier-scoutgg/` och deployas från `kevin` till
  croupier.scoutgg.dev. Enligt inkorg #10:
  - Table Studio på `/studio`: login mot BO-konton, ett bord med dealer, rum,
    filt, språk, gränser och logga, delas som `/t/<slug>`;
  - dealers Paow och Dragan på Emils KLARA-klipp, med hålkort och filmad vändning;
  - läppsynk enligt Emils recept (−16 LUFS, crf 13) för 264 repliker och livechatt;
  - operatörslogga;
  - backoffice på `/bo`.

  Kopplingspunkter: `GET /api/studio/session`, `POST /api/studio/login|logout`,
  `GET/POST /api/studio/table`, `GET /api/presentation?brand=`, `/api/table`,
  `/api/internal/game-audit/integration` och media i
  `public/media/dealers/<id>/v2/` med `meta.json`.
- Krockar med main: `/studio` är Studio-tjänstens basePath i main. `/bo` är ett
  pensionerat alias i main. `lab/components/kevin-bo/` i main är den aktiva
  partnerportalen och har inget med `kevin/` att göra.

## Ägda filer

Endast `ordning/rapporter/A06-kevin.md` (ny).

## Steg

0. Steg 0 enligt ORKESTRERING §4 och `git fetch origin` (läsning).
   Checka inte ut `kevin` i någon worktree. Läs med `git show origin/kevin:<sökväg>`,
   `git diff --stat origin/main...origin/kevin` och
   `git log --oneline origin/main..origin/kevin`.
1. **Funktionskarta:** för varje Kevin-funktion, vilken motsvarighet finns i
   main (fil, route, status)? Är den bättre, sämre eller saknad?
2. **Kandidater för selektiv import**, t.ex. klippövergångar, greenscreen,
   samordning av tal och utdelning, läppsynksreceptet och loggan i filten:
   filer, storlek, beroenden, krockar med mains kontrakt (servern äger
   spelmotorn, saldot och medieacceptansen) och risk.
3. **Media:** Kevins dealermedia (Paow, Dragan/Dragge), med storlek och om main
   redan har motsvarande registrerade dealers.
4. **Utkast till svar** på inkorg #10, på svenska och högst cirka 150 ord.
   Skicka inte.

## Klart när

- [ ] Funktionskartan och kandidatlistan finns, med risk och storlek.
- [ ] Svarsutkastet finns.

## Tveksamt att lyfta

- Allt som skulle kräva en ändring av spelmotorns, saldots eller
  medieacceptansens ägarskap.
- Namnkrockarna `/studio` och `/bo`.
