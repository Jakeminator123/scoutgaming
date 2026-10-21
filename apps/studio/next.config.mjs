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
  async redirects() {
    if (process.env.CROUPIER_STUDIO_NATIVE_ADMIN !== '1') return [];
    const mounted = process.env.CROUPIER_LAB_BASE_PATH === '/studio';
    return ['login', 'set-password'].map(mode => ({
      source: (mounted ? '/' : '/studio/') + mode,
      destination: (mounted ? '/studio/' : '/') + mode,
      permanent: false, basePath: false,
    }));
  },
  reactStrictMode: true,
  outputFileTracingRoot: resolve(root, '../..'),
  // Production obtains credentials/state from scoped env and Neon. Private
  // local config, QA evidence and old writable state must never be bundled.
  outputFileTracingExcludes: { '/*': ['../../.env*', './.env*', './data/**', '../../lab/data/**', '../../lab/.env*', '../../lab/tsconfig.probe.json', '../../web/data/**', '../../services/game/data/**',
    '../../open-claw/lab/data/**', '../../open-claw/lab/runtime/**', '../../services/openclaw/lab/data/**', '../../services/openclaw/lab/runtime/**', '../../agent-talk/**', '../../.croupier-inbox/**', '../../random/**', '../../media/dealers/**',
    '../../media/layout.json', '../../media/blob-index.json', '../../media/catalog/**'] },
  outputFileTracingIncludes: appTraceRoutes({
    ...Object.fromEntries(['/control/compositions', '/control/rehearsal', '/control/replies', '/api/replies/**', '/control/library', '/control/preview', '/api/layer-assets/**', '/', '/administration', '/control/clips', '/control/administration', '/control/tree', '/control/videos', '/control/openclaw', '/control/activity', '/control/guide', '/control/zones', '/control/events', '/control/probe', '/control/operator-chat', '/control/login', '/control/set-password', '/control/[[...path]]', '/partner/[[...path]]', '/partner/login', '/partner/set-password', '/api/partner-preview', '/api/partner/[...action]', '/login', '/set-password', '/api/assistant', '/api/openclaw/admin', '/api/admin/**', '/api/auth/**', '/api/project', '/api/social', '/api/videos/**', '/api/dealers/**', '/api/zones/reference']
      .map(route => [route, ['../../ops/neon-game/product-schema.sql', '../../ops/neon-studio/*.sql',
        // This worker runs as an unbundled Node module. Trace its runtime imports
        // explicitly, including Sharp's native binaries and transitive helpers.
        ...(route==='/api/layer-assets/**'?['./lib/layer-media-inspection-worker.mjs',
          './node_modules/mediabunny/package.json','./node_modules/mediabunny/dist/modules/**/*.js',
          './node_modules/sharp/package.json','./node_modules/sharp/dist/**/*',
          './node_modules/@img/**/*','./node_modules/detect-libc/**/*','./node_modules/semver/**/*']:[])]])),
    '/preview/[...path]': ['./preview-build/**/*'],
    '/admin/[[...path]]': ['./design-preview-build/**/*'],
    '/lobby/[[...path]]': ['./design-preview-build/public-lobby/**/*', './design-preview-build/fonts/**/*'],
  }),
  experimental: {
    externalDir: true,
    // Limit local Windows build workers; retain deployment/CI defaults.
    ...(process.platform === 'win32' && !process.env.CI ? { cpus: 4 } : {}),
  },
};
