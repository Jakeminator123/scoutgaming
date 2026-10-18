#!/usr/bin/env python3
"""Portable single-job entrypoint; no provider SDK, keys or TTS calls.

stdin: {"id": "<actual provider job id>", "input": <job contract>}
stdout: one redacted result. The trusted launcher supplies id from the provider
envelope. A RunPod Serverless launcher can call handler(job) inside its SDK;
this image itself runs a job on a pod/container without provider credentials.
"""
import asyncio
import contextlib
import json
import os
from pathlib import Path
import signal
import sys
import tempfile
import diagnostics as diag
from contracts import validate_job, verify_bank, verify_release
from engine import ProcessEngine
from bank_download import fetch_bank_download
from fetch_models import verify as verify_models
from session import serve

ROOT = Path(__file__).resolve().parent


async def run(job, bank_store, allowed_origin):
    with diag.phase("releaseVerifyMs"):
        release_sha = verify_release(ROOT)
    diag.record(releaseSha256=release_sha)
    attestation = validate_job(job["input"], release_sha, allowed_origin, job["id"])
    binding = job["input"]["binding"]
    async with asyncio.timeout(job["input"]["ttlSeconds"]):
        if "bankDownload" in job["input"]:
            bank_store = await fetch_bank_download(job["input"]["bankDownload"],
                                                   job["input"]["callbackUrl"], binding)
        else:
            diag.record(bankArchiveCache="not_requested", bankReceiptCache="not_requested")
        with tempfile.TemporaryDirectory(prefix="moving-worker-") as temporary:
            destination = Path(temporary) / "avatars"
            bank_store = Path(bank_store)
            # Hash validation and extraction intentionally remain one operation.
            with diag.phase("bankExtractVerifyMs"):
                mapping = verify_bank(
                    bank_store / (binding["avatarSha256"] + ".tar"),
                    bank_store / (binding["bankReceiptSha256"] + ".json"),
                    destination, binding)
            with diag.phase("modelsVerifyMs"):
                verify_models("/workspace/MuseTalk/models")
            with diag.phase("engineSpawnMs"):
                engine = ProcessEngine(destination, binding["workerAvatar"])
            try:
                with diag.phase("enginePrepareMs"):
                    await engine.prepare()
                import websockets
                # allowlisted TLS origin; proxy discovery is disabled. Never log
                # callbackUrl: its token is a one-use transport capability.
                async with contextlib.AsyncExitStack() as connection:
                    with diag.phase("callbackConnectMs"):
                        socket = await connection.enter_async_context(websockets.connect(
                            job["input"]["callbackUrl"], proxy=None, open_timeout=15, close_timeout=2,
                            max_size=65536, max_queue=4, write_limit=65536, compression=None))
                    return await serve(socket, engine, attestation, mapping)
            finally:
                with diag.phase("engineStopMs"):
                    await engine.close()


def handler(job):
    # Caller-owned journal must finalize every result, timeout or process loss.
    # A worker result never releases the server's reservation by itself.
    if not isinstance(job, dict) or set(job) != {"id", "input"}:
        return {"status": "failed", "code": "invalid_provider_envelope"}
    with diag.collect() as diagnostics:
        try:
            with contextlib.redirect_stdout(sys.stderr):
                outcome = asyncio.run(run(job, os.environ.get("MOVING_BANK_STORE", "/banks"),
                                          os.environ.get("MOVING_CALLBACK_ORIGIN", "")))
            result = {"status": outcome}
        except BaseException as error:
            # Deliberately omit arbitrary exception strings and provider payloads.
            known = {"release_mismatch", "bank_bytes_changed", "bank_binding_mismatch",
                     "session_not_bound", "worker_below_realtime_limit",
                     "frame_plan_length_mismatch", "pcm_exceeds_plan"}
            code = error.args[0] if type(error) is ValueError and len(error.args) == 1 and type(error.args[0]) is str and error.args[0] in known else "moving_worker_failed"
            result = {"status": "failed", "code": code}
        diag.record(outcome=result["status"])
        diag.resources()
        result["diagnostics"] = diagnostics.snapshot()
        diag.emit(result["diagnostics"])
        return result


def main():
    def interrupted(_signum, _frame):
        raise KeyboardInterrupt()
    signal.signal(signal.SIGTERM, interrupted)
    raw = sys.stdin.buffer.read(65537)
    if len(raw) > 65536:
        print('{"status":"failed","code":"job_too_large"}')
        return 1
    try:
        job = json.loads(raw)
    except (ValueError, UnicodeError):
        print('{"status":"failed","code":"invalid_job_json"}')
        return 1
    result = handler(job)
    print(json.dumps(result))
    return 0 if result["status"] in ("complete", "cancelled") else 1


if __name__ == "__main__":
    raise SystemExit(main())
