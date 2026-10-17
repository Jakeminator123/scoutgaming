import copy
import hashlib
import io
import json
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from contracts import (canonical, digest, validate_job, attest_ack, verify_bank,
                       validate_start, validate_pcm, verify_release)

H = "a" * 64
VIDEO = "11111111-2222-3333-4444-555555555555"
TAKE = "clip-" + VIDEO


def binding():
    return dict(schemaVersion=1, releaseSha256=H, dealerId="dragan", workerAvatar="dragan",
                profileRevision=H, sourceSetSha256=H, avatarSha256=H,
                bankReceiptSha256=H, sessionId="session-1", attemptId="attempt-1", nonce=H)


def job():
    return {"schemaVersion": 1, "callbackUrl": "wss://engine.example/lipsync-moving/" + "1"*48
            + "?token=" + "2"*64 + "&avatar=dragan", "binding": binding(), "ttlSeconds": 180}


def make_bank(root, mutate=None):
    source = {"schemaVersion":1, "dealerId":"dragan", "workerAvatar":"dragan",
              "clips":[{"videoId":VIDEO, "take":TAKE, "sha256":H, "bytes":100,
                        "fps":24, "frameCount":2, "width":1080, "height":1920}],
              "rest":{"videoId":VIDEO,"frame":0}}
    source["sourceSetSha256"] = hashlib.sha256(canonical(source).encode()).hexdigest()
    mapping = {"pool":2, "vila":0, "segs":[0], "takes":{TAKE:[0,1]},
               "sourceSetSha256":source["sourceSetSha256"]}
    meta = {"frames":2, "size":[1080,1920], "missing":0, "per_frame":[{},{}]}
    files = {"pool.mp4":b"synthetic-no-gpu",
             "sources.json":canonical(source).encode(),
             "takes.json":canonical(mapping).encode(),
             "prep/meta.json":canonical(meta).encode(),
             "prep/latents.pt":b"not-executed-pickle",
             "prep/masks.npz":b"synthetic", "prep/bias.npz":b"synthetic"}
    if mutate:
        mutate(files)
    archive = root / "bank.tar"
    with tarfile.open(archive, "w") as tar:
        for name, value in files.items():
            member = tarfile.TarInfo("dragan/" + name)
            member.size = len(value)
            tar.addfile(member, io.BytesIO(value))
    receipt = {"status":"prepared","dealerId":"dragan","workerAvatar":"dragan",
               "sourceSetSha256":source["sourceSetSha256"],"avatarSha256":digest(archive),
               "poolFrames":2,"clips":1,"visualApproval":False,
               "files":{name:hashlib.sha256(value).hexdigest() for name,value in files.items()}}
    receipt_path = root / "receipt.json"
    receipt_path.write_text(json.dumps(receipt))
    expected = {**binding(),"sourceSetSha256":source["sourceSetSha256"],
                "avatarSha256":digest(archive),"bankReceiptSha256":digest(receipt_path)}
    return archive, receipt_path, expected


