# Scout / Privé UI verification — 25 September 2026

Final app: http://astrid-prive-ui.localhost:8620/

- Palette is black, warm white and champagne/gold, following the user's explicit
  exclusion of lime. Markers are denomination colors; green/red are action colors.
- Verified rendered layouts at normal narrow app width (597×837), desktop
  (1280×720), mobile (390×844), and short mobile (360×640). Short phones scroll
  rather than crop the source footage or overlap controls with the wallet.
- At 390×844, chip-row buttons fit between x18 and x372; controls end at y666,
  wallet starts at y717. At 360×640, controls end at y585 and the wallet starts
  at y704 on the scrollable page. No card dimensions or framing were edited.
- Browser on separate QA server/SQLite: main $5 + PP $5 + 21+3 $5 = $15.
  Double draft then Undo restored $15. Opening rendered 8♠, 8♥ and dealer A♦.
  Insurance button correctly offered $2.50. Clicking it debited to $982.50;
  dealer K♣ revealed; returned $42.50 (mixed-pair return $35 + insurance $7.50),
  resulting balance $1,025.00. New round reset draft and kept the wallet.
- A second rendered round exercised the decision UI; the test browser was also
  being interacted with during it, so it is not treated as a deterministic
  end-to-end test of every action. Authoritative split/double/hit/settlement
  regressions are covered by the existing engine tests.
- Automatic insurance decline visibly advanced into a fresh 20-second decision
  countdown in the first QA session. Countdown-only mode left the action to the
  player in the deterministic insurance test. Pure-clock tests verify the exact
  deadline, pause/resume and one-time expiration callback.
- Ambience loaded (readyState 4), played after a gesture, and currentTime advanced.
  Browser mute set aria-pressed=true and paused the actual audio element.
  Unit tests cover speech duck/restore, hidden-tab pause, persisted volume,
  no effects before unlock, and cancellation of stale sounds on mute. Physical
  speaker output was not recorded; no claim of a listening test is made.
- 26 Node tests passed, including the existing 197 shoe/service assertions.
  Browser console inspection showed no errors in the tested table.

Screenshots: normal-view.png, mobile.png, short-mobile.png. The normal app server
and original user wallets are separate from the temporary seeded QA databases.

## Follow-up: direct side-bet circles

The bet-type selector has been removed. Each main circle has a smaller PP circle
above-left and a 21+3 circle above-right, following the felt's perspective.
In the browser, clicking main, PP, 21+3, then main again on seat 4 produced main
$10, PP $5, 21+3 $5, total $20. No selector elements remain.

Verified at desktop and 390 x 844 mobile. The mobile screenshot
`sidebet-circles-mobile.png` shows those three distinct wagers and the centered
controls. Auto actions were disabled for this draft-only check; no round was
started. Earlier screenshots above document the previous control placement.

## Follow-up: countdown only before the deal

The countdown now exists only during betting. It is cleared and hidden as soon
as dealing starts; player decisions and insurance are manual and untimed.
The earlier automatic Stand/insurance observations above describe the previous
version and no longer apply.

Browser check on a separate localhost session: seat 4 main $5 showed the timer
at 20 before dealing. Clicking Deal hid it immediately (`display: none`).
The opening reached 9 clubs + 2 diamonds versus dealer king spades; the decision
buttons appeared with the timer still hidden. Stand completed the dealer's 19
and settled the round. New round returned to betting with a visible 20 and
"Lägg din första insats" after the place-bets line. Existing 26 tests passed.
