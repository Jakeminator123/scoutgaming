"""Network-isolated CPU smoke, executed as UID 10001 during image build."""
from importlib.metadata import version
from pathlib import Path
import json
import os
import sys
from contracts import BASE_RELEASE, ROOT, digest, verify_release, verify_sources
from models import verify

release = verify_release()
verify_sources()
if os.getuid() != 10001:
    raise RuntimeError("prep_must_run_unprivileged")
worker = Path("/opt/moving-worker")
sys.path.insert(0, str(worker))
# Use the base release's own validator without shadowing this module.
import importlib.util
spec = importlib.util.spec_from_file_location("renderer_contracts", worker / "contracts.py")
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)
if renderer.verify_release(worker) != BASE_RELEASE:
    raise RuntimeError("renderer_release_changed")
for lock in (worker / "requirements.lock", worker / "requirements-serverless.lock", ROOT / "requirements.lock"):
    for line in lock.read_text().splitlines():
        if not line or line.startswith("#"):
            continue
        name, expected = line.split("==")
        if version(name) != expected:
            raise RuntimeError("installed_dependency_changed: " + name)
if digest(worker / "vendor/preprocessing_mp.py") != digest(ROOT / "sources/preprocessing_mp.py"):
    raise RuntimeError("helper_changed")
models = verify("/workspace/MuseTalk/models")
sys.path.insert(0, str(worker / "vendor"))
import rorlig
import preprocessing_mp
import numpy as np
import torch
from musetalk.utils.blending import get_image_prepare_material
from musetalk.utils.face_parsing import FaceParsing
if torch.cuda.is_available():
    raise RuntimeError("CPU_smoke_must_not_use_GPU")
# Detect on a synthetic blank frame: initialize the real task and native library.
mesh = preprocessing_mp._Mesh.get()
try:
    if preprocessing_mp.landmarks68(np.zeros((256, 256, 3), dtype=np.uint8)) is not None:
        raise RuntimeError("unexpected_face_on_blank_frame")
finally:
    mesh.close()
    preprocessing_mp._Mesh._inst = None
# Load both exact checkpoints on CPU; no synthetic replacement or model patch.
parser = FaceParsing(left_cheek_width=90, right_cheek_width=90)
if next(parser.net.parameters()).device.type != "cpu":
    raise RuntimeError("unexpected_model_device")
print(json.dumps({"releaseSha256": release, "rendererReleaseSha256": BASE_RELEASE,
                  "verifiedPrepModels": models, "uid": os.getuid(), "cpuModelLoad": True,
                  "gpuPreparation": False, "visualApproval": False}))
