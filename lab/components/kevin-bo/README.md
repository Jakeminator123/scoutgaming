# Partnerportal component

Real operator data and an explicitly enabled diagnostic fixture are separate snapshots of this component. `/partner` lists registered, accessible operators. Internal administrators reach those real operators with the same N1 login (`accessClass: 'internal-admin'`); members sign in through `/partner/login` and receive only their active memberships (`accessClass: 'partner'`). Normal partner routes never substitute fixtures. `/control` does not render this component. Players, transactions and reports remain disconnected from the game engine.

`kevin-backoffice.jsx` exports `KevinBackoffice({ surface, initialSnapshot,
apiBase, user, initialView })`. The same component serves two snapshot modes:

- **Internal fixture preview** (`preview: true`, `mode: 'fixture'`): admin-only
  demonstration. The banner stays **Intern förhandsvisning**, and the demo
  picker can switch the two example operators.
- **Real operator data** (`preview: false`): compact header with the operator
  name and current package revision, a compact Overview, Game rooms, Team and Integration navigation, light/dark
  theme and Swedish/English preferences. No demo picker. An operator switcher
  is shown only when the authorized `operators` list contains several entries.
  Both the real directory and operator header expose **Byt konto / Logga ut**
  (or **Switch account / Log out**) on desktop and mobile. The diagnostic
  fixture never exposes these real-session actions.

Session actions use `createStudioLoginClient` and the server's snapshot API base.
Members end only their partner session. Internal administrators first clear any
secondary partner session, then end the N1 session; only that secondary endpoint's
existing 401/expired-cookie response counts as already absent. Any other failed or
malformed response stops navigation and shows a localized retry message. After
confirmed logout, the user reaches the appropriate login page. Account switching
keeps only an allowlisted canonical partner return path, never an external URL.

`players`, `transactions` and `reports` stay empty while `notConnected: true`.
Those views show an honest disconnected notice without fictional metrics or
working-action promises. Public `/control` renders the real internal
tool entrance, not this component. Old internal tool URLs lead to the existing
Studio editors.

## Remaining disconnected verticals and diagnostic-only actions

Player accounts, transactions, reports, API-key creation, report scheduling,
PDF/XLSX export, player blocking and real table activation remain disconnected.
Operator registration belongs to the existing internal company administration.
Real operator membership invitations/role changes and lane branding
save/publication use their existing scoped clients, subject to server permissions.
The diagnostic fixture does not perform those live mutations. Fixture CSV stays
labelled example data, and its design drafts exist only in the mounted instance.

The source design is pinned to GitLab commit
`7dee0901c75b7470c16a178079d5a5ebe4f11b9f`. The alias ImpactPL is still not
verified as Kevin. `source-provenance.json` records each imported JSX file's
SHA-256 and the runtime parts deliberately replaced.

Medlemskap (`team`) has left the factory and renders from `views/team.jsx` for both the fixture preview and a real operator snapshot. Leave every other view in `original-views.jsx` until that view's own data is connected and the replacement is tested; delete only the factory functions that replacement covers.

## Preserved and separated

Thirteen original JSX files provide the actual cards, SVG table editor,
colour/chip/card editor, operations floor/command/list layouts, player and
transaction layouts, statistics, report catalogue and internal library views.
All original CSS is fenced under `.kevin-bo`. Eleven static BO reference
images are imported as build assets; no approved gameplay assets were changed.

`navigation.mjs` inventories the 24 diagnostic destinations: 17 fixture operator sections
and seven internal-only sections. Roulette and Baccarat remain planned views.
Partner dealers expose assigned presentation profiles; dealer construction,
voice/clip generation, original pit-boss villkor and background uploads
belong to internal Studio. The retained internal prototype views are source
reference only; `/control` no longer renders them. Old tool links lead to
existing Studio routes. Team membership uses the proposed scoped role labels,
not the original global role editor.

## Runtime boundaries

- Native React 19: no second React root, global `window.BO_*`, loader script,
  legacy server, SQLite, external fonts, game iframe, speech service or socket.
- Fixture reads are GET to the authenticated preview API. A `preview: true`
  snapshot must be `fixture` and `internal`, owned by the selected operator,
  and bound to the authenticated viewer. A `preview: false` snapshot is
  operator data already supplied to the page (`mode: 'live'`,
  `accessClass: 'partner'` or `'internal-admin'` and `notConnected: true` are accepted). This
  component does not refetch that snapshot from the fixture API. API failures,
  actor changes and failed authorization clear the visible fixture snapshot.
- Changing operators aborts prior reads, clears the old view, validates the
  returned context, discards old drafts and updates the URL. Re-focus checks
  authorization without replacing local drafts; an actor mismatch closes them.
- Imported design drafts exist only in the current mounted instance. No local
  storage or server save; applying that design updates only its preview. This is
  separate from the connected lane branding editor's server-backed save/publication.
  A before-unload guard and a context-switch confirmation protect unsaved drafts.
- Image/logo palette tools operate locally on bounded PNG/JPG/WebP images.
  PDF import, API key creation, report scheduling, PDF/XLSX export, player blocking
  and real table activation are disconnected. Fixture invitations/publication do
  not make live writes; connected operator team and lane branding actions keep
  their server authorization. CSV exports are explicitly labelled fixture data.
- Test a table uses the original SVG/ThFrame presentation states. It does not
  import the old simulator, wallet or dealer-video player. Static amounts and
  cards are visible design examples; production game authority remains unchanged.

## Addresses and lane status

This preview's public links use /partner/{operatorSlug}, with readable sections
with rooms as the single composition and publishing workspace. Old presentation, table-design, lanes, preview and tables links open that workspace. Component IDs stay
internal; old short paths and hash bookmarks resolve to the current address.
Menu and same-operator history changes retain the mounted room editor and its unsaved choices. Hidden room previews stop playback. Document navigation warns on unsaved edits; account/operator changes confirm before leaving. Failed logout restores the warning.
Cross-operator history reloads through the existing server authorization gate.

The partner design sections show an explicit missing-presentationslane notice.
Chip/card/colour and table edits also notify that the change is preview-only.
Local designs still feed the original table preview. No fake publish button,
new presentationslane assignment or unscoped admin API bridge has been introduced.

## Verification and remaining work

Run from the repository root with the project's compatible Node:

```
node --test --test-concurrency=4 lab/components/kevin-bo/preview.test.mjs
```

Tests render all 24 destinations without browser globals, verify partner
exclusion, reject mixed operators and changed actors, prove instance-local
draft isolation and reject old backend mutations. CSS fencing and UTC versus
Stockholm initial markup are also checked. The coordinating task runs the
application build and browser interaction verification.

Resource ownership for the remaining verticals, durable storage/publication of
imported design drafts, player-account operations, media mapping and reports remain
explicit integration work. Existing scoped membership and lane branding flows
are connected, not evidence that those other verticals are complete.
Operator membership for the scoped snapshot is enforced for partner sessions;
internal-admin snapshots use the bounded N1 authorization bridge. Medlemskap
renders from `views/team.jsx`. The other imported
views stay in the factory so their cross-view helpers remain intact; split a
view out only when its data is connected and the replacement is tested.

To reproduce the pinned transfer after changing the adaptation rules:

```
node lab/components/kevin-bo/port-source.mjs <path-to-pinned-GitLab-checkout>
```

The transfer script verifies the commit and writes only this component
directory. Edit its adaptation rules and the factory preamble/appendix before
regenerating `original-views.jsx`, `original.css`, asset map and provenance.
