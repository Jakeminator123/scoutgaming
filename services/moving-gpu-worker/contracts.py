"""Strict identities around the pinned rendering engine and reviewed protocol patches.

No registry, TTS, credential lookup, URL audio download or provider call belongs
here. The trusted game server owns admission, the budget reservation and job
lifecycle. A callback capability proves transport ownership, not authorization.
"""
import hashlib
from frame_contract import pcm_frames
import json
import re
import tarfile
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

SHA = re.compile(r"[a-f0-9]{64}")
IDENTITY = re.compile(r"[a-z][a-z0-9-]{0,39}")
OPAQUE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")
BANK_FILES = ("pool.mp4", "takes.json", "sources.json", "prep/meta.json",
              "prep/latents.pt", "prep/masks.npz", "prep/bias.npz")
BINDING_KEYS = {"schemaVersion", "releaseSha256", "dealerId", "workerAvatar",
                "profileRevision", "sourceSetSha256", "avatarSha256",
                "bankReceiptSha256", "sessionId", "attemptId", "nonce"}
MAX_BANK_BYTES = 4 * 1024 ** 3
MAX_PCM_BYTES = 24000 * 2 * 25
MAX_FRAMES = 600


def fail(code):
    raise ValueError(code)


def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def sha(value):
    return isinstance(value, str) and SHA.fullmatch(value) is not None


def identifier(value, pattern=OPAQUE):
    return isinstance(value, str) and pattern.fullmatch(value) is not None


def read_json(path, limit=1024 * 1024):
    path = Path(path)
    if path.is_symlink() or not path.is_file() or not 0 < path.stat().st_size <= limit:
        fail("invalid_json_file")
    return json.loads(path.read_text(encoding="utf-8"))


def verify_release(root):
    root = Path(root)
    manifest = read_json(root / "release.json")
    if set(manifest) != {"schemaVersion", "files", "releaseSha256"} or manifest["schemaVersion"] != 1:
        fail("invalid_release")
    payload = {"schemaVersion": 1, "files": manifest["files"]}
    if hashlib.sha256(canonical(payload).encode()).hexdigest() != manifest["releaseSha256"]:
        fail("release_changed")
    if not isinstance(manifest["files"], dict) or not manifest["files"]:
        fail("invalid_release")
    for name, expected in manifest["files"].items():
        if (not isinstance(name, str) or Path(name).is_absolute() or ".." in Path(name).parts
                or "\\" in name or not sha(expected)):
            fail("invalid_release_path")
        path = root / name
        if path.is_symlink() or not path.is_file() or digest(path) != expected:
            fail("release_file_changed")
    return manifest["releaseSha256"]


def validate_job(job, release_sha, allowed_origin, job_id):
    if not isinstance(job, dict) or set(job) != {"schemaVersion", "callbackUrl", "binding", "ttlSeconds"}:
        fail("invalid_job")
    binding = job["binding"]
    if job["schemaVersion"] != 1 or not isinstance(binding, dict) or set(binding) != BINDING_KEYS:
        fail("invalid_binding")
    if type(binding["schemaVersion"]) is not int or binding["schemaVersion"] != 1:
        fail("invalid_binding")
    for name in ("releaseSha256", "profileRevision", "sourceSetSha256",
                 "avatarSha256", "bankReceiptSha256", "nonce"):
        if not sha(binding[name]):
            fail("invalid_binding")
    if binding["releaseSha256"] != release_sha:
        fail("release_mismatch")
    for name in ("dealerId", "workerAvatar"):
        if not identifier(binding[name], IDENTITY):
            fail("invalid_binding")
    for name in ("sessionId", "attemptId"):
        if not identifier(binding[name]):
            fail("invalid_binding")
    if not identifier(job_id):
        fail("invalid_provider_job")
    if type(job["ttlSeconds"]) is not int or not 1 <= job["ttlSeconds"] <= 180:
        fail("invalid_job_lifetime")
    if not isinstance(job["callbackUrl"], str) or not isinstance(allowed_origin, str):
        fail("invalid_callback")
    origin, callback = urlsplit(allowed_origin), urlsplit(job["callbackUrl"])
    if (origin.scheme != "https" or not origin.hostname or origin.username or origin.password
            or origin.path not in ("", "/") or origin.query or origin.fragment
            or callback.scheme != "wss" or callback.netloc != origin.netloc
            or callback.username or callback.password or callback.fragment
            or not re.fullmatch(r"/lipsync-moving/[a-f0-9]{48}", callback.path)):
        fail("invalid_callback")
    query = parse_qs(callback.query, keep_blank_values=True, strict_parsing=True)
    if set(query) != {"token", "avatar"} or query["avatar"] != [binding["workerAvatar"]]:
        fail("invalid_callback")
    if len(query["token"]) != 1 or not sha(query["token"][0]):
        fail("invalid_callback")
    return {**binding, "jobId": job_id}


def attest_ack(message, attestation):
    if json.dumps(message,sort_keys=True) != json.dumps({"t": "bind", "attestation": attestation},sort_keys=True):
        fail("session_not_bound")


