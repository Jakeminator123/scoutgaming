# Roulette (staging)

European roulette with Astrid 2.0 as the dealer, built beside the blackjack (Emil, 30 Oct). It has its own pages,
tables and share links, so the blackjack's routes, tables and page policy are unchanged.

| Address | What |
|---|---|
| `/studio/roulette/` | Roulette Table Studio: dealer, wheel (Champagne, Classic Black), room (Champagne, Emerald, Onyx, Penthouse), limits, name. Same back office sign-in as `/studio/`. |
| `/t/<slug>` | A roulette table's share link (blackjack tables are matched first; slugs never collide) |
| `/roulette/?table=<slug>` | The game. Behind the same demo gate as the blackjack page: a studio table or a signed-in account. |
| `GET/POST /api/studio/roulette-table` | A table's choices / build a table (signed in, same origin, rate limited) |

**Server.** `server/roulette-routes.mjs` holds all of it; `server.mjs` only wires it in (an import, `roulette.api`,
`roulette.http`, `.mjs` served as JavaScript, and blackjack slugs and roulette slugs reserving each other).
Tables are saved in `roulette-tables.json` beside `studio-tables.json`. If the roulette files are missing it turns
itself off and the blackjack server runs on. Tests: `test/roulette.test.mjs`.

**Page policy.** The game page gets the global Content-Security-Policy plus the hash of its inline import map
(three.js) and `blob:` for the wheel module, which the page runs as a blob (`public/roulette/js/hjul.mjs`). Every
other page keeps the global policy.

**Files.**
- `public/roulette/`: the game. Index, `katalog.json` (dealers, wheels, rooms, limits), `js/`, `3d/` (wheel and physics), `vendor/three/`.
- `public/studio/roulette/`: the roulette Table Studio. `studio-kevin.css` is the studio's stylesheet verbatim.
- `public/media/dealers/astrid2/roulette/`: Astrid's green throw clip, idle clips and still.
- `public/media/roulette/`: rooms, wheel and studio previews.

**Not yet.**
- The outcome is drawn in the browser, and the balance is a demo balance in the page. The engine's spin call and back office limit tiers come next.
- No voice or lip-sync for the dealer's calls yet.
- No phone layout.
- One dealer.
- The green clips are regenerated later, which also closes the small gap between Astrid's side and the wheel rim.
