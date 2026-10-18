import asyncio
import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from session import serve
import diagnostics as diag
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


class WaitingStartSocket(Socket):
    def __init__(self):
        super().__init__([{"t":"bind","attestation":ATTESTATION}])
        self.receives=0
        self.waiting=asyncio.Event()
        self.finished=asyncio.Event()
    async def recv(self):
        self.receives+=1
        start_wait=self.receives==2
        if start_wait: self.waiting.set()
        try:
            value=await super().recv()
            if isinstance(value,Exception): raise value
            return value
        finally:
            if start_wait: self.finished.set()


class FinalGateSocket(Socket):
    def __init__(self, engine, immediate_input=None):
        super().__init__(messages())
        self.engine=engine
        self.final_started=asyncio.Event()
        self.final_released=asyncio.Event()
        self.final_finished=asyncio.Event()
        self.input_seen=asyncio.Event()
        self.immediate_input=immediate_input
        self.closed_before_abort=None
    async def recv(self):
        value=await super().recv()
        if isinstance(value,Exception):
            self.input_seen.set()
            raise value
        if isinstance(value,str) and json.loads(value).get("t")=="avbryt":
            self.input_seen.set()
        return value
    async def send(self,value):
        message=json.loads(value) if isinstance(value,str) else None
        if message and message.get("t")=="done":
            if message.get("aborted"):
                self.closed_before_abort=self.engine.closed
            else:
                self.final_started.set()
                try:
                    if self.immediate_input is not None:
                        self.messages.put_nowait(self.immediate_input)
                    else:
                        await self.final_released.wait()
                finally:
                    self.final_finished.set()
        await super().send(value)


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
    async def test_cancel_of_job_during_final_send_stops_engine_and_both_socket_tasks(self):
        engine=Engine()
        socket=FinalGateSocket(engine)
        task=asyncio.create_task(serve(socket,engine,ATTESTATION,MAPPING,keep_alive_on_complete=True))
        await asyncio.wait_for(socket.final_started.wait(),1)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError): await task
        self.assertTrue(engine.closed)
        self.assertTrue(socket.final_finished.is_set())
        self.assertEqual(len(socket.messages._getters),0)

    async def test_final_recv_result_winning_cancellation_is_checked_before_reuse(self):
        class WonReceive(Socket):
            def __init__(self):
                super().__init__(messages())
                self.done_sent=False
            async def send(self,value):
                if isinstance(value,str) and json.loads(value).get("t")=="done":
                    self.done_sent=True
                await super().send(value)
            async def recv(self):
                try:
                    return await super().recv()
                except asyncio.CancelledError:
                    if self.done_sent:
                        return json.dumps({"t":"avbryt","id":START["id"]})
                    raise
        engine=Engine()
        socket=WonReceive()
        self.assertEqual(await serve(socket,engine,ATTESTATION,MAPPING,keep_alive_on_complete=True),"cancelled")
        self.assertTrue(engine.closed)
        self.assertTrue(socket.sent[-1]["aborted"])
        self.assertEqual(len(socket.messages._getters),0)

    async def test_final_send_timeout_cannot_leave_a_reusable_engine(self):
        engine=Engine()
        socket=FinalGateSocket(engine)
        with self.assertRaises(TimeoutError):
            await serve(socket,engine,ATTESTATION,MAPPING,idle_seconds=.02,keep_alive_on_complete=True)
        self.assertTrue(engine.closed)
        self.assertTrue(socket.final_finished.is_set())
        self.assertEqual(len(socket.messages._getters),0)

    async def test_cancel_during_blocked_final_send_wins_without_releasing_send(self):
        engine=Engine()
        socket=FinalGateSocket(engine)
        task=asyncio.create_task(serve(socket,engine,ATTESTATION,MAPPING,keep_alive_on_complete=True))
        try:
            await asyncio.wait_for(socket.final_started.wait(),1)
            socket.messages.put_nowait(json.dumps({"t":"avbryt","id":START["id"]}))
            await asyncio.wait_for(socket.input_seen.wait(),1)
            self.assertEqual(await asyncio.wait_for(task,1),"cancelled")
            self.assertFalse(socket.final_released.is_set())
            self.assertTrue(socket.final_finished.is_set())
            self.assertTrue(engine.closed)
            self.assertTrue(socket.closed_before_abort)
            self.assertEqual([item for item in socket.sent if isinstance(item,dict) and item.get("t")=="done"],
                             [{"t":"done","id":START["id"],"aborted":True}])
            self.assertEqual(len(socket.messages._getters),0)
        finally:
            task.cancel()
            await asyncio.gather(task,return_exceptions=True)

    async def test_peer_close_during_blocked_final_send_is_not_successful_reuse(self):
        engine=Engine()
        socket=FinalGateSocket(engine)
        task=asyncio.create_task(serve(socket,engine,ATTESTATION,MAPPING,keep_alive_on_complete=True))
        try:
            await asyncio.wait_for(socket.final_started.wait(),1)
            socket.messages.put_nowait(ConnectionError("peer closed during done"))
            with self.assertRaisesRegex(ConnectionError,"peer closed during done"):
                await asyncio.wait_for(task,1)
            self.assertTrue(socket.final_finished.is_set())
            self.assertTrue(engine.closed)
            self.assertFalse(any(isinstance(item,dict) and item.get("t")=="done" for item in socket.sent))
            self.assertEqual(len(socket.messages._getters),0)
        finally:
            task.cancel()
            await asyncio.gather(task,return_exceptions=True)

    async def test_input_accepted_in_same_turn_as_successful_final_send_still_wins(self):
        for value,expected in [(json.dumps({"t":"avbryt","id":START["id"]}),"cancelled"),
                               (ConnectionError("peer closed at done"),ConnectionError),
                               (json.dumps({"t":"avbryt","id":"foreign"}),ValueError)]:
            with self.subTest(expected=expected):
                engine=Engine()
                socket=FinalGateSocket(engine,immediate_input=value)
                if isinstance(expected,str):
                    self.assertEqual(await serve(socket,engine,ATTESTATION,MAPPING,keep_alive_on_complete=True),expected)
                    self.assertTrue(socket.closed_before_abort)
                else:
                    with self.assertRaises(expected):
                        await serve(socket,engine,ATTESTATION,MAPPING,keep_alive_on_complete=True)
                self.assertTrue(engine.closed)
                self.assertTrue(socket.final_finished.is_set())
                self.assertEqual(len(socket.messages._getters),0)

    async def test_reusable_completion_does_not_close_but_cleans_pending_socket_read(self):
        socket,engine=Socket(messages()),Engine()
        self.assertEqual(await serve(socket,engine,ATTESTATION,MAPPING,keep_alive_on_complete=True),"complete")
        self.assertFalse(engine.closed)
        self.assertEqual(socket.sent[-1]["t"],"done")
        self.assertEqual(len(socket.messages._getters),0)

    async def test_reusable_final_send_failure_hard_stops_model(self):
        class FailedDone(Socket):
            async def send(self,value):
                if isinstance(value,str) and json.loads(value).get("t")=="done":
                    raise OSError("failed final delivery")
                await super().send(value)
        socket,engine=FailedDone(messages()),Engine()
        with self.assertRaises(OSError):
            await serve(socket,engine,ATTESTATION,MAPPING,keep_alive_on_complete=True)
        self.assertTrue(engine.closed)
        self.assertEqual(len(socket.messages._getters),0)

    async def test_reusable_missing_ack_and_low_current_readiness_hard_stop(self):
        socket,engine=Socket(messages(),auto_ack=False),Engine()
        with self.assertRaises(TimeoutError):
            await serve(socket,engine,ATTESTATION,MAPPING,idle_seconds=.02,keep_alive_on_complete=True)
        self.assertTrue(engine.closed)
        engine=Engine(speed=29)
        with self.assertRaisesRegex(ValueError,"worker_below_realtime_limit"):
            await serve(Socket(messages()),engine,ATTESTATION,MAPPING,keep_alive_on_complete=True)
        self.assertTrue(engine.closed)
        self.assertFalse(engine.started)

    async def test_reusable_cancel_kills_before_abort_ack(self):
        socket,engine=Socket(messages()),Engine(stall=True)
        task=asyncio.create_task(serve(socket,engine,ATTESTATION,MAPPING,keep_alive_on_complete=True))
        while not engine.started:
            await asyncio.sleep(0)
        await socket.messages.put(json.dumps({"t":"avbryt","id":START["id"]}))
        self.assertEqual(await asyncio.wait_for(task,1),"cancelled")
        self.assertTrue(engine.closed)
        self.assertTrue(socket.sent[-1]["aborted"])

    async def test_diagnostics_count_actual_delivery_and_ack_without_protocol_extensions(self):
        socket,engine=Socket(messages()),Engine()
        with diag.collect() as collector:
            self.assertEqual(await serve(socket,engine,ATTESTATION,MAPPING),"complete")
            snapshot=collector.snapshot()
        self.assertEqual((snapshot["sentFrames"],snapshot["sentChunks"],snapshot["encodedBytes"]),(42,4,16))
        self.assertEqual(snapshot["warmupFps"],45.9)
        for key in ("bindWaitMs","startWaitMs","pcmReceiveMs","renderWallMs","receivedFirstChunkMs","chunkAckWaitMs","chunkSendMs","engineStopMs"):
            self.assertGreaterEqual(snapshot[key],0,key)
        self.assertNotIn("diagnostics",json.dumps([m for m in socket.sent if isinstance(m,dict)]))
        self.assertTrue(engine.closed)

    async def test_failed_ack_records_elapsed_failure_and_preserves_cleanup(self):
        socket,engine=Socket(messages(),auto_ack=False),Engine()
        with diag.collect() as collector:
            with self.assertRaises(TimeoutError):
                await serve(socket,engine,ATTESTATION,MAPPING,idle_seconds=.02)
            snapshot=collector.snapshot()
        self.assertEqual(snapshot["firstFailedPhase"],"chunkAckWaitMs")
        self.assertEqual(snapshot["sentFrames"],12)
        self.assertEqual(snapshot["sentChunks"],1)
        self.assertGreaterEqual(snapshot["chunkAckWaitMs"],15)
        self.assertTrue(engine.closed)

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

    async def test_start_after_old_idle_deadline_within_start_budget_completes(self):
        socket,engine=WaitingStartSocket(),Engine()
        task=asyncio.create_task(serve(socket,engine,ATTESTATION,MAPPING,
                                       idle_seconds=.05,start_seconds=.5))
        try:
            await asyncio.wait_for(socket.waiting.wait(),1)
            await asyncio.sleep(.1)
            self.assertFalse(task.done())
            self.assertFalse(engine.started)
            for item in messages()[1:]:
                socket.messages.put_nowait(json.dumps(item) if isinstance(item,dict) else item)
            self.assertEqual(await asyncio.wait_for(task,1),"complete")
            self.assertTrue(engine.closed)
        finally:
            task.cancel()
            await asyncio.gather(task,return_exceptions=True)

    async def test_missing_start_uses_separate_bounded_wait_and_closes_engine(self):
        socket,engine=WaitingStartSocket(),Engine()
        loop=asyncio.get_running_loop()
        began=loop.time()
        async with asyncio.timeout(1):
            with self.assertRaises(TimeoutError):
                await serve(socket,engine,ATTESTATION,MAPPING,
                            idle_seconds=.02,start_seconds=.08)
        self.assertGreaterEqual(loop.time()-began,.08)
        self.assertTrue(socket.finished.is_set())
        self.assertFalse(engine.started)
        self.assertTrue(engine.closed)
        self.assertEqual([item["t"] for item in socket.sent],["pong"])

    async def test_disconnect_during_start_wait_closes_engine_without_success(self):
        socket,engine=WaitingStartSocket(),Engine()
        task=asyncio.create_task(serve(socket,engine,ATTESTATION,MAPPING,start_seconds=.5))
        try:
            await asyncio.wait_for(socket.waiting.wait(),1)
            socket.messages.put_nowait(ConnectionError("closed"))
            with self.assertRaises(ConnectionError): await task
            self.assertTrue(socket.finished.is_set())
            self.assertFalse(engine.started)
            self.assertTrue(engine.closed)
            self.assertEqual([item["t"] for item in socket.sent],["pong"])
        finally:
            task.cancel()
            await asyncio.gather(task,return_exceptions=True)

    async def test_abort_during_start_wait_cancels_receive_and_closes_engine(self):
        socket,engine=WaitingStartSocket(),Engine()
        task=asyncio.create_task(serve(socket,engine,ATTESTATION,MAPPING,start_seconds=.5))
        try:
            await asyncio.wait_for(socket.waiting.wait(),1)
            task.cancel()
            with self.assertRaises(asyncio.CancelledError): await task
            self.assertTrue(socket.finished.is_set())
            self.assertFalse(engine.started)
            self.assertTrue(engine.closed)
            self.assertEqual([item["t"] for item in socket.sent],["pong"])
        finally:
            task.cancel()
            await asyncio.gather(task,return_exceptions=True)

    async def test_enclosing_job_deadline_still_caps_start_wait(self):
        socket,engine=WaitingStartSocket(),Engine()
        with self.assertRaises(TimeoutError):
            async with asyncio.timeout(.02):
                await serve(socket,engine,ATTESTATION,MAPPING,start_seconds=.5)
        self.assertTrue(socket.finished.is_set())
        self.assertFalse(engine.started)
        self.assertTrue(engine.closed)

    async def test_start_budget_does_not_extend_bind_or_pcm_idle_wait(self):
        for pending in [[],messages()[:2]]:
            socket,engine=Socket(pending),Engine()
            async with asyncio.timeout(.5):
                with self.assertRaises(TimeoutError):
                    await serve(socket,engine,ATTESTATION,MAPPING,
                                idle_seconds=.02,start_seconds=1)
            self.assertFalse(engine.started)
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
