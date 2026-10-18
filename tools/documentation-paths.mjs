// Prose-only paths shared by local checks and CI. Runtime Markdown is not prose.
const guides = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "agent-talk/README.md",
  "apps/studio/AGENTS.md",
  "apps/studio/README.md",
  "apps/studio/client/README.md",
  "apps/studio/docs/README.md",
  "apps/web/README.md",
  "ops/cloud/CONTAINER-CONTEXT.md",
  "packages/presentation/README.md",
  "packages/presentation/docs/INTEGRATION.md",
  "services/astrid-gpu-worker/README.md",
  "services/astrid-gpu-worker/SOURCE.md",
  "services/astrid-gpu-worker/gateway/README.md",
  "services/game/README.md",
  "services/game/public/README.md",
  "services/game/storage/README.md",
  "services/openclaw/README.md",
  "services/openclaw/lab/README.md",
  "tools/media/README.md"
]);

export function isDocumentationPath(path) {
  return typeof path === 'string' && !path.includes('\\')
    && !path.split('/').some(part => ['', '.', '..'].includes(part))
    && (guides.has(path) || /^(?:docs|apps\/studio\/docs)\/.+\.md$/.test(path));
}
