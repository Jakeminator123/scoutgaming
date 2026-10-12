# A19 · Lokala ignorerade mappar

| Fält | Värde |
| --- | --- |
| Våg | 2 · körs av orkestratorn lokalt, inte av en molnagent (molnet har inte mapparna) |
| Väntar på | B16 för varje borttagning |
| Plats | Huvudcheckouten `C:\Users\jakem\Projects\croupier` och lokala worktrees |
| Risk | 10 % · privata data |

## Mål

Jakob vet vad som tar plats lokalt utanför Git, och vad som säkert kan
återskapas, arkiveras eller måste stå kvar. Inget privat raderas utan hans ok.

## Fakta (BASLINJE §9)

`lab/data` är 787 MB (`platform-private` 748 MB med QA-evidens och privata
nycklar). Därtill `Gronstripp/.venv` (161 MB) i 3lager-materialet, `.next`
(172 MB), `lab/preview-build` (12 MB), `media/.migration` (9,5 MB, journaler
från 2 oktober), genererade kopior i `apps/croupier-frontend/public/` och
`runtime-ui/`, samt `ops/vercel-entry/preview/{.vercel,dist}`.

## Regler

- Läs aldrig innehållet i `lab/data/platform-private/`, `.env*` eller
  `random-stuff-jakob/`. Använd bara namn, storlek och datum.
- Rör aldrig `lab/data`, `web/data`, `web/public/review/2026-09-09/3lager/` eller
  `random/` (lokala filer) utan att Jakob nämnt exakt sökväg.
- Radera bara byggutdata när ingen server eller byggprocess kör i checkouten
  (`node lab/start.mjs --check`, agent-talk).

## Steg

1. Mät om: `git ls-files --others --ignored --exclude-standard --directory` med
   storlekar, utan `node_modules` och arkivet.
2. Klassa varje post:
   - **återskapas** (byggutdata: `.next`, `preview-build`, `runtime-ui`,
     genererade `public/`-kopior, `preview/dist`);
   - **arkivera** (QA-evidens och loggar från september, `media/.migration`
     efter verifierad migrering);
   - **behåll** (sparat projekt, historik, spelare, röstcache och Jakobs material).
3. Förslag till Jakob: tabell med sökväg, storlek, klass och kommando. Arkivering
   sker till en plats utanför repot som Jakob anger, aldrig radering av privata data.
4. Efter Jakobs ok: genomför exakt de godkända raderna och mät igen. Notera
   resultatet i README-registret. Inget av detta committas.

## Klart när

- [ ] Förslaget har lämnats till Jakob och hans val är genomförda.
