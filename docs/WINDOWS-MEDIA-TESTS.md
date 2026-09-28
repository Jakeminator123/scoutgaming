# Windows media/player test repair — 2026-09-20

Verified on Windows with Node v22.22.2 in `jakeminator123/work`.
This change repairs test execution and text fingerprint portability. No player,
game rules, RNG, payouts, calibrated media, secrets or Render configuration changed.

## Reproduction and fixes

The initial run reproduced all 11 reported Node test failures: 99/110 passed.

- Five failures came from two script paths in `test/build-index.mjs` and
  `test/dealer-sync-audit.mjs`: `/C:/...` became `C:\C:\...` in the child process.
  Both now use `fileURLToPath`.
- One packing test lacked `ffmpeg`; four media tests lacked `ffprobe`.
  Those four tests also contained five latent `.pathname` process arguments
  (including one FFmpeg call). All now use `fileURLToPath`. In total, seven
  filesystem arguments in six test files were corrected.
- The report-payload test selected Windows' WSL `bash.exe`. It now locates
  the installed Git for Windows Bash through `git --exec-path`. The extracted
  shell source is converted from CRLF to LF in memory, and the temporary
  directory uses forward slashes for MSYS. Linux/macOS still use `bash`.
  The same real shell/jq payload code and assertions run; missing prerequisites
  still fail the test. `tools/bugshot.sh` itself is unchanged.
- Astrid's `dealing-cues.json` has 31 CRLF sequences in this checkout.
  The audit now removes only CR immediately before LF when fingerprinting cue
  text. Every other byte remains significant. Audio, video and matte hashes
  still use exact bytes; there is no general JSON or whitespace canonicalization.

Three added regression tests verify CRLF/LF equivalence without audit writes,
canonical identities when recording disposable fixtures, rejection of cue
value/indentation/lone-CR/removal changes, and byte-exact media hashing.
Fixture baselines exist only in temporary directories.

Astrid cue SHA-256 evidence:

| Input | SHA-256 |
| --- | --- |
| Unchanged local CRLF file | `c56a7c4edbc17120b52255f04541ef3a17359384b3ba1e4e92bce2feabd9f190` |
| LF-normalized bytes, Git blob and existing baseline | `5c4b12d48635673869b7542ca61bd6db596ef4d25e40411577c641565448b23a` |

Neither the original cue file nor `docs/dealer-sync-baseline.json` was rewritten.
No baseline was regenerated for the real repository.

## Local test tools

No FFmpeg/ffprobe/jq command was available on PATH or in the inspected standard
tool directories. Existing Git Bash 5.3.9 and Git's GnuPG were reused.

Installed under `%LOCALAPPDATA%\Programs\CroupierTestTools`:

| Tool | Directory | Verification |
| --- | --- | --- |
| FFmpeg and ffprobe 9.0.1 | `ffmpeg-9.0.1-essentials_build\bin` | Archive SHA-256 matched publisher checksum |
| jq 1.8.2, Windows AMD64 | `jq-1.8.2` | SHA-256 and detached PGP signature passed |

