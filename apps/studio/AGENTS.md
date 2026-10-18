<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Studio i repot

Källroten är apps/studio (tidigare lab). Studio serverar produktens /admin,
/partner och /lobby; /studio är teknisk basePath. Följ [repots AGENTS](../../AGENTS.md),
[aktuellt handoff](../../docs/JOHN-HANDOFF.md) och de kanoniska guiderna, inklusive
[terminologin](docs/TERMINOLOGI.md). Neon är produktregistret och Blob äger
mediebytes; starta inget parallellt lokalt produktregister. Spelmotorn ligger i `services/game`; delade kontrakt ligger i `packages/`.