def verify_bank(archive, receipt_path, destination, binding):
    """Hash before parsing/extraction; never execute unverified torch pickles."""
    archive, receipt_path, destination = map(Path, (archive, receipt_path, destination))
    if archive.stat().st_size > MAX_BANK_BYTES + 1024*1024:
        fail("bank_archive_too_large")
    for path, key in ((archive, "avatarSha256"), (receipt_path, "bankReceiptSha256")):
        if path.is_symlink() or not path.is_file() or digest(path) != binding[key]:
            fail("bank_bytes_changed")
    receipt = read_json(receipt_path)
    if (receipt.get("status") != "prepared"
            or receipt.get("avatarSha256") != binding["avatarSha256"]
            or set(receipt.get("files", {})) != set(BANK_FILES)):
        fail("bank_not_prepared")
    for key in ("dealerId", "workerAvatar", "sourceSetSha256"):
        if receipt.get(key) != binding[key]:
            fail("bank_binding_mismatch")
    if any(not sha(value) for value in receipt["files"].values()):
        fail("invalid_bank_file_hash")
    prefix = binding["workerAvatar"] + "/"
    expected = {prefix + name for name in BANK_FILES}
    with tarfile.open(archive, "r:") as tar:
        members = tar.getmembers()
        if (len(members) != len(expected) or {m.name for m in members} != expected
                or any(not m.isfile() or m.issym() or m.islnk() or m.size <= 0 for m in members)
                or sum(m.size for m in members) > MAX_BANK_BYTES):
            fail("invalid_bank_archive")
        destination.mkdir(exist_ok=False)
        for member in members:
            name = member.name[len(prefix):]
            target = destination / binding["workerAvatar"] / name
            target.parent.mkdir(parents=True, exist_ok=True)
            with tar.extractfile(member) as source, target.open("xb") as output:
                while chunk := source.read(1024 * 1024):
                    output.write(chunk)
            if digest(target) != receipt["files"][name]:
                fail("bank_file_changed")
    bank = destination / binding["workerAvatar"]
    source = read_json(bank / "sources.json")
    keys = ("schemaVersion", "dealerId", "workerAvatar", "clips", "rest")
    if (not isinstance(source, dict) or set(source) != set(keys) | {"sourceSetSha256"}
            or source["schemaVersion"] != 1
            or hashlib.sha256(canonical({key: source[key] for key in keys}).encode()).hexdigest()
            != binding["sourceSetSha256"] or source["sourceSetSha256"] != binding["sourceSetSha256"]):
        fail("bank_sources_changed")
    for key in ("dealerId", "workerAvatar"):
        if source[key] != binding[key]:
            fail("bank_binding_mismatch")
    mapping, prep = read_json(bank / "takes.json"), read_json(bank / "prep/meta.json", 16 * 1024 * 1024)
    count = receipt.get("poolFrames")
    if (type(count) is not int or not 1 <= count <= 4096 or mapping.get("pool") != count
            or mapping.get("sourceSetSha256") != binding["sourceSetSha256"]
            or prep.get("frames") != count or prep.get("size") != [1080, 1920]
            or prep.get("missing") != 0 or len(prep.get("per_frame", [])) != count):
        fail("bank_geometry_mismatch")
    if type(mapping.get("vila")) is not int or not 0 <= mapping["vila"] < count:
        fail("bank_rest_mismatch")
    takes = mapping.get("takes")
    clips = source["clips"]
    if (not isinstance(clips, list) or not 1 <= len(clips) <= 128 or not isinstance(takes, dict)
            or set(takes) != {clip.get("take") for clip in clips} or receipt.get("clips") != len(clips)):
        fail("bank_takes_mismatch")
    for clip in clips:
        ids = takes[clip["take"]]
        if (not identifier(clip["take"], re.compile(r"clip-[a-f0-9-]{36}"))
                or clip["take"] != "clip-" + clip.get("videoId", "")
                or not sha(clip.get("sha256")) or clip.get("fps") != 24
                or [clip.get("width"), clip.get("height")] != [1080, 1920]
                or not isinstance(ids, list) or not ids or len(ids) != clip.get("frameCount")
                or any(type(i) is not int or not 0 <= i < count for i in ids)):
            fail("bank_takes_mismatch")
    rest = source["rest"]
    rest_ids = takes.get("clip-" + str(rest.get("videoId")))
    rest_frame = rest.get("frame")
    if (not rest_ids or type(rest_frame) is not int or not 0 <= rest_frame < len(rest_ids)
            or rest_ids[rest_frame] != mapping["vila"]):
        fail("bank_rest_mismatch")
    return mapping


def validate_start(message, mapping):
    required = {"t", "id", "ljud_id", "rate", "karta", "fran_ruta"}
    if (not isinstance(message, dict) or set(message) != required or message["t"] != "start"
            or not isinstance(message["id"], str) or len(message["id"]) > 240
            or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}#[1-9][0-9]*#[a-f0-9]{64}", message["id"])
            or message["ljud_id"] != message["id"].split("#")[0] or message["rate"] != 24000
            or not isinstance(message["karta"], list) or not 1 <= len(message["karta"]) <= MAX_FRAMES):
        fail("invalid_start")
    total = 0
    for row in message["karta"]:
        if not isinstance(row, list) or len(row) != 3:
            fail("invalid_frame_plan")
        take, first, count = row
        if (not isinstance(take, str) or type(first) is not int or first < 0
                or type(count) is not int or count < 1):
            fail("invalid_frame_plan")
        if take == "vila":
            if first != 0:
                fail("invalid_frame_plan")
        elif take not in mapping["takes"] or first + count > len(mapping["takes"][take]):
            fail("invalid_frame_plan")
        total += count
    if not 1 <= total <= MAX_FRAMES or type(message["fran_ruta"]) is not int or not 0 <= message["fran_ruta"] < total:
        fail("invalid_frame_plan")
    return total


def validate_pcm(pcm, frames, from_frame):
    if not pcm or len(pcm) % 2 or len(pcm) > MAX_PCM_BYTES:
        fail("invalid_pcm")
    # Motor adds 220 ms leading and 530 ms trailing silence. Never rely on its
    # implicit last-frame extension when the authoritative plan is too short.
    generated = pcm_frames(len(pcm))
    if generated > frames or generated <= from_frame:
        fail("pcm_exceeds_plan")
    return generated
