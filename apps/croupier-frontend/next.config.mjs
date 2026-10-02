import { platformConfiguration } from './lib/platform-routing.mjs';
import { fileURLToPath } from 'node:url';
const platform = platformConfiguration();
/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  outputFileTracingIncludes: platform ? { '/game': ['./runtime-ui/game.html'], '/v2': ['./runtime-ui/game.html'], '/casino.html': ['./runtime-ui/casino.html'], '/blackjack': ['./runtime-ui/blackjack.html'], '/bo/[[...path]]': ['./runtime-ui/bo*.html'] } : {},
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    if (platform) return [
      ...['/lab', '/labb', '/studio-astrid', '/studio-lissabon', '/labb-lissabon'].map(source => ({source, destination: '/studio', permanent: false})),
      {source: '/labb/filmer', destination: '/studio/videos', permanent: false},
      {source: '/labb/zoner', destination: '/studio/zones', permanent: false},
      {source: '/labb/guide', destination: '/studio/guide', permanent: false},
    ];
    // Operator shortcuts to the existing authenticated Lab on Render.
    return [
      { source: "/studio", destination: "https://croupier-v2.onrender.com/studio/", permanent: false },
      { source: "/lab", destination: "https://croupier-v2.onrender.com/studio/", permanent: false },
      { source: "/studio-astrid", destination: "https://croupier-v2.onrender.com/studio/", permanent: false },
      { source: "/studio-lissabon", destination: "https://croupier-v2.onrender.com/studio/", permanent: false },
      { source: "/labb", destination: "https://croupier-v2.onrender.com/studio/", permanent: false },
      { source: "/labb/filmer", destination: "https://croupier-v2.onrender.com/studio/videos", permanent: false },
      { source: "/labb/zoner", destination: "https://croupier-v2.onrender.com/studio/zones", permanent: false },
      { source: "/labb/guide", destination: "https://croupier-v2.onrender.com/studio/guide", permanent: false },
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
      {source: '/:path((?!game|blackjack|v2).*)', headers: [{key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()'}]},
      {source: '/game/:path*', headers: [{key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()'}]},
      {source: '/v2/:path*', headers: [{key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()'}]},
      {source: '/blackjack/:path*', headers: [{key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()'}]},
    ]
  },
}

export default nextConfig
