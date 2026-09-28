# Root container build context

The repository root now has a `.dockerignore` for a future Croupier product and
Lissabon image. It does not change local files or the existing OpenClaw images,
which build from `open-claw/lab/` and have their own ignore file. No root Docker
image has been built or deployed.

The root context retains `web/`, `lab/` application code and `lab/docs/guide.json`,
`lab/policies/project.seed.json`, `presentation-runtime/`, `open-claw/lab/src/`,
`emil/dealklipp-v1/` with its exact video manifest, `web/public/` with the
published dealer and table assets, `content/dealers/`, and `content/persona/`. It also
retains `pipeline/`: `lab/lib/video-registry.mjs` imports
`pipeline/build-lab-video-manifest.mjs` at runtime for operator rescans.

The ignore file omits Git metadata, local agent state, development caches,
installed dependencies, secrets, mutable databases/project files, tests, root
documentation, and reference or staging material. Persistent player and studio
state must be mounted or supplied by an external store, never copied from a
developer's machine into an image. Environment variables must be supplied by
the deployment platform. `content/staging/` contains review and source renders;
runtime presentation media is retained in its published locations above.
The editable root source trees `assets/astrid-3d/` (about 563 MiB) and
`assets/blackjack-3d/` (about 220 MiB) are also excluded. Their consumers
are offline Blender/asset scripts; the browser loads separate exports from
`web/public/`. This is a static dependency check, not a built-image test.

On this workstation, targeted metadata inspection found approximately
2,075 MiB in `content/staging/`, 1,084 MiB in `lab/.next`, `.next-probe`, and
`node_modules` combined, and 2,760 MiB in `.git`. These three categories alone
represent about 3.1 GiB of working files plus 2.7 GiB of Git metadata that a
local root Docker build should no longer send. Actual savings depend on the
builder, its context directory, and generated files present at build time.

Docker is not installed on this workstation. Before the first deployment,
build an image with the repository root as its context and verify that the
studio can read its video manifest, that original media previews and gameplay
video serve the retained files, and that no local `.env` or database entered
the image. The current `.dockerignore` does not make the product cloud ready;
`docs/CLOUD-MIGRATION.md` tracks storage, authentication, HTTPS, and runtime
work that remains.
