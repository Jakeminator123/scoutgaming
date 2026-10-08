# Prompt N2.2: skrivande partnerrutter – bolag, roller, medlemskap (utan att vänta på Kevin)

Kör i en egen agent/chatt. **Modell: Claude Opus 5.5 (max) eller GPT-5.3-codex** – det här
är åtkomstkontroll (vem får skapa vem, sista-admin-spärren, revisions-CAS) och ska resonera
om missbruk. Orkestratorn granskar före merge. Jakob 8 okt 02:49: "bortse från John om det
blockar"; Kevin har inte svarat på #3 – vi bygger enligt befintlig datamodell och låter
Kevin justera efteråt. **Ingen SQL-migration** (005 räcker: `operators`, `operator_roles`,
`operator_memberships`, `operator_packages`).

Skriven 8 okt 2026 av orkestrator 2 efter `7445b5a5`. Checklista: N2.2, N2.3, N2.6, L7.

---

Du arbetar i `C:\Users\jakob\dev\projects\scoutgame` på `main`. Läs `AGENTS.md`
(partner/operatör, "Keep server-owned … authoritative"), `docs/JOHN-HANDOFF.md`
(Sista operatörsadmin, Partnerportal), `random/checklista-2026-10-08.md` (N2.*, L4, L7),
`random/losa-tradar-2026-10-07.md` (L5, L11, L14, L24), `ops/neon-studio/005-operators.sql`,
`web/storage/operator-store.mjs` (**hela**: `createOperator`, `upsertRole`,
`upsertMembership`, `withOperatorLock` – sista-admin-spärren, `resolvePartnerContext`,
`publishPackage`), `web/partner-access-policy.mjs` (`PARTNER_PERMISSIONS`,
`allowsPartnerResource`), `lab/lib/partner-session.mjs` (actions `login|logout|snapshot|branding`;
hur `branding` öppnar store med poolen, medlemskap/roll-kontroll – **kopiera det mönstret**),
`lab/lib/partner-branding-api.mjs` (CAS-mönster), `lab/lib/operator-package-api.mjs`
(admin-sidans `operator-create-demo`), `lab/lib/studio-admin-contract.mjs` +
`studio-access-policy.mjs` (hur admin-POST registreras), `lab/components/kevin-bo/views/team.jsx`
(Kevins team-vy: vilka knappar/fält finns – **ändra inte hans jsx**, koppla via props/API),
`lab/test/partner-session.test.mjs`, `lab/test/partner-team.test.mjs`, `test/operator-store.mjs`.
Ingen commit/push/branch utan orkestratorns ord. Inget mot produktion/Neon. Agent-talk-id
`n22-skriv`: `node tools/agent-talk.mjs status n22-skriv` vid start, var 30:e sekund, före rapport.

## Mål

**A. Intern admin (nivå 1) skapar bolag och första administratör** – admin-POST i
`lab/lib/operator-admin-api.mjs` (nytt), registrerat som `operator-create`,
`operator-role`, `operator-membership` i admin-kontraktet med samma grind som
`operator-package`:
1. `operator-create { slug, name }` → `createOperator` (409 vid dubblett). Skapar också
   standardrollerna via `upsertRole`: `partner-admin` (alla `PARTNER_PERMISSIONS`),
   `partner-editor` (`presentations.read`, `presentations.configure`, `tables.read`),
   `partner-viewer` (bara `*.read`). Rapportera exakta permission-namn du använde.
2. `operator-membership { operatorId, userId, roleId, status }` → `upsertMembership`
   inom `withOperatorLock`; sista aktiva `partner-admin` får inte degraderas/suspenderas
   (spärren finns i store – testa att den slår). `userId` måste vara ett befintligt
   konto med roll `partner` i game-DB (läs hur `partner-session` slår upp konton).
3. `operator-role { operatorId, roleId, permissions }` → `upsertRole`; bara kända
   permissions; `partner-admin` kan inte tömmas.
4. Sidan `/control/lanes` (eller Administration → Konton & roller, välj det som är minst
   ingrepp och rapportera) får ett kort **Bolag**: lista bolag ur store, `Skapa bolag`
   (slug + namn), per bolag: medlemmar med roll och `Lägg till medlem` (användarnamn +
   roll). Sekundära knappar; sidans lime orörd.

**B. Operatörens egen team-vy (nivå 2)** – partner-action `team` (GET/POST) i
`lab/lib/partner-session.mjs` bredvid `branding`: GET listar medlemmar+roller för
operatören (samma 401/403-grind), POST `{ action: 'invite'|'role'|'suspend'|'reactivate',
userId, roleId?, expectedRevision }` kräver `team.roles.assign` (eller det namn policyn
har), CAS på medlemskapets `revision`, sista-admin-spärr. `invite` i detta pass =
koppla ett **befintligt** partner-konto; e-postinbjudan (N2.6) är inte med – skriv det.
Koppla Kevins `team.jsx` via `preview-runtime`/props så att knapparna anropar API:t när
sessionen är riktig (`snapshot.preview === false`); fixturläget orört.

**C. Journal (N2.5, minsta steg):** varje skrivning ovan loggas med `actor`, `action`,
`operatorId`, `target`, `at` i en befintlig journal om store har en; annars en rad i
serverloggen utan hemligheter, och skriv i Tveksamt att tabell saknas.

## Tester

Minnes-pool med taggade frågor (kopiera `memoryPool` från `lab/test/operator-package-api.test.mjs`
och lägg till taggarna för roller/medlemskap – läs dem i `operator-store.mjs`):
skapa bolag + standardroller; dubblett 409; medlemskap för okänt konto 422; sista admin
kan inte suspenderas (423/409 enligt store); CAS 409; partner utan `team.roles.assign`
får 403 på POST men 200 på GET; `{ query }`-pool 503; admin-POST utan Origin 403.
`npm test` + `npm run typecheck` i `lab/`; `node --test test/operator-store.mjs` grön.

## Rapport

Tabell per punkt Åtgärd | Status | Verifierat hur | Risk %; permission-namn per roll;
var kortet hamnade; **Tveksamt** (särskilt allt som Kevin bör godkänna: rollnamn,
standardbehörigheter, var UI:t sitter, journalformat).
