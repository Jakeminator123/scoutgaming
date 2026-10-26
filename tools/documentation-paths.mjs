// Reviewed documentation paths shared by local checks and CI. Runtime Markdown is not documentation.
// Migration report data is validated separately; other JSON and future guides stay strict.
const migrationReports = new Set([
  "migrering/MASTERPLAN.md",
  "migrering/STATUS.md",
  "migrering/status.json",
  "migrering/jakob-main-migrering/AKTIVITETER.md",
  "migrering/kevin-ks-migrering/AKTIVITETER.md",
  "migrering/kevin-ks-migrering/K05/MAPPNINGSSYSTEM.md",
]);
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
    && (guides.has(path) || migrationReports.has(path) || /^(?:docs|apps\/studio\/docs)\/.+\.md$/.test(path));
}
