import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
export default {
  basePath: process.env.CROUPIER_LAB_BASE_PATH || '',
  env: { NEXT_PUBLIC_LAB_BASE_PATH: process.env.CROUPIER_LAB_BASE_PATH || '' },
  distDir: process.env.CROUPIER_LAB_DIST_DIR || '.next',
  typescript: { tsconfigPath: process.env.CROUPIER_LAB_TSCONFIG || 'tsconfig.json' },
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingRoot: resolve(root, '..'),
  // Production obtains credentials/state from scoped env and Neon. Private
  // local config, QA evidence and old writable state must never be bundled.
  outputFileTracingExcludes: { '/*': ['../.env*', './.env*', './data/**', '../web/data/**',
    '../open-claw/lab/data/**', '../open-claw/lab/runtime/**', '../agent-talk/**', '../.croupier-inbox/**'] },
  outputFileTracingIncludes: Object.fromEntries(['/', '/administration', '/login', '/set-password', '/api/admin/**', '/api/auth/**', '/api/project', '/api/social', '/api/videos/**']
    .map(route => [route, ['../ops/neon-game/product-schema.sql', '../ops/neon-studio/*.sql',
      '../media/layout.json', '../media/blob-index.json', '../media/dealers/*/runtime/**/index.json',
      '../media/dealers/*/runtime/**/audio/en/bank.json', '../media/dealers/*/runtime/**/performance/manifest.json',
      '../media/dealers/astrid/runtime/presentation/lab-video-manifest.json', '../media/game/runtime/speech-media.json',
      '../media/dealers/*/runtime/composited/**/speak.json']])),
  experimental: { externalDir: true },
};
