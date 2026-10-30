# Moving GPU BANK PREP

Separate private development image for preparing a verified moving-speech CPU pool.
It adds no game service, endpoint, runtime download, publication or AV approval.

- Base: exact private GHCR digest in Dockerfile; inherited renderer release
  `5908716a81532d29e8b2e9aece3a8639258a7f56dad2ee3b6d98fcc343d0c08c`.
- Source: `sources.lock.json` pins the existing bank builder and MediaPipe helper.
  The builder normalizes CRLF to LF when staging; it never modifies the source files.
  The helper is copied unchanged, including its historical comments; those comments
  are not independent evidence of model licensing.
- Wheels: MediaPipe 0.10.31 is intentional. Its four-package overlay reuses the
  base's NumPy 1.26.4 and CFFI 2.1.1/pycparser. MediaPipe 0.10.32 additionally asks
  for a second OpenCV distribution and matplotlib; 0.10.21 also asks for JAX.
  PyPI release metadata and direct immutable wheel URLs/hashes are the sources.
  Install uses `--no-deps --require-hashes`; `pip check` plus exact base-version
  checks reject dependency changes. Sounddevice is declared but microphone capture
  is unused; MediaPipe catches absent PortAudio for its optional audio interface.
- Models: `models.lock.json` records actual streamed SHA256/byte counts. Google
  provides Face Landmarker v1, PyTorch provides the ResNet checkpoint, and the
  revision-pinned Hugging Face mirror is the one referenced by pinned MuseTalk.
  The mirror declares WTFPL; neither that declaration nor upstream code licenses
  establish independent commercial clearance for every training dataset/weight.
  This package records technical provenance for a private development trial.
