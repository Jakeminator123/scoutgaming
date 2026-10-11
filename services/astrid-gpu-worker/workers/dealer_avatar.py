"""Bounded server-owned reference image. No URL fetching or fallback avatar."""
import base64
import hashlib
import json
from pathlib import Path
import re
import shutil
import struct
import subprocess
import tempfile
import zlib

MAX_IMAGE = 8 * 1024 * 1024
WIDTH, HEIGHT = 1080, 1920


def validate_avatar(value):
    if not isinstance(value, dict) or set(value) != {"schemaVersion", "dealerId", "profileRevision", "imageSha256", "imageBase64"}:
        raise ValueError("Invalid dealer avatar")
    if type(value["schemaVersion"]) is not int or value["schemaVersion"] != 1 or not isinstance(value["dealerId"], str) or not re.fullmatch(r"[a-z][a-z0-9-]{0,63}", value["dealerId"]):
        raise ValueError("Invalid dealer avatar")
    for key in ("profileRevision", "imageSha256"):
        if not isinstance(value[key], str) or not re.fullmatch(r"[a-f0-9]{64}", value[key]):
            raise ValueError("Invalid dealer avatar")
    encoded = value["imageBase64"]
    if not isinstance(encoded, str) or len(encoded) > 4 * ((MAX_IMAGE + 2) // 3):
        raise ValueError("Invalid dealer avatar")
    try:
        image = base64.b64decode(encoded, validate=True)
    except (ValueError, TypeError):
        raise ValueError("Invalid dealer avatar") from None
    if not image or len(image) > MAX_IMAGE or base64.b64encode(image).decode() != encoded or hashlib.sha256(image).hexdigest() != value["imageSha256"]:
        raise ValueError("Invalid dealer avatar")
    if image[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError("Invalid dealer image")
    offset, first, data_seen, ended = 8, True, False, False
    while offset + 12 <= len(image):
        size = struct.unpack_from('>I', image, offset)[0]
        kind = image[offset + 4:offset + 8]
        if size > MAX_IMAGE or offset + size + 12 > len(image):
            raise ValueError("Invalid dealer image")
        data = image[offset + 8:offset + 8 + size]
        crc = struct.unpack_from('>I', image, offset + 8 + size)[0]
        if zlib.crc32(kind + data) & 0xffffffff != crc or kind in (b'acTL', b'fcTL', b'fdAT'):
            raise ValueError("Invalid dealer image")
        if first:
            if kind != b'IHDR' or size != 13 or struct.unpack('>IIBBBBB', data) not in (
                    (WIDTH, HEIGHT, 8, 2, 0, 0, 0), (WIDTH, HEIGHT, 8, 6, 0, 0, 0)):
                raise ValueError("Invalid dealer image")
            first = False
        elif kind == b'IHDR':
            raise ValueError("Invalid dealer image")
        if kind == b'IDAT':
            data_seen = True
        offset += size + 12
        if kind == b'IEND':
            ended = size == 0 and offset == len(image) and data_seen
            break
    if not ended:
        raise ValueError("Invalid dealer image")
    binding = {key: value[key] for key in ('dealerId', 'profileRevision', 'imageSha256')}
    return image, {**binding, 'protocolVersion': 3}


def prepare_avatar_assets(value, root='/workspace/avatar', run=subprocess.run):
    image, binding = validate_avatar(value)
    root = Path(root).resolve()
    directory = Path(tempfile.mkdtemp(prefix='dealer-session-', dir=root))
    avatar_id = directory.name
    try:
        source, output = directory / 'talk_base.png', directory / 'talk_base.yuv'
        source.write_bytes(image)
        run(['/usr/bin/ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin',
             '-protocol_whitelist', 'file,pipe', '-threads', '2', '-i', str(source),
             '-frames:v', '1', '-an', '-vf', 'scale=out_color_matrix=bt709:out_range=tv',
             '-pix_fmt', 'yuv420p', '-threads', '2', '-f', 'rawvideo', str(output)],
            check=True, timeout=30, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if output.stat().st_size != WIDTH * HEIGHT * 3 // 2:
            raise ValueError('Invalid dealer image decode')
        (directory / 'binding.json').write_text(json.dumps(binding), encoding='utf8')
        return {'directory': str(directory), 'id': avatar_id, 'binding': binding}
    except BaseException:
        cleanup_avatar_assets({'directory': str(directory), 'id': avatar_id}, root=root)
        raise


def cleanup_avatar_assets(assets, root='/workspace/avatar', cache_root='/workspace/MuseTalk/results/v15/avatars'):
    # Only our exact randomly allocated session directories may be removed.
    name = assets['id']
    directory = Path(assets['directory'])
    if not re.fullmatch(r'dealer-session-[a-z0-9_]{8}', name) or directory.name != name or directory.resolve().parent != Path(root).resolve() or directory.is_symlink():
        raise ValueError('Invalid avatar cleanup path')
    cache = Path(cache_root) / name
    if cache.is_symlink() or cache.resolve().parent != Path(cache_root).resolve():
        raise ValueError('Invalid avatar cleanup path')
    if directory.exists():
        shutil.rmtree(directory)
    if cache.exists():
        shutil.rmtree(cache)
