# Existing Astrid clips enabled together

The user requested connecting existing rendered clips for a demonstrable game, accepting that the current material is imperfect. No generation was submitted.

On the isolated `astridsingleseat.localhost:4190` Astrid URL with `astridBox0=review&astridVariant=v6`, the first centre card and first face-up dealer card now inherit the existing review switch. Together with first-card box0v6 and box1, this selects four available candidate routes. Explicit per-route off overrides remain. The centre layout still requires the reviewed 1091x837 viewport; dealer-up retains its reviewed viewport guard. Other configurations fall back rather than detach cards from filmed hands.

Technical status banners are hidden unless diagnostics/capture is explicitly enabled. Their DOM receipts remain available. Card identities, hole-card protection, first-card/split gates and target tolerances are unchanged.

Actual visible browser test used the unchanged demo URL at 1091x837: three $5 bets at boxes0,1,3, two cards at each, three Stand decisions, dealer settlement and return to bets. Wallet925→910→940; returned30. `three-seat.json` contains retained final player/dealer receipts and per-seat card counts; earlier player receipts are replaced by the next player route and therefore are not individually retained in that file. `three-seat-settlement.txt` records the full-round result. Dealer-up completed and landed once using clean source hash6eaeb503; box0v6 completed and landed once. Frame drops remain and no60fps claim is made.

This is partial integration, not all twelve history clips and not completed seven-seat realism. Additional player cards and unsupported destinations still use legacy footage. Partial extraction experiments and clips with incompatible camera/return poses were not silently inserted. Their missing motion is not repaired by these defaults.

Validation: 18 focused routing/geometry/diagnostic tests, required pre-commit suites and dealer-sync probe pass. Public4173 and other dealers are unchanged.
