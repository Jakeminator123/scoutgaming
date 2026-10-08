# Dragge – English speech: take records (2026-10-08)

One record per film, fields as in `lab/docs/templates/media-take.md`. Written by `build.py` from the checks in
`receipt.json`. Automated checks pass for every film; nobody has reviewed the lip sync yet, so every take is
**ogranskad** (unreviewed). A changed text, audio or video hash invalidates any later approval.

## `repliker/greeting/greeting.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `greeting` (family `dragge/speak.other/greeting`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Standard of the family; `greeting_1`. Selected whenever the game speaks the line. Trigger: `say('greeting')`, the player arrives.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `c3934c82-8623-53e3-d72f-b203ba5df4e8`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/greeting/greeting.mp4`, `c3934c82862353e3d72fb203ba5df4e8347d90b17e2b848500771a26ebbf0678`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 114 frames (4.750 s; sound 4.693 s), 675156 bytes.
- Exakt text och språk (tal): English: "Good evening, and welcome to the table. I'm Dragge, take any seat you like."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `greeting_1.mp4` (`d419f419c97a9ce5e8950faddaf9f201e6764ee9e4da7f045222eba85e384153`), copied packet for packet (identical packets: yes); payload `a3c7d229d2a50f5acf714d0a1fce7562abaa528de6a3ac268a8f2636f07cf27f`. Lip-sync input `voice/en-wav/greeting_1.wav` (`d762bc46b2c585a7b84b05e2ae4aeec77781c554a86df05336381c6441ef8f94`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–113; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.25 s to 3.99 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.32 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/greeting_1.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'greeting'}` resolves to family `dragge/speak.other/greeting` in the repository registry with this film's video ID as its standard; `test/presentation-select-dealers.mjs`: `/api/presentation/select` serves this film for Dragge's line; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/greeting/variant/greeting_2.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `greeting` (family `dragge/speak.other/greeting`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `greeting_2`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('greeting')`, the player arrives.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `878ce94b-b4a0-beb1-ac4a-9d1e30d0bbe4`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/greeting/variant/greeting_2.mp4`, `878ce94bb4a0beb1ac4a9d1e30d0bbe4c2e2386f29c50a7f461a7880304c90e9`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 100 frames (4.167 s; sound 4.096 s), 655936 bytes.
- Exakt text och språk (tal): English: "Welcome in. Pull up a chair, the cards are fresh and the table is yours."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `greeting_2.mp4` (`1b197678e3aabc1b2b7b4f74c01593deb60ba6b5b20d735cee26f52342d574e0`), copied packet for packet (identical packets: yes); payload `6d86eefd2c29052634bf2ecf77fca8f029c6887906c2466ba411426ea6ed8fc8`. Lip-sync input `voice/en-wav/greeting_2.wav` (`a7529b4dce691e323d7cf061dd6d7a860a0b7f59d815ab5d5fb1879b5eacb98b`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–99; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 3.62 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.3 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/greeting_2.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'greeting'}` resolves to family `dragge/speak.other/greeting` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/greeting/variant/greeting_3.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `greeting` (family `dragge/speak.other/greeting`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `greeting_3`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('greeting')`, the player arrives.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `fae35349-8a54-514e-c570-6106c394c4af`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/greeting/variant/greeting_3.mp4`, `fae353498a54514ec5706106c394c4af60247bbf6da156cbc1b4a54687b40014`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 114 frames (4.750 s; sound 4.693 s), 676770 bytes.
- Exakt text och språk (tal): English: "A new face at the table. Welcome, I'm Dragge, and I'll be dealing for you tonight."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `greeting_3.mp4` (`89f706f2b5849aa8523e9958390c5762f896fa25a5fa2a2e51987de816c1eacd`), copied packet for packet (identical packets: yes); payload `6ba28e06865da9046c096029270b34906242cfebe04c5b886425f2a6100b3e06`. Lip-sync input `voice/en-wav/greeting_3.wav` (`5927adcdb12a13401a3ba0c264cdb13fe4e7aae22603a0ddb5ab91b3e2a5f905`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–113; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 3.98 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.32 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/greeting_3.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'greeting'}` resolves to family `dragge/speak.other/greeting` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/placebets/placebets.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `placebets` (family `dragge/speak.other/placebets`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Standard of the family; `placebets_1`. Selected whenever the game speaks the line. Trigger: `say('placebets')`, a new round opens for bets.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `12a5af97-ba19-7cca-db2f-76b85ed98a98`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/placebets/placebets.mp4`, `12a5af97ba197ccadb2f76b85ed98a98b2226eac6be3a3deb3a7e1729e13bc6e`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 87 frames (3.625 s; sound 3.584 s), 633544 bytes.
- Exakt text och språk (tal): English: "Bets are open. Place your chips whenever you're ready."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `placebets_1.mp4` (`37a2479b7dc9e31c342941d5a9e93fb8f951998542d14b40d8dd3c613565f013`), copied packet for packet (identical packets: yes); payload `d87b4fb66626028b5a1aac53b4ad22207e96eeb69e204e5a257048f64c163995`. Lip-sync input `voice/en-wav/placebets_1.wav` (`02f61f04ba8f5e233b71e44689a358e5d953b8d21937c3b11f1279ab1a3747b3`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–86; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.23 s to 2.85 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.3 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/placebets_1.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'placebets'}` resolves to family `dragge/speak.other/placebets` in the repository registry with this film's video ID as its standard; `test/presentation-select-dealers.mjs`: `/api/presentation/select` serves this film for Dragge's line; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/placebets/variant/placebets_2.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `placebets` (family `dragge/speak.other/placebets`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `placebets_2`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('placebets')`, a new round opens for bets.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `03d89085-7d87-4e4f-3e94-d65b8b0edcab`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/placebets/variant/placebets_2.mp4`, `03d890857d874e4f3e94d65b8b0edcab1b28df14c2ec8c0dfa28ef3fe1b76a5c`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 93 frames (3.875 s; sound 3.797 s), 640564 bytes.
- Exakt text och språk (tal): English: "New round, fresh cards. The betting circle is all yours."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `placebets_2.mp4` (`5889fa4aa696cfcc758953e0c3021d8968d57950bbf53ab9e9ba853f4127f9d9`), copied packet for packet (identical packets: yes); payload `ea2f6b87b8e7aedcad9582d6532463580991eed549a61e0dd49425698199e4ba`. Lip-sync input `voice/en-wav/placebets_2.wav` (`4c7ea1b4ceec1a65f92d598a1694bc3f25e180e5c58e25a4f3761add56dd54f7`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–92; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 3.34 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.28 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/placebets_2.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'placebets'}` resolves to family `dragge/speak.other/placebets` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/placebets/variant/placebets_3.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `placebets` (family `dragge/speak.other/placebets`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `placebets_3`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('placebets')`, a new round opens for bets.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `475d5c7e-453e-929d-50d6-2e4e95a65b86`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/placebets/variant/placebets_3.mp4`, `475d5c7e453e929d50d62e4e95a65b868e0dffb4c33e1ed1718c06efa526ecd0`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 85 frames (3.542 s; sound 3.499 s), 632378 bytes.
- Exakt text och språk (tal): English: "The table is open. Take your time, and place your bets."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `placebets_3.mp4` (`515646a1ce70e3205fa69a0e185d199c7150df2c59ceac07c5af9d36b658a31b`), copied packet for packet (identical packets: yes); payload `76a4c15f03fa16919c629b82ce3fdb934a519429242cc43bd2b88431dbe51eb2`. Lip-sync input `voice/en-wav/placebets_3.wav` (`684859f627bb42701518bbf10efa11cef16d8c7ce6de66345f818f94fbbc317c`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–84; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.29 s to 2.85 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.27 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/placebets_3.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'placebets'}` resolves to family `dragge/speak.other/placebets` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/goodluck/goodluck.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.goodluck`, line `goodluck` (family `dragge/speak.goodluck/goodluck`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Standard of the family; `goodluck_1`. Selected whenever the game speaks the line. Trigger: `say('goodluck')`, bets close.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `3d91bf38-d5a6-41f3-9a80-7911e95424e1`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/goodluck/goodluck.mp4`, `3d91bf38d5a641f39a807911e95424e190d097aab3feb8dea2cd9d6143bde8b3`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 62 frames (2.583 s; sound 2.517 s), 590118 bytes.
- Exakt text och språk (tal): English: "No more bets. Here come the cards."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `goodluck_1.mp4` (`b508a25e8339e985816ba7831c3f4348182e6f6f12003c14ded5a9ebaa7659e2`), copied packet for packet (identical packets: yes); payload `638cfa135a1a500ce538b074bc4b18823fc244e6378a42cf268b87bf83f8d718`. Lip-sync input `voice/en-wav/goodluck_1.wav` (`31274c3248a96a791e784c6dc5d3e406036ff768a424ad47f6c944c92217aa1d`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–61; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 1.76 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.26 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/goodluck_1.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'goodluck'}` resolves to family `dragge/speak.goodluck/goodluck` in the repository registry with this film's video ID as its standard; `test/presentation-select-dealers.mjs`: `/api/presentation/select` serves this film for Dragge's line; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/goodluck/variant/goodluck_2.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.goodluck`, line `goodluck` (family `dragge/speak.goodluck/goodluck`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `goodluck_2`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('goodluck')`, bets close.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `ffb70994-b6d9-2992-8a5c-09636f188c74`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/goodluck/variant/goodluck_2.mp4`, `ffb70994b6d929928a5c09636f188c74d1af0f90c77faee45eaf8a2dbfb15b07`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 65 frames (2.708 s; sound 2.645 s), 591785 bytes.
- Exakt text och språk (tal): English: "Bets are closed. Good luck, everyone."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `goodluck_2.mp4` (`12a40a06cb1a747cddaf8490705696eee3c5c33651860a290de8d50c47b86564`), copied packet for packet (identical packets: yes); payload `d6a6cff68b9dac2dfaaf0b16adf7d8c8ebdbc224ea2c4e62a750583357c2cb4c`. Lip-sync input `voice/en-wav/goodluck_2.wav` (`0049b6406564bb71d0958f7d726d3719f5bbc8d0b20033aadcb713cb305fa175`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–64; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.35 s to 1.97 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.23 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/goodluck_2.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'goodluck'}` resolves to family `dragge/speak.goodluck/goodluck` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/goodluck/variant/goodluck_3.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.goodluck`, line `goodluck` (family `dragge/speak.goodluck/goodluck`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `goodluck_3`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('goodluck')`, bets close.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `5efc1ac5-a988-c684-0e26-572c752cf4a6`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/goodluck/variant/goodluck_3.mp4`, `5efc1ac5a988c6840e26572c752cf4a69609bedd4454f00b13a07d44a1182819`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 85 frames (3.542 s; sound 3.499 s), 629983 bytes.
- Exakt text och språk (tal): English: "That's all the bets. Let's see what the shoe has for us."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `goodluck_3.mp4` (`0e75b61e7ae59bb151bd67e3e55d4caecfbbd0538f8649a20889a4fcb373f1b9`), copied packet for packet (identical packets: yes); payload `593207916ccc3a3091bc653872909faf07274fb8ad7478855c77c434da412e17`. Lip-sync input `voice/en-wav/goodluck_3.wav` (`48f4ceda45f82c53228a0dfde38824afb4dfd1c46c04bac30f4723e9d36942c8`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–84; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.23 s to 2.81 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.27 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/goodluck_3.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'goodluck'}` resolves to family `dragge/speak.goodluck/goodluck` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/sidebet/sidebet.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `sidebet` (family `dragge/speak.other/sidebet`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Standard of the family; `sidebet_1`. Selected whenever the game speaks the line. Trigger: `say('sidebet')`, a side bet wins.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `23e5d0e5-96af-c050-cc0f-acc3c831c704`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/sidebet/sidebet.mp4`, `23e5d0e596afc050cc0facc3c831c70401cec28dfaf20e9ee0d44af084db31a3`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 91 frames (3.792 s; sound 3.712 s), 637743 bytes.
- Exakt text och språk (tal): English: "Your side bet comes in. That one pays straight away."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `sidebet_1.mp4` (`5c0e45e7b4c46b89dbae3358e3bda334a1ed47b2e22f32268342fa887c9d862e`), copied packet for packet (identical packets: yes); payload `dec3fb5d8860b50d084aac29f9f7ce25158f053a5f469ee0cf25071b585c50c5`. Lip-sync input `voice/en-wav/sidebet_1.wav` (`a04981fe258d65699c8b51064a8ea44e20c744fc8dc8d94b5661525528908099`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–90; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.38 s to 3.24 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.31 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/sidebet_1.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'sidebet'}` resolves to family `dragge/speak.other/sidebet` in the repository registry with this film's video ID as its standard; `test/presentation-select-dealers.mjs`: `/api/presentation/select` serves this film for Dragge's line; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/sidebet/variant/sidebet_2.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `sidebet` (family `dragge/speak.other/sidebet`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `sidebet_2`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('sidebet')`, a side bet wins.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `1f97df2b-192a-ba5d-8f5f-826b5417388b`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/sidebet/variant/sidebet_2.mp4`, `1f97df2b192aba5d8f5f826b5417388b219a8f6cfb6f6187dd1708898279d867`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 81 frames (3.375 s; sound 3.328 s), 624352 bytes.
- Exakt text och språk (tal): English: "Side bet's a winner. Nice way to start the hand."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `sidebet_2.mp4` (`dfced69bed771ce9d50693b262e41b87234fcc270a6030d7b3c3e9354d25e084`), copied packet for packet (identical packets: yes); payload `e40ac18606d62f4e0c6e9a9446378bb34fed624267f3c3894f096ab073dc2af1`. Lip-sync input `voice/en-wav/sidebet_2.wav` (`5070ea2d3af221f65d1208bac5d2efd5da9c93ac4719437cc86121f7feec59bc`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–80; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 2.75 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.27 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/sidebet_2.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'sidebet'}` resolves to family `dragge/speak.other/sidebet` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/sidebet/variant/sidebet_3.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `sidebet` (family `dragge/speak.other/sidebet`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `sidebet_3`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('sidebet')`, a side bet wins.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `cfc481ce-a083-0651-6907-521c32659cdd`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/sidebet/variant/sidebet_3.mp4`, `cfc481cea08306516907521c32659cddc3d34c379340f20125c358c9bf5149a1`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 91 frames (3.792 s; sound 3.712 s), 642398 bytes.
- Exakt text och språk (tal): English: "And the side bet lands. Paid before we've even begun."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `sidebet_3.mp4` (`628345fb88804215160dab65741f95670e8bc484197eaf40b4e8525b754d311e`), copied packet for packet (identical packets: yes); payload `4057886cfdf80ffa8b6e96e84a66dfea7ae32b2de5c91b62fdb32c18fa36593d`. Lip-sync input `voice/en-wav/sidebet_3.wav` (`90b037fd265c7ece463238627c7498fed4f128ae0c444d8df8c3f14ced1d0874`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–90; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.31 s to 3.02 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.31 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/sidebet_3.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'sidebet'}` resolves to family `dragge/speak.other/sidebet` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/insurance/insurance.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.insurance`, line `insurance` (family `dragge/speak.insurance/insurance`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Standard of the family; `insurance_1`. Selected whenever the game speaks the line. Trigger: `say('insurance')`, insurance is offered.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `ad36615e-9a01-7d6b-facc-0790110e3737`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/insurance/insurance.mp4`, `ad36615e9a017d6bfacc0790110e3737ed69c955721825d585532139e1c4c01b`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 77 frames (3.208 s; sound 3.157 s), 617152 bytes.
- Exakt text och språk (tal): English: "Ace showing. Would anyone like insurance?"
- Ljudreferens och SHA-256 (tal): the AAC stream of take `insurance_1.mp4` (`df23df88f009f9b8b3df32654ffb01cfa5ac378ec6402b36ba6953c7b914634a`), copied packet for packet (identical packets: yes); payload `1e097c0a7fb5398e5a7dd08a49b811f2ea7ebebaa19b425578a226b676958eef`. Lip-sync input `voice/en-wav/insurance_1.wav` (`e9e372522d43058953704abbb819c57eb043a6e2a68432832bdf927ded3646f1`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–76; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 2.64 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.25 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/insurance_1.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'insurance'}` resolves to family `dragge/speak.insurance/insurance` in the repository registry with this film's video ID as its standard; `test/presentation-select-dealers.mjs`: `/api/presentation/select` serves this film for Dragge's line; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/insurance/variant/insurance_2.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.insurance`, line `insurance` (family `dragge/speak.insurance/insurance`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `insurance_2`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('insurance')`, insurance is offered.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `b008b3aa-8991-0926-0de5-cbb20524e42b`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/insurance/variant/insurance_2.mp4`, `b008b3aa899109260de5cbb20524e42b7b6da6630f6d803d1a79efe6f5025797`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 96 frames (4.000 s; sound 3.925 s), 649638 bytes.
- Exakt text och språk (tal): English: "I have an ace. Insurance is open, and it pays two to one."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `insurance_2.mp4` (`6383387e473708290c2d69f630f33ebc2f5d3d917c201671bbab6ac91a6c4b11`), copied packet for packet (identical packets: yes); payload `a9b2530ad5b930349013013039ac3f53656875e4b01d15b45a825bc6242d3066`. Lip-sync input `voice/en-wav/insurance_2.wav` (`b39031d128c044238d9334784cd9af21987fd406ddbbd15780555865f7434a88`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–95; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 3.43 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.3 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/insurance_2.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'insurance'}` resolves to family `dragge/speak.insurance/insurance` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/insurance/variant/insurance_3.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.insurance`, line `insurance` (family `dragge/speak.insurance/insurance`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `insurance_3`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('insurance')`, insurance is offered.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `4ad29957-f72c-4ee6-8f7d-1616b5ca6256`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/insurance/variant/insurance_3.mp4`, `4ad29957f72c4ee68f7d1616b5ca62569a26b53b3c16ab55da75ebf4d2c19aa6`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 78 frames (3.250 s; sound 3.200 s), 618500 bytes.
- Exakt text och språk (tal): English: "Ace up, so insurance is on offer. Entirely your call."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `insurance_3.mp4` (`9e9049ce8372b05e38e783561865e3eb952675e9d5cad4665618c95101177a85`), copied packet for packet (identical packets: yes); payload `2ad18d3d3db9cc9c2fe549c7d6513688ec1922c932161aa2d4ed43760ffea1ed`. Lip-sync input `voice/en-wav/insurance_3.wav` (`c2852d5f03e5188fc7227134c42424006658b92c1328b3dc0c565ddf944c5162`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–77; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.23 s to 2.61 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.3 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/insurance_3.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'insurance'}` resolves to family `dragge/speak.insurance/insurance` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/double/double.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.double`, line `double` (family `dragge/speak.double/double`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Standard of the family; `double_1`. Selected whenever the game speaks the line. Trigger: `say('double')`, the player doubles.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `b79a214e-9cff-14b2-47da-68417508d886`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/double/double.mp4`, `b79a214e9cff14b247da68417508d88629b1cda7762342ea1fe66d8ba03d5bf6`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 74 frames (3.083 s; sound 3.029 s), 610915 bytes.
- Exakt text och språk (tal): English: "Doubling down. One card, and one card only."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `double_1.mp4` (`d4501fe9521f30a06f96556977404ff56b361e1afa2d96a9eedcbfaf91c07012`), copied packet for packet (identical packets: yes); payload `c53ea06a99a258791ae20243fe50198f2316faf797f51f32328e356c13ca9f60`. Lip-sync input `voice/en-wav/double_1.wav` (`41a870c83dd1c314bb9340dc22f250234d265ba3ad0bd546750ab322849b74f2`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–73; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.37 s to 2.30 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.28 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/double_1.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'double'}` resolves to family `dragge/speak.double/double` in the repository registry with this film's video ID as its standard; `test/presentation-select-dealers.mjs`: `/api/presentation/select` serves this film for Dragge's line; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/double/variant/double_2.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.double`, line `double` (family `dragge/speak.double/double`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `double_2`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('double')`, the player doubles.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `f80c85c1-dcab-8975-82d7-714d8266c8dc`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/double/variant/double_2.mp4`, `f80c85c1dcab897582d7714d8266c8dc809b1f137a111637b707531059c36e33`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 70 frames (2.917 s; sound 2.859 s), 602417 bytes.
- Exakt text och språk (tal): English: "Double it is. Here's your one card."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `double_2.mp4` (`094838006a7b6102c75249754b8bc1feae88634de50465a6b0a7459cf31f0fde`), copied packet for packet (identical packets: yes); payload `7d3cca076e24bba08b2f1527a80473843ac471373a586083529fe723b117ad3c`. Lip-sync input `voice/en-wav/double_2.wav` (`dc323c768d59bce8680d53633224a8cf6364bb9e5d8ea872f2f23ee764160883`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–69; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 2.24 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.28 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/double_2.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'double'}` resolves to family `dragge/speak.double/double` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/double/variant/double_3.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.double`, line `double` (family `dragge/speak.double/double`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `double_3`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('double')`, the player doubles.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `09ba0aa9-452c-ea5d-10e6-0d02cb3cde23`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/double/variant/double_3.mp4`, `09ba0aa9452cea5d10e60d02cb3cde2366d9dd9971c53441be6dc12628722aa5`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 61 frames (2.542 s; sound 2.475 s), 584093 bytes.
- Exakt text och språk (tal): English: "Doubled. One card to settle it."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `double_3.mp4` (`2a632a7f3a51fb6a1a8f1534a020f64198baa08f9822ef6cae8828ee41015968`), copied packet for packet (identical packets: yes); payload `c3f205dbfcad6d870b0fe26643eb39fe582dacd96ef1a9bb80e08b3ee9424538`. Lip-sync input `voice/en-wav/double_3.wav` (`7db00ac7a44971aafd27a87d314f217ad0e2a52e78f13bc15fbde64a0556a0bc`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–60; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 1.86 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.22 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/double_3.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'double'}` resolves to family `dragge/speak.double/double` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/bust/bust.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `bust` (family `dragge/speak.other/bust`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Standard of the family; `bust_1`. Selected whenever the game speaks the line. Trigger: `say('bust')`, the player's hand goes over 21.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `a68bfddc-4193-d832-e365-d9da59b9b3cb`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/bust/bust.mp4`, `a68bfddc4193d832e365d9da59b9b3cb4a137d87830d13251d6829e93874c404`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 87 frames (3.625 s; sound 3.584 s), 631820 bytes.
- Exakt text och språk (tal): English: "Over twenty-one, I'm afraid. That hand is done."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `bust_1.mp4` (`e8222b168c793d74f0c2a5a01e2cc88ae8077645ba2c9707792ab6f0c3db5e31`), copied packet for packet (identical packets: yes); payload `45ad16d900f7d5646804e5faaba6213c991a43b8dc02e4cbcc117ff281d15c9e`. Lip-sync input `voice/en-wav/bust_1.wav` (`e755b779fc45af8401d45b127caf1035a2b30e6e54f043c4c7e75569b035060b`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–86; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.38 s to 2.84 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.3 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/bust_1.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'bust'}` resolves to family `dragge/speak.other/bust` in the repository registry with this film's video ID as its standard; `test/presentation-select-dealers.mjs`: `/api/presentation/select` serves this film for Dragge's line; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/bust/variant/bust_2.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `bust` (family `dragge/speak.other/bust`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `bust_2`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('bust')`, the player's hand goes over 21.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `6ec17b7d-e6b5-0775-2e95-4a3cf969489c`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/bust/variant/bust_2.mp4`, `6ec17b7de6b507752e954a3cf969489c05005c968c2e380c90c2fbedea3c3db6`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 57 frames (2.375 s; sound 2.304 s), 577806 bytes.
- Exakt text och språk (tal): English: "That's a bust. Unlucky card."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `bust_2.mp4` (`6e74a021094e20c7f314a53c31fd7c3fc428b5e3c5e3383ec011f0e6b796709f`), copied packet for packet (identical packets: yes); payload `10a32a7d8ba5fcdc07641ade371eeb3e57a3e4031ef192400bd6d5500ef708ba`. Lip-sync input `voice/en-wav/bust_2.wav` (`a58084dabe9f32626224340e9caa6def1c97a764e29eb45da634c2cd925d701a`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–56; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 1.62 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.22 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/bust_2.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'bust'}` resolves to family `dragge/speak.other/bust` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/bust/variant/bust_3.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `bust` (family `dragge/speak.other/bust`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `bust_3`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('bust')`, the player's hand goes over 21.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `abb94aad-31af-b827-efff-b3c3260cb84e`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/bust/variant/bust_3.mp4`, `abb94aad31afb827efffb3c3260cb84e518db62eea30ca4f001b52285ac0ce44`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 84 frames (3.500 s; sound 3.456 s), 630525 bytes.
- Exakt text och språk (tal): English: "Too many, I'm sorry. That one goes to the house."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `bust_3.mp4` (`c84b33da8daf690c23f1407b86cddb07bfc7e505d87fe3ee1f59a5efbe120051`), copied packet for packet (identical packets: yes); payload `4652ee124dd03a7fac2f59d939b34083e680fabcc3123f979f356ea988f00af1`. Lip-sync input `voice/en-wav/bust_3.wav` (`e3d8937faf4c290539f6367c58fb10954084e3079c214c0dd0841b2d14feabdd`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–83; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.29 s to 2.77 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.29 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/bust_3.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'bust'}` resolves to family `dragge/speak.other/bust` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/blackjack/blackjack.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `blackjack` (family `dragge/speak.other/blackjack`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Standard of the family; `blackjack_1`. Selected whenever the game speaks the line. Trigger: `say('blackjack')`, the player has blackjack.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `f4e6af39-bc14-62a4-bd75-669262080186`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/blackjack/blackjack.mp4`, `f4e6af39bc1462a4bd756692620801861d5e702b56d025b5d0c1a5644b9f08bf`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 85 frames (3.542 s; sound 3.499 s), 632800 bytes.
- Exakt text och språk (tal): English: "Blackjack! Beautifully done. That pays three to two."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `blackjack_1.mp4` (`0947cb9aa95031d69d0cdd2703a6bcbd3ab2e65a751b1d086d024caa97149f9e`), copied packet for packet (identical packets: yes); payload `0b0451f5f6c3fc035a3d3560708e9febf969e56dd791e2b9a1aea049e4f63bad`. Lip-sync input `voice/en-wav/blackjack_1.wav` (`0dc46604fa177b890a870adaa035e2a36b5cd31c8935fd86935e3d93b36c2df6`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–84; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 2.88 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.28 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/blackjack_1.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'blackjack'}` resolves to family `dragge/speak.other/blackjack` in the repository registry with this film's video ID as its standard; `test/presentation-select-dealers.mjs`: `/api/presentation/select` serves this film for Dragge's line; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/blackjack/variant/blackjack_2.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `blackjack` (family `dragge/speak.other/blackjack`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `blackjack_2`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('blackjack')`, the player has blackjack.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `293a5e23-e249-d4a6-7b0d-5bcebad09ada`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/blackjack/variant/blackjack_2.mp4`, `293a5e23e249d4a67b0d5bcebad09ada55d797faaf5a8678ed2b1633d7954f39`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 92 frames (3.833 s; sound 3.755 s), 641583 bytes.
- Exakt text och språk (tal): English: "Blackjack, straight off the deal. Paid three to two."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `blackjack_2.mp4` (`859922faca2b025ca5931a5c33125dd3845ae2c77e20f39947e4cc4716c18cb5`), copied packet for packet (identical packets: yes); payload `89c50d7056d98b08bd1f5f7190244e20b5a63146d532a353210d521f829383c7`. Lip-sync input `voice/en-wav/blackjack_2.wav` (`f14862b20579e4aa3021f3890d9cd1b45a246ea08eccd5791fe3551301bafa8a`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–91; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.30 s to 3.29 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.3 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/blackjack_2.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'blackjack'}` resolves to family `dragge/speak.other/blackjack` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/blackjack/variant/blackjack_3.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `blackjack` (family `dragge/speak.other/blackjack`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `blackjack_3`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('blackjack')`, the player has blackjack.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `69c9c591-4598-63c3-d6f3-8e22510c3e7a`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/blackjack/variant/blackjack_3.mp4`, `69c9c591459863c3d6f38e22510c3e7abbac92206f791d1f451c88c6eaa24fa8`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 89 frames (3.708 s; sound 3.627 s), 636728 bytes.
- Exakt text och språk (tal): English: "Now that's how you open a hand. Blackjack, three to two."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `blackjack_3.mp4` (`7472ec2a700f17bb40feac503faaae82470fd4175b45457c9a3b381fe2d5d967`), copied packet for packet (identical packets: yes); payload `3e1f3cf5b7336d2988832968def95226e8d398f39d175ca6681b6f0cc9be7732`. Lip-sync input `voice/en-wav/blackjack_3.wav` (`2e15ccc51ce762d91b7ba9e4fb2d359e14a6a8df86b5e4ae0a9b996e4a932480`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–88; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 3.06 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.28 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/blackjack_3.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'blackjack'}` resolves to family `dragge/speak.other/blackjack` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/dealerblackjack/dealerblackjack.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `dealerblackjack` (family `dragge/speak.other/dealerblackjack`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Standard of the family; `dealerblackjack_1`. Selected whenever the game speaks the line. Trigger: `say('dealerblackjack')`, the dealer has blackjack.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `586d72eb-d507-00a8-e1df-0b84000ba71e`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/dealerblackjack/dealerblackjack.mp4`, `586d72ebd50700a8e1df0b84000ba71eed2ea754b1d242f57d21c1d631d8db87`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 73 frames (3.042 s; sound 2.987 s), 608720 bytes.
- Exakt text och språk (tal): English: "Dealer has blackjack. I'm sorry, everyone."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `dealerblackjack_1.mp4` (`807ff17ec0251cb44c15fd6c35bd6dcf1dbd2fba36284f151de1944c3c7abcd2`), copied packet for packet (identical packets: yes); payload `0c4cffb518b3f835c6645121d52fd43dbbc394cb61112da57b9eb6e0989ccf8b`. Lip-sync input `voice/en-wav/dealerblackjack_1.wav` (`975eb8e101a11fee94dafe435355a6065c897e28acd27dbc2894185bc578660a`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–72; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.37 s to 2.28 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.36 dB, last frame 47.25 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/dealerblackjack_1.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'dealerblackjack'}` resolves to family `dragge/speak.other/dealerblackjack` in the repository registry with this film's video ID as its standard; `test/presentation-select-dealers.mjs`: `/api/presentation/select` serves this film for Dragge's line; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/dealerblackjack/variant/dealerblackjack_2.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `dealerblackjack` (family `dragge/speak.other/dealerblackjack`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `dealerblackjack_2`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('dealerblackjack')`, the dealer has blackjack.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `b684a0e6-7c7e-d3da-8546-bb381dbc200e`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/dealerblackjack/variant/dealerblackjack_2.mp4`, `b684a0e67c7ed3da8546bb381dbc200ef4feee3609290ac1678ad9ddef89bc26`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 85 frames (3.542 s; sound 3.499 s), 632419 bytes.
- Exakt text och språk (tal): English: "Blackjack for the house this time. It happens to the best of us."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `dealerblackjack_2.mp4` (`d8d7b2be7237e55128b8c14a812f984ea049c4bf1d9ac568a20b90e993111f18`), copied packet for packet (identical packets: yes); payload `0ae506a1821408cffe7584a2b84efa96e477a73510f04d16b9ebc0c4dbab9678`. Lip-sync input `voice/en-wav/dealerblackjack_2.wav` (`34d2b668d2a8aa328855daf1f39558c822a1097e7fd35a358b1fdefdcca10a14`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–84; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 2.84 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.27 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/dealerblackjack_2.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'dealerblackjack'}` resolves to family `dragge/speak.other/dealerblackjack` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/dealerblackjack/variant/dealerblackjack_3.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `dealerblackjack` (family `dragge/speak.other/dealerblackjack`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `dealerblackjack_3`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('dealerblackjack')`, the dealer has blackjack.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `a3c59bcc-ed1c-9356-72a3-5c7a44feaef5`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/dealerblackjack/variant/dealerblackjack_3.mp4`, `a3c59bcced1c935672a35c7a44feaef5cf66633b20fa8641df0b9b180a2957f7`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 106 frames (4.417 s; sound 4.352 s), 666720 bytes.
- Exakt text och språk (tal): English: "I'm afraid it's blackjack for me. That round goes to the house."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `dealerblackjack_3.mp4` (`aa846766bc089d4e794939486f282666298c84ede3da7981da5d24fd42d6cad3`), copied packet for packet (identical packets: yes); payload `7f3e4da7ef7059e78f4b4cfa653282379abc56a00452e46481060c365d6e1aa2`. Lip-sync input `voice/en-wav/dealerblackjack_3.wav` (`518882b9929fc47fc857be3672b656e2d7256ee6e1ac99e7045d533bc14f04dc`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–105; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 3.87 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.31 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/dealerblackjack_3.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'dealerblackjack'}` resolves to family `dragge/speak.other/dealerblackjack` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/dealerbust/dealerbust.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `dealerbust` (family `dragge/speak.other/dealerbust`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Standard of the family; `dealerbust_1`. Selected whenever the game speaks the line. Trigger: `say('dealerbust')`, the dealer goes over 21.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `e958a8c9-4f61-6753-c567-9da98dd78fab`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/dealerbust/dealerbust.mp4`, `e958a8c94f616753c5679da98dd78fab646896112731cf34f994f0558336fec9`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 85 frames (3.542 s; sound 3.499 s), 632753 bytes.
- Exakt text och språk (tal): English: "Dealer busts! Everyone still in the hand gets paid."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `dealerbust_1.mp4` (`d8b6ab4f4006ddced8475425332c3e3288fc6cf9d1aee5c29b160f40ff5a6a48`), copied packet for packet (identical packets: yes); payload `1f14d15c68ea3fe8446a4783fec450bd90aaa4200ab0c1db040368cbfadd6307`. Lip-sync input `voice/en-wav/dealerbust_1.wav` (`34aa2a9f2290f615923635773bba04858651cdb3c46f3cd2a693eab36ad7423c`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–84; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 2.81 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.27 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/dealerbust_1.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'dealerbust'}` resolves to family `dragge/speak.other/dealerbust` in the repository registry with this film's video ID as its standard; `test/presentation-select-dealers.mjs`: `/api/presentation/select` serves this film for Dragge's line; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/dealerbust/variant/dealerbust_2.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `dealerbust` (family `dragge/speak.other/dealerbust`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `dealerbust_2`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('dealerbust')`, the dealer goes over 21.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `8621d8a2-caf0-21bd-b092-6e3023782c57`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/dealerbust/variant/dealerbust_2.mp4`, `8621d8a2caf021bdb0926e3023782c5748c7bafc8744cddb419e7603e42d38bf`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 90 frames (3.750 s; sound 3.669 s), 639992 bytes.
- Exakt text och språk (tal): English: "Too many for me. The house busts. Congratulations, table."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `dealerbust_2.mp4` (`fc4d54c3a2cf6c2989ad053b172db8dd9c49cabc9eb5bff99bd12cd1573e70d8`), copied packet for packet (identical packets: yes); payload `fe5fa16365c8ccc4b33e316bf146650c30539c112af52c9e14e5675ef4ec4fa7`. Lip-sync input `voice/en-wav/dealerbust_2.wav` (`7f43c053e5f8c6c40df83e28a51e7685ccb1913f3c61d084f3cc580f215f0fb7`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–89; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.35 s to 2.98 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.32 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/dealerbust_2.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'dealerbust'}` resolves to family `dragge/speak.other/dealerbust` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/dealerbust/variant/dealerbust_3.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `dealerbust` (family `dragge/speak.other/dealerbust`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `dealerbust_3`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('dealerbust')`, the dealer goes over 21.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `6f9452ca-35a4-f066-94f6-da9dc2161cc1`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/dealerbust/variant/dealerbust_3.mp4`, `6f9452ca35a4f06694f6da9dc2161cc11c9657203e27e25a47fa12a7373ac426`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 88 frames (3.667 s; sound 3.627 s), 635369 bytes.
- Exakt text och språk (tal): English: "And that's over twenty-one for the dealer. Winners all round."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `dealerbust_3.mp4` (`50e9c39cbdc9b952d7cf72cda92573e77a6797294b98d53ced9fb7c462354f3a`), copied packet for packet (identical packets: yes); payload `5f030072a80df08ad036913fced9753367917ba144f2b4cd22336e039538c91c`. Lip-sync input `voice/en-wav/dealerbust_3.wav` (`2c89e5050403a2629d878a4457d35c373700349149122b9a7f1c4db0b6548b0a`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–87; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.38 s to 2.90 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.29 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/dealerbust_3.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'dealerbust'}` resolves to family `dragge/speak.other/dealerbust` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/win/win.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `win` (family `dragge/speak.other/win`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Standard of the family; `win_1`. Selected whenever the game speaks the line. Trigger: `say('win')`, the player wins.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `5092de81-8fa0-89e6-0c88-b42ae8a1545d`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/win/win.mp4`, `5092de818fa089e60c88b42ae8a1545d901be864d39bf2c2dec70c8736028c0b`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 68 frames (2.833 s; sound 2.773 s), 600511 bytes.
- Exakt text och språk (tal): English: "Well played. That hand is yours."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `win_1.mp4` (`206724f5e69f2178f9544d8eac15114458349b4d79722d66e82ea0375a3c06f7`), copied packet for packet (identical packets: yes); payload `561c03df5c5015a867b00405adf251fc3f9d2ab6d84065a53a541515ec88e5bb`. Lip-sync input `voice/en-wav/win_1.wav` (`a54641d3a6279857da56a834ba3fb13b255814ebbe2b1850d73f2e5e3e7c1278`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–67; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 2.08 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.24 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/win_1.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'win'}` resolves to family `dragge/speak.other/win` in the repository registry with this film's video ID as its standard; `test/presentation-select-dealers.mjs`: `/api/presentation/select` serves this film for Dragge's line; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/win/variant/win_2.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `win` (family `dragge/speak.other/win`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `win_2`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('win')`, the player wins.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `d6ebeea8-31bb-5643-cb85-1f6008a7d4ea`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/win/variant/win_2.mp4`, `d6ebeea831bb5643cb851f6008a7d4ea9bc3faf217d8beacdf936d06e23e9179`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 65 frames (2.708 s; sound 2.645 s), 593075 bytes.
- Exakt text och språk (tal): English: "You beat me on that one. Congratulations."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `win_2.mp4` (`7945ef43d74557accaffd46ae2095993e51ef1db386da1dda49f08b278e3851d`), copied packet for packet (identical packets: yes); payload `2c982b27738649856ae47f685a110b298f1edea8816318d837459c89efee020b`. Lip-sync input `voice/en-wav/win_2.wav` (`53c8910cda496c5f778ac2bfd1987bedd5c62d270eef27f658baccc7c95fe0e2`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–64; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.25 s to 2.16 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.23 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/win_2.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'win'}` resolves to family `dragge/speak.other/win` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/win/variant/win_3.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `win` (family `dragge/speak.other/win`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `win_3`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('win')`, the player wins.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `e96adbed-436b-6adf-dd57-0eb5a463c3a0`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/win/variant/win_3.mp4`, `e96adbed436b6adfdd570eb5a463c3a0bd70611f27a5f7c59e7d91e987c36d7c`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 62 frames (2.583 s; sound 2.517 s), 585127 bytes.
- Exakt text och språk (tal): English: "A winning hand. Paid in full."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `win_3.mp4` (`b833c6d46f144f7daa9aadbf1620234c6d76ee2124947eb2eb5cb379e2574d0a`), copied packet for packet (identical packets: yes); payload `6d6cbcede0ff700b9a5c3d1ff4ef5d3c928312aeb43d626bbe6752c76e538405`. Lip-sync input `voice/en-wav/win_3.wav` (`5f9c35ec49a842e29308baf8ecc3b8c2dfbbb2dfbc8b6ff2112a8ac0c64c0f0d`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–61; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.38 s to 1.82 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.27 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/win_3.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'win'}` resolves to family `dragge/speak.other/win` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/push/push.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `push` (family `dragge/speak.other/push`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Standard of the family; `push_1`. Selected whenever the game speaks the line. Trigger: `say('push')`, a push.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `5a221c73-00d9-9917-348a-649d255749be`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/push/push.mp4`, `5a221c7300d99917348a649d255749be82c197a2960927ad01a647a304a924d5`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 82 frames (3.417 s; sound 3.371 s), 624965 bytes.
- Exakt text och språk (tal): English: "Same total. It's a push, your stake stays with you."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `push_1.mp4` (`f5551a30459450bff80912ae4cdebc17c11687de69eed29589dee04a9ac882c5`), copied packet for packet (identical packets: yes); payload `e7423a9a05854f37a41259c41528b1b0dffcd2a8d3b9d48267bf360e04681462`. Lip-sync input `voice/en-wav/push_1.wav` (`9377124572e489e8e14f42efae69cdfeb55d1ad87e7d8e31c3f950ff1886c9c9`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–81; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 2.91 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.31 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/push_1.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'push'}` resolves to family `dragge/speak.other/push` in the repository registry with this film's video ID as its standard; `test/presentation-select-dealers.mjs`: `/api/presentation/select` serves this film for Dragge's line; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/push/variant/push_2.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `push` (family `dragge/speak.other/push`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `push_2`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('push')`, a push.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `6587023d-4704-2977-36b4-8eea9e24d1d1`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/push/variant/push_2.mp4`, `6587023d4704297736b48eea9e24d1d19f7855edc16424743cfb4b67991e3f25`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 93 frames (3.875 s; sound 3.797 s), 644462 bytes.
- Exakt text och språk (tal): English: "We're level. A push, nobody wins and nobody loses."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `push_2.mp4` (`fb6610a97a40bffb77f4fb13443fab16de1ffe16f03d726067af0a3d2290952c`), copied packet for packet (identical packets: yes); payload `611120f15559a701418ee5a484caa67e57ec9bd3c03ff934045cad511e8998af`. Lip-sync input `voice/en-wav/push_2.wav` (`bf2e29846b2dc4a5adc3fe4fb0568fb931b40e67ba508036563e5fdb35fc18ee`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–92; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 3.22 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.34 dB, last frame 47.28 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/push_2.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'push'}` resolves to family `dragge/speak.other/push` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/push/variant/push_3.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `push` (family `dragge/speak.other/push`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `push_3`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('push')`, a push.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `b5eb890f-b2f8-3e0f-ed54-81408f33812f`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/push/variant/push_3.mp4`, `b5eb890fb2f83e0fed5481408f33812fb693fba943a0b2dac0218699b13b46b7`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 59 frames (2.458 s; sound 2.389 s), 582297 bytes.
- Exakt text och språk (tal): English: "Push. Your bet comes back."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `push_3.mp4` (`fda5bf9b598e6a52e5635769d56dbe3ee3e2faf68a9e5b3184c1fd9cdaebde3e`), copied packet for packet (identical packets: yes); payload `39db1db43a3519b4b2a86665bf7ff0f3e251b55db94774d0f911bf60cfe97581`. Lip-sync input `voice/en-wav/push_3.wav` (`b5ec05c7e66dc7d210b6b3266c9337d381f1371bb4d0318f421d61d162353646`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–58; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.37 s to 1.59 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.25 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/push_3.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'push'}` resolves to family `dragge/speak.other/push` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/lose/lose.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `lose` (family `dragge/speak.other/lose`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Standard of the family; `lose_1`. Selected whenever the game speaks the line. Trigger: `say('lose')`, the player loses.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `1af6526f-e32c-7473-90b6-5672e1e61444`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/lose/lose.mp4`, `1af6526fe32c747390b65672e1e61444d782106da9fecc44328d8f023d7486c1`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 73 frames (3.042 s; sound 2.987 s), 610094 bytes.
- Exakt text och språk (tal): English: "Dealer wins. That one goes to the house."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `lose_1.mp4` (`43be073971cf47a580f7c1e4b006db17eb8be92e77904e6477fac5d3e83990f5`), copied packet for packet (identical packets: yes); payload `90aa83b9e01ad7cbc23ce8465010b5e5919ebdadfd25082433ca72bd7b0ef040`. Lip-sync input `voice/en-wav/lose_1.wav` (`3ea775a0974813b89c81b51527e3f19a89a47bb02f4642acc6d249330501d258`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–72; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 2.29 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.25 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/lose_1.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'lose'}` resolves to family `dragge/speak.other/lose` in the repository registry with this film's video ID as its standard; `test/presentation-select-dealers.mjs`: `/api/presentation/select` serves this film for Dragge's line; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/lose/variant/lose_2.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `lose` (family `dragge/speak.other/lose`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `lose_2`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('lose')`, the player loses.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `fad31b50-6fda-1013-bbaf-03d4b5ba9443`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/lose/variant/lose_2.mp4`, `fad31b506fda1013bbaf03d4b5ba9443ac81567a6958182a33ace370e94cbf15`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 72 frames (3.000 s; sound 2.944 s), 606591 bytes.
- Exakt text och språk (tal): English: "Not this time, I'm afraid. The house holds."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `lose_2.mp4` (`78ba2bd9f9528219b913ddabdf3e7c31893632783e2df0d9773ade06e31ed922`), copied packet for packet (identical packets: yes); payload `bc5487393d7243fd33ce5d6000cd4b7550d783a6a057d0343e001a712c1282da`. Lip-sync input `voice/en-wav/lose_2.wav` (`96392f40b2e90a839106f00acd302fc9fd824dd02370a446575dc764553b3a65`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–71; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.38 s to 2.26 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.25 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/lose_2.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'lose'}` resolves to family `dragge/speak.other/lose` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/lose/variant/lose_3.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `lose` (family `dragge/speak.other/lose`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `lose_3`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: `say('lose')`, the player loses.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `44908ca1-a05a-98fd-b6bf-cd9d8cc435cc`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/lose/variant/lose_3.mp4`, `44908ca1a05a98fdb6bfcd9d8cc435ccbdf8cde73f81adabf95e828222bdff0a`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 70 frames (2.917 s; sound 2.859 s), 603411 bytes.
- Exakt text och språk (tal): English: "Close, but the house has it this round."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `lose_3.mp4` (`eba9ce581e42410d06c3a1d41a76dec665eb1e82789736a7e53b0c6c37ccbb13`), copied packet for packet (identical packets: yes); payload `717d310d46f0ca020b61215c87dcbf371dfecfad570b070eda89bc502dacf9a9`. Lip-sync input `voice/en-wav/lose_3.wav` (`87b8773cbedfeb0d03851f3e5cb31f5f5acb044204267a1907bfbdf1b7eaae4e`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–69; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.36 s to 2.18 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.36 dB, last frame 47.29 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/lose_3.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'lose'}` resolves to family `dragge/speak.other/lose` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/peek/peek.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `peek` (family `dragge/speak.other/peek`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Standard of the family; `peek_1`. Selected whenever the game speaks the line. Trigger: none; the game does not call `say('peek')` today.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `b092f155-a0d5-a497-a5ca-7212105063f1`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/peek/peek.mp4`, `b092f155a0d5a497a5ca7212105063f10a5d7d9c476a96948900935c2cceb9c6`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 62 frames (2.583 s; sound 2.517 s), 589846 bytes.
- Exakt text och språk (tal): English: "One moment while I check for blackjack."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `peek_1.mp4` (`9cd74736a427da0ca9549f28832f0136d3219d879116e10569bf84adc5d87428`), copied packet for packet (identical packets: yes); payload `4d62c08dfb40a2891deb5f120e8ca5c40e331676637ffa9af0be10654d4ec40a`. Lip-sync input `voice/en-wav/peek_1.wav` (`f14cd031c97cb63d25145f2337ca31b75571eac189900026ada648373ec7baa1`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–61; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 1.97 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.26 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/peek_1.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'peek'}` resolves to family `dragge/speak.other/peek` in the repository registry with this film's video ID as its standard; `test/presentation-select-dealers.mjs`: `/api/presentation/select` serves this film for Dragge's line; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/peek/variant/peek_2.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `peek` (family `dragge/speak.other/peek`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `peek_2`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: none; the game does not call `say('peek')` today.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `cf02a1d5-0e52-b863-8e04-ceaaa2155090`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/peek/variant/peek_2.mp4`, `cf02a1d50e52b8638e04ceaaa21550906541692c91d21222374af7416f9c761b`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 51 frames (2.125 s; sound 2.048 s), 570113 bytes.
- Exakt text och språk (tal): English: "Dealer checks for blackjack."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `peek_2.mp4` (`c8e36618eb0e8129ea09ad411b737c2974ab6a4aafadf009edfddbd4ddd67f41`), copied packet for packet (identical packets: yes); payload `e050dd3b40b73917c33dc53ed56f2bfb117fb855e8162aee3f0e4211832ed61e`. Lip-sync input `voice/en-wav/peek_2.wav` (`bf1f5cc42f34a7b4eb4f7f1b3e54e67da5eb2a4c8f78ac61a6e6cc304c0c404d`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–50; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.23 s to 1.54 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.27 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/peek_2.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'peek'}` resolves to family `dragge/speak.other/peek` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/peek/variant/peek_3.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `peek` (family `dragge/speak.other/peek`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `peek_3`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: none; the game does not call `say('peek')` today.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `faab69c3-a66a-b69a-04c7-a0fe4829dd20`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/peek/variant/peek_3.mp4`, `faab69c3a66ab69a04c7a0fe4829dd2056eabe3e08f8a6ed4b042064c38cdfcc`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 70 frames (2.917 s; sound 2.859 s), 604503 bytes.
- Exakt text och språk (tal): English: "Checking for blackjack. Nothing up my sleeve."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `peek_3.mp4` (`18ae85d7acade4c691ded8b40dc29cabdc2360d1a1e123da675f9510f2d37fb5`), copied packet for packet (identical packets: yes); payload `50f2d5892849e0ddccbdfdd5970deaa10cb5e155c8d1e72c812120b532413153`. Lip-sync input `voice/en-wav/peek_3.wav` (`0be29aa321b75d0ef62502102816fd103b26784fb117586c95007c583a71a14f`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–69; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.28 s to 2.26 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.29 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/peek_3.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'peek'}` resolves to family `dragge/speak.other/peek` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/farewell/farewell.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `farewell` (family `dragge/speak.other/farewell`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Standard of the family; `farewell_1`. Selected whenever the game speaks the line. Trigger: none; the game does not call `say('farewell')` today.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `b6b189d8-9ceb-9d5a-92a2-9a2111877cc3`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/farewell/farewell.mp4`, `b6b189d89ceb9d5a92a29a2111877cc3f5d56005d480c7612b114f6fd88bb926`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 88 frames (3.667 s; sound 3.627 s), 635243 bytes.
- Exakt text och språk (tal): English: "Thank you for playing. It was a pleasure dealing for you."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `farewell_1.mp4` (`e3e18b37dc0b6f836e21b84848299421ccb387367a33d6f1c0990a06de888cde`), copied packet for packet (identical packets: yes); payload `681c730b880df75245e383a5ee821a04e9506b683d5be322afc1439d4442709d`. Lip-sync input `voice/en-wav/farewell_1.wav` (`d9ea30e551417ece066b73f637550cbe51e6307b7d6284eb5ea2e8e0d0cff6f0`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–87; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.35 s to 2.92 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.34 dB, last frame 47.3 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/farewell_1.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'farewell'}` resolves to family `dragge/speak.other/farewell` in the repository registry with this film's video ID as its standard; `test/presentation-select-dealers.mjs`: `/api/presentation/select` serves this film for Dragge's line; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/farewell/variant/farewell_2.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `farewell` (family `dragge/speak.other/farewell`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `farewell_2`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: none; the game does not call `say('farewell')` today.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `186a8485-73fa-1408-e3ee-18d25c20dcc5`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/farewell/variant/farewell_2.mp4`, `186a848573fa1408e3ee18d25c20dcc5a06641b9a95f3e7256e7fbca9ad22805`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 113 frames (4.708 s; sound 4.651 s), 672729 bytes.
- Exakt text och språk (tal): English: "All done for tonight? Thank you, it was lovely having you at the table."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `farewell_2.mp4` (`edf33c03c2c0ca24f0443c8572a436bd2a7b06aa54fd39dd48bc4ad4413ad0ef`), copied packet for packet (identical packets: yes); payload `7da6d03f2b7a5f894db967a90dc2e88b6dbe5d82af51f8d798a232a3408679c9`. Lip-sync input `voice/en-wav/farewell_2.wav` (`fbd8e36ed17b255d216ef5612536308e767365b8524fbe65beafcf8925abb5d7`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–112; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.24 s to 4.10 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.29 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/farewell_2.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'farewell'}` resolves to family `dragge/speak.other/farewell` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/farewell/variant/farewell_3.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `farewell` (family `dragge/speak.other/farewell`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `farewell_3`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: none; the game does not call `say('farewell')` today.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `76f475b2-f32a-0918-f609-abf17c05990e`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/farewell/variant/farewell_3.mp4`, `76f475b2f32a0918f609abf17c05990eb768581a1e1f361d45a076dfd17a959f`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 90 frames (3.750 s; sound 3.669 s), 637089 bytes.
- Exakt text och språk (tal): English: "Good night, and thank you for the company at my table."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `farewell_3.mp4` (`ca6390a92c72b5b0161da9d2fdeace988ceef8e71c7f4bbb2febd616eadbc0ec`), copied packet for packet (identical packets: yes); payload `ed39af4ba6abb4e5f467f38e2612cd1569d6d30829a45adc178b79be58cfa0ab`. Lip-sync input `voice/en-wav/farewell_3.wav` (`df5fe1a0fc9a35383252a67a4a492154a58f1f1bcbc23cf8c2dc42cfd42e1cca`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–89; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.25 s to 3.17 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.33 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/farewell_3.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'farewell'}` resolves to family `dragge/speak.other/farewell` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The rehearsal panel plays the standard; this variant needs a Studio media policy entry to be heard in the player.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/chatter1/chatter1.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `chatter1` (family `dragge/speak.other/chatter1`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Standard of the family; `chatter1_1`. Selected whenever the game speaks the line. Trigger: none; the game does not call `say('chatter1')` today.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `22fd631a-63ac-f2cf-1b69-3552f65528f8`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/chatter1/chatter1.mp4`, `22fd631a63acf2cf1b693552f65528f81b545fbcf5e4e2e4a59e1622335a4676`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 77 frames (3.208 s; sound 3.157 s), 617268 bytes.
- Exakt text och språk (tal): English: "Quiet night at the table. Those are my favourite."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `chatter1_1.mp4` (`c13df6e611251148791fbb29720cc59d3d799a19912201a32e9a7066106b388f`), copied packet for packet (identical packets: yes); payload `61a6f7616c4b67f40f6c7fb73cad2ea214d01554909830ada0ff329bda0d0b12`. Lip-sync input `voice/en-wav/chatter1_1.wav` (`dfb7fd97fe2680682fbc5d7853be9acb8509c918f9883c3b06d9be9a514ec4ac`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–76; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.29 s to 2.37 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.25 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/chatter1_1.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'chatter1'}` resolves to family `dragge/speak.other/chatter1` in the repository registry with this film's video ID as its standard; `test/presentation-select-dealers.mjs`: `/api/presentation/select` refuses the line, because it accepts letter-only line ids (the same for every dealer); Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The game does not call this line today, and select refuses its id, so the player cannot play it yet.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/chatter1/variant/chatter1_2.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `chatter1` (family `dragge/speak.other/chatter1`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `chatter1_2`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: none; the game does not call `say('chatter1')` today.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `cdfac9a9-5066-9a49-47a2-246d00daba95`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/chatter1/variant/chatter1_2.mp4`, `cdfac9a950669a4947a2246d00daba95a69881e558f4599011c44b7b101de19f`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 118 frames (4.917 s; sound 4.864 s), 687522 bytes.
- Exakt text och språk (tal): English: "Eight decks, shuffled fresh every round. Every hand starts from nothing."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `chatter1_2.mp4` (`a54f6746d3e03328711e624a9bdc3d4263abca981b0e59aea910f9ae2bd1f342`), copied packet for packet (identical packets: yes); payload `0fa821677fc18d3c355e8daf079ad7864de4c2f0a8ae70e72d07da985cda6a7b`. Lip-sync input `voice/en-wav/chatter1_2.wav` (`1250f3db6192f7f0c1723c70e82cc53ebec2349b258794e0384cc2a0b8f865ea`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–117; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.22 s to 4.15 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.32 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/chatter1_2.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'chatter1'}` resolves to family `dragge/speak.other/chatter1` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The game does not call this line today, and select refuses its id, so the player cannot play it yet.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/chatter1/variant/chatter1_3.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `chatter1` (family `dragge/speak.other/chatter1`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `chatter1_3`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: none; the game does not call `say('chatter1')` today.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `cceadccc-b82a-0741-1c20-03d9fadaf33a`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/chatter1/variant/chatter1_3.mp4`, `cceadcccb82a07411c2003d9fadaf33ab201edcb449d95fccbba7158fc2943c1`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 121 frames (5.042 s; sound 4.992 s), 690618 bytes.
- Exakt text och språk (tal): English: "I've dealt a lot of hands at this table. No two ever play out the same."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `chatter1_3.mp4` (`dcac43967dc2902e9eb592bffc30f2efff67889565ae9fcab6498838810abba3`), copied packet for packet (identical packets: yes); payload `3f6173eb53db18389a1cf94bcd567b264c67da66452b3c3ab99f5654275d0591`. Lip-sync input `voice/en-wav/chatter1_3.wav` (`53b1834d1c032a41e2f1cdea60a3180e5cb60e710f2ffb7e3425e6b7c64aa295`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–120; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.23 s to 4.26 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.29 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/chatter1_3.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'chatter1'}` resolves to family `dragge/speak.other/chatter1` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The game does not call this line today, and select refuses its id, so the player cannot play it yet.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/chatter2/chatter2.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `chatter2` (family `dragge/speak.other/chatter2`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Standard of the family; `chatter2_1`. Selected whenever the game speaks the line. Trigger: none; the game does not call `say('chatter2')` today.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `00afcfeb-f18d-d349-815b-cd3d97129bc6`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/chatter2/chatter2.mp4`, `00afcfebf18dd349815bcd3d97129bc6ee25d8920e796ecf5ed25771346d0717`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 77 frames (3.208 s; sound 3.157 s), 613928 bytes.
- Exakt text och språk (tal): English: "Take your time. The cards aren't going anywhere."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `chatter2_1.mp4` (`5c7cd4548816558bcced8f9ac3e2ccce9ff7ed8b7bba72a8ae6ceead8d4cfa55`), copied packet for packet (identical packets: yes); payload `7bbf6391012f99f44c3ba39e61ec097f57c71d44663b2c1e0df29902c4fb2dba`. Lip-sync input `voice/en-wav/chatter2_1.wav` (`bdca067167a9d95f096b16cb9398cf8e1ebefcb5cae9429f831ed93794b8b3ff`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–76; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.38 s to 2.45 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.25 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/chatter2_1.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'chatter2'}` resolves to family `dragge/speak.other/chatter2` in the repository registry with this film's video ID as its standard; `test/presentation-select-dealers.mjs`: `/api/presentation/select` refuses the line, because it accepts letter-only line ids (the same for every dealer); Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The game does not call this line today, and select refuses its id, so the player cannot play it yet.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/chatter2/variant/chatter2_2.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `chatter2` (family `dragge/speak.other/chatter2`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `chatter2_2`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: none; the game does not call `say('chatter2')` today.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `95fbde9e-9223-6849-213a-cef0d9b99804`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/chatter2/variant/chatter2_2.mp4`, `95fbde9e92236849213acef0d9b99804ac8b325401f03dd08c4045ca78ffe165`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 63 frames (2.625 s; sound 2.560 s), 587880 bytes.
- Exakt text och språk (tal): English: "No rush at all. Think it over."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `chatter2_2.mp4` (`1d33ede80cb6c9ed42179f071ca9f6037de8d1abe63386c6414bdf7888d1402d`), copied packet for packet (identical packets: yes); payload `d2312e554b07d07d3077bfb53945b38bc541826e0f1d7b650a3f781c0d277770`. Lip-sync input `voice/en-wav/chatter2_2.wav` (`9c5666d69ad52dd3c36ca77006003f5b773065b6770d1d70d03d6229f8dfb17c`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–62; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.38 s to 2.08 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.25 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/chatter2_2.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'chatter2'}` resolves to family `dragge/speak.other/chatter2` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The game does not call this line today, and select refuses its id, so the player cannot play it yet.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.

## `repliker/chatter2/variant/chatter2_3.mp4`

- Dealer och avsedd identitet: `dragge` (Dragge), the KLARA VILA rest pose (`rest.png` of the deal bank).
- Eventgrupp och exakt situation/replik-ID: `speak.other`, line `chatter2` (family `dragge/speak.other/chatter2`).
- Variant-ID, standard/alternativ, urvalstillåtelser och trigger-ID:n: Folder variant `chatter2_3`. Never chosen automatically; only an explicit, reviewed Studio media policy entry may select it. Trigger: none; the game does not call `say('chatter2')` today.
- Video-ID, revisionsnamn, relativ materialreferens, SHA-256: `a9c2058a-e61f-d583-b30f-2dfb596aa4bf`, speech-en-bake 2026-10-08, `media/dealers/dragge/runtime/presentation/repliker/chatter2/variant/chatter2_3.mp4`, `a9c2058ae61fd583b30f2dfb596aa4bf1e0150a7c0a1f4ac7c6b46151cf7f486`.
- Filformat, codec, fps, dimensioner, duration: MP4, H.264 crf 12 yuv420p BT.709 + AAC-LC mono 24000 Hz, 24 fps, 1080×1920, 74 frames (3.083 s; sound 3.029 s), 610466 bytes.
- Exakt text och språk (tal): English: "Whenever you're ready. The decision is yours."
- Ljudreferens och SHA-256 (tal): the AAC stream of take `chatter2_3.mp4` (`c20255bb2a7598980c23f7564098cb3aa02621ee780873161c2e997100bb1949`), copied packet for packet (identical packets: yes); payload `2c4040b545a121313d790342c91c709de31f15177199a2f6be416fa21d8217f5`. Lip-sync input `voice/en-wav/chatter2_3.wav` (`eaf39f0c0eba38a73d7ad46b34cfaf2461ae8e81a7ef30d822feb9bb661da3e0`).
- Frame-index, audio delay och kalibreringsreferens: frames 0–73; sound and picture start together at 0.000 s in the same file, audio delay 0 ms; voice from 0.38 s to 2.33 s (above -40 dBFS, information only). No card calibration (no card in a speech film).
- Mask/kontakt/landning/övergångar (om relevant): green key of `../klara-bake/build.py` over `darkhall.png`; no contact or landing. Starts and ends on the rest still: frame 0 47.35 dB, last frame 47.28 dB PSNR against `rest.png`; green fringe pixels 0.
- Producent, datum, källmaterial och överlämningsplats: Kevin, 2026-10-08. Voice: ElevenLabs, Dragge's cloned voice. Lip sync: MuseTalk on RunPod Serverless, avatar `dragan_vila2x`. Take handed over in `croupier-dragge-live/public/media/dealers/dragge/repliker/en/chatter2_3.mp4` (outside the repository, not tracked); baked by `build.py` here.
- Matchande eventprov och icke-matchande kontrollfall: automated, `lab/test/presentation-banks.test.mjs`: Dragge's `{type:'speak', line:'chatter2'}` resolves to family `dragge/speak.other/chatter2` in the repository registry with this film's video ID among its variants; Paow's same request finds no family.
- Uppspelningskvitton, två plays i följd och avbrottsprov: **saknas**. Needs `/blackjack?lane=mobile-phone-dragge&rehearsal=1`, "Play twice", and an interrupted play, in a browser. The game does not call this line today, and select refuses its id, so the player cannot play it yet.
- Visuell granskare, datum, exakt granskade bytes och resultat per punkt: **saknas**, pending a human reviewer (lip sync, mouth closed at the end, seams to the rest still).
- Kvarvarande luckor, status (ogranskad / review / avvisad / accepterad): ogranskad. Open: visual lip-sync approval, browser rehearsal, Blob publish.
- Kevin: eventuell produktbindning och aktiveringsrevision: none. Not published to Blob and not active in BO or live.
