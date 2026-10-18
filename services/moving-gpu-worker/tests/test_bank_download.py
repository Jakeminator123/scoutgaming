import asyncio
import copy
import hashlib
from pathlib import Path
import shutil
import ssl
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import AsyncMock, Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bank_download as download
import entrypoint
from contracts import validate_job
from test_contracts import binding, job, H


class DownloadContracts(unittest.TestCase):
    def test_job_requires_exact_same_origin_sizes_and_bound_hashes(self):
        bank = {"schemaVersion": 1,
                "archive": {"url": "https://engine.example/bank/archive?cap=one", "bytes": 594432000, "sha256": H},
                "receipt": {"url": "https://engine.example/bank/receipt?cap=two", "bytes": 1045, "sha256": H}}
        valid = {**job(), "bankDownload": bank}
        self.assertEqual(validate_job(valid, H, "https://engine.example", "job-1")["jobId"], "job-1")
        bad = []
        for field, value in [("url", "http://engine.example/bank"), ("url", "https://other.example/bank"),
                             ("url", "https://engine.example:444/bank"), ("url", "https://engine.example:0/bank"), ("url", "https://user@engine.example/bank"),
                             ("url", "https://engine.example/bank#fragment"), ("url", "https://engine.example/bank\r\nX: 1"),
                             ("sha256", "b" * 64), ("bytes", 0), ("bytes", True), ("bytes", 1024 ** 3 + 1)]:
            changed = copy.deepcopy(valid)
            changed["bankDownload"]["archive"][field] = value
            bad.append(changed)
        for altered in bad:
            with self.assertRaises(ValueError):
                validate_job(altered, H, "https://engine.example", "job-1")

    def test_cached_corruption_is_preserved_and_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bank.tar"
            path.write_bytes(b"wrong")
            with self.assertRaisesRegex(ValueError, "bank_cache_conflict"):
                download._cached(path, {"bytes": 5, "sha256": hashlib.sha256(b"right").hexdigest()})
            self.assertEqual(path.read_bytes(), b"wrong")


