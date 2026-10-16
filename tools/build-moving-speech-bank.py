#!/usr/bin/env python3
"""Build Emil-compatible takes/pool from verified registry sources.

Default: CPU pool only. --prepare-with points to a reviewed worker/ directory
with rorlig.py and installed model dependencies. No network or GPU service is
started by this script. Originals are read-only; output must not exist.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tarfile


def digest(path):
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def read_sources(directory):
    manifest = json.loads((directory / "sources.json").read_text(encoding="utf-8"))
    required = {"schemaVersion", "dealerId", "workerAvatar", "clips", "rest", "sourceSetSha256"}
    if set(manifest) != required or manifest["schemaVersion"] != 1:
        raise ValueError("moving_bank_invalid_sources")
    identity = re.compile(r"[a-z][a-z0-9-]{0,39}")
    if any(not isinstance(manifest[k], str) or not identity.fullmatch(manifest[k]) for k in ("dealerId", "workerAvatar")):
        raise ValueError("moving_bank_invalid_identity")
    clips = manifest["clips"]
    if not isinstance(clips, list) or not 1 <= len(clips) <= 128:
        raise ValueError("moving_bank_invalid_sources")
    seen = set()
    for clip in clips:
        video_id = clip.get("videoId", "")
        if (set(clip) != {"videoId", "take", "sha256", "bytes", "fps", "frameCount", "width", "height"}
                or not re.fullmatch(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", video_id)
                or video_id in seen or clip["take"] != "clip-" + video_id
                or clip["fps"] != 24 or [clip["width"], clip["height"]] != [1080, 1920]
                or type(clip["frameCount"]) is not int or not 1 <= clip["frameCount"] <= 600
                or type(clip["bytes"]) is not int or not 1 <= clip["bytes"] <= 256 * 1024 * 1024
                or not re.fullmatch(r"[a-f0-9]{64}", clip["sha256"])):
            raise ValueError("moving_bank_invalid_source")
        seen.add(video_id)
        file = directory / "sources" / (video_id + ".mp4")
        if file.is_symlink() or not file.is_file() or file.stat().st_size != clip["bytes"] or digest(file) != clip["sha256"]:
            raise ValueError("moving_bank_source_changed")
    if clips != sorted(clips, key=lambda c: c["videoId"]):
        raise ValueError("moving_bank_sources_changed")
    rest = manifest["rest"]
    resting = next((c for c in clips if c["videoId"] == rest.get("videoId")), None)
    if (set(rest) != {"videoId", "frame"} or type(rest["frame"]) is not int
            or not resting or not 0 <= rest["frame"] < resting["frameCount"]):
        raise ValueError("moving_bank_invalid_rest")
    # Rebuild JS's stable key order; JSON whitespace is not an identity.
    payload = {k: manifest[k] for k in ("schemaVersion", "dealerId", "workerAvatar", "clips", "rest")}
    if hashlib.sha256(canonical(payload).encode()).hexdigest() != manifest["sourceSetSha256"]:
        raise ValueError("moving_bank_sources_changed")
    return manifest


def build(directory, output, ffmpeg="ffmpeg", prepare_with=None):
    source = read_sources(directory)
    output.mkdir()  # Never overwrite an earlier bank, source or calibrated take.
    bank = output / source["workerAvatar"]
    bank.mkdir()
    raw = bank / "pool.yuv"
    takes, seen, segments = {}, {}, []
    frame_size = 1080 * 1920 * 3 // 2
    with raw.open("xb") as pool:
        for clip in source["clips"]:
            path = directory / "sources" / (clip["videoId"] + ".mp4")
            args = [ffmpeg, "-v", "error", "-nostdin", "-protocol_whitelist", "file,pipe",
                    "-format_whitelist", "mov", "-i", str(path), "-map", "0:v:0",
                    "-an", "-sn", "-dn", "-threads", "2", "-fps_mode", "passthrough",
                    "-f", "rawvideo", "-pix_fmt", "yuv420p", "pipe:1"]
            indices, consecutive = [], False
            process = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                       stderr=subprocess.DEVNULL)
            try:
                while True:
                    frame = process.stdout.read(frame_size)
                    if not frame:
                        break
                    if len(frame) != frame_size or len(indices) >= clip["frameCount"]:
                        raise ValueError("moving_bank_decoded_frame_mismatch")
                    key = hashlib.sha256(frame).digest()
                    index = seen.get(key)
                    if index is None:
                        index = len(seen)
                        seen[key] = index
                        pool.write(frame)
                        if consecutive:
                            segments[-1] += 1
                        else:
                            segments.append(1)
                        consecutive = True
                    else:
                        consecutive = False
                    indices.append(index)
                if process.wait(timeout=60) or len(indices) != clip["frameCount"]:
                    raise ValueError("moving_bank_decode_failed")
            finally:
                process.stdout.close()
                if process.poll() is None:
                    process.kill()
                    process.wait()
            takes[clip["take"]] = indices
    subprocess.run([ffmpeg, "-v", "error", "-nostdin", "-n", "-f", "rawvideo",
                    "-pix_fmt", "yuv420p", "-s", "1080x1920", "-r", "24", "-i", str(raw),
                    "-c:v", "libx264", "-preset", "medium", "-crf", "0", "-threads", "4",
                    "-pix_fmt", "yuv420p", str(bank / "pool.mp4")], check=True,
                   stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    raw.unlink()  # This exact newly created intermediate, never a source file.
    rest_take = "clip-" + source["rest"]["videoId"]
    mapping = {"dealer": source["workerAvatar"], "fps": 24, "size": [1080, 1920],
               "pool": len(seen), "vila": takes[rest_take][source["rest"]["frame"]],
               "vila_from": rest_take, "segs": segments, "takes": takes,
               "deduplication": "sha256-full-decoded-yuv420p", "sourceSetSha256": source["sourceSetSha256"]}
    (bank / "takes.json").write_text(canonical(mapping), encoding="utf-8")
    (bank / "sources.json").write_text(canonical(source), encoding="utf-8")
    receipt = {"status": "pool-only", "dealerId": source["dealerId"],
               "workerAvatar": source["workerAvatar"], "sourceSetSha256": source["sourceSetSha256"],
               "clips": len(takes), "poolFrames": len(seen), "visualApproval": False}
    if prepare_with:
        # Reuse Emil's inference/preparation implementation from the explicitly
        # selected reviewed checkout. Do not vendor models or run arbitrary TARs.
        sys.path.insert(0, str(prepare_with.resolve()))
        import rorlig
        rorlig.forbered(str(bank / "pool.mp4"), sigma=1.0, cheek=90,
                        out=str(bank / "prep"), segs=segments)
        meta = json.loads((bank / "prep" / "meta.json").read_text())
        if meta.get("frames") != len(seen) or meta.get("size") != [1080, 1920] or meta.get("missing") != 0:
            raise ValueError("moving_bank_preparation_incomplete")
        files = ["pool.mp4", "takes.json", "sources.json", "prep/meta.json",
                 "prep/latents.pt", "prep/masks.npz", "prep/bias.npz"]
        for name in files:
            if (bank / name).is_symlink() or not (bank / name).is_file() or not (bank / name).stat().st_size:
                raise ValueError("moving_bank_preparation_incomplete")
        archive = output / (source["workerAvatar"] + ".tar")
        with tarfile.open(archive, "x") as tar:
            for name in files:
                tar.add(bank / name, arcname=source["workerAvatar"] + "/" + name, recursive=False)
        receipt.update(status="prepared", avatarSha256=digest(archive),
                       files={name: digest(bank / name) for name in files})
    (output / "bank-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--prepare-with", type=Path)
    args = parser.parse_args()
    result = build(args.sources.resolve(), args.output.resolve(), args.ffmpeg, args.prepare_with)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
