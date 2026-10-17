import asyncio
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from session import serve
from test_contracts import binding, TAKE, H

ATTESTATION={**binding(),"jobId":"actual-job-id"}
START={"t":"start","id":"talk#1#"+H,"ljud_id":"talk","rate":24000,"karta":[[TAKE,0,42]],"fran_ruta":0}
MAPPING={"takes":{TAKE:list(range(42))}}

class Socket:
    def __init__(self, messages, block_binary=False, auto_ack=True):
        self.messages=asyncio.Queue()
        for message in messages:
            self.messages.put_nowait(json.dumps(message) if isinstance(message,dict) else message)
        self.sent=[]
        self.block_binary=block_binary
        self.auto_ack=auto_ack
    async def recv(self):
        return await self.messages.get()
    async def send(self,value):
        if isinstance(value,bytes) and self.block_binary:
            await asyncio.Future()
        self.sent.append(json.loads(value) if isinstance(value,str) else value)
        if isinstance(value,bytes) and self.auto_ack:
            meta=self.sent[-2]
            self.messages.put_nowait(json.dumps({"t":"ack","id":meta["id"],"del":meta["del"]}))

class Engine:
    def __init__(self,speed=45.9,stall=False):
        self.speed=speed
        self.closed=False
        self.started=False
        self.stall=stall
        self.position=0
    async def prepare(self):
        return {"rutor_per_s":self.speed,"forsta_bit_ms":496}
    async def begin(self,start,pcm):
        self.started=True
        self.pcm=pcm
    async def next(self):
        if self.stall:
            await asyncio.Future()
        await asyncio.sleep(0)
        if self.position==42:
            return {"t":"done","rutor":42},None
        first=self.position
        self.position=min(42,first+12)
        return {"t":"lapp","del":first//12,"fran":first,"till":self.position,
                "rutor":[{"tagning":TAKE,"ruta":i,"rect":[0,0,20,20]} for i in range(first,self.position)]},b"h264"
    async def close(self):
        self.closed=True

def messages(start=None):
    return [{"t":"bind","attestation":ATTESTATION},start or START,
            bytes(24000),bytes(24000),{"t":"end","id":START["id"]}]

