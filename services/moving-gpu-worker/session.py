"""One bound utterance over the existing moving-worker callback protocol."""
import asyncio
import json
from contracts import attest_ack, fail, validate_start, validate_pcm, MAX_PCM_BYTES

MAX_CHUNK_BYTES = 2 * 1024 * 1024


def control(value):
    if not isinstance(value, str) or len(value) > 65536:
        fail("invalid_control")
    message = json.loads(value)
    if not isinstance(message, dict):
        fail("invalid_control")
    return message


async def serve(socket, engine, attestation, mapping, idle_seconds=15):
    """Engine is owned by this attempt and is killed before abort acknowledgement."""
    async def send(message):
        await asyncio.wait_for(socket.send(json.dumps(message, separators=(",", ":"))), idle_seconds)

    async def receive():
        return await asyncio.wait_for(socket.recv(), idle_seconds)

    stopped = False
    async def stop():
        nonlocal stopped
        if not stopped:
            stopped = True
            await engine.close()

    pcm = bytearray()
    output = incoming = None
    try:
        measurement = await engine.prepare()
        if (not isinstance(measurement, dict)
                or type(measurement.get("rutor_per_s")) not in (int, float)
                or not 30 <= measurement["rutor_per_s"] <= 10000):
            fail("worker_below_realtime_limit")
        await send({"t": "pong", "avatar": attestation["workerAvatar"], "motor": "rorlig-9",
                    "ljud_fore_s": 0.22, "pad_after_s": 0.53, "fps": 24, "del_rutor": 12, "samma_ljud": False, "spar": 1,
                    "rutor_per_s": measurement["rutor_per_s"],
                    "forsta_bit_ms": measurement.get("forsta_bit_ms"),
                    "attestation": attestation})
        attest_ack(control(await receive()), attestation)
        start = control(await receive())
        frames = validate_start(start, mapping)
        while True:
            item = await receive()
            if isinstance(item, bytes):
                if len(item) % 2 or not item or len(item) > 32768 or len(pcm) + len(item) > MAX_PCM_BYTES:
                    fail("invalid_pcm")
                pcm.extend(item)
                continue
            message = control(item)
            if message == {"t": "avbryt", "id": start["id"]}:
                await stop()
                await send({"t": "done", "id": start["id"], "aborted": True})
                return "cancelled"
            if message != {"t": "end", "id": start["id"]}:
                fail("invalid_end")
            break
        generated = validate_pcm(pcm, frames, start["fran_ruta"])
        if generated != frames:
            fail("frame_plan_length_mismatch")
        await engine.begin(start, bytes(pcm))
        pcm[:] = b"\0" * len(pcm)
        next_frame = start["fran_ruta"]
        incoming = asyncio.create_task(socket.recv())
        while True:
            output = asyncio.create_task(engine.next())
            done, _ = await asyncio.wait((output, incoming), return_when=asyncio.FIRST_COMPLETED,
                                         timeout=idle_seconds)
            if not done:
                fail("worker_output_timeout")
            # A simultaneous cancel always wins over a newly produced chunk.
            if incoming in done:
                message = control(incoming.result())
                if message != {"t": "avbryt", "id": start["id"]}:
                    fail("unexpected_input_during_render")
                await stop()
                await send({"t": "done", "id": start["id"], "aborted": True})
                return "cancelled"
            meta, data = output.result()
            if meta.get("t") == "done":
                if data is not None or next_frame != frames:
                    fail("incomplete_worker_output")
                await stop()
                await send({**meta, "id": start["id"]})
                return "complete"
            if (meta.get("t") != "lapp" or not isinstance(data, bytes)
                    or not 0 < len(data) <= MAX_CHUNK_BYTES
                    or type(meta.get("fran")) is not int or meta["fran"] != next_frame
                    or type(meta.get("till")) is not int or not next_frame < meta["till"] <= frames
                    or meta["till"] - next_frame > 12
                    or not isinstance(meta.get("rutor"), list)
                    or len(meta["rutor"]) != meta["till"] - next_frame):
                fail("invalid_worker_output")
            next_frame = meta["till"]
            await send({**meta, "id": start["id"]})
            await asyncio.wait_for(socket.send(data), idle_seconds)
    finally:
        pcm[:] = b"\0" * len(pcm)
        await stop()
        for task in (incoming, output):
            if task is not None:
                task.cancel()
        await asyncio.gather(*(t for t in (incoming, output) if t is not None), return_exceptions=True)
