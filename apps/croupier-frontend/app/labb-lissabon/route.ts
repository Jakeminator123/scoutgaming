// Lab runs beside the game on Render so uploads and project revisions share
// its persistent disk. Authentication remains owned by the existing Lab gate.
export function GET() {
  return new Response(null, {
    status: 307,
    headers: {
      Location: 'https://croupier-v2.onrender.com/studio',
      'Cache-Control': 'no-store',
    },
  });
}
