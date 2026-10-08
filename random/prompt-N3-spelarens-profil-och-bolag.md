# Prompt N3: spelarens profil (N3.3) och operatörskontext i lobbyn (N3.2)

Kör i en egen agent/chatt. **Modell: grok 4.7 xhigh fast räcker** (frontend + en liten
Render-rutt), men Render-deployen är Jakobs (N3.5) – koden kan mergas före deploy.
Orkestratorn granskar före merge. Beroende: N3.2 använder `?operator=<slug>` från
prompt L8 om den är klar; annars lagra bara valet i webbläsaren (J3).

Skriven 8 okt 2026 av orkestrator 2 efter `79737a5d`. Checklista: N3.2, N3.3.

---

Du arbetar i `C:\Users\jakob\dev\projects\scoutgame` på `main`. Läs `AGENTS.md`,
`docs/JOHN-HANDOFF.md` (Spelaryta), `random/checklista-2026-10-08.md` (N3, J3, F2, F4),
`apps/croupier-frontend/app/play/**`, `apps/croupier-frontend/lib/platform-routing.mjs`,
`web/server.mjs` (rutterna under `/api/` för konto/historik, `POST /api/history`),
`web/account-role.mjs`. Ingen commit/push/branch utan orkestratorns ord. Inget mot
produktion. Agent-talk-id `n3-spelare`: `node tools/agent-talk.mjs status n3-spelare`
vid start, var 30:e sekund, före rapport.

## Mål

**N3.3 Redigerbar profil.** `/play/profil` får ett formulär för visningsnamn (2–40
tecken, inga styrtecken) och språk (`sv`/`en`). Saldo och valuta förblir **läsbara,
serverägda**, aldrig redigerbara (AGENTS.md: wallet authoritative).
- Server: `PATCH /api/profile` (eller den form `web/server.mjs` använder för
  kontoändringar – följ befintligt mönster för auth-cookie, Origin, JSON-gräns) som
  uppdaterar bara `display_name` och `locale` på den inloggade spelaren; 401 utan
  session; 422 vid ogiltigt värde; svarar med den nya profilen. Om kontotabellen saknar
  kolumnerna: migration i `ops/neon-game/` enligt tvåstegsregeln i `AGENTS.md`
  (migration först mot produktions-Neon av Jakob, kod sen) – skriv då SQL:en, kör den
  inte, och gör koden tolerant tills kolumnen finns (profilsidan visar `Inte tillgängligt
  än`). Rapportera.
- Frontend: formulär på `/play/profil` med en lime `Spara profil`, fel- och
  bekräftelsetext, inget optimistiskt skrivande av saldo.

**N3.2 Operatörskontext i lobbyn (steg 1, webbläsaren först – J3/F4).** `/play` visar
`Spelar hos: <bolagsnamn>` när `?operator=<slug>` finns i URL:en eller sparat i
`localStorage['croupier.operator']`. Namnet hämtas från `GET /api/partner/...`? Nej –
ingen partner-API i spelarytan. Använd i stället en liten publik läsning
`GET /api/operators/<slug>` i `web/server.mjs` som returnerar bara `{ slug, name }` för
`status = 'active'` (läs `croupier_studio.operators` via samma pool/scope som
`web/storage/operator-store.mjs`; 404 annars; cache 60 s; ingen annan kolumn). Länken
`Spela blackjack` i lobbyn bär vidare `?operator=<slug>` till `/play/blackjack` och
därifrån till spelet (L8 läser den när den är klar). Knapp `Byt bolag` rensar valet.
Fixturen `sg-test` ska fungera lokalt.

## Tester

- `apps/croupier-frontend/test/`: profilformulär renderar med nuvarande namn, saldo är
  text (ingen `<input>`), en lime; lobbyn visar bolagsnamn från `?operator` och från
  localStorage, döljer vid okänt.
- `test/`: `PATCH /api/profile` 401/422/200 mot isolerad databas eller minnesstore enligt
  befintligt kontotest; `GET /api/operators/<slug>` 200/404 och exakt två fält.
- Befintliga tester gröna; `node test/fuzz-blackjack.mjs` orört och grönt.

## Rapport

Tabell Åtgärd | Status | Verifierat hur | Risk %. Om migration behövs: exakt SQL och
var den ska köras. **Tveksamt**: fältgränser, var valet sparas, om `?operator` ska
överleva utloggning.
