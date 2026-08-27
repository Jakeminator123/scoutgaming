# Scout Live Casino — Expected Results

Source of truth: John's 30s commercial (2026-08-27, WhatsApp master). The film IS the spec.
Brand: **SCOUT LIVE CASINO** · "You cannot tell our dealers from real ones."
Promise architecture: **EVERY FACE · EVERY LANGUAGE · INFINITE TABLES**

## ER-1 · EVERY FACE — dealer selection
- The player chooses a dealer before (or at) the table; switching dealers is a first-class action.
- Minimum roster to match the film: **Vera** (auburn, mahogany Privé — shipped) plus **three new dealers**:
  - blonde, black blazer/white blouse — dark graphite hall
  - brunette, camel blazer — golden salon
  - East Asian, navy uniform with name badge — azure venue
- Each dealer is a COMPLETE experience at Vera's quality bar: idle loop, dealing actions, speech clips
  regenerated from her own canonical still, per-clip measured lip-sync, her own voice.
  A dealer is NOT a reskin; a dealer with fewer clips than the MVP set does not ship.
- MVP clip set per dealer (proves the experience, extends later):
  idle, action-deal, greeting, goodluck, win, lose (6 clips) + her TTS voice for the full line bank.

## ER-2 · INFINITE TABLES — rooms
- Three new rooms beyond the mahogany Privé, matching the film's grade:
  **Dark Hall** (graphite, linear pendants, illuminated white table rim),
  **Golden Salon** (amber light, tan felt),
  **Azure Venue** (curved white architecture, cyan-lit tables).
- Room = plate + table art + felt palette + matching dealer lighting. Room, dealer and felt change TOGETHER.
- The tier selector becomes places: CLASSIC → Dark Hall, HIGH ROLLER → Golden Salon, VIP SALON → Azure Venue
  (Privé stays the flagship/default). Table limits stay as shipped.

## ER-3 · EVERY LANGUAGE
- The audio bank layout is per-dealer, per-language (`dealers/<name>/audio/<lang>/`).
- v1 ships English; the pipeline (TTS → seedance clip per line → measured sync) must be re-runnable per language
  with zero code changes. Swedish is the first expansion candidate.

## ER-4 · The reveal moment (product echo of the ad)
- The lobby/tier switch shows the floor: choosing a table pulls INTO a room (even as a simple
  crossfade + room plate zoom, v1). The ad's pull-back is the reference for the feeling, not literal 3D.

## Acceptance checks (per dealer/room)
1. Splice check: dealer's speech/action clips vs her idle — stream-frame diff at boundaries ≤ 2.5.
2. Lip-sync: measured residual ≤ 100ms constant per clip (warp + stamp pipeline).
3. Room continuity: her table rail/felt in-video matches the room's art at the composite line (same bake
   architecture as Vera: keep everything below v0.845 + center span).
4. Voice: distinct per dealer; the same line spoken by two dealers must not be the same audio.
5. Switching dealer/room mid-session keeps balance, bets and round state.

## Build order (credits are the constraint, ~875 on the workspace)
1. Canonical stills ×3 + room plates ×3 (images — cheap, in flight).
2. ONE dealer end-to-end at MVP scope in her room, wired to a tier (≈300 credits incl. TTS) — the
   architecture proof. Kevin gate: approve her before scaling.
3. Remaining two dealers (≈600 credits) — top-up likely needed.
4. Full line-bank parity per dealer, then languages.