class Contracts(unittest.TestCase):
    def test_exact_session_binds_provider_job_and_generic_registered_avatar(self):
        attestation = validate_job(job(), H, "https://engine.example", "actual-job-id")
        self.assertEqual(attestation["jobId"], "actual-job-id")
        self.assertEqual(attestation["workerAvatar"], "dragan")
        attest_ack({"t":"bind","attestation":attestation}, attestation)
        for key in ("jobId","nonce","avatarSha256","sessionId","profileRevision"):
            altered = copy.deepcopy(attestation)
            altered[key] = "changed"
            with self.assertRaises(ValueError):
                attest_ack({"t":"bind","attestation":altered}, attestation)

    def test_cross_origin_duplicate_capabilities_missing_identity_and_release_fail(self):
        valid = job()
        for changed in [
            {**valid,"callbackUrl":valid["callbackUrl"].replace("engine.example","other.example")},
            {**valid,"callbackUrl":valid["callbackUrl"]+"&token="+"3"*64},
            {**valid,"callbackUrl":valid["callbackUrl"]+"&unexpected=yes"},
            {**valid,"callbackUrl":valid["callbackUrl"].replace("wss://","ws://")},
            {**valid,"ttlSeconds":True},
            {**valid,"binding":{**valid["binding"],"nonce":"bad"}},
            {**valid,"binding":{**valid["binding"],"releaseSha256":"b"*64}},
            {**valid,"binding":{**valid["binding"],"workerAvatar":"../dragan"}},
        ]:
            with self.subTest(changed=changed):
                with self.assertRaises((ValueError,TypeError)):
                    validate_job(changed,H,"https://engine.example","actual-job-id")

    def test_archive_and_receipt_are_both_pinned_before_extraction(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            archive,receipt,expected=make_bank(root)
            mapping=verify_bank(archive,receipt,root/"verified",expected)
            self.assertEqual(mapping["takes"][TAKE],[0,1])
            receipt.write_bytes(receipt.read_bytes()+b" ")
            with self.assertRaisesRegex(ValueError,"bank_bytes_changed"):
                verify_bank(archive,receipt,root/"rejected",expected)
            self.assertFalse((root/"rejected").exists())

    def test_modified_archive_fails_before_reading_prepared_pickle(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            archive,receipt,expected=make_bank(root)
            archive.write_bytes(archive.read_bytes()+b"changed")
            with self.assertRaisesRegex(ValueError,"bank_bytes_changed"):
                verify_bank(archive,receipt,root/"rejected",expected)
            self.assertFalse((root/"rejected").exists())

    def test_even_pinned_traversal_archive_cannot_escape_destination(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            archive,receipt,expected=make_bank(root,lambda f:f.update({"../../outside":b"forbidden"}))
            with self.assertRaisesRegex(ValueError,"bank_not_prepared"):
                verify_bank(archive,receipt,root/"rejected",expected)
            self.assertFalse((root/"outside").exists())

    def test_pinned_wrong_geometry_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            def change(files):
                meta=json.loads(files["prep/meta.json"])
                meta["missing"]=1
                files["prep/meta.json"]=json.dumps(meta).encode()
            archive,receipt,expected=make_bank(root,change)
            with self.assertRaisesRegex(ValueError,"bank_geometry_mismatch"):
                verify_bank(archive,receipt,root/"rejected",expected)

    def test_wrong_bank_owner_cannot_load(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            archive,receipt,expected=make_bank(root)
            expected["dealerId"]="someone-else"
            with self.assertRaisesRegex(ValueError,"bank_binding_mismatch"):
                verify_bank(archive,receipt,root/"rejected",expected)

    def test_plan_rejects_implicit_frozen_last_frame_and_unscoped_url_audio(self):
        mapping={"takes":{TAKE:list(range(42))}}
        start={"t":"start","id":"talk#1#"+H,"ljud_id":"talk","rate":24000,
               "karta":[[TAKE,0,42]],"fran_ruta":0}
        self.assertEqual(validate_start(start,mapping),42)
        self.assertEqual(validate_pcm(bytes(48000),42,0),42)
        with self.assertRaisesRegex(ValueError,"pcm_exceeds_plan"):
            validate_pcm(bytes(48000),30,0)
        for altered in [{**start,"karta":[[TAKE,1,42]]},{**start,"ljud_url":"https://other/"},
                        {**start,"fran_ruta":42},{**start,"karta":[["unknown",0,42]]}]:
            with self.assertRaises(ValueError):
                validate_start(altered,mapping)

    def test_code_release_cannot_silently_change(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            (root/"core.py").write_text("reviewed code")
            payload={"schemaVersion":1,"files":{"core.py":digest(root/"core.py")}}
            release=hashlib.sha256(canonical(payload).encode()).hexdigest()
            (root/"release.json").write_text(json.dumps({**payload,"releaseSha256":release}))
            self.assertEqual(verify_release(root),release)
            (root/"core.py").write_text("different code")
            with self.assertRaisesRegex(ValueError,"release_file_changed"):
                verify_release(root)
