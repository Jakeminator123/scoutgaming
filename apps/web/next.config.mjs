import { fileURLToPath } from 'node:url';
import {adminDocumentHref} from '../../packages/navigation/admin-workspace-routes.mjs';
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep local Windows builds responsive while other apps and agents are running.
  ...(process.platform === 'win32' && !process.env.CI ? { experimental: { cpus: 4 } } : {}),
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  // /game serves the engine document in canonical mode; the local shell is the non-Neon fallback.
  outputFileTracingIncludes: { '/game': ['./runtime-ui/game.html'], '/player-login': ['./runtime-ui/blackjack.html'] },
  images: {
    unoptimized: true,
  },
  async redirects() {
    // Retired lab bookmarks go straight to the Admin workspace. Game, lobby,
    // Admin and Partner routing is owned by middleware and the Services config.
    return [
      ...['/lab', '/labb', '/studio-astrid', '/studio-lissabon', '/labb-lissabon'].map(source => ({source, destination: adminDocumentHref('/control'), permanent: false})),
      {source: '/labb/filmer', destination: adminDocumentHref('/control/videos'), permanent: false},
      {source: '/labb/zoner', destination: adminDocumentHref('/control/zones'), permanent: false},
      {source: '/labb/guide', destination: adminDocumentHref('/control/guide'), permanent: false},
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
        ],
      },
      {source: '/:path((?!game).*)', headers: [{key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()'}]},
      {source: '/game/:path*', headers: [{key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()'}]},
    ]
  },
}

export default nextConfig
