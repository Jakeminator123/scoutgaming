const defaultGameUrl = "https://croupier-v2.onrender.com/blackjack?dealer=astrid"

export function gameUrl() {
  return process.env.CROUPIER_GAME_URL || defaultGameUrl
}
