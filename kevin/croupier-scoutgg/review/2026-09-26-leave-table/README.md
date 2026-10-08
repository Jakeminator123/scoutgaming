# Leave table

Explicit leave releases seats and pending (not yet debited) bets immediately
outside an active round. During a round the request persists across restart:
insurance is declined and the leaving owner's hands stand when their turns
arrive after current media playback. Existing bets settle once before ownership
is released. Other owners keep their seats and decision control.

Disconnected owners are detected after 120 seconds without table polling.
Seats are released outside rounds, including settled rounds. Active hands finish
before release. An empty settled table returns to betting so a new guest can join.
An open foreground tab continues polling and is not treated as disconnected.

The existing 24-hour demo break remains a separate control. The UI adds Leave
table beside the footer actions; pending departure reads Leaving after hand.
Mobile actions use two columns, with wallet space reserved above the footer.

79 tests pass, covering leave/rejoin, pending bets, restart, insurance, ownership,
settlement and disconnected cleanup. WebKit iPhone-viewport QA exercised leave
before and during dealing, automatic completion, rejoin and wallet separation.
See browser.json and screenshots. This is browser emulation, not physical iPhone
validation. The disposable QA database is /tmp/astrid-leave-qa.sqlite.
