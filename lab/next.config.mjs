import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
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
  outputFileTracingRoot: resolve(root, '..'),
  // Production obtains credentials/state from scoped env and Neon. Private
  // local config, QA evidence and old writable state must never be bundled.
  outputFileTracingExcludes: { '/*': ['../.env*', './.env*', './data/**', '../web/data/**',
    '../open-claw/lab/data/**', '../open-claw/lab/runtime/**', '../agent-talk/**', '../.croupier-inbox/**', '../random/**'] },
  outputFileTracingIncludes: {
    ...Object.fromEntries(['/', '/administration', '/control/clips', '/control/administration', '/control/tree', '/control/videos', '/control/openclaw', '/control/activity', '/control/guide', '/control/zones', '/control/events', '/control/probe', '/control/operator-chat', '/control/login', '/control/set-password', '/control/[[...path]]', '/partner/[[...path]]', '/partner/login', '/api/partner-preview', '/api/partner/[...action]', '/login', '/set-password', '/api/admin/**', '/api/auth/**', '/api/project', '/api/social', '/api/videos/**', '/api/zones/reference']
      .map(route => [route, ['../ops/neon-game/product-schema.sql', '../ops/neon-studio/*.sql',
        '../media/layout.json', '../media/blob-index.json', '../media/dealers/*/runtime/**/index.json',
        '../media/dealers/*/runtime/**/audio/en/bank.json', '../media/dealers/*/runtime/**/performance/manifest.json',
        '../media/dealers/astrid/runtime/presentation/lab-video-manifest.json', '../media/game/runtime/speech-media.json',
        '../media/dealers/*/runtime/composited/**/speak.json']])),
    '/preview/[...path]': ['./preview-build/**/*'],
  },
  experimental: {
    externalDir: true,
    // Limit local Windows build workers; retain deployment/CI defaults.
    ...(process.platform === 'win32' && !process.env.CI ? { cpus: 4 } : {}),
  },
};
