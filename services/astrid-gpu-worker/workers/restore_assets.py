#!/usr/bin/env python3
"""Restore the worker's original avatar bytes from lossless build inputs."""
import argparse
import hashlib
import lzma
from pathlib import Path


# Hashes describe the original runtime files, not a re-encoded approximation.
# The square talk avatar is 1440x1440; the table avatar is 1080x1920.
ASSETS = (
    ("talk_base.png", False, 575074,
     "13cf0e876518918452d06c497e8a183ed1ed117817af1dcb940871e1e535edc5"),
    ("talk_base.yuv", True, 3110400,
     "c699b432f734e410a042e9324debb3062533003b6b87758172b85a7700765106"),
    ("astrid_spel2x/talk_base.png", True, 1628428,
     "eda87f9e877b00dbd2f02479db44ae5f41e2f182563825304906880ceee0088a"),
    ("astrid_spel2x/talk_base.yuv", True, 3110400,
     "a2dd21787472f8f9955cdddca1367d590d427ccbe46908aeacd06fa12c8cb586"),
)


def restore_assets(source, destination):
    """Validate every input before writing the four original runtime paths."""
    restored = []
    for name, compressed, size, digest in ASSETS:
        path = Path(source) / (name + ".xz" if compressed else name)
        if compressed:
            with lzma.open(path, "rb") as stream:
                data = stream.read(size + 1)
        else:
            data = path.read_bytes()
        if len(data) != size or hashlib.sha256(data).hexdigest() != digest:
            raise ValueError(f"Avatar asset integrity mismatch: {name}")
        restored.append((name, data))
    for name, data in restored:
        path = Path(destination) / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    restore_assets(args.source, args.destination)
