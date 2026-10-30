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
and approved target `ghcr.io/jakeminator123/moving-gpu-prep`. It rebuilds/checks,
rejects a non-private destination, publishes only an SHA tag and records a digest.
GitHub creates a new package private by default; privacy is checked again afterward.
The runner login is always removed. No GPU resources are created by either workflow.

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
