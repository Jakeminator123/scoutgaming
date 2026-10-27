// Reviewed documentation paths shared by local checks and CI. Runtime Markdown is not documentation.
// Migration report data is validated separately; other JSON and future guides stay strict.
const migrationReports = new Set([
  "migrering/status.json",
]);
const guides = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "START-HERE.md",
  "agent-talk/README.md",
  "apps/studio/AGENTS.md",
  "apps/studio/README.md",
  "apps/studio/client/README.md",
  "apps/studio/docs/README.md",
  "apps/web/README.md",
  "inbox/README.md",
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
// Prose folders: every Markdown file under docs/, apps/studio/docs/ and migrering/, the
// cloud runbooks directly in ops/cloud/, and dated receipts moved to docs/history/.
const proseFolders = [
  /^(?:docs|apps\/studio\/docs|migrering)\/.+\.md$/,
  /^ops\/cloud\/[^/]+\.md$/,
  /^docs\/history\/.+$/,
];

export function isDocumentationPath(path) {
  return typeof path === 'string' && !path.includes('\\')
    && !path.split('/').some(part => ['', '.', '..'].includes(part))
    && (guides.has(path) || migrationReports.has(path) || proseFolders.some(pattern => pattern.test(path)));
}
