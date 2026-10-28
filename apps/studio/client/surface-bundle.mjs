import { readFile } from 'node:fs/promises';
import { dirname, resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

/** esbuild options for one surface's app.js (admin, lobby, public-lobby), shared by build.mjs and the
 * public-lobby bundle test, so the test checks the bundle the build actually ships. */
export function surfaceBundleOptions(surface) {
  const publicLobby = surface === 'public-lobby';
  const source = resolve(root, publicLobby ? 'lobby' : surface);
  return { entryPoints: [resolve(source, 'entry.tsx')],
    bundle: true, minify: true, sourcemap: false, platform: 'browser', target: 'es2022', jsx: 'automatic',
    // The shared room validator reaches this lazy game-only browser import.
    // It is served by the game runtime and is never used by the design lobby.
    external: ['/composition-runtime/compositor.js'],
    define: { 'process.env.NODE_ENV': '"production"',
      'process.env.NEXT_PUBLIC_ADMIN_WORKSPACE': JSON.stringify(surface==='admin'?'1':'0'),
      'process.env.NEXT_PUBLIC_LAB_BASE_PATH': JSON.stringify(process.env.CROUPIER_LAB_BASE_PATH === '/studio' ? '/studio' : '') },
    alias: { ...(publicLobby ? { '@/lib/catalog.mjs': resolve(root, 'runtime/public-lobby-catalog.mjs') } : {}),
      'react': resolve(root, 'node_modules/react'), 'react-dom': resolve(root, 'node_modules/react-dom'),
      '@': source, 'next/link': resolve(root, 'runtime/navigation.tsx'),
      'next/navigation': resolve(root, 'runtime/navigation.tsx'), 'next/image': resolve(root, 'runtime/image.ts') },
    // Keep the imported internal design intact. The independent public bundle
    // uses its own asset URLs, player readers and home link.
    plugins: publicLobby ? [publicLobbyPaths(source)] : [],
  };
}

/** Rewrites Admin's asset base, home link and label in files under client/lobby only. A lobby URL built
 * outside that folder is not rewritten, so its base must live in client/lobby (see lobby/lib/catalog.mjs). */
export function publicLobbyPaths(source = resolve(root, 'lobby')) {
  return { name: 'public-lobby-paths', setup(builder) {
    builder.onLoad({ filter: /\.(?:tsx?|mjs)$/ }, async args => {
      if (!args.path.startsWith(source + sep)) return;
      const contents = (await readFile(args.path, 'utf8'))
        .replaceAll('/admin/_assets/lobby/', '/lobby/_assets/lobby/')
        .replaceAll('/admin/structure', '/')
        .replaceAll('Till administrationen', 'Till startsidan');
      return { contents, loader: extname(args.path) === '.mjs' ? 'js' : extname(args.path).slice(1) };
    });
  } };
}
