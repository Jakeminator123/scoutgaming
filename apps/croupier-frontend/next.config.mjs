import { platformConfiguration } from './lib/platform-routing.mjs';
import { fileURLToPath } from 'node:url';
const platform = platformConfiguration();
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep local Windows builds responsive while other apps and agents are running.
  ...(process.platform === 'win32' && !process.env.CI ? { experimental: { cpus: 4 } } : {}),
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  outputFileTracingIncludes: platform ? { '/game': ['./runtime-ui/game.html'], '/v2': ['./runtime-ui/game.html'], '/blackjack': ['./runtime-ui/blackjack.html'], '/play/blackjack': ['./runtime-ui/game.html'], '/player-login': ['./runtime-ui/blackjack.html'] } : {},
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    if (platform) return [
      ...['/lab', '/labb', '/studio-astrid', '/studio-lissabon', '/labb-lissabon'].map(source => ({source, destination: '/control', permanent: false})),
      {source: '/labb/filmer', destination: '/control/videos', permanent: false},
      {source: '/labb/zoner', destination: '/control/zones', permanent: false},
      {source: '/labb/guide', destination: '/control/guide', permanent: false},
    ];
    // Legacy lab names go to staff control. /studio stays the Render lab mount.
    return [
      { source: "/studio", destination: "https://croupier-v2.onrender.com/studio/", permanent: false },
      { source: "/lab", destination: "https://www.scoutgaming.tech/control", permanent: false },
      { source: "/studio-astrid", destination: "https://www.scoutgaming.tech/control", permanent: false },
      { source: "/studio-lissabon", destination: "https://www.scoutgaming.tech/control", permanent: false },
      { source: "/labb", destination: "https://www.scoutgaming.tech/control", permanent: false },
      { source: "/labb-lissabon", destination: "https://www.scoutgaming.tech/control", permanent: false },
      { source: "/labb/filmer", destination: "https://www.scoutgaming.tech/control/videos", permanent: false },
      { source: "/labb/zoner", destination: "https://www.scoutgaming.tech/control/zones", permanent: false },
      { source: "/labb/guide", destination: "https://www.scoutgaming.tech/control/guide", permanent: false },
    ]
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
      {source: '/:path((?!game|blackjack|v2|play/blackjack).*)', headers: [{key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()'}]},
      {source: '/game/:path*', headers: [{key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()'}]},
      {source: '/v2/:path*', headers: [{key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()'}]},
      {source: '/blackjack/:path*', headers: [{key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()'}]},
      {source: '/play/blackjack/:path*', headers: [{key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()'}]},
    ]
  },
}

export default nextConfig
