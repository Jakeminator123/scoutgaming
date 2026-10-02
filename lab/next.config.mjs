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
  outputFileTracingIncludes: Object.fromEntries(['/administration', '/api/admin/**', '/api/auth/session']
    .map(route => [route, ['../ops/neon-game/product-schema.sql', '../ops/neon-studio/*.sql']])),
  experimental: { externalDir: true },
};