class BankTLS(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        executable = shutil.which("openssl")
        if not executable:
            raise unittest.SkipTest("openssl is required for local TLS fixtures; present in the locked image")
        cls.certificates = tempfile.TemporaryDirectory()
        cls.cert = Path(cls.certificates.name) / "cert.pem"
        cls.key = Path(cls.certificates.name) / "key.pem"
        result = subprocess.run([executable, "req", "-x509", "-newkey", "rsa:2048", "-nodes",
                                 "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1",
                                 "-keyout", str(cls.key), "-out", str(cls.cert)],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15)
        if result.returncode:
            raise RuntimeError("TLS fixture creation failed")
        cls.server_tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        cls.server_tls.load_cert_chain(cls.cert, cls.key)
        cls.client_tls = ssl.create_default_context(cafile=str(cls.cert))

    @classmethod
    def tearDownClass(cls):
        cls.certificates.cleanup()

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.cache = Path(self.directory.name) / "cache"
        self.archive = bytes(range(256)) * 513
        self.receipt = b'{"status":"prepared"}'
        self.calls = []
        self.mode = "ok"
        self.tasks = set()
        self.body_started, self.resume = asyncio.Event(), asyncio.Event()
        self.server = await asyncio.start_server(self.respond, "127.0.0.1", 0, ssl=self.server_tls)
        self.port = self.server.sockets[0].getsockname()[1]
        self.callback = "wss://127.0.0.1:" + str(self.port) + "/lipsync-moving/" + "1" * 48
        self.binding = binding()
        self.descriptor = {"schemaVersion": 1}
        for name, data, key in (("archive", self.archive, "avatarSha256"),
                                ("receipt", self.receipt, "bankReceiptSha256")):
            sha = hashlib.sha256(data).hexdigest()
            self.binding[key] = sha
            self.descriptor[name] = {"url": "https://127.0.0.1:" + str(self.port) + "/" + name + "?cap=private",
                                     "sha256": sha, "bytes": len(data)}

    async def asyncTearDown(self):
        self.resume.set()
        self.server.close()
        await self.server.wait_closed()
        if self.tasks:
            await asyncio.gather(*list(self.tasks), return_exceptions=True)
        self.directory.cleanup()

    async def respond(self, reader, writer):
        task = asyncio.current_task()
        self.tasks.add(task)
        try:
            request = await reader.readuntil(b"\r\n\r\n")
            path = request.split(b" ")[1].split(b"?")[0].decode()
            self.calls.append(path)
            data = self.archive if path == "/archive" else self.receipt
            status = "200 OK"
            version = "HTTP/1.1"
            headers = "Content-Length: " + str(len(data)) + "\r\n"
            if path == "/archive":
                if self.mode == "redirect":
                    status, headers = "302 Found", "Location: https://other.example/bank\r\n"
                elif self.mode == "wrong_length":
                    headers = "Content-Length: 9999999999\r\n"
                elif self.mode == "duplicate_length":
                    headers += "Content-Length: " + str(len(data)) + "\r\n"
                elif self.mode == "chunked":
                    headers += "Transfer-Encoding: chunked\r\n"
                elif self.mode == "encoded":
                    headers += "Content-Encoding: gzip\r\n"
                elif self.mode == "truncated":
                    data = data[:-1]
                elif self.mode == "corrupt":
                    data = b"x" + data[1:]
                elif self.mode == "overflow":
                    data += b"extra"
            if self.mode.startswith("chunked_"):
                headers = "Transfer-Encoding: ChUnKeD\r\n"
                extension, trailers = b"", b""
                chunk_size = len(data) if self.mode == "chunked_large" else 32768
                if self.mode == "chunked_metadata":
                    extension = b'; unknown="ignored; value"; other=opaque'
                    trailers = b"X-Note: ignored\r\n"
                if path == "/archive":
                    if self.mode == "chunked_corrupt":
                        data = b"x" + data[1:]
                    elif self.mode == "chunked_short":
                        data = data[:-1]
                    elif self.mode == "chunked_overflow":
                        data += b"extra"
                    elif self.mode == "chunked_duplicate":
                        headers += "Transfer-Encoding: chunked\r\n"
                    elif self.mode == "chunked_encoding":
                        headers += "Content-Encoding: gzip\r\n"
                    elif self.mode == "chunked_chain":
                        headers = "Transfer-Encoding: gzip, chunked\r\n"
                    elif self.mode == "chunked_http10":
                        version = "HTTP/1.0"
                    elif self.mode == "chunked_long_extension":
                        extension = b";" + b"x" * 8192
                    elif self.mode == "chunked_framing_trailer":
                        trailers = b"Content-Length: 1\r\n"
                    elif self.mode == "chunked_long_trailers":
                        trailers = (b"X-Note: " + b"x" * 4000 + b"\r\n") * 9
                    elif self.mode == "chunked_bad_trailer":
                        trailers = b"not a header\r\n"
                data = b"".join(format(len(data[i:i + chunk_size]), "x").encode() + extension + b"\r\n"
                                + data[i:i + chunk_size] + b"\r\n"
                                for i in range(0, len(data), chunk_size)) + b"0\r\n" + trailers + b"\r\n"
                if path == "/archive":
                    if self.mode == "chunked_bad_size":
                        data = b"not-hex\r\n"
                    elif self.mode == "chunked_signed_size":
                        data = b"+20\r\n"
                    elif self.mode == "chunked_huge_size":
                        data = b"F" * 100 + b"\r\n"
                    elif self.mode == "chunked_bad_delimiter":
                        prefix = data.index(b"\r\n") + 2 + chunk_size
                        data = data[:prefix] + b"XX" + data[prefix + 2:]
                    elif self.mode == "chunked_truncated":
                        data = data[:-8]
                    elif self.mode == "chunked_missing_end":
                        data = data[:-5]
            writer.write((version + " " + status + "\r\n" + headers + "Connection: close\r\n\r\n").encode())
            if self.mode in ("stall", "chunked_stall", "chunked_line_stall", "chunked_trailer_stall") and path == "/archive":
                partial = data[:1]
                if self.mode == "chunked_stall":
                    partial = data[:data.index(b"\r\n") + 3]
                elif self.mode == "chunked_trailer_stall":
                    partial = data[:-2]
                writer.write(partial)
                await writer.drain()
                self.body_started.set()
                await self.resume.wait()
            else:
                writer.write(data)
                await writer.drain()
        except (ConnectionError, asyncio.IncompleteReadError):
            pass
        finally:
            writer.close()
            try:
                await asyncio.wait_for(writer.wait_closed(), 1)
            except (ConnectionError, TimeoutError):
                writer.transport.abort()
            self.tasks.discard(task)

    async def fetch(self):
        return await download.fetch_bank_download(self.descriptor, self.callback, self.binding,
                                                   cache_root=self.cache, tls=self.client_tls)

    async def test_exact_tls_stream_and_verified_cache_reuse(self):
        self.assertEqual(await self.fetch(), self.cache)
        self.assertEqual(self.calls, ["/receipt", "/archive"])
        self.assertEqual((self.cache / (self.binding["avatarSha256"] + ".tar")).read_bytes(), self.archive)
        await self.fetch()
        self.assertEqual(self.calls, ["/receipt", "/archive"])
        self.assertEqual(len(list(self.cache.iterdir())), 2)

    async def test_chunked_receipt_and_archive_keep_exact_bytes_and_hashes(self):
        for mode in ("chunked_valid", "chunked_metadata", "chunked_large"):
            with self.subTest(mode=mode):
                self.mode = mode
                self.cache = Path(self.directory.name) / mode
                self.calls.clear()
                self.assertEqual(await self.fetch(), self.cache)
                self.assertEqual(self.calls, ["/receipt", "/archive"])
                for kind, suffix, data in (("receipt", ".json", self.receipt), ("archive", ".tar", self.archive)):
                    self.assertEqual((self.cache / (self.descriptor[kind]["sha256"] + suffix)).read_bytes(), data)
                await self.fetch()
                self.assertEqual(self.calls, ["/receipt", "/archive"])

    async def test_invalid_chunked_framing_size_and_hash_leave_no_archive_or_partial_file(self):
        for mode in ("chunked_bad_size", "chunked_signed_size", "chunked_huge_size", "chunked_bad_delimiter",
                     "chunked_truncated", "chunked_missing_end", "chunked_corrupt", "chunked_short", "chunked_overflow",
                     "chunked_duplicate", "chunked_encoding", "chunked_chain", "chunked_http10",
                     "chunked_long_extension", "chunked_framing_trailer", "chunked_long_trailers", "chunked_bad_trailer"):
            with self.subTest(mode=mode):
                self.mode = mode
                with self.assertRaises(ValueError):
                    await self.fetch()
                self.assertFalse((self.cache / (self.binding["avatarSha256"] + ".tar")).exists())
                self.assertFalse(list(self.cache.glob("*.part")))

    async def test_redirect_bad_lengths_encoding_and_hash_fail_without_archive_cache(self):
        for mode in ("redirect", "wrong_length", "duplicate_length", "chunked", "encoded", "truncated", "corrupt", "overflow"):
            with self.subTest(mode=mode):
                self.mode = mode
                with self.assertRaises(ValueError):
                    await self.fetch()
                self.assertFalse((self.cache / (self.binding["avatarSha256"] + ".tar")).exists())
                self.assertFalse(list(self.cache.glob("*.part")))
        self.assertTrue(all(path in ("/receipt", "/archive") for path in self.calls))

    async def test_corrupted_cache_is_not_silently_replaced(self):
        await self.fetch()
        archive = self.cache / (self.binding["avatarSha256"] + ".tar")
        archive.write_bytes(b"x" * len(self.archive))
        with self.assertRaisesRegex(ValueError, "bank_cache_conflict"):
            await self.fetch()
        self.assertEqual(self.calls, ["/receipt", "/archive"])
        self.assertEqual(archive.read_bytes(), b"x" * len(self.archive))

    async def test_timeout_and_cancel_remove_only_their_partial_download(self):
        for mode in ("stall", "chunked_stall", "chunked_line_stall", "chunked_trailer_stall"):
            for cancel in (False, True):
                with self.subTest(mode=mode, cancel=cancel):
                    self.mode = mode
                    self.body_started.clear()
                    with patch.object(download, "DOWNLOAD_SECONDS", .5):
                        task = asyncio.create_task(self.fetch())
                        await asyncio.wait_for(self.body_started.wait(), 2)
                        if cancel:
                            task.cancel()
                        with self.assertRaises(asyncio.CancelledError if cancel else TimeoutError):
                            await task
                    self.assertFalse(list(self.cache.glob("*.part")))
                    self.assertFalse((self.cache / (self.binding["avatarSha256"] + ".tar")).exists())
                    self.resume.set()
                    await asyncio.gather(*list(self.tasks), return_exceptions=True)
                    self.resume.clear()

    async def test_unverified_tls_context_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "invalid_bank_tls"):
            await download.fetch_bank_download(self.descriptor, self.callback, self.binding,
                                                cache_root=self.cache, tls=ssl._create_unverified_context())
        self.assertEqual(self.calls, [])

    async def test_download_is_followed_by_existing_bank_verification_before_models(self):
        valid = {**job(), "bankDownload": {**self.descriptor}}
        # This integration isolates the handoff; actual descriptor/TLS behavior is tested above.
        fetch = AsyncMock(return_value=self.cache)
        verifier = Mock(side_effect=ValueError("bank_bytes_changed"))
        with patch.object(entrypoint, "verify_release", return_value=H), \
             patch.object(entrypoint, "validate_job", return_value={}), \
             patch.object(entrypoint, "fetch_bank_download", fetch), \
             patch.object(entrypoint, "verify_bank", verifier), \
             patch.object(entrypoint, "verify_models") as models, \
             patch.object(entrypoint, "ProcessEngine") as engine:
            with self.assertRaisesRegex(ValueError, "bank_bytes_changed"):
                await entrypoint.run({"id": "job-1", "input": valid}, "/unused", "https://engine.example")
        fetch.assert_awaited_once()
        self.assertEqual(verifier.call_args.args[0], self.cache / (H + ".tar"))
        models.assert_not_called()
        engine.assert_not_called()
