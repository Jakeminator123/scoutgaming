# Kevin BO: native preview transfer

`kevin-backoffice.jsx` exports `KevinBackoffice({ surface, initialSnapshot,
apiBase, user, initialView })`. Both surfaces are currently protected by the
existing **internal administrator** server gate. `partner` is an operator UI
preview, not a grant of real operator access.

The source design is pinned to GitLab commit
`7dee0901c75b7470c16a178079d5a5ebe4f11b9f`. The alias ImpactPL is still not
verified as Kevin. `source-provenance.json` records each imported JSX file's
SHA-256 and the runtime parts deliberately replaced.

## Preserved and separated

Thirteen original JSX files provide the actual cards, SVG table editor,
colour/chip/card editor, operations floor/command/list layouts, player and
transaction layouts, statistics, report catalogue and internal library views.
All original CSS is fenced under `.kevin-bo`. Eleven static BO reference
images are imported as build assets; no approved gameplay assets were changed.

`navigation.mjs` inventories all 24 destinations: 17 operator-visible sections
and seven internal-only sections. Roulette and Baccarat remain planned views.
Partner dealers expose assigned presentation profiles; dealer construction,
voice/clip generation, original pit-boss trigger rules and background uploads
are confined to the internal surface. Internal sections link to verified
existing Studio routes. Team membership uses the proposed scoped role labels,
not the original global role editor.

## Runtime boundaries

- Native React 19: no second React root, global `window.BO_*`, loader script,
  legacy server, SQLite, external fonts, game iframe, speech service or socket.
- The only network data request is GET to the authenticated preview API. Every
  snapshot must be explicitly `fixture`, `internal`, owned by the selected
  operator, and bound to the authenticated viewer. API failures, actor changes
  and failed authorization clear the visible snapshot.
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

Real operator membership, resource ownership, durable design storage,
publication, account operations, media mapping and reports remain explicit
integration work. The imported UI remains one instance-bound factory to keep
the original cross-view helpers intact; split it into feature modules when
connecting each vertical slice rather than reinstating its global runtime.

To reproduce the pinned transfer after changing the adaptation rules:

```
node lab/components/kevin-bo/port-source.mjs <path-to-pinned-GitLab-checkout>
```

The transfer script verifies the commit and writes only this component
directory. Edit its adaptation rules and the factory preamble/appendix before
regenerating `original-views.jsx`, `original.css`, asset map and provenance.
