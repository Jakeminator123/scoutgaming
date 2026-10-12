# A18 · Ops-arv: `vercel-entry`, `preview/` och Caddy

| Fält | Värde |
| --- | --- |
| Våg | 2 · omgång 1 · mergas in före A11, A16 och A20 (samma frontendfiler) |
| Väntar på | B15 för radering. Utredningen och flytten av `build.mjs` kan göras direkt. |
| Branch | molnagentens egen branch, inmergad på `jakob/repo-ordning` |
| Modell | grok-4.7-xhigh-fast |
| Risk | 20 % · frontendbygget och tre tester importerar `build.mjs` |

## Mål

Ingen aktiv byggkedja beror på en mapp som beskriver ett pensionerat
Vercel-projekt. Den levande bygglogiken ägs av frontenden, och gammal
projektkonfiguration är utredd. Om B15 säger ja tas den bort.

## Fakta (00ea55c5 / e160af12)

- `ops/vercel-entry/` beskriver sig som "Enkel Vercel-ingång till Blackjack", ett
  äldre fristående projekt (`github-work-vercel-entry`).
  `docs/ENVIRONMENT-VARIABLES.md` rad ~289 kallar det "äldre statisk ingång,
  inte längre publicerad". Filer: `README.md`, `build.mjs`, `index.html`,
  `vercel.json`, `.env.example`, `.gitignore`, `test/build-preview.mjs` och
  `test/preview-routes.mjs`.
- **Levande:** `ops/vercel-entry/build.mjs` importeras av
  `apps/croupier-frontend/tools/prepare-platform-ui.mjs` (Vercel-tjänsten
  `web`), `test/blackjack-entry-http.mjs` och `test/player-signup.mjs`
  (`blackjackUrl`). Den släpper igenom `presentation-runtime/`-sökvägar (rad ~20,
  viktigt för A21). Miljöregistret har tjänsten `vercel-entry`
  (`docs/environment-variables.json` rad ~120: sources `ops/vercel-entry/build.mjs`
  och `.env.example`), och systemkartan har `environment.vercel-entry`
  (`catalog.json` rad ~367).
- `ops/vercel-entry/preview/` är en "isolerad Vercel Preview för spelarfronten":
  ett separat, tillfälligt Vercel-projekt för prov mot en isolerad backend.
  Filer: `README.md`, `build.mjs`, `prepare.mjs`, `preview-only.css`,
  `route-guard.js` och `vercel.template.json`. Lokalt finns en ignorerad
  `.vercel`-länk och `dist/` (BASLINJE §9).
- `test/vercel-presentation-video-origin.mjs` använder originen
  `https://github-work-vercel-entry.vercel.app`.
- `ops/caddy/bettalotto-game-auth.Caddyfile` är en Caddy-konfiguration för
  `www.bettalotto.se` och `bettalotto.se` (omdirigering, `reverse_proxy` och
  `forward_auth` för spelcookie). Inget i repot refererar filen. Env-registret
  har `BETTALOTTO_PARTNER_*` för partnerkopplingen, vilket är en annan sak än
  filen. **Den kan köras på en extern server (T6).**

## Ägda filer

`ops/vercel-entry/**`, `ops/caddy/**`, importraderna i
`apps/croupier-frontend/tools/prepare-platform-ui.mjs`,
`test/blackjack-entry-http.mjs`, `test/player-signup.mjs` och
`test/vercel-presentation-video-origin.mjs` (bara import och sökväg), ny plats
för bygglogiken under `apps/croupier-frontend/tools/`, posten `vercel-entry` i
`docs/environment-variables.json` och `docs/ENVIRONMENT-VARIABLES.md`, posten
`environment.vercel-entry` i `docs/system-map/catalog.json`, rader i
`.githooks/pre-commit-full` för flyttade tester, samt `ordning/rapporter/A18-ops-arv.md`.

**Rör inte:** övrig logik i `prepare-platform-ui.mjs` (kasino och `/v2`
hanteras av A11 och A16), `ops/cloud/**` och `ops/neon-*/**`.

## Steg

0. Steg 0 enligt ORKESTRERING §4.
1. **Rapport** `ordning/rapporter/A18-ops-arv.md`: varje fil i `ops/vercel-entry/`
   och `ops/caddy/` klassad som levande, prov-verktyg eller pensionerat, med
   konsumenter (fil:rad) och rekommendation. Lista frågor som bara Vercel eller
   Jakob kan besvara: finns projektet `github-work-vercel-entry` kvar, och används
   Caddy-filen någonstans?
2. **Flytta bygglogiken** (internt, görs nu): `git mv ops/vercel-entry/build.mjs apps/croupier-frontend/tools/player-ui-build.mjs`
   (eller ett namn som beskriver vad den gör) som en egen commit. Uppdatera
   sedan alla importörer, testerna, env-registrets `sources`, systemkartans post
   och `ops/vercel-entry/preview/build.mjs`, som anropar förälderns `build`.
   Behåll exakt beteende.
3. **Efter B15** (inte i omgång 1 om B15 saknas i prompten): ta bort den
   pensionerade projektkonfigurationen, `preview/` och Caddy-filen enligt
   rapporten. Ta bort env-posten `vercel-entry` om inga källor finns kvar, enligt
   miljöregeln.
4. **Prov:**
   - `node --test test/blackjack-entry-http.mjs test/player-signup.mjs test/vercel-presentation-video-origin.mjs apps/croupier-frontend/test/platform-ui.mjs ops/vercel-entry/test/build-preview.mjs ops/vercel-entry/test/preview-routes.mjs`
     (de testfiler som finns kvar);
   - `node tools/check-environment-variables.mjs`;
   - `node docs/system-map/verify.mjs --check` och
     `node tools/check-orphan-tests.mjs`;
   - orkestratorn kör frontendbygget med plattformsmiljö.

## Klart när

- [ ] Rapporten finns, och B15 och T6 kan besvaras.
- [ ] Frontendens bygglogik ligger under `apps/croupier-frontend/`, och alla prov
      och bygget är gröna.

## Tveksamt att lyfta

- Caddy-filen: radera inte utan Jakobs svar på T6.
- Om isolerade preview-prov (`preview/`) fortfarande är ett önskat QA-verktyg.