class Sessions(unittest.IsolatedAsyncioTestCase):
    async def test_success_requires_bank_binding_and_announces_exact_padding(self):
        socket,engine=Socket(messages()),Engine()
        self.assertEqual(await serve(socket,engine,ATTESTATION,MAPPING),"complete")
        pong=socket.sent[0]
        self.assertEqual((pong["fps"],pong["ljud_fore_s"],pong["pad_after_s"]),(24,0.22,0.53))
        self.assertEqual(pong["attestation"],ATTESTATION)
        self.assertIs(pong["chunk_ack"],True)
        self.assertEqual(socket.sent[-1]["t"],"done")
        self.assertEqual(sum(isinstance(x,bytes) for x in socket.sent),4)
        self.assertTrue(engine.closed)

    async def test_pcm_or_start_before_bind_cannot_start_engine_render(self):
        for first in [START,bytes(20),{"t":"bind","attestation":{**ATTESTATION,"jobId":"other"}}]:
            socket,engine=Socket([first]),Engine()
            with self.assertRaises((ValueError,TypeError)):
                await serve(socket,engine,ATTESTATION,MAPPING,idle_seconds=.05)
            self.assertFalse(engine.started)
            self.assertTrue(engine.closed)

    async def test_slow_offline_worker_is_rejected_before_admission(self):
        socket,engine=Socket(messages()),Engine(speed=11.8)
        with self.assertRaisesRegex(ValueError,"worker_below_realtime_limit"):
            await serve(socket,engine,ATTESTATION,MAPPING)
        self.assertEqual(socket.sent,[])
        self.assertFalse(engine.started)

    async def test_short_legacy_plan_cannot_freeze_last_body_frame(self):
        start={**START,"karta":[[TAKE,0,30]]}
        socket,engine=Socket(messages(start)),Engine()
        with self.assertRaisesRegex(ValueError,"pcm_exceeds_plan"):
            await serve(socket,engine,ATTESTATION,MAPPING)
        self.assertFalse(engine.started)

    async def test_cancel_during_render_stops_engine_before_ack(self):
        socket=Socket(messages()+[{"t":"avbryt","id":START["id"]}])
        engine=Engine(stall=True)
        self.assertEqual(await serve(socket,engine,ATTESTATION,MAPPING,idle_seconds=.05),"cancelled")
        self.assertTrue(engine.closed)
        self.assertEqual(socket.sent[-1],{"t":"done","id":START["id"],"aborted":True})
        self.assertFalse(any(isinstance(item,bytes) for item in socket.sent))

    async def test_cancel_before_end_clears_admission_without_render(self):
        socket=Socket(messages()[:-1]+[{"t":"avbryt","id":START["id"]}])
        engine=Engine()
        self.assertEqual(await serve(socket,engine,ATTESTATION,MAPPING),"cancelled")
        self.assertFalse(engine.started)
        self.assertTrue(engine.closed)

    async def test_missing_bind_and_stalled_output_have_bounded_cleanup(self):
        for socket,engine in [(Socket([]),Engine()),(Socket(messages()),Engine(stall=True))]:
            with self.assertRaises((TimeoutError,ValueError)):
                await serve(socket,engine,ATTESTATION,MAPPING,idle_seconds=.02)
            self.assertTrue(engine.closed)

    async def test_slow_consumer_stops_owned_engine(self):
        socket,engine=Socket(messages(),block_binary=True),Engine()
        with self.assertRaises(TimeoutError):
            await serve(socket,engine,ATTESTATION,MAPPING,idle_seconds=.02)
        self.assertTrue(engine.closed)

    async def test_disconnect_during_render_never_reports_success(self):
        class Closed(Socket):
            async def recv(self):
                if self.messages.empty():
                    raise ConnectionError("closed")
                return await super().recv()
        socket,engine=Closed(messages()),Engine(stall=True)
        with self.assertRaises(ConnectionError):
            await serve(socket,engine,ATTESTATION,MAPPING)
        self.assertTrue(engine.closed)
        self.assertFalse(any(isinstance(m,dict) and m.get("t")=="done" for m in socket.sent))

    async def test_pcm_overrun_does_not_begin_gpu_inference(self):
        socket=Socket([{"t":"bind","attestation":ATTESTATION},START,bytes(32770)])
        engine=Engine()
        with self.assertRaisesRegex(ValueError,"invalid_pcm"):
            await serve(socket,engine,ATTESTATION,MAPPING)
        self.assertFalse(engine.started)

    async def test_wrong_rest_frame_identity_is_rejected_before_binary_output(self):
        class WrongRest(Engine):
            async def next(self):
                meta, data = await super().next()
                if meta["t"] == "lapp":
                    for row in meta["rutor"]:
                        row["tagning"] = "vila"
                return meta, data
        start = {**START, "karta": [["vila", 0, 42]]}
        socket, engine = Socket(messages(start)), WrongRest()
        with self.assertRaisesRegex(ValueError, "worker_frame_identity_mismatch"):
            await serve(socket, engine, ATTESTATION, {**MAPPING, "vila": 0})
        self.assertTrue(engine.closed)
        self.assertFalse(any(isinstance(item, bytes) for item in socket.sent))

    async def test_missing_chunk_ack_stops_before_next_engine_read(self):
        socket,engine=Socket(messages(),auto_ack=False),Engine()
        with self.assertRaises(TimeoutError):
            await serve(socket,engine,ATTESTATION,MAPPING,idle_seconds=.02)
        self.assertEqual(engine.position,12)
        self.assertTrue(engine.closed)
        self.assertEqual(sum(isinstance(x,bytes) for x in socket.sent),1)
        self.assertFalse(any(isinstance(x,dict) and x.get("t")=="done" for x in socket.sent))

    async def test_chunk_ack_must_match_exact_current_identity_and_keys(self):
        for invalid in [
            {"t":"ack","id":"other","del":0},
            {"t":"ack","id":START["id"],"del":1},
            {"t":"ack","id":START["id"],"del":False},
            {"t":"ack","id":START["id"],"del":0,"extra":True},
        ]:
            class BadAck(Socket):
                async def send(self,value):
                    await super().send(value)
                    if isinstance(value,bytes): self.messages.put_nowait(json.dumps(invalid))
            socket,engine=BadAck(messages(),auto_ack=False),Engine()
            with self.assertRaisesRegex(ValueError,"invalid_chunk_ack"):
                await serve(socket,engine,ATTESTATION,MAPPING,idle_seconds=.05)
            self.assertEqual(engine.position,12)
            self.assertTrue(engine.closed)

    async def test_cancel_while_waiting_for_chunk_ack_stops_engine(self):
        class Cancel(Socket):
            async def send(self,value):
                await super().send(value)
                if isinstance(value,bytes): self.messages.put_nowait(json.dumps({"t":"avbryt","id":START["id"]}))
        socket,engine=Cancel(messages(),auto_ack=False),Engine()
        self.assertEqual(await serve(socket,engine,ATTESTATION,MAPPING,idle_seconds=.05),"cancelled")
        self.assertEqual(engine.position,12)
        self.assertTrue(engine.closed)
        self.assertEqual(socket.sent[-1],{"t":"done","id":START["id"],"aborted":True})

    async def test_delayed_ack_holds_next_chunk_and_stale_ack_is_rejected(self):
        socket,engine=Socket(messages(),auto_ack=False),Engine()
        task=asyncio.create_task(serve(socket,engine,ATTESTATION,MAPPING,idle_seconds=.5))
        try:
            for chunk in range(2):
                while sum(isinstance(x,bytes) for x in socket.sent)<=chunk: await asyncio.sleep(.001)
                await asyncio.sleep(.01)
                self.assertEqual(engine.position,(chunk+1)*12)
                socket.messages.put_nowait(json.dumps({"t":"ack","id":START["id"],"del":0}))
            with self.assertRaisesRegex(ValueError,"invalid_chunk_ack"): await task
            self.assertTrue(engine.closed)
        finally:
            task.cancel()
            await asyncio.gather(task,return_exceptions=True)