- ResNet compatibility: [TorchVision 0.23's official ZIP checkpoint](https://github.com/pytorch/vision/blob/v0.23.0/torchvision/models/resnet.py)
  `resnet18-f37072fd.pth` is stored at MuseTalk's fixed `resnet18-5c106cde.pth`
  path. The old file is a legacy tar that [PyTorch 2.8's default safe loader](https://docs.pytorch.org/docs/2.8/notes/serialization.html#torch-load-with-weights-only-true)
  rejects. No loader is relaxed and no upstream code is patched. Pinned
  [FaceParsing](https://github.com/TMElyralab/MuseTalk/blob/0a89dec45a0192b824e3cf4daf96c239440c5ed8/musetalk/utils/face_parsing/__init__.py)
  then strictly loads the unchanged `79999_iter.pth` into the complete BiSeNet.
  The CPU smoke compares every final checkpoint tensor and permits only zero
  BatchNorm counters absent from the old checkpoint; it also requires eval mode.
- Image checks: original renderer seal, every source/model hash, all installed
  base/prep package versions, actual FaceLandmarker detection on a blank CPU image
  and FaceParsing CPU checkpoint/state verification. Checks run as UID 10001 with no network.
  They do not establish CUDA inference or lip synchronization.

## Review and build

Local stdlib-only checks (no Docker, GPU or package installation):

```sh
python services/moving-gpu-prep/build.py --check
python -B -m unittest discover -s services/moving-gpu-prep/tests -v
```

After a reviewed package change, explicitly regenerate `release.json` with
`python services/moving-gpu-prep/build.py --seal`, then run those checks again.

The dedicated cloud build is manual. Before the new workflow exists on default
main, apply the PR label `moving-gpu-prep-build`; the same-repository event freezes
the exact PR head. Remove/reapply that label for a deliberate retry. There is no
synchronize trigger or automatic build in global CI. Once installed, dispatch
`moving-gpu-prep-build.yml` on a branch and supply its full `expected_head`.
Both paths authenticate only for pulling the private base (packages:read).

Publish is a separate main-only dispatch with exact head, overlay release SHA256
and approved target `ghcr.io/jakeminator123/moving-gpu-worker`. It requires that
this existing package is private **before any image build or push**. A missing,
public or inaccessible package fails closed; no new package may be created.
The prep image uses only `prep-sha-<full-head>`, separate from the original
renderer tags. The digest-pinned original renderer remains unchanged. The job
rechecks privacy after publication and records the prep digest, tag, release
and UID checks. The runner login is always removed. No GPU resources are created.

Do not assume that a new GHCR package will be private. With `GITHUB_TOKEN`,
[a new package can inherit the repository visibility](https://docs.github.com/en/packages/managing-github-packages-using-github-actions-workflows/publishing-and-installing-a-package-with-github-actions).
This repository is public. Failed publication
[run 41051847647](https://github.com/Jakeminator123/scoutgaming/actions/runs/41051847647)
created the separate public `moving-gpu-prep` package before its final privacy
check rejected it. That failed run is not an accepted private prep release.

## One-off cleanup of the failed publication

`moving-gpu-prep-cleanup.yml` is separate from publication and defaults to dry-run.
It does not run on pushes or ordinary PR updates. Before merge, apply
`moving-gpu-prep-cleanup-dry-run` to a same-repository PR to inspect its frozen
head. Review that result and exact source head before deliberately applying
`moving-gpu-prep-cleanup-approved`; that second label explicitly approves the
fixed digest/head below. A main-installed workflow can instead be dispatched
with `expected_head`; deletion additionally requires `execute=true`,
`approved_digest` and `confirmed_head`. No cleanup has been executed merely
by adding this code.

- Only `Jakeminator123/scoutgaming` (repository ID `1380630440`) and package
  `moving-gpu-prep` can be addressed. The private `moving-gpu-worker` is never
  a cleanup target.
- The only allowed version is
  `sha256:5e3ecea7694d8b5dd4bf160dd27ad2ac4303da3caaed7080d1b9a3318d9c9e1b`,
  with exactly tag `sha-8418878f25d9563358545c9b39ff2391c7036d7f`.
  The confirmed publication head is `8418878f25d9563358545c9b39ff2391c7036d7f`.
- Package and version creation must fall in the verified successful push step,
  `2026-10-30T12:01:29Z` through `2026-10-30T12:01:38Z`, inside the fixed failed
  run. Its head, repository, workflow and start/end times are checked live.
  Additional active/deleted versions, tags, pages or changed identity refuse deletion.
- The workflow uses only `contents:read` and `packages:write`. It relies on the
  publishing repository's existing package-admin role; it creates no PAT and
  grants no access. GitHub documents
  [Actions deletion and restoration using that existing role](https://docs.github.com/en/packages/learn-github-packages/deleting-and-restoring-a-package).
- The safe JSON receipt is uploaded before deletion and retained as a workflow
  artifact for 30 days. A failed upload prevents deletion. A second artifact
  records the result. Both include package/version IDs and the restore endpoint.
  GitHub allows restoration within 30 days if the namespace remains available;
  any restore is a separate reviewed action.
- Success requires DELETE 204, authenticated package GET 404, and unavailable
  anonymous manifests for both the exact digest and tag using a previously
  valid anonymous token. Any uncertain postcheck fails; the receipt preserves
  what happened. Cleanup and publication share one concurrency group.

## GPU job contract

Use the resulting verified digest, an explicitly bounded job and a writable output
under /tmp. The input is the **CPU bank parent**, containing bank-receipt.json plus
the child dealer directory. The output must not already exist:

```sh
/workspace/mt-venv/bin/python -I /opt/moving-prep/sources/build-moving-speech-bank.py \
  --pool /tmp/job/cpu-bank \
  --expected-receipt-sha256 <separately-verified-input-receipt-sha256> \
  --prepare-with /opt/moving-worker/vendor \
  --output /tmp/job/prepared
```

The output receipt remains `visualApproval=false`. Provisioning, private transport,
budget/watchdog, result review and teardown are owned by the calling workflow.