FFmpeg's [official download page](https://ffmpeg.org/download.html) links to
[Gyan's Windows builds](https://www.gyan.dev/ffmpeg/builds/).
The downloaded `ffmpeg-9.0.1-essentials_build.zip` matched
[its checksum](https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-9.0.1-essentials_build.zip.sha256):
`fec81ae03971d9dd4be3ebe02e263bd2ec1d789483f931bdba5f5715e65da2e9`.
The binaries report Authenticode `NotSigned`; no Authenticode verification is claimed.

jq came from the [official download links](https://jqlang.org/download/).
`jq-windows-amd64.exe` matched the
[published checksum](https://raw.githubusercontent.com/jqlang/jq/master/sig/v1.8.2/sha256sum.txt):
`a6fc67fedaf9128a3309a1e2ebb8b986aeccf70122ee46d2cb4849e423f0c627`.
GnuPG reported `GOODSIG` and `VALIDSIG` for the detached signature with key
`93079A9511EFC0B7D6CDBFB5B0DA60FB454BAF18`, obtained from the official jq site.
Verification used an isolated temporary keyring, not the user's personal keyring.

Only the user's PATH was extended. No system-wide installation, Windows feature
activation or reboot was performed. Existing IDE processes may need a fresh
terminal/app restart to inherit that PATH. In the current PowerShell session:

```powershell
$testTools = Join-Path $env:LOCALAPPDATA 'Programs/CroupierTestTools'
$env:PATH = "$testTools/ffmpeg-9.0.1-essentials_build/bin;$testTools/jq-1.8.2;$env:PATH"
```

Signature evidence and full command logs remain ignored under
`.croupier-inbox/windows-tests/`; no executable or private log is committed.
On 2026-09-28, the downloaded FFmpeg archive, its unpacked copy, and the
downloaded jq executable were removed after their installed executables matched
by SHA-256. The installed tools and the verification evidence remain available.

## Final results

Every command below exited 0. Node test groups have zero failures, skips,
cancellations or TODO tests. All 12 hook commands were executed individually in
order so that an earlier failure could not conceal a later result.

| Exact command | Result |
| --- | --- |
| `node pipeline/audit-dealer-sync.mjs` | PASS: all four dealers match the existing baseline |
| `node pipeline/audit-performance.mjs` | PASS |
| `node pipeline/audit-astrid-actor.mjs` | PASS |
| `node --test test/build-index.mjs test/dealer-sync-audit.mjs test/speech-playback.mjs test/animation-clock.mjs test/dealing-cues.mjs test/movement-cues.mjs test/casino-navigation.mjs` | 29/29 |
| `node --test test/performance-contact.mjs test/pack-contact-media.mjs test/table-audio.mjs test/shoe-contact-occlusion.mjs` | 30/30 |
| `node --test test/dealer-rhythm.mjs test/dealer-smooth60.mjs test/dealer-reach.mjs test/scene-join.mjs test/ready-motion.mjs` | 18/18 |
| `node --test test/action-placement.mjs test/bugshot-report.mjs` | 4/4 |
| `node test/blackjack-asset-state.mjs` | PASS: shoe lifecycle/exported node contract; 79,214 unique triangles, 4,656,368 bytes |
| `node --test test/dealer-motion.mjs test/dealer-skin-contact.mjs` | 8/8 |
| `node --test test/rigged-card-layout.mjs test/rigged-layout-contact.mjs test/rigged-discard-state.mjs` | 9/9 |
| `node --test test/dealer-collection.mjs` | 2/2 |
| `node --test test/dealer-face.mjs test/rigged-face-playback.mjs test/rigged-face-bindings.mjs` | 13/13 |
| `node pipeline/audit-dealer-sync.mjs --probe` | PASS: 90 streams across Vera 39, Astrid 20, Amira 16, Mei 15 |
| `npm --prefix lab test` | 69/69 |
| `npm --prefix open-claw/lab test` | 62/62 |

Totals: 113/113 hook Node tests (the original 110 plus three new tests),
69/69 studio tests and 62/62 Director tests. `git diff --check` also passed.

## Remaining boundaries

No blocker remains for these requested test commands. Existing missing speech
takes remain explicit: Vera 8, Amira 2 and Mei 3. Passing the audit does not
approve lip sync or physical contact. No runtime/media change or new four-dealer
visual acceptance is claimed; real Render/model integration remains unverified.

No CAC issue ID or Jira connection was available for this maintenance task;
no Jira status was changed. The requested inbox check reported unavailable
`GITLAB_TOKEN_FILE` in this task's process; no browser fallback or message was sent.
Other work, including the pre-existing untracked private note, was preserved.
Delivery is a local commit only: no push or deployment.
