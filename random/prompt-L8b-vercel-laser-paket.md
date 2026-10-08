# Prompt L8b: Vercels /play/blackjack bär operatören till Render

Kör i en egen agent/chatt. **Modell: grok 4.7 xhigh fast räcker** (routing + proxy, ingen
spelmotor). Orkestratorn granskar före merge. Beroende: L8 (`19f8073a`) är live på Render.

Skriven 8 okt 2026 av orkestrator 2 efter `7445b5a5`. Checklista: L8 (Vercel-delen), N3.2.

---

Du arbetar i `C:\Users\jakob\dev\projects\scoutgame` på `main`. Läs `AGENTS.md`,
`docs/JOHN-HANDOFF.md`, `random/checklista-2026-10-08.md` (L8, N3.2),
`apps/croupier-frontend/lib/platform-routing.mjs` (hur `/play/blackjack` och `/blackjack`
hanteras; `approvedGameQuery`), `apps/croupier-frontend/middleware.ts`,
`apps/croupier-frontend/app/play/blackjack/**`, `apps/croupier-frontend/lib/player-operator.mjs`,
`web/game-entry-operator.mjs` (Renders beteende: `?operator=` → paket → 404 för okänd),
`web/public/game-entry-contract.mjs`, testerna `apps/croupier-frontend/test/platform-ui.mjs`,
`apps/croupier-frontend/test/game-entry.mjs`, `test/game-entry-operator.mjs`.
Ingen commit/push/branch utan orkestratorns ord. Inget mot produktion. Agent-talk-id
`l8b-vercel`: `node tools/agent-talk.mjs status l8b-vercel` vid start, var 30:e sekund, före rapport.

## Problem (L8-agentens Tveksamt)

L8 märks bara på Renders egen `/blackjack`. Publika `www.scoutgaming.tech/blackjack`
omdirigerar (307) till Vercels `/play/blackjack`, och signerad launch landar också där.
Så spelaren når aldrig paketbegränsningen i produktion.

Verifierat 8 okt 12:45:
`curl -I https://www.scoutgaming.tech/blackjack?operator=x` → `307 /play/blackjack?operator=x`
(frågesträngen överlever omdirigeringen). Vad `/play/blackjack` sedan gör med `operator`
är din uppgift att fastställa först.

## Mål

1. **Fakta först (rapportera innan du ändrar):** hur `/play/blackjack` hämtar spelet från
   Render i dag (iframe? proxy-rewrite? HTML-hämtning med `decorateGameEntryHtml`?), och
   om `operator` når Render-anropet. Skriv det som en kort kedja.
2. **Bär `operator` hela vägen:** `/play/blackjack?operator=<slug>` ska ge samma resultat
   som Renders `/blackjack?operator=<slug>` – paketbegränsad lane/dealer, och 404-sidan
   `Bolaget finns inte` för okänd slug (rendera Vercels egen 404 med samma text, eller
   förmedla Renders). `approvedGameQuery` måste vitlista `operator` med samma slug-regel
   (`web/demo-operators.mjs` `isOperatorSlug`). Utan `operator` → byte-identiskt med i dag
   (snapshot-test).
3. **Lobbyns länk:** N3 lade redan `?operator=` på `Spela blackjack`; verifiera att den
   överlever genom `/play/blackjack` till spelet (test).
4. **Signerad launch:** om launch-JWT:n har `claims.partner` (läs `web/` auth-koden för
   namnet), låt den vinna över `?operator=` när båda finns, och rapportera var det sitter.
   Gör inte en ny claim.
5. Ingen ändring i `web/server.mjs` spelväg, kort, wallet, auth. Vercel-middleware får bara
   vidarebefordra; ingen ny Origin/Host-tillåtelse (se `CROUPIER_VERCEL_FRONTEND_ORIGIN`-regeln
   i `docs/ENVIRONMENT-VARIABLES.md`).

## Tester

- `apps/croupier-frontend/test/platform-ui.mjs`: `operator` passerar i rewrite/proxy;
  ogiltig slug tas bort; utan `operator` identiskt.
- `apps/croupier-frontend/test/game-entry.mjs`: 404-flödet för okänd slug.
- `test/game-entry-operator.mjs` orört och grönt. `.githooks/pre-commit`-testerna gröna.

## Rapport

Tabell Åtgärd | Status | Verifierat hur | Risk %; kedjan Vercel → Render med fil:rad;
**Tveksamt** (särskilt om 404 ska renderas av Vercel eller Render, och claim-prioritet).
