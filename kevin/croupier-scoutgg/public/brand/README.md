# Scout / Privé UI sources

Reference: croupier/design-kit/ScoutBrand.dc.html, BettingRail.dc.html,
HandBar.dc.html, and the existing Privé game controls.

The current instruction explicitly excludes lime. This implementation uses the
approved black/gold card back and table's champagne language: ink #0A0B0D,
cream #F2F1ED, champagne #DBC18A. The Scout mark's accent is champagne too.
Chip denomination colors and green/red decision actions are functional colors,
not a lime brand accent. Typography: Figtree and Space Grotesk, with local system
fallbacks when Google Fonts is unavailable.

Sound sources: /sfx/ambience.mp3 and table-audio.js were copied from the existing
croupier/web/public sound system. game-audio.js reuses its ceramic chip, paper,
knock and chime synthesis with volume controls and speech ducking.

No source media, card calibration or dealer framing is changed by this UI.
