# Partner operator workspace

`partner-operator-workspace.jsx` exports `PartnerOperatorWorkspace({ surface,
initialSnapshot, apiBase, user, initialView, initialRoomId })`. Its only product
caller is the shared server page in `apps/studio/components/workspace-surface-page.tsx`.
The page loads authorized live data through `apps/studio/lib/partner-data.mjs`;
`surface: 'partner'` and `preview: false` are required at this client boundary.
`/control` uses `ControlWorkspace`. Neither route mounts a client demonstration.

The shared server page lives outside the Control route folder. It retains the
same authentication, N1-session priority, operator grants, room return context,
error handling and compatibility URLs for both entry points.

## Active views and session boundaries

Overview uses `views/overview.jsx`, room appearance uses `views/rooms.jsx`,
integration uses `views/integration.jsx`, and membership uses `views/team.jsx`.
`views/shared.jsx` provides the mark and shared elements. Existing CSS remains
scoped under `.kevin-bo`; that historical selector is not another product.
The assets and source receipt are retained unchanged.

The live workspace keeps Swedish/English and light/dark preferences, scoped
operator switching, unsaved-draft protection, room identity across navigation,
and server-verified publication receipts. Internal administrators see Admin
and Player lobby links. Ordinary members do not gain staff access.

Session actions use the existing native authentication and partner APIs.
Members end their partner session. Internal administrators clear any secondary
partner session and then the N1 session. Failed responses stop navigation;
account switching preserves only an allowlisted partner return destination.
Team and room writes continue to recheck server permissions and revisions.
Players, transactions and reports remain explicitly disconnected, with no
fictional metrics or working-action promises.

`preview-runtime.mjs` still supplies the live views' compatibility adapter and
snapshot validation. The server-side partner-preview fixtures are separate:
Control and operator-package diagnostics still use them. Their ownership,
viewer checks and instance-local compatibility state remain tested. Legacy
navigation IDs are retained for saved-link resolution.

## Historical source receipt

`source-provenance.json` records the thirteen source-file hashes imported from
commit `7dee0901c75b7470c16a178079d5a5ebe4f11b9f`, not hashes of today's live
components. The alias ImpactPL has not been verified as Kevin. This receipt
records provenance; it does not authorize another import or imply a live site.

The unreachable client demonstration and its regeneration script/factory
sources were retired together. There is no supported regeneration command in
this directory. Live views, assets and the source receipt remain the maintained
inputs; server fixtures and historical URLs were not removed.

## Verification

From the repository root with the supported Node version:

```
node --test --test-concurrency=4 apps/studio/components/kevin-bo/preview.test.mjs apps/studio/test/workspace-surface-pages.test.mjs apps/studio/test/partner-workspace-visual.test.mjs apps/studio/test/partner-team-loader.test.mjs apps/studio/test/partner-login.test.mjs
```

The tests cover live rendering, rejected client fixtures, mixed operators and
changed actors, scoped session actions, saved room/package context, retained
room component identity, CSS boundaries and stable initial markup. Existing
server fixture tests continue to cover the diagnostic API separately.
