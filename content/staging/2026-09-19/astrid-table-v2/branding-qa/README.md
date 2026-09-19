# Astrid table details and restored idle — 19 September 2026

The user requested the missing branding and shoe cards, then explicitly restored the original living idle and requested felt-aligned betting boxes and chips. No generation or production deployment occurred.

The supplied table materials and geometry remain intact. Runtime ink restores the original Scout bracket/S, payout text and arc. The hollow shoe receives a branded card pack whose length and follower use authoritative remaining/total counts. Invalid state shows no invented pack; empty state hides all cards.

Seven marker planes lie on the felt. Their projected corners define the exact CSS homography for betting hit targets and chip stacks. Main chips are circular 44-unit art inside a 60-unit circle; side chips are 12 units inside the 14-unit crescent. This avoids applying an ellipse before the table projection. Existing chips, bankroll and outcomes stay server-owned. The betting banner moved below the target row.

The original 145-frame paired RGB/actor-mask idle runs through DealerEngine at its native24fps. A rigid uniform placement matches the new take's head size; the old masked body remains unwarped. Idle hides for the green first-upcard and resumes afterward. Old speech/action fallbacks remain disabled. Folded idle arms and extended green-take arms still cut between poses; this is not a generated transition or full-motion acceptance.

Actual isolated guest QA: seven main bets plus PP on box0 and21+3 on box6, total45; 16-card opening; rightmost hit bust; five stands and one natural; settlement62.50 returned, balance1017.50. Counts415→399→398→397 match the rendered shoe. All seven main click targets and both side targets worked. A refresh preserved the active hand, stake and balance. Restored idle was observed across repeated cycles and the green replay hid it correctly. No new QA warning/error logged. Earlier branding-only QA had one performance interruption while the user was interacting; it is not counted as motion acceptance.

Screenshots: fitted-chips.png is the final in-round composition; green-first-card.png captures the new action; settled.png records the return to betting. The initial chip screenshot predates the final size correction and is retained as before evidence. Detailed observations are in result.json. Focused tests, full precommit suites and dealer-sync probe pass.

Local4190 was restarted from the existing astrid-green-table/runtime with its own saved data; no database copied or replaced. The user began a subsequent round in the final QA tab; it was left untouched.
