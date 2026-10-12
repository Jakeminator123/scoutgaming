# A02 · Handoff, README och användarguide i takt med koden

| Fält | Värde |
| --- | --- |
| Våg | 1 · omgång 1 · mergas in före A01 |
| Väntar på | – · B1 är beslutat, och README:s leveransmening följer det (README §4) |
| Branch | Molnagentens egen branch, inmergad på `jakob/repo-ordning` (lokalt alternativ: ORKESTRERING §2) |
| Modell | grok-4.7-xhigh-fast |
| Risk | 15 % · fakta kan tas bort som fortfarande gäller |

## Mål

En läsare kan förstå dagens produkt från `README.md` och toppen av
`docs/JOHN-HANDOFF.md` utan att gå igenom gamla arbetsrundor. Historiken finns
kvar i Git.

## Fakta (00ea55c5)

- `docs/JOHN-HANDOFF.md`: 222 KB, cirka 2 270 rader, med daterade avsnitt från
  många rundor. Exempel på föråldrad uppgift: avsnittet "Rätt dealer" säger att
  Amira/Vera/Mei använder originalmotorn, men `web/public/app.mjs` kräver
  presentation `local` eller `layered` och kastar
  `Presentation requires registered cloud media` för allt annat. Produktionen
  bekräftar (BASLINJE §8): inga registerposter eller paket refererar Astrids
  gamla filer. Filen har cirka 17 referenser till `random/`.
- `main` har ändrat handoffen under dagen (Dealer Forge, `/play`-fixen
  `e160af12`, historikrensningen). Bevara de nya avsnitten i "Senaste leveranser".
- `README.md` listar N1-sidor efter den gamla strukturen (`/control/videos`,
  `/control/zones`, `/control/lanes`, `/control/activity` …). AGENTS.md
  beskriver den nya: Studio (`/control/clips`, `/control/library`,
  `/control/compositions`), Spelbolag (`/control/companies`, `/control/rooms`),
  Drift, System och `/control/rehearsal`. Gamla adresser omdirigerar.
  README:s runtime-karta pekar på `dealer-engine.mjs` som uppspelning; dagens
  spelare är `local-presentation.mjs`, `performance-player.mjs` och
  `layered-presentation.mjs`.
- `lab/docs/README.md` (56 KB, användarguide) och `lab/README.md` (31 KB)
  innehåller troligen samma föråldrade ruttnamn.

## Ägda filer

`docs/JOHN-HANDOFF.md`, `README.md`, `lab/docs/README.md`, `lab/README.md`,
`lab/docs/TERMINOLOGI.md` (bara om en term är fel), `ordning/rapporter/A02-rattelser.md`.

**Rör inte:** `AGENTS.md`, `CLAUDE.md`, `.cursor/**` (A03),
`docs/CLOUD-MIGRATION.md`, `docs/LOCAL-PRESENTATION-RUNTIME.md` och
`docs/system-map/**` (A01).

## Steg

0. Steg 0 enligt ORKESTRERING §4.
1. **Faktablad från koden.** Lista sidor och omdirigeringar ur
   `lab/app/**/page.tsx` och `route.ts`, `apps/croupier-frontend/app/**`,
   `lab/lib/workspace-surfaces.mjs`, `lab/components/kevin-bo/navigation.mjs`
   och `docs/system-map/routes.json`. Ange för varje adress: sida, omdirigering
   eller API.
2. **JOHN-HANDOFF.md** byggs om till:
   1. *Aktuellt läge* (en skärm: ytor, drift, vad som är verifierat och var);
   2. *Öppna kontroller och kända fel*;
   3. *Senaste leveranser* (14 dagar, högst cirka 15 rader per leverans: vad,
      prov, kvar);
   4. en rad: "Äldre avsnitt: `git show 00ea55c5:docs/JOHN-HANDOFF.md`".

   Målet är högst cirka 60 KB. Behåll varje fortfarande giltig
   medieacceptansnotering (godkänd tagning, hash, per-rad-resultat) eller
   hänvisa exakt till den. Ersätt `random/`-hänvisningar med A01:s nya platser.
   Hänvisa annars till `git show 00ea55c5:random/<fil>`.
3. **README.md:** synka nivå- och sidtabellen med AGENTS.md och faktabladet,
   rätta runtime-kartan och behåll alla länkar. Ändra leveransmeningen ("Work on
   `main`; deliver with …") bara om B1 finns i prompten. Annars lämnas den åt
   A03.
4. **lab/docs/README.md och lab/README.md:** rätta bara verifierbart
   föråldrade sid- och funktionsnamn. Skriv inte om.
5. **Rättelselogg:** för varje borttagen eller ändrad sakuppgift, skriv en rad i
   `ordning/rapporter/A02-rattelser.md` med gammal text, ny text och bevis
   (fil:rad).
6. **Prov:** `rg` efter länkar till filer som inte finns och
   `node tools/precommit-checks.mjs --plan`. Om bara dokumentlistan är ändrad
   ska utdata visa dokumentläge.

## Klart när

- [ ] JOHN-HANDOFF ≤ ~60 KB, med de fyra delarna och utan `random/`-hänvisningar
      som inte går att följa.
- [ ] README:s sidor stämmer med koden och AGENTS.md.
- [ ] Rättelseloggen täcker varje sakändring.

## Tveksamt att lyfta

- Uppgifter där koden och handoffen säger olika och prod-data krävs för att avgöra.
- Om en kort beslutslogg ska ligga kvar i handoffen.
