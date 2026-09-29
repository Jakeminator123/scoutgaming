/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
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
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ]
  },
}

export default nextConfig
