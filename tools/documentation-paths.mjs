// Reviewed prose paths eligible for the CI/local-check classification and merge freshness exception.
// New READMEs and runtime Markdown remain strict until explicitly reviewed here.
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
  "apps/studio/components/partner/README.md",
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

function normalizedPath(path) {
  return typeof path === 'string' && !path.includes('\\')
    && !path.split('/').some(part => ['', '.', '..'].includes(part));
}

export function isDocumentationPath(path) {
  return normalizedPath(path) && (guides.has(path) || proseFolders.some(pattern => pattern.test(path)));
}

// Link auditing also follows functional entry points. Auditing a README does not make
// its containing package (or a Markdown runtime payload) eligible for lighter checks.
export function isDocumentationSource(path) {
  return isDocumentationPath(path) || (normalizedPath(path)
    && /^(?:apps|packages|services|test|tools|ops|media)\/(?:[^/]+\/)*README\.md$/.test(path));
}
