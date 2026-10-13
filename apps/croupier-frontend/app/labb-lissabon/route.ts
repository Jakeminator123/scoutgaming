// Legacy compatibility redirect; preserve the destination and existing Studio gate.
// Production Studio revisions live in Neon and media in Blob, not a Render disk.
export function GET() {
  return new Response(null, {
    status: 307,
    headers: {
      Location: 'https://croupier-v2.onrender.com/studio',
      'Cache-Control': 'no-store',
    },
  });
}
