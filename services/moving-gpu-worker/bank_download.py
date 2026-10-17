"""Fetch a job-bound bank capability; no storage keys, proxies or redirects."""
import asyncio
import hashlib
import os
from pathlib import Path
import re
import ssl
import stat
import tempfile
from urllib.parse import urlsplit
from uuid import uuid4

MAX_ARCHIVE_BYTES = 1024 ** 3
MAX_RECEIPT_BYTES = 128 * 1024
DOWNLOAD_SECONDS = 60
IO_SECONDS = 15
CACHE_ROOT = Path(tempfile.gettempdir()) / "croupier-moving-banks"


def validate_bank_download(descriptor, callback_url, binding):
    if (not isinstance(descriptor, dict) or set(descriptor) != {"schemaVersion", "archive", "receipt"}
            or type(descriptor["schemaVersion"]) is not int or descriptor["schemaVersion"] != 1):
        raise ValueError("invalid_bank_download")
    callback = urlsplit(callback_url)
    callback_port = 443 if callback.port is None else callback.port
    for kind, key, limit in (("archive", "avatarSha256", MAX_ARCHIVE_BYTES),
                              ("receipt", "bankReceiptSha256", MAX_RECEIPT_BYTES)):
        item = descriptor[kind]
        if (not isinstance(item, dict) or set(item) != {"url", "sha256", "bytes"}
                or not isinstance(item["sha256"], str) or not re.fullmatch(r"[a-f0-9]{64}", item["sha256"])
                or item["sha256"] != binding[key]
                or type(item["bytes"]) is not int or not 0 < item["bytes"] <= limit
                or not isinstance(item["url"], str) or not 1 <= len(item["url"]) <= 4096
                or any(ord(c) < 33 or ord(c) > 126 for c in item["url"])):
            raise ValueError("invalid_bank_download")
        url = urlsplit(item["url"])
        port = 443 if url.port is None else url.port
        if (callback.scheme != "wss" or not callback.hostname or callback.username or callback.password
                or url.scheme != "https" or url.hostname != callback.hostname
                or not 1 <= port <= 65535 or port != callback_port
                or url.username or url.password or url.fragment or not url.path.startswith("/")):
            raise ValueError("invalid_bank_origin")
    return descriptor


def _cached(path, item):
    try:
        info = path.lstat()
    except FileNotFoundError:
        return False
    if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size != item["bytes"]:
        raise ValueError("bank_cache_conflict")
    with path.open("rb") as source:
        actual = hashlib.file_digest(source, "sha256").hexdigest()
    if actual != item["sha256"]:
        raise ValueError("bank_cache_conflict")
    return True


def _cache_directory(root):
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    info = root.lstat()
    if not stat.S_ISDIR(info.st_mode) or (os.name == "posix" and
            (info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) & 0o077)):
        raise ValueError("invalid_bank_cache")


async def _download(item, target, tls):
    url = urlsplit(item["url"])
    part = target.with_name("." + target.name + "." + uuid4().hex + ".part")
    writer = None
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(
            url.hostname, url.port or 443, ssl=tls, server_hostname=url.hostname,
            ssl_handshake_timeout=IO_SECONDS, limit=32768), IO_SECONDS)
        request_path = url.path + ("?" + url.query if url.query else "")
        request = ("GET " + request_path + " HTTP/1.1\r\nHost: " + url.netloc
                   + "\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n")
        writer.write(request.encode("ascii"))
        await asyncio.wait_for(writer.drain(), IO_SECONDS)
        raw = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), IO_SECONDS)
        lines = raw.decode("iso-8859-1").split("\r\n")
        if not re.fullmatch(r"HTTP/1[.][01] 200(?: .*)?", lines[0]):
            raise ValueError("bank_http_rejected")
        headers = {}
        for line in lines[1:-2]:
            name, separator, value = line.partition(":")
            name = name.lower()
            if not separator or not re.fullmatch(r"[a-z0-9!#$%&'*+.^_`|~-]+", name) or (name in headers and name in {"content-length", "transfer-encoding", "content-encoding"}):
                raise ValueError("bank_http_rejected")
            headers[name] = value.strip()
        if ("transfer-encoding" in headers or "content-encoding" in headers
                or headers.get("content-length") != str(item["bytes"])):
            raise ValueError("bank_length_mismatch")
        count, sha256 = 0, hashlib.sha256()
        with part.open("xb") as output:
            os.chmod(part, 0o600)
            while True:
                data = await asyncio.wait_for(reader.read(min(65536, item["bytes"] - count + 1)), IO_SECONDS)
                if not data:
                    break
                count += len(data)
                if count > item["bytes"]:
                    raise ValueError("bank_length_mismatch")
                sha256.update(data)
                output.write(data)
        if count != item["bytes"] or sha256.hexdigest() != item["sha256"]:
            raise ValueError("bank_bytes_changed")
        # Link is atomic and never overwrites an existing cache entry.
        try:
            os.link(part, target)
        except FileExistsError:
            _cached(target, item)
    finally:
        part.unlink(missing_ok=True)
        if writer is not None:
            writer.close()
            try:
                await asyncio.wait_for(writer.wait_closed(), 1)
            except asyncio.CancelledError:
                writer.transport.abort()
                raise
            except Exception:
                writer.transport.abort()


async def fetch_bank_download(descriptor, callback_url, binding, *, cache_root=CACHE_ROOT, tls=None):
    """Return a hash-addressed ephemeral store; every cache hit is reverified."""
    validate_bank_download(descriptor, callback_url, binding)
    root = Path(cache_root)
    _cache_directory(root)
    tls = tls or ssl.create_default_context()
    if not tls.check_hostname or tls.verify_mode != ssl.CERT_REQUIRED:
        raise ValueError("invalid_bank_tls")
    async with asyncio.timeout(DOWNLOAD_SECONDS):
        for kind, suffix in (("receipt", ".json"), ("archive", ".tar")):
            item = descriptor[kind]
            target = root / (item["sha256"] + suffix)
            if not _cached(target, item):
                await _download(item, target, tls)
    return root
