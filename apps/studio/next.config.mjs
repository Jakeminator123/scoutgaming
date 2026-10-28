import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
// Next traces app entries as /app/<route>; retain the documented route keys too.
const appTraceRoutes = entries => Object.fromEntries(Object.entries(entries)
  .flatMap(([route, files]) => [[route, files], [`/app${route}`, files]]));
export default {
  basePath: process.env.CROUPIER_LAB_BASE_PATH || '',
  env: { NEXT_PUBLIC_LAB_BASE_PATH: process.env.CROUPIER_LAB_BASE_PATH || '' },
  distDir: process.env.CROUPIER_LAB_DIST_DIR || '.next',
  typescript: { tsconfigPath: process.env.CROUPIER_LAB_TSCONFIG || 'tsconfig.json' },
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingRoot: resolve(root, '../..'),
  // Production obtains credentials/state from scoped env and Neon. Private
  // local config, QA evidence and old writable state must never be bundled.
  outputFileTracingExcludes: { '/*': ['../../.env*', './.env*', '../../open-claw/lab/data/**', '../../services/openclaw/lab/data/**',
    '../../.croupier-inbox/**', '../../arkiv/**', '../../media/dealers/**',
    '../../media/layout.json', '../../media/blob-index.json', '../../media/catalog/**'] },
  outputFileTracingIncludes: appTraceRoutes({
    ...Object.fromEntries(['/api/replies/**', '/api/layer-assets/**', '/', '/administration', '/partner/[[...path]]', '/partner/login', '/partner/set-password', '/api/partner-preview', '/api/partner/[...action]', '/admin/login', '/admin/set-password', '/api/assistant', '/api/openclaw/admin', '/api/admin/**', '/api/auth/**', '/api/project', '/api/social', '/api/videos/**', '/api/dealers/**', '/api/zones/reference']
      .map(route => [route, ['../../ops/neon-game/product-schema.sql', '../../ops/neon-studio/*.sql',
        // This worker runs as an unbundled Node module. Trace its runtime imports
        // explicitly, including Sharp's native binaries and transitive helpers.
        ...(['/api/layer-assets/**','/api/videos/**'].includes(route)?['./lib/layer-media-inspection-worker.mjs','./lib/mp4-media-timing.mjs',
          './node_modules/mediabunny/package.json','./node_modules/mediabunny/dist/modules/**/*.js',
          './node_modules/sharp/package.json','./node_modules/sharp/dist/**/*',
          './node_modules/@img/**/*','./node_modules/detect-libc/**/*','./node_modules/semver/**/*']:[])]])),
    '/preview/[...path]': ['./preview-build/**/*'],
    '/admin/[[...path]]': ['./design-preview-build/**/*'],
    '/lobby/[[...path]]': ['./design-preview-build/public-lobby/**/*', './design-preview-build/fonts/**/*'],
  }),
  experimental: {
    externalDir: true,
    // forbidden() in app/forbidden.tsx: a Partnerportalen view the role may not
    // open answers HTTP 403 instead of a 200 page with a notice.
    authInterrupts: true,
    // Limit local Windows build workers; retain deployment/CI defaults.
    ...(process.platform === 'win32' && !process.env.CI ? { cpus: 4 } : {}),
  },
};
