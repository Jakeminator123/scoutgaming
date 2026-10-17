"""RunPod Serverless transport only; admission and budget remain server-owned."""
import asyncio
import os
import threading
from entrypoint import run

_ADMISSION = threading.Lock()


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
    except BaseException:
        # Callback capabilities and provider payloads must never reach SDK errors.
        return {"status":"failed","code":"moving_worker_failed"}
    finally:
        _ADMISSION.release()


def start(sdk=None):
    os.environ["RUNPOD_LOG_LEVEL"] = "ERROR"
    if sdk is None:
        import runpod as sdk
    sdk.serverless.start({"handler":handler,"concurrency_modifier":lambda current:1})


if __name__ == "__main__":
    start()
