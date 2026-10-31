// Reviewed documentation paths shared by local checks and CI. Markdown outside the listed guides and
// prose folders (runtime bundles, package docs, new folder READMEs) stays strict, as does JSON.
const guides = new Set([
  ".cursor/rules/scoutgaming.mdc",
  ".github/copilot-instructions.md",
  ".windsurf/rules/scoutgaming.md",
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  "README.md",
  "START-HERE.md",
  "apps/studio/AGENTS.md",
  "apps/studio/README.md",
  "apps/studio/client/README.md",
  "apps/studio/docs/README.md",
  "apps/web/README.md",
  "inbox/README.md",
  "packages/presentation/README.md",
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
// Prose folders: every Markdown file under docs/ and apps/studio/docs/, and the cloud
// runbooks directly in ops/cloud/; scripts or other files placed there stay strict.
const proseFolders = [
  /^(?:docs|apps\/studio\/docs)\/.+\.md$/,
  /^ops\/cloud\/[^/]+\.md$/,
];

export function isDocumentationPath(path) {
  return typeof path === 'string' && !path.includes('\\')
    && !path.split('/').some(part => ['', '.', '..'].includes(part))
    && (guides.has(path) || proseFolders.some(pattern => pattern.test(path)));
}
