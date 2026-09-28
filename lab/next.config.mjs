import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
export default {
  distDir: process.env.CROUPIER_LAB_DIST_DIR || '.next',
  typescript: { tsconfigPath: process.env.CROUPIER_LAB_TSCONFIG || 'tsconfig.json' },
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingRoot: resolve(root, '..'),
  experimental: { externalDir: true },
};
