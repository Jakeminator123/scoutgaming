"""RunPod Serverless transport only; admission and budget remain server-owned."""
import asyncio
import os
import threading
from entrypoint import run

_ADMISSION = threading.Lock()

# Fixed internal codes only. Never stringify an exception: it may contain the
# callback capability, a bank URL, credentials, or an untrusted HTTP response.
_SAFE_FAILURE_CODES = frozenset({
    "invalid_job", "invalid_binding", "invalid_provider_job", "invalid_job_lifetime",
    "invalid_callback", "invalid_release", "release_changed", "invalid_release_path",
    "release_file_changed", "release_mismatch", "invalid_json_file",
    "invalid_bank_download", "invalid_bank_origin", "invalid_bank_cache",
    "invalid_bank_tls", "bank_cache_conflict", "bank_http_rejected",
    "bank_length_mismatch", "bank_bytes_changed", "bank_archive_too_large",
    "bank_not_prepared", "bank_binding_mismatch", "invalid_bank_file_hash",
    "invalid_bank_archive", "bank_file_changed", "bank_sources_changed",
    "bank_geometry_mismatch", "session_not_bound", "worker_below_realtime_limit",
    "frame_plan_length_mismatch", "pcm_exceeds_plan",
})


def _failure_code(error):
    if (type(error) is ValueError and len(error.args) == 1
            and type(error.args[0]) is str and error.args[0] in _SAFE_FAILURE_CODES):
        return error.args[0]
    if isinstance(error, TimeoutError):
        return "moving_worker_timeout"
    if isinstance(error, OSError):
        return "moving_worker_io_failed"
    return "moving_worker_failed"


async def handler(job):
    if not isinstance(job, dict) or "id" not in job or "input" not in job:
        return {"status":"failed","code":"invalid_provider_envelope"}
    if not _ADMISSION.acquire(blocking=False):
        return {"status":"failed","code":"worker_busy"}
    try:
        # RunPod supplies the job id. No RUNPOD_API_KEY is read by this adapter.
        result = await run({"id":job["id"],"input":job["input"]},
                           os.environ.get("MOVING_BANK_STORE","/banks"),
                           os.environ.get("MOVING_CALLBACK_ORIGIN",""))
        return {"status":result}
    except asyncio.CancelledError:
        # run() closes the owned subprocess before cancellation reaches the SDK.
        raise
    except BaseException as error:
        return {"status":"failed","code":_failure_code(error)}
    finally:
        _ADMISSION.release()


def start(sdk=None):
    os.environ["RUNPOD_LOG_LEVEL"] = "ERROR"
    if sdk is None:
        import runpod as sdk
    sdk.serverless.start({"handler":handler,"concurrency_modifier":lambda current:1})


if __name__ == "__main__":
    start()
