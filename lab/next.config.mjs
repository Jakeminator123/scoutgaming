import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
export default {
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingRoot: resolve(root, '..'),
  experimental: { externalDir: true },
};
