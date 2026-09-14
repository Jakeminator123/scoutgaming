# Foreground repeat preparation analysis

Root receipt foreground-repeat-browser-review.json confirms increasing reported drops2→7→15 even visible, same4♦ and same bytes. Thus hidden-tab state alone is not sufficient explanation.

The89→85 totalVideoFrames delta is NOT evidence that four output frames disappeared: each repeat seek decodes four frames before the playback baseline. Run1 starttotal4→end93; run2 previousend93→seeked97→end182; run3 previousend182→seeked186→end271. Each repeat adds89 cumulative frames when preparation is included, of which85 follow play baseline. Added qualityBeforePreparation/preparation timestamps to preserve both boundaries.

No waiting/stalled event in three playback phases. Run2 seek takes~234ms; run3~34ms, yet run3 has more drops. Warm rendercost is low. Callbackmetadata can describe prepared frame0 with callbackTime earlier than playStarted (run3), so classify it as preparation-related, not evidence actorwasdisplayedbeforeplay. No confirmed new duplicate-loop/lifecycle defect. Existing oldhandlers have generation guards; one VideoTexture and one renderer persist.

Bounded next experiment implemented ONLY as `?prepare=reload`: reload SAME video element from SAME URL before ready/initialpaint, resetting decode pipeline while retaining renderer/texture geometry. Default remains seek. Record three foreground repeats of same issuedcard, unchanged viewport/cardface, compare decode/quality deltas AND preparation+play totals and latency. This is an explicit hypothesis, not a claimed fix. No new source, resized video, phase lead, new server round or default switch. Full27 tests retained; syntax checked. If reload is no better, keep default and investigate decode/compositor scheduling outside this preparation path.
