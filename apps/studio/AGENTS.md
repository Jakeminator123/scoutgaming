# Tillämpning i detta repo

Next.js-blocket nedan är verktygsgenererat. Dess läskrav gäller arbete med
Next-routing, serverkomponenter, Next-API:er och Next-konfiguration. Ren esbuild-
klientkod i `client/`, delade kontrakt, dokumentation och tester kräver inte
Next-guider om ändringen inte berör en sådan integration. Denna avgränsning
gäller även formuleringen "before writing any code" i det genererade blocket.
Blocket behålls oförändrat eftersom `next dev` återställer det; repoets
avgränsning ligger utanför och bevaras av den installerade generatorn.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Studio i repot

Källroten är apps/studio (tidigare lab). Studio serverar produktens /admin,
/partner och /lobby; /studio är teknisk basePath. Följ [START-HERE](../../START-HERE.md), [repots AGENTS](../../AGENTS.md),
[aktuell överlämning](../../docs/NEXT-AGENT.md) och de kanoniska guiderna, inklusive
[terminologin](docs/TERMINOLOGI.md). Neon är produktregistret och Blob äger
mediebytes; starta inget parallellt lokalt produktregister. Spelmotorn ligger i `services/game`; delade kontrakt ligger i `packages/`.
