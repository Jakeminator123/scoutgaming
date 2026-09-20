# Croupier: gemensamma begrepp / shared model (2026-09-20)

Recommended mental view: spel → dealer → presentationsbehov → konkret situation
→ variantfamilj → kompatibel take. A family is an expression (standard, calm,
warm); a take is a specific recording. The view need not mirror disk folders.

Existing engine/adapter: 10 internal Round event types, 6 public Partner
presentation types (speak/deal/reveal/turn/settle/idle), and 16 lab groupings are
different counts. The 16 are not 10+6 and not a complete inventory of videos.
Four dealers share the presentation contract; blackjack has seven physical boxes
0–6. A box is not necessarily a player; split hands can share one box.

Situation compatibility comes before expression: dealer, destination/box,
hand, card position, visibility, sequence and exact speech line matter.
shoeDraw identifies the draw, not position within a hand. Today's public deal
has no reason/card-position field; those require an adapter using public views
and command context. Do not invent fields or inspect hidden cards to derive them.
Standard/fallback must also fit the situation. Never select speech by approximate
duration or loop a recorded sentence over ongoing audio. Loop/duration/cue
constraints belong to the approved asset and playback contract, not model guesses.

Current lab: one variant has one assetId and at most one videoGenerationId.
Triggers gate candidates. Rules choose the highest-priority eligible variant;
active can accept validated OpenClaw advice; shadow keeps the baseline while
observing advice; off uses the baseline. OpenClaw is not a trigger category.
Deterministic signals and social/emotional signals are different input categories;
social values/history in the lab are simulated, not a working player-memory link.
Lab operator chat does not implement production player chat or IDE-agent inbox.

Proposals, NOT current runtime: multi-take families, equal/weighted selection
within a compatible pool, full situation coverage matrix, and queued extra
reactions. Three equal-weight compatible takes would mean 1/3 each, not equal
probability for incompatible takes. Presentation variation is separate from game
RNG. Replacement fulfills the same presentation; append adds a separate reaction
and needs explicit queue/timing rules. Do not silently turn one into the other.

Generations API want/no is media intake, not acceptance or live binding. A preview
reference does not prove an approved video. pickup/release/land/rest are media
cues, not new game events. Production acceptance ties exact speech/audio/video,
hashes, calibration and review together. Synthetic 2D motions are illustrations,
not proof of video coverage. Partner presentation projection is not yet the
ordinary game's direct playback integration. Kevin's verified source contract
and review of exact line/dealer/action/take are the integration boundary.

Source references (repository paths, not claims of live file access):
web/partner-presentation.mjs; lab/COMPATIBILITY.md;
random-stuff-jakob/jakob-docs/2026-09-20-situationer-variantfamiljer-och-takes.md.
This is a dated design snapshot; current request data is needed for live state.
