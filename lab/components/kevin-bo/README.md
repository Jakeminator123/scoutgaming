# Partnerportal component

Internal fixture preview and real operator data are two snapshots of this same component. Without `partner_session`, an internal admin on `/partner` and `/partner/{operatorSlug}` gets the fixture (`preview: true`, `mode: 'fixture'`) from `/studio/api/partner-preview`. `/partner/login` issues `partner_session`; those same `/partner` routes then serve that operator's data (`preview: false`, `mode: 'live'`). No session on `/partner` redirects to `/partner/login`. `/control` does not render this component. Players, transactions, reports, onboarding and package publishing stay disconnected.

`kevin-backoffice.jsx` exports `KevinBackoffice({ surface, initialSnapshot,
apiBase, user, initialView })`. The same component serves two snapshot modes:

- **Internal fixture preview** (`preview: true`, `mode: 'fixture'`): admin-only
  demonstration. The banner stays **Intern förhandsvisning**, and the demo
  picker can switch the two example operators.
- **Real operator data** (`preview: false`): compact header with the operator
  name, the text pill **Operatör**, and the current operatörspaket revision
  when the snapshot includes one. No demo picker. An operator switcher is
  shown only when `operators` has more than one membership.

`players`, `transactions` and `reports` stay empty while `notConnected: true`.
Those views then show one short sentence and one button, either to the matching
nivå 1 tool or to Integrationer. Public `/control` renders the real internal
tool entrance, not this component. Old internal tool URLs lead to the existing
Studio editors.

## Still disconnected

Player accounts, transactions, reports, real operator onboarding, invitations,
API-key creation, report scheduling, PDF/XLSX export, player blocking, live
publication and real table activation. Fixture CSV stays labelled example data.
Design drafts exist only in the mounted instance.

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

`navigation.mjs` inventories all 24 destinations: 17 operator-visible sections
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
  `accessClass: 'partner'` and `notConnected: true` are accepted). This
  component does not refetch that snapshot from the fixture API. API failures,
  actor changes and failed authorization clear the visible fixture snapshot.
- Changing operators aborts prior reads, clears the old view, validates the
  returned context, discards old drafts and updates the URL. Re-focus checks
  authorization without replacing local drafts; an actor mismatch closes them.
- Design drafts exist only in the current mounted preview instance. No local
  storage or server save. Applying a design updates only this preview. A
  before-unload guard and a context-switch confirmation protect unsaved drafts.
- Image/logo palette tools operate locally on bounded PNG/JPG/WebP images.
  PDF import, live publication, API key creation, invitations, report scheduling,
  PDF/XLSX export, player blocking and real table activation are disconnected.
  CSV exports are explicitly labelled fixture data.
- Test a table uses the original SVG/ThFrame presentation states. It does not
  import the old simulator, wallet or dealer-video player. Static amounts and
  cards are visible design examples; production game authority remains unchanged.

## Addresses and lane status

This preview's public links use /partner/{operatorSlug}, with readable sections
such as presentation, table-design, lanes and tables. Component IDs stay
internal; old short paths and hash bookmarks resolve to the current address.
Menu changes preserve mounted drafts; history back/forward is observed.
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

Resource ownership for each vertical, durable design storage, publication,
account operations, media mapping and reports remain explicit integration
work. Operator membership for the scoped snapshot is already enforced with
`partner_session`. Medlemskap renders from `views/team.jsx`. The other imported
views stay in the factory so their cross-view helpers remain intact; split a
view out only when its data is connected and the replacement is tested.

To reproduce the pinned transfer after changing the adaptation rules:

```
node lab/components/kevin-bo/port-source.mjs <path-to-pinned-GitLab-checkout>
```

The transfer script verifies the commit and writes only this component
directory. Edit its adaptation rules and the factory preamble/appendix before
regenerating `original-views.jsx`, `original.css`, asset map and provenance.
