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
  experimental: { externalDir: true },
};
