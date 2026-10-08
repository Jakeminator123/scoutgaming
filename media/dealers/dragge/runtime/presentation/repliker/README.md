# Dragge – speech films, English (baked 2026-10-08)

The 17 lines of the game's speech catalogue as lip-synced films on Dragge's rest still, for the local presentation
lane. The folder name is the line id, the same ids as `presentation-runtime/media-families.mjs` and
`web/public/speech-lines.mjs`. `bank.json` here, published as `/dealers/dragge/audio/en/bank.json`, holds the
exact English text of each standard film. How the films were made and measured, and one take record per film:
`media/dealers/dragge/staging/2026-10-08/speech-en-bake/`.

## Format

| | |
|---|---|
| Films | MP4, H.264 (crf 12, preset slow), yuv420p, BT.709, 24 fps, **1080×1920**, faststart, **with sound**: AAC-LC, mono, 24 kHz, copied packet for packet from the lip-sync take |
| Rest still | `../rest.png`. Frame 0 and the last frame of every film match it at 47.22–47.36 dB PSNR (the deal films' frame 0: 46.3 dB), so speech and deal films start and end on the same picture |
| Movement | only the mouth and jaw; the rest of the picture is the still |
| Silence | 0.22–0.38 s before the voice and 0.46–0.80 s after it (no 10 ms window above -40 dBFS) |
| Voice | Dragge's cloned voice (ElevenLabs), English. Lip sync: MuseTalk, avatar `dragan_vila2x` (his KLARA `VILA.png`) |

## Standard films

| File | Text | Played when (`web/public/app.mjs`) | Length |
|---|---|---|---|
| `greeting/greeting.mp4` | Good evening, and welcome to the table. I'm Dragge, take any seat you like. | the player arrives | 4.8 s |
| `placebets/placebets.mp4` | Bets are open. Place your chips whenever you're ready. | a new round opens for bets | 3.6 s |
| `goodluck/goodluck.mp4` | No more bets. Here come the cards. | bets close | 2.6 s |
| `sidebet/sidebet.mp4` | Your side bet comes in. That one pays straight away. | a side bet wins | 3.8 s |
| `insurance/insurance.mp4` | Ace showing. Would anyone like insurance? | insurance is offered | 3.2 s |
| `double/double.mp4` | Doubling down. One card, and one card only. | the player doubles | 3.1 s |
| `bust/bust.mp4` | Over twenty-one, I'm afraid. That hand is done. | the player's hand goes over 21 | 3.6 s |
| `blackjack/blackjack.mp4` | Blackjack! Beautifully done. That pays three to two. | the player has blackjack | 3.5 s |
| `dealerblackjack/dealerblackjack.mp4` | Dealer has blackjack. I'm sorry, everyone. | the dealer has blackjack | 3.0 s |
| `dealerbust/dealerbust.mp4` | Dealer busts! Everyone still in the hand gets paid. | the dealer goes over 21 | 3.5 s |
| `win/win.mp4` | Well played. That hand is yours. | the player wins | 2.8 s |
| `push/push.mp4` | Same total. It's a push, your stake stays with you. | a push | 3.4 s |
| `lose/lose.mp4` | Dealer wins. That one goes to the house. | the player loses | 3.0 s |
| `peek/peek.mp4` | One moment while I check for blackjack. | not called today | 2.6 s |
| `farewell/farewell.mp4` | Thank you for playing. It was a pleasure dealing for you. | not called today | 3.7 s |
| `chatter1/chatter1.mp4` | Quiet night at the table. Those are my favourite. | not called today | 3.2 s |
| `chatter2/chatter2.mp4` | Take your time. The cards aren't going anywhere. | not called today | 3.2 s |

## variant/

Other wordings of the same moment. The player never chooses one by itself: only an explicit, reviewed Studio
media policy entry can select a variant, and the rehearsal panel plays the standard.

| File | Text | Length |
|---|---|---|
| `greeting/variant/greeting_2.mp4` | Welcome in. Pull up a chair, the cards are fresh and the table is yours. | 4.2 s |
| `greeting/variant/greeting_3.mp4` | A new face at the table. Welcome, I'm Dragge, and I'll be dealing for you tonight. | 4.8 s |
| `placebets/variant/placebets_2.mp4` | New round, fresh cards. The betting circle is all yours. | 3.9 s |
| `placebets/variant/placebets_3.mp4` | The table is open. Take your time, and place your bets. | 3.5 s |
| `goodluck/variant/goodluck_2.mp4` | Bets are closed. Good luck, everyone. | 2.7 s |
| `goodluck/variant/goodluck_3.mp4` | That's all the bets. Let's see what the shoe has for us. | 3.5 s |
| `sidebet/variant/sidebet_2.mp4` | Side bet's a winner. Nice way to start the hand. | 3.4 s |
| `sidebet/variant/sidebet_3.mp4` | And the side bet lands. Paid before we've even begun. | 3.8 s |
| `insurance/variant/insurance_2.mp4` | I have an ace. Insurance is open, and it pays two to one. | 4.0 s |
| `insurance/variant/insurance_3.mp4` | Ace up, so insurance is on offer. Entirely your call. | 3.2 s |
| `double/variant/double_2.mp4` | Double it is. Here's your one card. | 2.9 s |
| `double/variant/double_3.mp4` | Doubled. One card to settle it. | 2.5 s |
| `bust/variant/bust_2.mp4` | That's a bust. Unlucky card. | 2.4 s |
| `bust/variant/bust_3.mp4` | Too many, I'm sorry. That one goes to the house. | 3.5 s |
| `blackjack/variant/blackjack_2.mp4` | Blackjack, straight off the deal. Paid three to two. | 3.8 s |
| `blackjack/variant/blackjack_3.mp4` | Now that's how you open a hand. Blackjack, three to two. | 3.7 s |
| `dealerblackjack/variant/dealerblackjack_2.mp4` | Blackjack for the house this time. It happens to the best of us. | 3.5 s |
| `dealerblackjack/variant/dealerblackjack_3.mp4` | I'm afraid it's blackjack for me. That round goes to the house. | 4.4 s |
| `dealerbust/variant/dealerbust_2.mp4` | Too many for me. The house busts. Congratulations, table. | 3.8 s |
| `dealerbust/variant/dealerbust_3.mp4` | And that's over twenty-one for the dealer. Winners all round. | 3.7 s |
| `win/variant/win_2.mp4` | You beat me on that one. Congratulations. | 2.7 s |
| `win/variant/win_3.mp4` | A winning hand. Paid in full. | 2.6 s |
| `push/variant/push_2.mp4` | We're level. A push, nobody wins and nobody loses. | 3.9 s |
| `push/variant/push_3.mp4` | Push. Your bet comes back. | 2.5 s |
| `lose/variant/lose_2.mp4` | Not this time, I'm afraid. The house holds. | 3.0 s |
| `lose/variant/lose_3.mp4` | Close, but the house has it this round. | 2.9 s |
| `peek/variant/peek_2.mp4` | Dealer checks for blackjack. | 2.1 s |
| `peek/variant/peek_3.mp4` | Checking for blackjack. Nothing up my sleeve. | 2.9 s |
| `farewell/variant/farewell_2.mp4` | All done for tonight? Thank you, it was lovely having you at the table. | 4.7 s |
| `farewell/variant/farewell_3.mp4` | Good night, and thank you for the company at my table. | 3.8 s |
| `chatter1/variant/chatter1_2.mp4` | Eight decks, shuffled fresh every round. Every hand starts from nothing. | 4.9 s |
| `chatter1/variant/chatter1_3.mp4` | I've dealt a lot of hands at this table. No two ever play out the same. | 5.0 s |
| `chatter2/variant/chatter2_2.mp4` | No rush at all. Think it over. | 2.6 s |
| `chatter2/variant/chatter2_3.mp4` | Whenever you're ready. The decision is yours. | 3.1 s |

## Known limits

- While he speaks, the mouth area is softer and the lips paler than in the still: that is MuseTalk's mouth, and
  each take eases into it and back over about five frames at either end. The bake does not change it.
- `chatter1` and `chatter2` are not called by the game, and `/api/presentation/select` accepts letter-only line
  ids, so neither can be played yet. The same holds for Astrid's.

## Not done

- Visual lip-sync approval of every film. The take records are filled in as far as automated checks go and wait
  for a human reviewer.
- Swedish: the speech catalogue has no language dimension, so the Swedish takes are not included.
- The 15 extra lines of the delivery (`greet_*`, `remark_*`, `banter_1`, `table_*`) have no trigger here and are
  left out.
