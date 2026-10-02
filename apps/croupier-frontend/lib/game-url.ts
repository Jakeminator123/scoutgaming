const defaultGameUrl = "https://croupier-v2.onrender.com/blackjack?dealer=astrid"

export function gameUrl() {
  if (process.env.CROUPIER_VERCEL_UI === '1') return '/blackjack';
  return process.env.CROUPIER_GAME_URL || defaultGameUrl
}
